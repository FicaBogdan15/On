namespace GameServer.Models;

/// <summary>
/// Base class for one live mini-game round. Rounds hold the hidden answer and all per-player
/// progress; only <see cref="GetPublicState"/> / <see cref="GetPrivateState"/> output ever leaves the server
/// while the round is running. <see cref="GetReveal"/> is only used once the round has ended.
/// </summary>
public abstract class MiniGameRound
{
    protected MiniGameRound(MiniGameType type, string title, string puzzleId)
    {
        Type = type;
        Title = title;
        PuzzleId = puzzleId;
    }

    public MiniGameType Type { get; }
    public string Title { get; }
    public string PuzzleId { get; }

    public long StartAt { get; protected set; }
    public long EndAt { get; protected set; }

    public abstract int DurationMs { get; }

    public virtual void Begin(long startAt)
    {
        StartAt = startAt;
        EndAt = startAt + DurationMs;
    }

    public bool IsOpen(long now) => now >= StartAt && now < EndAt;

    /// <summary>Advance internal stages (question changes, reveal levels). Returns true when public state changed.</summary>
    public virtual bool Tick(long now, IReadOnlyCollection<string> activePlayerIds) => false;

    public virtual bool IsComplete(long now, IReadOnlyCollection<string> activePlayerIds) =>
        now >= EndAt || (activePlayerIds.Count > 0 && activePlayerIds.All(IsPlayerDone));

    public abstract bool IsPlayerDone(string playerId);

    public abstract object GetPublicState(long now);

    public abstract object? GetPrivateState(string playerId);

    public abstract List<PlayerOutcome> Score(IEnumerable<string> participantIds);

    public abstract object GetReveal();
}

public sealed record SubmitResult(bool Accepted, bool? Correct = null, string? Message = null, long? LockedUntil = null)
{
    public static SubmitResult Reject(string message, long? lockedUntil = null) => new(false, null, message, lockedUntil);
}

/// <summary>
/// One player's scored result. Lower SortKey values rank higher (compared lexicographically).
/// Only eligible players (those who actually solved/answered correctly) can earn movement.
/// </summary>
public sealed record PlayerOutcome(string PlayerId, bool Eligible, double[] SortKey, string Detail);
