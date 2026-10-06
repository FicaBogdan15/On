using GameServer.Models;

namespace GameServer.Services;

/// <summary>Builds the sanitized, public view of a lobby. Contains no hidden answers or session tokens.</summary>
public static class SnapshotBuilder
{
    public static SnapshotDto Build(Lobby lobby, long now, int finishIndex, int minPlayers = LobbyService.DefaultMinPlayers)
    {
        var players = lobby.Players.Select(p => new PlayerDto(
            p.PlayerId,
            p.DisplayName,
            p.Color,
            p.IsReady,
            p.PlayerId == lobby.HostPlayerId,
            p.IsConnected,
            p.HasLeft,
            p.BoardPosition,
            p.HasShield,
            p.DoubleMovementActive,
            p.InitialDiceRoll,
            lobby.TurnOrder.Contains(p.PlayerId) ? lobby.TurnOrder.IndexOf(p.PlayerId) : null)).ToList();

        OrderRollDto? order = null;
        if (lobby.OrderRoll is { } o)
        {
            order = new OrderRollDto(
                o.Round,
                o.PlayersRollingThisRound().ToList(),
                new Dictionary<string, int>(o.CurrentRolls),
                o.History.ToDictionary(kv => kv.Key, kv => kv.Value.ToList()),
                o.RoundComplete,
                o.Groups.Select(g => g.ToList()).ToList());
        }

        MiniGameDto? mini = null;
        if (lobby.ActiveMiniGame is { } round)
        {
            var playing = lobby.Phase == GamePhase.MiniGamePlaying;
            mini = new MiniGameDto(round.Type, round.Title, playing ? "playing" : "preparing", round.StartAt, round.EndAt,
                playing ? round.GetPublicState(now) : null);
        }

        SwapDto? swap = lobby.PendingSwap is { } s ? new SwapDto(s.ChooserId, s.Deadline, s.Candidates) : null;

        return new SnapshotDto(
            lobby.Code,
            lobby.HostPlayerId,
            lobby.Phase,
            lobby.PhaseEndsAt,
            now,
            LobbyService.MaxPlayers,
            minPlayers,
            finishIndex,
            players,
            lobby.TurnOrder.ToList(),
            lobby.CurrentTurnPlayerId,
            lobby.TurnNumber,
            lobby.LastDiceValue,
            lobby.CurrentMiniGame,
            order,
            mini,
            lobby.Phase == GamePhase.MiniGameResults ? lobby.LastResults : null,
            swap,
            lobby.WinnerPlayerId,
            lobby.FinalRanking);
    }
}
