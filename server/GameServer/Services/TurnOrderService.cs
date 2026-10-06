namespace GameServer.Services;

/// <summary>
/// Turn order is a list of ordered "tie groups". Everyone starts in one group; after each roll round,
/// every unresolved group is split by roll value (descending). Groups that are still tied reroll,
/// and only their members roll. Resolution is complete when every group has exactly one player.
/// </summary>
public static class TurnOrderService
{
    public static List<List<string>> Split(IReadOnlyList<List<string>> groups, IReadOnlyDictionary<string, int> rolls)
    {
        var result = new List<List<string>>();
        foreach (var group in groups)
        {
            if (group.Count <= 1)
            {
                result.Add(group);
                continue;
            }

            foreach (var sub in group.GroupBy(id => rolls[id]).OrderByDescending(g => g.Key))
                result.Add(sub.ToList());
        }
        return result;
    }

    public static bool IsResolved(IEnumerable<List<string>> groups) => groups.All(g => g.Count == 1);

    public static IEnumerable<string> PlayersNeedingRoll(IEnumerable<List<string>> groups) =>
        groups.Where(g => g.Count > 1).SelectMany(g => g);

    public static List<string> Flatten(IEnumerable<List<string>> groups) => groups.SelectMany(g => g).ToList();
}
