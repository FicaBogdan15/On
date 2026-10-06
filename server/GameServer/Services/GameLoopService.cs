using GameServer.Models;

namespace GameServer.Services;

/// <summary>Drives every time-based transition (timers, timeouts, auto-rolls) for all lobbies.</summary>
public sealed class GameLoopService(LobbyService lobbies, GameService game, GameTimings timings, ILogger<GameLoopService> log)
    : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMilliseconds(100);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            foreach (var lobby in lobbies.All.ToList())
            {
                try
                {
                    lock (lobby.Sync)
                    {
                        if (IsAbandoned(lobby, now))
                        {
                            lobbies.RemoveLobby(lobby);
                            continue;
                        }
                        game.Tick(lobby, now);
                    }
                }
                catch (Exception ex)
                {
                    log.LogError(ex, "Tick failed for lobby {Code}", lobby.Code);
                }
            }
        }
    }

    private bool IsAbandoned(Lobby lobby, long now)
    {
        if (lobby.Players.Count == 0) return true;
        if (lobby.Players.Any(p => p.IsConnected)) return false;
        var lastSeen = lobby.Players.Max(p => p.DisconnectedAt ?? lobby.LastActivityAt);
        return now - lastSeen > timings.EmptyLobbyLifetime;
    }
}
