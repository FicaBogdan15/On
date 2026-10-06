using GameServer.Models;

namespace GameServer.Services;

public sealed record MovementAward(string PlayerId, int Place, int Steps, bool Doubled);

public static class RankingService
{
    /// <summary>Movement for 1st / 2nd / 3rd. Everyone else gets 0.</summary>
    public static readonly int[] RewardByPlace = [3, 2, 1];

    /// <summary>Eligible players first, then by SortKey ascending (lexicographic), PlayerId as a stable tiebreak.</summary>
    public static List<PlayerOutcome> Rank(IEnumerable<PlayerOutcome> outcomes) =>
        outcomes
            .OrderByDescending(o => o.Eligible)
            .ThenBy(o => o.SortKey, SortKeyComparer.Instance)
            .ThenBy(o => o.PlayerId, StringComparer.Ordinal)
            .ToList();

    public static int BaseReward(int placeIndex) =>
        placeIndex >= 0 && placeIndex < RewardByPlace.Length ? RewardByPlace[placeIndex] : 0;

    /// <summary>
    /// Assigns movement to the ranked list and consumes Double Movement for players who earn a reward.
    /// Players who are not eligible (failed the puzzle) never move, even if they are in the top three slots.
    /// </summary>
    public static List<MovementAward> AssignMovement(IReadOnlyList<PlayerOutcome> ranked, Func<string, PlayerState?> lookup)
    {
        var awards = new List<MovementAward>();
        for (var i = 0; i < ranked.Count; i++)
        {
            var outcome = ranked[i];
            var steps = outcome.Eligible ? BaseReward(i) : 0;
            var doubled = false;
            var player = lookup(outcome.PlayerId);
            if (steps > 0 && player is { DoubleMovementActive: true })
            {
                steps *= 2;
                doubled = true;
                player.DoubleMovementActive = false;
            }
            awards.Add(new MovementAward(outcome.PlayerId, i + 1, steps, doubled));
        }
        return awards;
    }

    private sealed class SortKeyComparer : IComparer<double[]>
    {
        public static readonly SortKeyComparer Instance = new();

        public int Compare(double[]? x, double[]? y)
        {
            x ??= [];
            y ??= [];
            for (var i = 0; i < Math.Min(x.Length, y.Length); i++)
            {
                var c = x[i].CompareTo(y[i]);
                if (c != 0) return c;
            }
            return x.Length.CompareTo(y.Length);
        }
    }
}
