using GameServer.Models;
using GameServer.Services;

namespace GameServer.MiniGames;

public static class LogicEngine
{
    public static bool IsCorrect(LogicPuzzle puzzle, int choice) => choice == puzzle.CorrectChoice;
}

/// <summary>Multiple choice with exactly ONE attempt per player (otherwise 4 choices could be brute-forced).</summary>
public sealed class LogicRound(LogicPuzzle puzzle, int durationMs) : MiniGameRound(MiniGameType.Logic, "Logic & Patterns", puzzle.Id)
{
    private readonly Dictionary<string, (int Choice, long At)> _answers = new();

    public override int DurationMs => durationMs;

    public SubmitResult Submit(string playerId, int choice, long now)
    {
        if (_answers.ContainsKey(playerId)) return SubmitResult.Reject("You already locked in an answer.");
        if (choice < 0 || choice >= puzzle.Choices.Count) return SubmitResult.Reject("Invalid choice.");
        _answers[playerId] = (choice, now);
        // Correctness is deliberately not returned until the round ends.
        return new SubmitResult(true, null, "Locked in!");
    }

    public override bool IsPlayerDone(string playerId) => _answers.ContainsKey(playerId);

    public override object GetPublicState(long now) => new
    {
        puzzleType = puzzle.Type,
        prompt = puzzle.Prompt,
        grid = puzzle.Grid,
        items = puzzle.Items,
        choices = puzzle.Choices,
        answered = _answers.Keys.ToList(),
    };

    public override object? GetPrivateState(string playerId) => new
    {
        type = MiniGameType.Logic,
        choice = _answers.TryGetValue(playerId, out var a) ? a.Choice : (int?)null,
    };

    public override List<PlayerOutcome> Score(IEnumerable<string> participantIds) =>
        participantIds.Select(id =>
        {
            if (!_answers.TryGetValue(id, out var a)) return new PlayerOutcome(id, false, [0], "No answer");
            var ms = a.At - StartAt;
            return LogicEngine.IsCorrect(puzzle, a.Choice)
                ? new PlayerOutcome(id, true, [ms], $"Correct · {TextNormalizer.FormatSeconds(ms)}")
                : new PlayerOutcome(id, false, [ms], "Wrong");
        }).ToList();

    public override object GetReveal() => new
    {
        prompt = puzzle.Prompt,
        correctChoice = puzzle.CorrectChoice,
        answer = puzzle.Choices[puzzle.CorrectChoice],
        explanation = puzzle.Explanation,
        playerChoices = _answers.ToDictionary(kv => kv.Key, kv => kv.Value.Choice),
    };
}
