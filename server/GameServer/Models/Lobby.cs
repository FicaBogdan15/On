using GameServer.Services;

namespace GameServer.Models;

/// <summary>
/// All mutable state for one room. Every read/write must happen while holding <see cref="Sync"/>;
/// SignalR invocations and the game loop tick run concurrently.
/// </summary>
public sealed class Lobby
{
    public object Sync { get; } = new();

    public required string Code { get; init; }
    public required string HostPlayerId { get; set; }
    public List<PlayerState> Players { get; } = new();
    public GamePhase Phase { get; set; } = GamePhase.Lobby;
    public long CreatedAt { get; init; }
    public long LastActivityAt { get; set; }

    /// <summary>When the current phase times out; the game loop advances the phase once reached.</summary>
    public long? PhaseEndsAt { get; set; }
    public long PhaseStartedAt { get; set; }

    // Turn order
    public OrderRollState? OrderRoll { get; set; }
    public List<string> TurnOrder { get; } = new();
    public int TurnIndex { get; set; }
    public int TurnNumber { get; set; }
    public string? CurrentTurnPlayerId { get; set; }

    // Turn dice + mini-game
    public int? LastDiceValue { get; set; }
    public MiniGameType? CurrentMiniGame { get; set; }
    public MiniGameRound? ActiveMiniGame { get; set; }
    public ResultsDto? LastResults { get; set; }
    public HashSet<string> UsedPuzzleIds { get; } = new();

    // Board resolution
    public MovementResolution? Resolution { get; set; }
    public SwapRequest? PendingSwap { get; set; }
    public int ActionSequence { get; set; }

    // End of game
    public string? WinnerPlayerId { get; set; }
    public List<string>? FinalRanking { get; set; }

    public PlayerState? FindPlayer(string playerId) => Players.FirstOrDefault(p => p.PlayerId == playerId);

    public IReadOnlyCollection<string> ActivePlayerIds() =>
        Players.Where(p => p.IsConnected).Select(p => p.PlayerId).ToList();
}

public sealed class OrderRollState
{
    public int Round { get; set; } = 1;

    /// <summary>Ordered tie groups; a group with more than one player still needs to reroll.</summary>
    public List<List<string>> Groups { get; set; } = new();

    /// <summary>Rolls made in the current round, only for players who must roll this round.</summary>
    public Dictionary<string, int> CurrentRolls { get; } = new();

    /// <summary>Every roll per player across rounds, for display.</summary>
    public Dictionary<string, List<int>> History { get; } = new();

    public bool RoundComplete { get; set; }

    public IEnumerable<string> PlayersRollingThisRound() => TurnOrderService.PlayersNeedingRoll(Groups);
}

public sealed class SwapRequest
{
    public required string ChooserId { get; init; }
    public required List<string> Candidates { get; init; }
    public long StartedAt { get; init; }
    public long Deadline { get; init; }
}
