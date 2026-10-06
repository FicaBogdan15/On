using GameServer.Models;

namespace GameServer.Services;

/// <summary>All phase durations in milliseconds. Tweak here to tune pacing.</summary>
public sealed class GameTimings
{
    public int OrderRollTimeout { get; init; } = 15_000;
    public int OrderRoundPause { get; init; } = 2_200;
    public int DisconnectedAutoAction { get; init; } = 4_000;
    public int ShowTurnOrder { get; init; } = 5_000;
    public int TurnRollTimeout { get; init; } = 30_000;
    public int DiceRolling { get; init; } = 2_800;
    public int MiniGamePreparing { get; init; } = 4_500;
    public int MiniGameResults { get; init; } = 7_500;
    public int SwapChoice { get; init; } = 10_000;
    public int MovementTail { get; init; } = 500;

    public int ReconnectGrace { get; init; } = 60_000;
    public int HostHandoverGrace { get; init; } = 8_000;
    public int EmptyLobbyLifetime { get; init; } = 5 * 60_000;
    public int MinSubmitInterval { get; init; } = 200;

    /// <summary>Players needed before the host can start. Set Game__MinPlayers=1 to test solo.</summary>
    public int MinPlayers { get; init; } = LobbyService.DefaultMinPlayers;
}

/// <summary>
/// Development-only shortcuts for manual testing (bound from the "Debug" config section, and only
/// when ASPNETCORE_ENVIRONMENT=Development). Production always uses the defaults.
/// </summary>
public sealed class DebugOptions
{
    /// <summary>Every turn plays this mini-game (e.g. "PixelGuess") instead of the rolled one.</summary>
    public MiniGameType? ForceMiniGame { get; init; }

    /// <summary>Pawns start on this space (e.g. 45) so the finish can be tested quickly.</summary>
    public int StartPosition { get; init; }
}
