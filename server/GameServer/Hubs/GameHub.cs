using GameServer.Models;
using GameServer.Services;
using Microsoft.AspNetCore.SignalR;

namespace GameServer.Hubs;

/// <summary>
/// Client → server commands. Clients only ever express intent ("roll", "submit this guess");
/// every outcome is computed by <see cref="GameService"/>. Server → client messages:
/// StateUpdated (snapshot), MiniGamePrivate (per-player), BoardActions (animations), Notice.
/// </summary>
public sealed class GameHub(LobbyService lobbies, GameService game, ILogger<GameHub> log) : Hub
{
    private static long Now => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    public long GetServerTime() => Now;

    public Task<JoinResultDto> CreateLobby(string name, PawnColor color, string sessionToken) =>
        Enter(lobbies.Create(Context.ConnectionId, name, color, sessionToken, Now));

    public Task<JoinResultDto> JoinLobby(string code, string name, string sessionToken) =>
        Enter(lobbies.Join(Context.ConnectionId, code, name, sessionToken, Now));

    public Task<JoinResultDto> ReconnectLobby(string code, string sessionToken) =>
        Enter(lobbies.Reconnect(Context.ConnectionId, code, sessionToken, Now));

    public async Task<CommandResult> LeaveLobby()
    {
        var lobby = lobbies.Leave(Context.ConnectionId, Now);
        if (lobby is null) return CommandResult.Success;
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, SignalRGameNotifier.GroupName(lobby.Code));
        lock (lobby.Sync)
        {
            if (lobby.Players.Count > 0) game.BroadcastState(lobby, Now);
        }
        return CommandResult.Success;
    }

    public CommandResult ChooseColor(PawnColor color) => WithPlayer((l, p, now) => game.ChooseColor(l, p, color, now));
    public CommandResult SetReady(bool ready) => WithPlayer((l, p, now) => game.SetReady(l, p, ready, now));
    public CommandResult StartGame() => WithPlayer(game.StartGame);
    public CommandResult ReturnToLobby() => WithPlayer(game.ReturnToLobby);
    public CommandResult RollInitialDice() => WithPlayer(game.RollInitialDice);
    public CommandResult RollTurnDice() => WithPlayer(game.RollTurnDice);
    public CommandResult ChooseSwapTarget(string targetPlayerId) => WithPlayer((l, p, now) => game.ChooseSwapTarget(l, p, targetPlayerId, now));

    public CommandResult SubmitWordleGuess(string guess) => WithPlayer((l, p, now) => game.SubmitWordleGuess(l, p, Clip(guess), now));
    public CommandResult SubmitChainAnswer(string answer) => WithPlayer((l, p, now) => game.SubmitChainAnswer(l, p, Clip(answer), now));
    public CommandResult SubmitHigherLowerAnswer(int questionIndex, int choice) =>
        WithPlayer((l, p, now) => game.SubmitHigherLowerAnswer(l, p, questionIndex, choice, now));
    public CommandResult SubmitNameXAnswer(string answer) => WithPlayer((l, p, now) => game.SubmitNameXAnswer(l, p, Clip(answer), now));
    public CommandResult SubmitPixelGuess(string guess) => WithPlayer((l, p, now) => game.SubmitPixelGuess(l, p, Clip(guess), now));
    public CommandResult SubmitLogicAnswer(int choice) => WithPlayer((l, p, now) => game.SubmitLogicAnswer(l, p, choice, now));

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var lobby = lobbies.Disconnected(Context.ConnectionId, Now);
        if (lobby is not null)
        {
            lock (lobby.Sync) game.BroadcastState(lobby, Now);
        }
        await base.OnDisconnectedAsync(exception);
    }

    private static string? Clip(string? s) => s is { Length: > 64 } ? s[..64] : s;

    private CommandResult WithPlayer(Func<Lobby, PlayerState, long, CommandResult> action)
    {
        if (!lobbies.TryResolve(Context.ConnectionId, out var lobby, out var player))
            return CommandResult.Fail("You're not in a lobby.");
        lock (lobby.Sync)
        {
            if (player.ConnectionId != Context.ConnectionId || !lobby.Players.Contains(player))
                return CommandResult.Fail("This session moved to another tab.");
            try
            {
                return action(lobby, player, Now);
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Command failed in lobby {Code}", lobby.Code);
                return CommandResult.Fail("Something went wrong on the server.");
            }
        }
    }

    private async Task<JoinResultDto> Enter(JoinOutcome outcome)
    {
        if (!outcome.Ok || outcome.Lobby is null || outcome.Player is null)
            return new JoinResultDto(false, outcome.Error, null, null);

        var lobby = outcome.Lobby;
        var group = SignalRGameNotifier.GroupName(lobby.Code);
        await Groups.AddToGroupAsync(Context.ConnectionId, group);
        if (outcome.ReplacedConnectionId is { } old)
        {
            await Groups.RemoveFromGroupAsync(old, group);
            await Clients.Client(old).SendAsync("Notice", new NoticeDto("sessionMoved", "This game was opened in another tab."));
        }

        lock (lobby.Sync)
        {
            var now = Now;
            game.BroadcastState(lobby, now);
            game.SendStateTo(lobby, outcome.Player, now);
        }
        return new JoinResultDto(true, null, lobby.Code, outcome.Player.PlayerId);
    }
}
