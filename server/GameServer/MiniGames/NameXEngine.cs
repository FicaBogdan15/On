using GameServer.Models;
using GameServer.Services;

namespace GameServer.MiniGames;

/// <summary>
/// "Name an animal beginning with C". Ranking: correct first, then speed.
/// RareAnswerMode (optional, off by default) ranks answers that fewer players in the lobby gave above common ones.
/// </summary>
public sealed class NameXRound : MiniGameRound
{
    public const int WrongAnswerLockMs = 1_200;

    private readonly NameXPrompt _prompt;
    private readonly HashSet<string> _valid;
    private readonly Dictionary<string, (string Answer, long At)> _correct = new();
    private readonly Dictionary<string, long> _lockedUntil = new();
    private readonly Dictionary<string, List<string>> _wrong = new();

    public NameXRound(NameXPrompt prompt, int durationMs, bool rareAnswerMode = false)
        : base(MiniGameType.NameX, "Name X with Y", prompt.Id)
    {
        _prompt = prompt;
        _valid = TextNormalizer.NormalizeAll(prompt.ValidAnswers);
        DurationMsValue = durationMs;
        RareAnswerMode = rareAnswerMode;
    }

    private int DurationMsValue { get; }
    public bool RareAnswerMode { get; }
    public override int DurationMs => DurationMsValue;

    public SubmitResult Submit(string playerId, string? raw, long now)
    {
        if (_correct.ContainsKey(playerId)) return SubmitResult.Reject("Already answered!");
        if (_lockedUntil.TryGetValue(playerId, out var until) && now < until) return SubmitResult.Reject("Locked…", until);

        var answer = TextNormalizer.Normalize(raw);
        if (answer.Length == 0 || answer.Length > TextNormalizer.MaxAnswerLength) return SubmitResult.Reject("Type an answer first.");

        if (TextNormalizer.TryMatch(answer, _valid, out var canonical))
        {
            _correct[playerId] = (canonical, now);
            return new SubmitResult(true, true, "Correct!");
        }

        (_wrong.TryGetValue(playerId, out var list) ? list : _wrong[playerId] = new()).Add(answer);
        _lockedUntil[playerId] = now + WrongAnswerLockMs;
        var letter = TextNormalizer.Normalize(_prompt.Letter);
        var message = answer.StartsWith(letter, StringComparison.Ordinal) ? "Not on our list!" : $"Must start with {_prompt.Letter.ToUpperInvariant()}!";
        return new SubmitResult(true, false, message, now + WrongAnswerLockMs);
    }

    public override bool IsPlayerDone(string playerId) => _correct.ContainsKey(playerId);

    public override object GetPublicState(long now) => new
    {
        prompt = _prompt.Prompt,
        category = _prompt.Category,
        letter = _prompt.Letter.ToUpperInvariant(),
        solved = _correct.Keys.ToList(),
    };

    public override object? GetPrivateState(string playerId) => new
    {
        type = MiniGameType.NameX,
        solved = _correct.ContainsKey(playerId),
        answer = _correct.TryGetValue(playerId, out var c) ? c.Answer : null,
        wrong = _wrong.GetValueOrDefault(playerId) ?? new List<string>(),
        lockedUntil = _lockedUntil.GetValueOrDefault(playerId),
    };

    public override List<PlayerOutcome> Score(IEnumerable<string> participantIds)
    {
        var counts = _correct.Values.GroupBy(v => v.Answer).ToDictionary(g => g.Key, g => g.Count());
        return participantIds.Select(id =>
        {
            if (!_correct.TryGetValue(id, out var c)) return new PlayerOutcome(id, false, [0, 0], "No answer");
            var ms = c.At - StartAt;
            var rarity = RareAnswerMode ? counts[c.Answer] : 0;
            return new PlayerOutcome(id, true, [rarity, ms], $"{c.Answer.ToUpperInvariant()} · {TextNormalizer.FormatSeconds(ms)}");
        }).ToList();
    }

    public override object GetReveal() => new
    {
        prompt = _prompt.Prompt,
        examples = _prompt.ValidAnswers.Take(8).ToList(),
        playerAnswers = _correct.ToDictionary(kv => kv.Key, kv => kv.Value.Answer),
    };
}
