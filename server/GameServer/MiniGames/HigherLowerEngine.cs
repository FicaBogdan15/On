using GameServer.Models;
using GameServer.Services;

namespace GameServer.MiniGames;

/// <summary>
/// Several two-option questions, each with its own answer window followed by a short reveal.
/// Numeric values are only included in public state for questions that have already been revealed.
/// </summary>
public sealed class HigherLowerRound : MiniGameRound
{
    public const int QuestionMs = 7_000;
    public const int RevealMs = 2_600;

    private sealed record Answer(int Choice, long ResponseMs);

    private readonly List<HigherLowerQuestion> _questions;
    private readonly Dictionary<string, Dictionary<int, Answer>> _answers = new();

    private int _index;
    private long _questionStart;
    private long _questionEnd;
    private bool _revealing;
    private long _revealEnd;
    private bool _finished;

    public HigherLowerRound(string puzzleId, List<HigherLowerQuestion> questions)
        : base(MiniGameType.HigherLower, "Higher or Lower", puzzleId)
    {
        _questions = questions;
    }

    public int QuestionCount => _questions.Count;
    public int CurrentIndex => _index;
    public bool Revealing => _revealing;

    public override int DurationMs => _questions.Count * (QuestionMs + RevealMs);

    public override void Begin(long startAt)
    {
        base.Begin(startAt);
        StartQuestion(0, startAt);
    }

    private void StartQuestion(int index, long now)
    {
        _index = index;
        _questionStart = now;
        _questionEnd = now + QuestionMs;
        _revealing = false;
        EndAt = now + (_questions.Count - index) * (QuestionMs + RevealMs);
    }

    /// <summary>0 = option A, 1 = option B.</summary>
    public static int CorrectChoice(HigherLowerQuestion q)
    {
        var aWins = q.Pick == "lower" ? q.OptionA.Value < q.OptionB.Value : q.OptionA.Value > q.OptionB.Value;
        return aWins ? 0 : 1;
    }

    public SubmitResult Submit(string playerId, int questionIndex, int choice, long now)
    {
        if (_finished || _revealing || questionIndex != _index || now >= _questionEnd)
            return SubmitResult.Reject("Too late for that one!");
        if (choice is not (0 or 1)) return SubmitResult.Reject("Pick A or B.");

        var mine = _answers.TryGetValue(playerId, out var a) ? a : _answers[playerId] = new();
        if (mine.ContainsKey(questionIndex)) return SubmitResult.Reject("Already answered.");
        mine[questionIndex] = new Answer(choice, Math.Max(0, now - _questionStart));
        return new SubmitResult(true);
    }

    public override bool Tick(long now, IReadOnlyCollection<string> activePlayerIds)
    {
        if (_finished) return false;
        if (!_revealing)
        {
            var allAnswered = activePlayerIds.Count > 0 && activePlayerIds.All(id =>
                _answers.TryGetValue(id, out var a) && a.ContainsKey(_index));
            if (now < _questionEnd && !allAnswered) return false;
            _revealing = true;
            _revealEnd = now + RevealMs;
            EndAt = _revealEnd + (_questions.Count - _index - 1) * (QuestionMs + RevealMs);
            return true;
        }

        if (now < _revealEnd) return false;
        if (_index >= _questions.Count - 1)
        {
            _finished = true;
            EndAt = now;
            return true;
        }
        StartQuestion(_index + 1, now);
        return true;
    }

    public override bool IsComplete(long now, IReadOnlyCollection<string> activePlayerIds) => _finished;

    public override bool IsPlayerDone(string playerId) => false;

    private int RevealedCount => _revealing || _finished ? _index + 1 : _index;

    private bool IsCorrect(int questionIndex, Answer? a) => a is not null && a.Choice == CorrectChoice(_questions[questionIndex]);

    public override object GetPublicState(long now)
    {
        var q = _questions[_index];
        var revealed = RevealedCount;
        return new
        {
            index = _index,
            count = _questions.Count,
            category = q.Category,
            prompt = q.Prompt,
            optionA = q.OptionA.Name,
            optionB = q.OptionB.Name,
            questionEndsAt = _questionEnd,
            revealing = _revealing,
            reveal = _revealing
                ? new { valueA = q.OptionA.Value, valueB = q.OptionB.Value, unit = q.Unit, correct = CorrectChoice(q) }
                : null,
            answered = _answers.Where(kv => kv.Value.ContainsKey(_index)).Select(kv => kv.Key).ToList(),
            scores = _answers.ToDictionary(kv => kv.Key,
                kv => Enumerable.Range(0, revealed).Count(i => IsCorrect(i, kv.Value.GetValueOrDefault(i)))),
        };
    }

    public override object? GetPrivateState(string playerId)
    {
        var mine = _answers.GetValueOrDefault(playerId) ?? new();
        var revealed = RevealedCount;
        return new
        {
            type = MiniGameType.HigherLower,
            answers = Enumerable.Range(0, _questions.Count).Select(i => new
            {
                choice = mine.TryGetValue(i, out var a) ? a.Choice : (int?)null,
                correct = i < revealed ? IsCorrect(i, mine.GetValueOrDefault(i)) : (bool?)null,
            }).ToList(),
        };
    }

    public (int Correct, long TotalMs) Tally(string playerId)
    {
        var mine = _answers.GetValueOrDefault(playerId) ?? new();
        var correct = 0;
        long total = 0;
        for (var i = 0; i < _questions.Count; i++)
        {
            var a = mine.GetValueOrDefault(i);
            if (IsCorrect(i, a)) correct++;
            total += a?.ResponseMs ?? QuestionMs;
        }
        return (correct, total);
    }

    public override List<PlayerOutcome> Score(IEnumerable<string> participantIds) =>
        participantIds.Select(id =>
        {
            var (correct, total) = Tally(id);
            return new PlayerOutcome(id, correct > 0, [-correct, total], $"{correct}/{_questions.Count} · {TextNormalizer.FormatSeconds(total)}");
        }).ToList();

    public override object GetReveal() => new
    {
        questions = _questions.Select(q => new
        {
            prompt = q.Prompt,
            optionA = q.OptionA.Name,
            optionB = q.OptionB.Name,
            valueA = q.OptionA.Value,
            valueB = q.OptionB.Value,
            unit = q.Unit,
            correct = CorrectChoice(q),
        }).ToList(),
    };
}
