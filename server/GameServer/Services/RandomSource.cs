using System.Security.Cryptography;

namespace GameServer.Services;

public interface IRandomSource
{
    /// <summary>Uniform integer in [minInclusive, maxExclusive).</summary>
    int Next(int minInclusive, int maxExclusive);
}

public sealed class SecureRandomSource : IRandomSource
{
    public int Next(int minInclusive, int maxExclusive) => RandomNumberGenerator.GetInt32(minInclusive, maxExclusive);
}

public static class RandomExtensions
{
    public static T Pick<T>(this IRandomSource rng, IReadOnlyList<T> items) => items[rng.Next(0, items.Count)];

    public static List<T> Shuffled<T>(this IRandomSource rng, IEnumerable<T> items)
    {
        var list = items.ToList();
        for (var i = list.Count - 1; i > 0; i--)
        {
            var j = rng.Next(0, i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }
        return list;
    }
}
