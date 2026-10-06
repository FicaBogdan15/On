namespace GameServer.Models;

/// <summary>
/// One animation step produced by board resolution. The server applies the state change instantly,
/// then streams these to clients so pawns visibly hop/teleport/swap. DurationMs is authoritative:
/// the server waits the sum of all durations before advancing the phase.
/// </summary>
public sealed class BoardAction
{
    public required string Type { get; init; }
    public string? PlayerId { get; init; }
    public string? TargetPlayerId { get; init; }
    public int? From { get; init; }
    public int? To { get; init; }
    public int[]? Path { get; init; }
    public string? Effect { get; init; }
    public string? Outcome { get; init; }
    public int DurationMs { get; init; }

    public const int StepMs = 320;

    public static BoardAction Move(string playerId, int from, int[] path) => new()
    {
        Type = "move", PlayerId = playerId, From = from, To = path[^1], Path = path,
        DurationMs = 250 + path.Length * StepMs + 150,
    };

    public static BoardAction Portal(string playerId, int from, int to) => new()
    {
        Type = "portal", PlayerId = playerId, From = from, To = to, DurationMs = 1300,
    };

    public static BoardAction Swap(string playerId, string targetId, int playerFrom, int targetFrom) => new()
    {
        Type = "swap", PlayerId = playerId, TargetPlayerId = targetId, From = playerFrom, To = targetFrom, DurationMs = 1400,
    };

    public static BoardAction TileEffect(string playerId, string effect, string? outcome = null) => new()
    {
        Type = "effect", PlayerId = playerId, Effect = effect, Outcome = outcome,
        DurationMs = effect == "mystery" ? 1700 : 1000,
    };

    public static BoardAction ShieldBlock(string playerId) => new()
    {
        Type = "shieldBlock", PlayerId = playerId, DurationMs = 1100,
    };

    public static BoardAction Finish(string playerId) => new()
    {
        Type = "finish", PlayerId = playerId, DurationMs = 1800,
    };
}
