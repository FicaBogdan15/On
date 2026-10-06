using GameServer.MiniGames;
using GameServer.Models;

namespace GameServer.Services;

/// <summary>Selects puzzles (avoiding repeats inside a lobby) and builds mini-game rounds.</summary>
public sealed class MiniGameService(ContentService content, IRandomSource rng)
{
    public const int WordleDurationMs = 75_000;
    public const int NameXDurationMs = 15_000;
    public const int PixelDurationMs = 14_000;
    public const int LogicDurationMs = 20_000;
    public const int HigherLowerQuestionsPerRound = 5;

    public static string TitleFor(MiniGameType type) => type switch
    {
        MiniGameType.Wordle => "Wordle Rush",
        MiniGameType.Chain => "Chain",
        MiniGameType.HigherLower => "Higher or Lower",
        MiniGameType.NameX => "Name X with Y",
        MiniGameType.PixelGuess => "Guess From Pixels",
        MiniGameType.Logic => "Logic & Patterns",
        _ => type.ToString(),
    };

    public bool HasContent(MiniGameType type) => type switch
    {
        MiniGameType.Wordle => content.WordleAnswers.Count > 0,
        MiniGameType.Chain => content.ChainPuzzles.Count > 0,
        MiniGameType.HigherLower => content.HigherLower.Count >= 1,
        MiniGameType.NameX => content.NameX.Count > 0,
        MiniGameType.PixelGuess => content.PixelPuzzles.Count > 0,
        MiniGameType.Logic => content.LogicPuzzles.Count > 0,
        _ => false,
    };

    /// <summary>Returns a playable type; if the rolled game has no content, falls back to the next one that does.</summary>
    public MiniGameType ResolvePlayable(MiniGameType rolled)
    {
        for (var i = 0; i < 6; i++)
        {
            var candidate = (MiniGameType)(((int)rolled - 1 + i) % 6 + 1);
            if (HasContent(candidate)) return candidate;
        }
        throw new InvalidOperationException("No mini-game content is available at all. Check GameData/*.json.");
    }

    public MiniGameRound CreateRound(MiniGameType type, Lobby lobby) => type switch
    {
        MiniGameType.Wordle => GetRandomWordle(lobby),
        MiniGameType.Chain => new ChainRound(GetRandomChainPuzzle(lobby)),
        MiniGameType.HigherLower => GetRandomHigherLowerRound(lobby),
        MiniGameType.NameX => new NameXRound(GetRandomNameXPuzzle(lobby), NameXDurationMs),
        MiniGameType.PixelGuess => new PixelGuessRound(GetRandomPixelPuzzle(lobby), PixelDurationMs),
        MiniGameType.Logic => new LogicRound(ShuffleChoices(GetRandomLogicPuzzle(lobby)), LogicDurationMs),
        _ => throw new ArgumentOutOfRangeException(nameof(type)),
    };

    public WordleRound GetRandomWordle(Lobby lobby)
    {
        var word = PickUnused(lobby, content.WordleAnswers, w => "wordle:" + w);
        return new WordleRound("wordle:" + word, word, content.WordleAllowed, WordleDurationMs);
    }

    public ChainPuzzle GetRandomChainPuzzle(Lobby lobby) => PickUnused(lobby, content.ChainPuzzles, p => "chain:" + p.Id);

    public HigherLowerRound GetRandomHigherLowerRound(Lobby lobby)
    {
        var picks = new List<HigherLowerQuestion>();
        var count = Math.Min(HigherLowerQuestionsPerRound, content.HigherLower.Count);
        while (picks.Count < count)
        {
            var remaining = content.HigherLower.Where(q => !picks.Contains(q)).ToList();
            var q = PickUnused(lobby, remaining, x => "hl:" + x.Id);
            picks.Add(q);
        }
        // Randomize which side each option is shown on, so A is not always the answer.
        var shuffled = picks.Select(q => rng.Next(0, 2) == 0 ? q : q with { OptionA = q.OptionB, OptionB = q.OptionA }).ToList();
        return new HigherLowerRound("hl:" + string.Join(",", picks.Select(p => p.Id)), shuffled);
    }

    public NameXPrompt GetRandomNameXPuzzle(Lobby lobby) => PickUnused(lobby, content.NameX, p => "namex:" + p.Id);

    public PixelPuzzle GetRandomPixelPuzzle(Lobby lobby) => PickUnused(lobby, content.PixelPuzzles, p => "pixel:" + p.Id);

    public LogicPuzzle GetRandomLogicPuzzle(Lobby lobby) => PickUnused(lobby, content.LogicPuzzles, p => "logic:" + p.Id);

    /// <summary>Shuffle answer order per round so the correct index can't be memorised.</summary>
    public LogicPuzzle ShuffleChoices(LogicPuzzle puzzle)
    {
        // Odd-one-out shows items in their authored order; only the choice buttons move.
        var order = rng.Shuffled(Enumerable.Range(0, puzzle.Choices.Count));
        return puzzle with
        {
            Choices = order.Select(i => puzzle.Choices[i]).ToList(),
            CorrectChoice = order.IndexOf(puzzle.CorrectChoice),
        };
    }

    /// <summary>Random pick that avoids ids this lobby already used; once a pool is exhausted it is recycled.</summary>
    private T PickUnused<T>(Lobby lobby, IReadOnlyList<T> pool, Func<T, string> key)
    {
        var fresh = pool.Where(p => !lobby.UsedPuzzleIds.Contains(key(p))).ToList();
        if (fresh.Count == 0)
        {
            foreach (var p in pool) lobby.UsedPuzzleIds.Remove(key(p));
            fresh = pool.ToList();
        }
        var pick = rng.Pick(fresh);
        lobby.UsedPuzzleIds.Add(key(pick));
        return pick;
    }
}
