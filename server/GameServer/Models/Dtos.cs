namespace GameServer.Models;

// Everything in this file is safe to send to every client.

public sealed record PlayerDto(
    string PlayerId,
    string Name,
    PawnColor? Color,
    bool IsReady,
    bool IsHost,
    bool IsConnected,
    bool HasLeft,
    int Position,
    bool HasShield,
    bool DoubleMovement,
    int? InitialRoll,
    int? TurnOrderIndex);

public sealed record OrderRollDto(
    int Round,
    List<string> Rolling,
    Dictionary<string, int> Rolls,
    Dictionary<string, List<int>> History,
    bool RoundComplete,
    List<List<string>> Groups);

public sealed record SwapDto(string ChooserId, long Deadline, List<string> Candidates);

public sealed record MiniGameDto(MiniGameType Type, string Title, string Stage, long StartAt, long EndAt, object? State);

public sealed record ResultEntryDto(string PlayerId, int Rank, bool Eligible, string Detail, int Movement, bool Doubled);

public sealed record ResultsDto(MiniGameType Type, string Title, List<ResultEntryDto> Entries, object? Reveal);

public sealed record SnapshotDto(
    string Code,
    string HostPlayerId,
    GamePhase Phase,
    long? PhaseEndsAt,
    long ServerNow,
    int MaxPlayers,
    int MinPlayers,
    int FinishIndex,
    List<PlayerDto> Players,
    List<string> TurnOrder,
    string? CurrentTurnPlayerId,
    int TurnNumber,
    int? LastDice,
    MiniGameType? DiceMiniGame,
    OrderRollDto? OrderRoll,
    MiniGameDto? MiniGame,
    ResultsDto? Results,
    SwapDto? Swap,
    string? WinnerId,
    List<string>? FinalRanking);

public sealed record BoardActionsDto(int Sequence, List<BoardAction> Actions);

public sealed record CommandResult(bool Ok, string? Error = null, object? Data = null)
{
    public static readonly CommandResult Success = new(true);
    public static CommandResult Fail(string error) => new(false, error);
}

public sealed record JoinResultDto(bool Ok, string? Error, string? Code, string? PlayerId);

public sealed record NoticeDto(string Kind, string Message);
