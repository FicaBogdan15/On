using System.Collections.Concurrent;
using GameServer.Models;

namespace GameServer.Services;

public sealed record JoinOutcome(bool Ok, string? Error, Lobby? Lobby = null, PlayerState? Player = null, string? ReplacedConnectionId = null)
{
    public static JoinOutcome Fail(string error) => new(false, error);
}

/// <summary>Owns lobby membership: room codes, joining, reconnect tokens and connection mapping.</summary>
public sealed class LobbyService(IRandomSource rng, IGameNotifier notifier, ILogger<LobbyService> log)
{
    public const int MaxPlayers = 8;
    public const int DefaultMinPlayers = 2;
    public const int MaxNameLength = 16;

    /// <summary>No O/0 or I/1/L to keep room codes easy to read aloud.</summary>
    public const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    private sealed record ConnectionRef(string Code, string PlayerId);

    private readonly ConcurrentDictionary<string, Lobby> _lobbies = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, ConnectionRef> _connections = new();

    public IEnumerable<Lobby> All => _lobbies.Values;

    public Lobby? Find(string code) => _lobbies.TryGetValue(NormalizeCode(code), out var l) ? l : null;

    public static string NormalizeCode(string? code) => (code ?? "").Trim().ToUpperInvariant();

    public static string? ValidateName(string? raw, out string name)
    {
        name = new string((raw ?? "").Where(c => !char.IsControl(c)).ToArray()).Trim();
        if (name.Length == 0) return "Pick a name first!";
        if (name.Length > MaxNameLength) return $"Names can be at most {MaxNameLength} characters.";
        return null;
    }

    private static string? ValidateToken(string? token) =>
        string.IsNullOrWhiteSpace(token) || token.Length is < 16 or > 64 ? "Invalid session. Please refresh the page." : null;

    public string GenerateCode()
    {
        for (var attempt = 0; ; attempt++)
        {
            var length = attempt < 50 ? 4 : attempt < 200 ? 5 : 6;
            var code = new string(Enumerable.Range(0, length).Select(_ => CodeAlphabet[rng.Next(0, CodeAlphabet.Length)]).ToArray());
            if (!_lobbies.ContainsKey(code)) return code;
        }
    }

    private static string NewPlayerId() => Guid.NewGuid().ToString("N")[..12];

    public JoinOutcome Create(string connectionId, string? rawName, PawnColor color, string? token, long now)
    {
        if (ValidateName(rawName, out var name) is { } nameError) return JoinOutcome.Fail(nameError);
        if (ValidateToken(token) is { } tokenError) return JoinOutcome.Fail(tokenError);
        if (!Enum.IsDefined(color)) return JoinOutcome.Fail("That colour doesn't exist.");

        Leave(connectionId, now);

        var player = new PlayerState
        {
            PlayerId = NewPlayerId(), SessionToken = token!, ConnectionId = connectionId,
            DisplayName = name, Color = color, JoinedAt = now,
        };

        while (true)
        {
            var lobby = new Lobby { Code = GenerateCode(), HostPlayerId = player.PlayerId, CreatedAt = now, LastActivityAt = now };
            lobby.Players.Add(player);
            if (!_lobbies.TryAdd(lobby.Code, lobby)) continue;
            _connections[connectionId] = new ConnectionRef(lobby.Code, player.PlayerId);
            log.LogInformation("Lobby {Code} created by {Name}", lobby.Code, name);
            return new JoinOutcome(true, null, lobby, player);
        }
    }

    public JoinOutcome Join(string connectionId, string? rawCode, string? rawName, string? token, long now)
    {
        if (ValidateToken(token) is { } tokenError) return JoinOutcome.Fail(tokenError);
        var lobby = Find(rawCode ?? "");
        if (lobby is null) return JoinOutcome.Fail("No lobby with that code. Double-check the letters!");

        lock (lobby.Sync)
        {
            // Same browser session joining again = reconnect.
            if (lobby.Players.Any(p => p.SessionToken == token && !p.HasLeft))
                return ReconnectLocked(lobby, connectionId, token!, now);
        }

        if (ValidateName(rawName, out var name) is { } nameError) return JoinOutcome.Fail(nameError);
        Leave(connectionId, now);

        lock (lobby.Sync)
        {
            if (!_lobbies.ContainsKey(lobby.Code)) return JoinOutcome.Fail("That lobby just closed.");
            if (lobby.Phase != GamePhase.Lobby) return JoinOutcome.Fail("That game has already started.");
            if (lobby.Players.Count >= MaxPlayers) return JoinOutcome.Fail("That lobby is full (8/8).");
            if (lobby.Players.Any(p => string.Equals(p.DisplayName, name, StringComparison.OrdinalIgnoreCase)))
                return JoinOutcome.Fail("Someone in that lobby already has that name.");

            var player = new PlayerState
            {
                PlayerId = NewPlayerId(), SessionToken = token!, ConnectionId = connectionId,
                DisplayName = name, Color = null, JoinedAt = now,
            };
            lobby.Players.Add(player);
            lobby.LastActivityAt = now;
            _connections[connectionId] = new ConnectionRef(lobby.Code, player.PlayerId);
            return new JoinOutcome(true, null, lobby, player);
        }
    }

    public JoinOutcome Reconnect(string connectionId, string? rawCode, string? token, long now)
    {
        if (ValidateToken(token) is { } tokenError) return JoinOutcome.Fail(tokenError);
        var lobby = Find(rawCode ?? "");
        if (lobby is null) return JoinOutcome.Fail("That lobby no longer exists (the server may have restarted).");
        lock (lobby.Sync) return ReconnectLocked(lobby, connectionId, token!, now);
    }

    private JoinOutcome ReconnectLocked(Lobby lobby, string connectionId, string token, long now)
    {
        var player = lobby.Players.FirstOrDefault(p => p.SessionToken == token);
        if (player is null || player.HasLeft) return JoinOutcome.Fail("Your seat in that lobby is gone.");

        var previous = player.ConnectionId != connectionId ? player.ConnectionId : null;
        if (previous is not null) _connections.TryRemove(previous, out _);

        player.ConnectionId = connectionId;
        player.IsConnected = true;
        player.DisconnectedAt = null;
        lobby.LastActivityAt = now;
        _connections[connectionId] = new ConnectionRef(lobby.Code, player.PlayerId);
        return new JoinOutcome(true, null, lobby, player, previous);
    }

    public bool TryResolve(string connectionId, out Lobby lobby, out PlayerState player)
    {
        lobby = null!;
        player = null!;
        if (!_connections.TryGetValue(connectionId, out var cref)) return false;
        if (!_lobbies.TryGetValue(cref.Code, out var l)) return false;
        var p = l.FindPlayer(cref.PlayerId);
        if (p is null) return false;
        lobby = l;
        player = p;
        return true;
    }

    /// <summary>Explicit leave. In the lobby the seat is removed; in a running game the pawn stays as a disconnected player.</summary>
    public Lobby? Leave(string connectionId, long now)
    {
        if (!TryResolve(connectionId, out var lobby, out var player)) return null;
        _connections.TryRemove(connectionId, out _);
        lock (lobby.Sync)
        {
            if (player.ConnectionId != connectionId) return null;
            if (lobby.Phase == GamePhase.Lobby) RemovePlayerLocked(lobby, player);
            else
            {
                player.IsConnected = false;
                player.HasLeft = true;
                player.ConnectionId = null;
                player.DisconnectedAt = now;
            }
        }
        return lobby;
    }

    /// <summary>Transport-level disconnect: keep the seat so a refresh can reclaim it with the session token.</summary>
    public Lobby? Disconnected(string connectionId, long now)
    {
        if (!_connections.TryRemove(connectionId, out var cref)) return null;
        if (!_lobbies.TryGetValue(cref.Code, out var lobby)) return null;
        lock (lobby.Sync)
        {
            var player = lobby.FindPlayer(cref.PlayerId);
            // A stale connection (replaced by a newer tab/refresh) must not mark the player offline.
            if (player is null || player.ConnectionId != connectionId) return null;
            player.IsConnected = false;
            player.DisconnectedAt = now;
            player.ConnectionId = null;
        }
        return lobby;
    }

    /// <summary>Caller must hold the lobby lock.</summary>
    public void RemovePlayerLocked(Lobby lobby, PlayerState player)
    {
        lobby.Players.Remove(player);
        if (player.ConnectionId is not null) _connections.TryRemove(player.ConnectionId, out _);
        if (lobby.HostPlayerId == player.PlayerId) ReassignHostLocked(lobby);
        if (lobby.Players.Count == 0) RemoveLobby(lobby);
    }

    /// <summary>Host goes to the oldest connected player (falls back to oldest overall).</summary>
    public static void ReassignHostLocked(Lobby lobby)
    {
        var next = lobby.Players.Where(p => p.IsConnected).OrderBy(p => p.JoinedAt).FirstOrDefault()
                   ?? lobby.Players.OrderBy(p => p.JoinedAt).FirstOrDefault();
        if (next is not null) lobby.HostPlayerId = next.PlayerId;
    }

    public void RemoveLobby(Lobby lobby)
    {
        if (!_lobbies.TryRemove(lobby.Code, out _)) return;
        foreach (var p in lobby.Players)
            if (p.ConnectionId is not null) _connections.TryRemove(p.ConnectionId, out _);
        notifier.CloseLobby(lobby.Code);
        log.LogInformation("Lobby {Code} closed", lobby.Code);
    }
}
