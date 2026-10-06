using GameServer.Models;

namespace GameServer.MiniGames;

public enum LetterMark
{
    Correct,
    Present,
    Absent,
}

public static class WordleEngine
{
    public const int WordLength = 5;
    public const int MaxGuesses = 6;

    /// <summary>Standard Wordle marking with correct duplicate-letter handling.</summary>
    public static LetterMark[] Evaluate(string guess, string answer)
    {
        var marks = new LetterMark[WordLength];
        var remaining = new Dictionary<char, int>();
        for (var i = 0; i < WordLength; i++)
        {
            if (guess[i] == answer[i]) marks[i] = LetterMark.Correct;
            else
            {
                marks[i] = LetterMark.Absent;
                remaining[answer[i]] = remaining.GetValueOrDefault(answer[i]) + 1;
            }
        }
        for (var i = 0; i < WordLength; i++)
        {
            if (marks[i] == LetterMark.Correct) continue;
            if (remaining.GetValueOrDefault(guess[i]) > 0)
            {
                marks[i] = LetterMark.Present;
                remaining[guess[i]]--;
            }
        }
        return marks;
    }
}

public sealed class WordleRound(string puzzleId, string answer, IReadOnlySet<string> allowed, int durationMs)
    : MiniGameRound(MiniGameType.Wordle, "Wordle Rush", puzzleId)
{
    private sealed class Progress
    {
        public List<(string Word, LetterMark[] Marks)> Guesses { get; } = new();
        public bool Solved { get; set; }
        public long? SolvedAt { get; set; }
        public bool Done => Solved || Guesses.Count >= WordleEngine.MaxGuesses;
    }

    private readonly Dictionary<string, Progress> _players = new();

    public override int DurationMs => durationMs;

    private Progress For(string playerId) =>
        _players.TryGetValue(playerId, out var p) ? p : _players[playerId] = new Progress();

    public SubmitResult SubmitGuess(string playerId, string? rawGuess, long now)
    {
        var guess = (rawGuess ?? "").Trim().ToLowerInvariant();
        if (guess.Length != WordleEngine.WordLength || !guess.All(c => c is >= 'a' and <= 'z'))
            return SubmitResult.Reject("Guesses must be 5 letters.");

        var progress = For(playerId);
        if (progress.Done) return SubmitResult.Reject("You're out of guesses.");
        if (!allowed.Contains(guess)) return SubmitResult.Reject("Not in word list!");

        var marks = WordleEngine.Evaluate(guess, answer);
        progress.Guesses.Add((guess, marks));
        if (marks.All(m => m == LetterMark.Correct))
        {
            progress.Solved = true;
            progress.SolvedAt = now;
            return new SubmitResult(true, true, "Solved!");
        }
        return new SubmitResult(true, false, progress.Done ? "Out of guesses!" : null);
    }

    public override bool IsPlayerDone(string playerId) => For(playerId).Done;

    /// <summary>Opponents only see colour patterns (like a shared Wordle grid), never letters.</summary>
    public override object GetPublicState(long now) => new
    {
        wordLength = WordleEngine.WordLength,
        maxGuesses = WordleEngine.MaxGuesses,
        progress = _players.ToDictionary(kv => kv.Key, kv => new
        {
            patterns = kv.Value.Guesses.Select(g => g.Marks).ToList(),
            solved = kv.Value.Solved,
            done = kv.Value.Done,
        }),
    };

    public override object? GetPrivateState(string playerId)
    {
        var p = For(playerId);
        return new
        {
            type = MiniGameType.Wordle,
            guesses = p.Guesses.Select(g => new { word = g.Word.ToUpperInvariant(), marks = g.Marks }).ToList(),
            solved = p.Solved,
            done = p.Done,
        };
    }

    public override List<PlayerOutcome> Score(IEnumerable<string> participantIds) =>
        participantIds.Select(id =>
        {
            var p = For(id);
            if (p.Solved)
            {
                var ms = p.SolvedAt!.Value - StartAt;
                return new PlayerOutcome(id, true, [p.Guesses.Count, ms],
                    $"{p.Guesses.Count} {(p.Guesses.Count == 1 ? "guess" : "guesses")} · {TextNormalizer.FormatSeconds(ms)}");
            }
            // Non-solvers: more greens in their best row ranks them a little higher among themselves.
            var bestGreens = p.Guesses.Count == 0 ? 0 : p.Guesses.Max(g => g.Marks.Count(m => m == LetterMark.Correct));
            return new PlayerOutcome(id, false, [99, -bestGreens], p.Guesses.Count == 0 ? "No guesses" : "Failed");
        }).ToList();

    public override object GetReveal() => new { answer = answer.ToUpperInvariant() };
}
