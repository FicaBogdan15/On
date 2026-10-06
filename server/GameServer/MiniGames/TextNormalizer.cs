using System.Globalization;
using System.Text;

namespace GameServer.MiniGames;

public static class TextNormalizer
{
    public const int MaxAnswerLength = 40;

    /// <summary>Lowercase, trim, strip diacritics, turn punctuation into spaces and collapse whitespace.</summary>
    public static string Normalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return "";
        var decomposed = input.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposed.Length);
        var lastWasSpace = false;
        foreach (var c in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
            if (char.IsLetterOrDigit(c) || c == '+' || c == '#')
            {
                sb.Append(c);
                lastWasSpace = false;
            }
            else if (!lastWasSpace && sb.Length > 0)
            {
                sb.Append(' ');
                lastWasSpace = true;
            }
        }
        return sb.ToString().TrimEnd();
    }

    /// <summary>Matches against a normalized answer set, tolerating plurals and leading articles.</summary>
    public static bool Matches(string normalizedGuess, IReadOnlySet<string> normalizedAnswers) =>
        TryMatch(normalizedGuess, normalizedAnswers, out _);

    public static bool TryMatch(string normalizedGuess, IReadOnlySet<string> normalizedAnswers, out string canonical)
    {
        canonical = "";
        if (normalizedGuess.Length == 0) return false;
        foreach (var candidate in Variants(normalizedGuess))
        {
            if (!normalizedAnswers.Contains(candidate)) continue;
            canonical = candidate;
            return true;
        }
        return false;
    }

    private static IEnumerable<string> Variants(string guess)
    {
        foreach (var g in new[] { guess, StripArticle(guess) })
        {
            yield return g;
            if (g.EndsWith('s')) yield return g[..^1];
            if (g.EndsWith("es")) yield return g[..^2];
        }
    }

    private static string StripArticle(string s) =>
        s.StartsWith("the ") ? s[4..] : s.StartsWith("a ") ? s[2..] : s.StartsWith("an ") ? s[3..] : s;

    public static HashSet<string> NormalizeAll(IEnumerable<string> answers) =>
        answers.Select(Normalize).Where(a => a.Length > 0).ToHashSet(StringComparer.Ordinal);

    public static string FormatSeconds(long ms) => (ms / 1000.0).ToString("0.0", CultureInfo.InvariantCulture) + "s";
}
