using System.Globalization;
using GameServer.Models;
using GameServer.Services;

namespace GameServer.MiniGames;

/// <summary>
/// The server owns the source pixel art and only ever sends a block-averaged (pixelated) version
/// at the current reveal level, so the full image and the answer never reach a client early.
/// </summary>
public sealed class PixelGuessRound : MiniGameRound
{
    public const int WrongGuessLockMs = 2_000;
    public const int LevelIntervalMs = 1_500;
    public static readonly int[] Levels = [2, 3, 4, 6, 8, 11, 16];

    private readonly PixelPuzzle _puzzle;
    private readonly HashSet<string> _answers;
    private readonly string[,] _source;
    private readonly int _width;
    private readonly int _height;
    private readonly Dictionary<string, long> _solvedAt = new();
    private readonly Dictionary<string, long> _lockedUntil = new();
    private readonly Dictionary<string, int> _wrongCount = new();
    private readonly Dictionary<int, string[]> _levelCache = new();
    private int _level;

    public PixelGuessRound(PixelPuzzle puzzle, int durationMs) : base(MiniGameType.PixelGuess, "Guess From Pixels", puzzle.Id)
    {
        _puzzle = puzzle;
        _answers = TextNormalizer.NormalizeAll(puzzle.Answers);
        _height = puzzle.Rows.Count;
        _width = puzzle.Rows[0].Length;
        _source = new string[_width, _height];
        var background = puzzle.Background ?? "#dfeefa";
        for (var y = 0; y < _height; y++)
        for (var x = 0; x < _width; x++)
        {
            var c = puzzle.Rows[y][x];
            _source[x, y] = c == '.' ? background : puzzle.Palette[c.ToString()];
        }
        DurationValue = durationMs;
    }

    private int DurationValue { get; }
    public override int DurationMs => DurationValue;

    public int LevelAt(long now) => Math.Clamp((int)((now - StartAt) / LevelIntervalMs), 0, Levels.Length - 1);

    public override bool Tick(long now, IReadOnlyCollection<string> activePlayerIds)
    {
        var level = LevelAt(now);
        if (level == _level) return false;
        _level = level;
        return true;
    }

    public SubmitResult Submit(string playerId, string? raw, long now)
    {
        if (_solvedAt.ContainsKey(playerId)) return SubmitResult.Reject("Already guessed it!");
        if (_lockedUntil.TryGetValue(playerId, out var until) && now < until) return SubmitResult.Reject("Locked…", until);

        var guess = TextNormalizer.Normalize(raw);
        if (guess.Length == 0 || guess.Length > TextNormalizer.MaxAnswerLength) return SubmitResult.Reject("Type a guess first.");

        if (TextNormalizer.Matches(guess, _answers))
        {
            _solvedAt[playerId] = now;
            return new SubmitResult(true, true, "Correct!");
        }
        _wrongCount[playerId] = _wrongCount.GetValueOrDefault(playerId) + 1;
        _lockedUntil[playerId] = now + WrongGuessLockMs;
        return new SubmitResult(true, false, "Wrong! Locked for 2s", now + WrongGuessLockMs);
    }

    public override bool IsPlayerDone(string playerId) => _solvedAt.ContainsKey(playerId);

    /// <summary>Average every source pixel that falls into each cell of an n×n grid.</summary>
    public string[] Pixelate(int n)
    {
        if (_levelCache.TryGetValue(n, out var cached)) return cached;
        var cellsX = Math.Min(n, _width);
        var cellsY = Math.Min(n, _height);
        var result = new string[cellsX * cellsY];
        for (var cy = 0; cy < cellsY; cy++)
        for (var cx = 0; cx < cellsX; cx++)
        {
            int x0 = cx * _width / cellsX, x1 = Math.Max(x0 + 1, (cx + 1) * _width / cellsX);
            int y0 = cy * _height / cellsY, y1 = Math.Max(y0 + 1, (cy + 1) * _height / cellsY);
            long r = 0, g = 0, b = 0, count = 0;
            for (var y = y0; y < y1; y++)
            for (var x = x0; x < x1; x++)
            {
                var hex = _source[x, y];
                r += int.Parse(hex.AsSpan(1, 2), NumberStyles.HexNumber);
                g += int.Parse(hex.AsSpan(3, 2), NumberStyles.HexNumber);
                b += int.Parse(hex.AsSpan(5, 2), NumberStyles.HexNumber);
                count++;
            }
            result[cy * cellsX + cx] = $"#{r / count:x2}{g / count:x2}{b / count:x2}";
        }
        return _levelCache[n] = result;
    }

    public override object GetPublicState(long now)
    {
        var level = LevelAt(now);
        var size = Levels[level];
        return new
        {
            level,
            levelCount = Levels.Length,
            columns = Math.Min(size, _width),
            rows = Math.Min(size, _height),
            pixels = Pixelate(size),
            nextLevelAt = level < Levels.Length - 1 ? StartAt + (level + 1) * LevelIntervalMs : (long?)null,
            category = _puzzle.Category,
            solved = _solvedAt.Keys.ToList(),
        };
    }

    public override object? GetPrivateState(string playerId) => new
    {
        type = MiniGameType.PixelGuess,
        solved = _solvedAt.ContainsKey(playerId),
        wrongGuesses = _wrongCount.GetValueOrDefault(playerId),
        lockedUntil = _lockedUntil.GetValueOrDefault(playerId),
    };

    public override List<PlayerOutcome> Score(IEnumerable<string> participantIds) =>
        participantIds.Select(id => _solvedAt.TryGetValue(id, out var at)
            ? new PlayerOutcome(id, true, [at - StartAt], TextNormalizer.FormatSeconds(at - StartAt))
            : new PlayerOutcome(id, false, [0], "Didn't get it")).ToList();

    public override object GetReveal() => new
    {
        answer = _puzzle.Answers[0].ToUpperInvariant(),
        columns = _width,
        rows = _height,
        pixels = Pixelate(Math.Max(_width, _height)),
    };
}
