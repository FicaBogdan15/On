using GameServer.Models;
using GameServer.Services;

namespace GameServer.MiniGames;

/// <summary>LEFT → ? → RIGHT. Wrong answers lock the input briefly; retries are allowed until time runs out.</summary>
public sealed class ChainRound : MiniGameRound
{
    public const int WrongAnswerLockMs = 1_000;

    private readonly ChainPuzzle _puzzle;
    private readonly HashSet<string> _answers;
    private readonly Dictionary<string, long> _solvedAt = new();
    private readonly Dictionary<string, int> _attempts = new();
    private readonly Dictionary<string, long> _lockedUntil = new();

    public ChainRound(ChainPuzzle puzzle) : base(MiniGameType.Chain, "Chain", puzzle.Id)
    {
        _puzzle = puzzle;
        _answers = TextNormalizer.NormalizeAll(puzzle.Answers);
    }

    public override int DurationMs => _puzzle.Difficulty switch
    {
        "easy" => 25_000,
        "medium" => 30_000,
        _ => 40_000,
    };

    public SubmitResult Submit(string playerId, string? raw, long now)
    {
        if (_solvedAt.ContainsKey(playerId)) return SubmitResult.Reject("Already solved!");
        if (_lockedUntil.TryGetValue(playerId, out var until) && now < until) return SubmitResult.Reject("Locked…", until);

        var guess = TextNormalizer.Normalize(raw);
        if (guess.Length == 0 || guess.Length > TextNormalizer.MaxAnswerLength) return SubmitResult.Reject("Type a word first.");

        _attempts[playerId] = _attempts.GetValueOrDefault(playerId) + 1;
        // Players often type the full compound ("keyboard"); accept the linking word itself only.
        if (TextNormalizer.Matches(guess.Replace(" ", ""), _answers) || TextNormalizer.Matches(guess, _answers))
        {
            _solvedAt[playerId] = now;
            return new SubmitResult(true, true, "Linked!");
        }
        _lockedUntil[playerId] = now + WrongAnswerLockMs;
        return new SubmitResult(true, false, "Nope!", now + WrongAnswerLockMs);
    }

    public override bool IsPlayerDone(string playerId) => _solvedAt.ContainsKey(playerId);

    public override object GetPublicState(long now)
    {
        var primary = TextNormalizer.Normalize(_puzzle.Answers[0]);
        var sameLength = _answers.All(a => a.Length == primary.Length);
        var sameFirst = _answers.All(a => a[0] == primary[0]);
        var hintVisible = now >= StartAt + DurationMs / 2;
        return new
        {
            left = _puzzle.Left.ToUpperInvariant(),
            right = _puzzle.Right.ToUpperInvariant(),
            difficulty = _puzzle.Difficulty,
            length = sameLength ? primary.Length : (int?)null,
            hint = hintVisible && sameFirst ? primary[..1].ToUpperInvariant() : null,
            hintAt = StartAt + DurationMs / 2,
            solved = _solvedAt.Keys.ToList(),
        };
    }

    public override object? GetPrivateState(string playerId) => new
    {
        type = MiniGameType.Chain,
        solved = _solvedAt.ContainsKey(playerId),
        attempts = _attempts.GetValueOrDefault(playerId),
        lockedUntil = _lockedUntil.GetValueOrDefault(playerId),
    };

    public override List<PlayerOutcome> Score(IEnumerable<string> participantIds) =>
        participantIds.Select(id => _solvedAt.TryGetValue(id, out var at)
            ? new PlayerOutcome(id, true, [at - StartAt], TextNormalizer.FormatSeconds(at - StartAt))
            : new PlayerOutcome(id, false, [0], "No link")).ToList();

    public override object GetReveal() => new
    {
        left = _puzzle.Left.ToUpperInvariant(),
        right = _puzzle.Right.ToUpperInvariant(),
        answers = _puzzle.Answers.Select(a => a.ToUpperInvariant()).ToList(),
    };
}
