using System.Text.Json;
using System.Text.RegularExpressions;
using GameServer.MiniGames;

namespace GameServer.Services;

public sealed record ChainPuzzle(string Id, string Left, string Right, List<string> Answers, string Difficulty);

public sealed record HigherLowerOption(string Name, double Value);

/// <summary>Pick = "higher" means the larger value is correct, "lower" means the smaller one is (e.g. "founded earlier").</summary>
public sealed record HigherLowerQuestion(
    string Id, string Category, string Prompt, HigherLowerOption OptionA, HigherLowerOption OptionB, string? Unit, string Pick);

public sealed record NameXPrompt(string Id, string Category, string Letter, string Prompt, List<string> ValidAnswers);

/// <summary>Pixel art defined as rows of palette characters; '.' is transparent.</summary>
public sealed record PixelPuzzle(string Id, string Category, List<string> Answers, Dictionary<string, string> Palette, List<string> Rows, string? Background);

public sealed record LogicPuzzle(
    string Id, string Type, string Prompt, List<List<string>>? Grid, List<string>? Items, List<string> Choices, int CorrectChoice, string? Explanation);

/// <summary>
/// Loads every JSON content file once at startup. Each entry is validated on its own: a malformed
/// entry is logged and skipped so one bad puzzle never takes the whole game down.
/// </summary>
public sealed class ContentService
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true, ReadCommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true };
    private static readonly Regex FiveLetters = new("^[a-z]{5}$", RegexOptions.Compiled);
    private static readonly Regex HexColor = new("^#[0-9a-fA-F]{6}$", RegexOptions.Compiled);

    private readonly ILogger<ContentService> _log;

    public string DataDirectory { get; }
    public IReadOnlyList<string> WordleAnswers { get; private set; } = [];
    public IReadOnlySet<string> WordleAllowed { get; private set; } = new HashSet<string>();
    public IReadOnlyList<ChainPuzzle> ChainPuzzles { get; private set; } = [];
    public IReadOnlyList<HigherLowerQuestion> HigherLower { get; private set; } = [];
    public IReadOnlyList<NameXPrompt> NameX { get; private set; } = [];
    public IReadOnlyList<PixelPuzzle> PixelPuzzles { get; private set; } = [];
    public IReadOnlyList<LogicPuzzle> LogicPuzzles { get; private set; } = [];

    public ContentService(ILogger<ContentService> log, IConfiguration config)
    {
        _log = log;
        DataDirectory = config["GameDataPath"] ?? Path.Combine(AppContext.BaseDirectory, "GameData");
        Load();
    }

    private void Load()
    {
        LoadWordle();
        ChainPuzzles = LoadArray<ChainPuzzle>("chain-puzzles.json", ValidateChain);
        HigherLower = LoadArray<HigherLowerQuestion>("higher-lower.json", ValidateHigherLower);
        NameX = LoadArray<NameXPrompt>("name-x.json", ValidateNameX);
        PixelPuzzles = LoadArray<PixelPuzzle>("pixel-puzzles.json", ValidatePixel);
        LogicPuzzles = LoadArray<LogicPuzzle>("logic-puzzles.json", ValidateLogic);

        _log.LogInformation(
            "Content loaded: {Wordle} wordle answers ({Allowed} allowed guesses), {Chain} chain, {HL} higher/lower, {NameX} name-x, {Pixel} pixel, {Logic} logic",
            WordleAnswers.Count, WordleAllowed.Count, ChainPuzzles.Count, HigherLower.Count, NameX.Count, PixelPuzzles.Count, LogicPuzzles.Count);
    }

    private void LoadWordle()
    {
        var doc = ReadDocument("wordle-words.json");
        if (doc is null) return;

        var answers = new List<string>();
        var allowed = new HashSet<string>(StringComparer.Ordinal);
        if (doc.RootElement.TryGetProperty("answers", out var a) && a.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in a.EnumerateArray())
            {
                var w = el.GetString()?.Trim().ToLowerInvariant();
                if (w is not null && FiveLetters.IsMatch(w)) { answers.Add(w); allowed.Add(w); }
                else _log.LogError("wordle-words.json: skipping invalid answer {Word}", el.ToString());
            }
        }
        if (doc.RootElement.TryGetProperty("allowed", out var g) && g.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in g.EnumerateArray())
            {
                var w = el.GetString()?.Trim().ToLowerInvariant();
                if (w is not null && FiveLetters.IsMatch(w)) allowed.Add(w);
            }
        }
        WordleAnswers = answers.Distinct().ToList();
        WordleAllowed = allowed;
    }

    private JsonDocument? ReadDocument(string file)
    {
        var path = Path.Combine(DataDirectory, file);
        try
        {
            return JsonDocument.Parse(File.ReadAllText(path), new JsonDocumentOptions { CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Failed to read content file {Path}. This mini-game will be unavailable.", path);
            return null;
        }
    }

    private List<T> LoadArray<T>(string file, Func<T, string?> validate) where T : class
    {
        var result = new List<T>();
        var doc = ReadDocument(file);
        if (doc is null) return result;
        if (doc.RootElement.ValueKind != JsonValueKind.Array)
        {
            _log.LogError("{File}: root must be a JSON array", file);
            return result;
        }

        var index = 0;
        foreach (var el in doc.RootElement.EnumerateArray())
        {
            try
            {
                var item = el.Deserialize<T>(JsonOptions) ?? throw new JsonException("null entry");
                var error = validate(item);
                if (error is null) result.Add(item);
                else _log.LogError("{File}[{Index}]: skipping invalid entry: {Error}", file, index, error);
            }
            catch (Exception ex)
            {
                _log.LogError("{File}[{Index}]: skipping malformed entry: {Message}", file, index, ex.Message);
            }
            index++;
        }

        var duplicateIds = result.GroupBy(IdOf).Where(g => g.Count() > 1).Select(g => g.Key).ToList();
        foreach (var id in duplicateIds) _log.LogWarning("{File}: duplicate id {Id}", file, id);
        return result;
    }

    private static string IdOf(object item) => item switch
    {
        ChainPuzzle c => c.Id,
        HigherLowerQuestion h => h.Id,
        NameXPrompt n => n.Id,
        PixelPuzzle p => p.Id,
        LogicPuzzle l => l.Id,
        _ => "",
    };

    private static string? ValidateChain(ChainPuzzle p)
    {
        if (string.IsNullOrWhiteSpace(p.Id)) return "missing id";
        if (string.IsNullOrWhiteSpace(p.Left) || string.IsNullOrWhiteSpace(p.Right)) return "left/right required";
        if (p.Answers is null || p.Answers.Count == 0 || p.Answers.Any(string.IsNullOrWhiteSpace)) return "answers required";
        if (p.Difficulty is not ("easy" or "medium" or "hard")) return "difficulty must be easy|medium|hard";
        return null;
    }

    private static string? ValidateHigherLower(HigherLowerQuestion q)
    {
        if (string.IsNullOrWhiteSpace(q.Id)) return "missing id";
        if (string.IsNullOrWhiteSpace(q.Prompt)) return "missing prompt";
        if (q.OptionA is null || q.OptionB is null) return "optionA/optionB required";
        if (string.IsNullOrWhiteSpace(q.OptionA.Name) || string.IsNullOrWhiteSpace(q.OptionB.Name)) return "option names required";
        if (q.OptionA.Value == q.OptionB.Value) return "option values must differ";
        if (q.Pick is not ("higher" or "lower")) return "pick must be higher|lower";
        return null;
    }

    private static string? ValidateNameX(NameXPrompt n)
    {
        if (string.IsNullOrWhiteSpace(n.Id)) return "missing id";
        if (string.IsNullOrWhiteSpace(n.Prompt)) return "missing prompt";
        if (string.IsNullOrWhiteSpace(n.Letter) || n.Letter.Length != 1) return "letter must be one character";
        if (n.ValidAnswers is null || n.ValidAnswers.Count == 0) return "validAnswers required";
        var letter = TextNormalizer.Normalize(n.Letter);
        var bad = n.ValidAnswers.FirstOrDefault(a => !TextNormalizer.Normalize(a).StartsWith(letter, StringComparison.Ordinal));
        return bad is null ? null : $"answer '{bad}' does not start with '{n.Letter}'";
    }

    private static string? ValidatePixel(PixelPuzzle p)
    {
        if (string.IsNullOrWhiteSpace(p.Id)) return "missing id";
        if (p.Answers is null || p.Answers.Count == 0) return "answers required";
        if (p.Rows is null || p.Rows.Count < 4) return "rows required (at least 4)";
        var width = p.Rows[0].Length;
        if (p.Rows.Any(r => r.Length != width)) return "all rows must have equal width";
        if (p.Palette is null) return "palette required";
        foreach (var (key, color) in p.Palette)
        {
            if (key.Length != 1) return $"palette key '{key}' must be one character";
            if (!HexColor.IsMatch(color)) return $"palette color '{color}' must be #rrggbb";
        }
        var unknown = p.Rows.SelectMany(r => r).FirstOrDefault(c => c != '.' && !p.Palette.ContainsKey(c.ToString()));
        if (unknown != default) return $"row uses undefined palette char '{unknown}'";
        if (p.Background is not null && !HexColor.IsMatch(p.Background)) return "background must be #rrggbb";
        return null;
    }

    private static string? ValidateLogic(LogicPuzzle l)
    {
        if (string.IsNullOrWhiteSpace(l.Id)) return "missing id";
        if (l.Type is not ("sequence" or "shape" or "oddOneOut" or "grid")) return "type must be sequence|shape|oddOneOut|grid";
        if (string.IsNullOrWhiteSpace(l.Prompt)) return "missing prompt";
        if (l.Choices is null || l.Choices.Count < 2) return "at least two choices required";
        if (l.CorrectChoice < 0 || l.CorrectChoice >= l.Choices.Count) return "correctChoice out of range";
        return null;
    }
}
