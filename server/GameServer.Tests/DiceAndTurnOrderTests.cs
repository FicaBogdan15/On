using GameServer.Models;
using GameServer.Services;

namespace GameServer.Tests;

public class DiceAndTurnOrderTests
{
    [Fact]
    public void Dice_values_are_always_between_1_and_6_and_every_face_appears()
    {
        var dice = new DiceService(new SecureRandomSource());
        var seen = new HashSet<int>();
        for (var i = 0; i < 10_000; i++)
        {
            var v = dice.RollD6();
            Assert.InRange(v, 1, 6);
            seen.Add(v);
        }
        Assert.Equal(6, seen.Count);
    }

    [Theory]
    [InlineData(1, MiniGameType.Wordle)]
    [InlineData(2, MiniGameType.Chain)]
    [InlineData(3, MiniGameType.HigherLower)]
    [InlineData(4, MiniGameType.NameX)]
    [InlineData(5, MiniGameType.PixelGuess)]
    [InlineData(6, MiniGameType.Logic)]
    public void Dice_face_maps_to_mini_game(int face, MiniGameType expected) =>
        Assert.Equal(expected, DiceService.MiniGameForFace(face));

    [Theory]
    [InlineData(0)]
    [InlineData(7)]
    public void Invalid_dice_face_throws(int face) =>
        Assert.Throws<ArgumentOutOfRangeException>(() => DiceService.MiniGameForFace(face));

    [Fact]
    public void Turn_order_sorts_by_roll_descending()
    {
        var groups = new List<List<string>> { new() { "alice", "bob", "mike", "sarah" } };
        var rolls = new Dictionary<string, int> { ["alice"] = 2, ["bob"] = 6, ["mike"] = 4, ["sarah"] = 1 };

        var result = TurnOrderService.Split(groups, rolls);

        Assert.True(TurnOrderService.IsResolved(result));
        Assert.Equal(["bob", "mike", "alice", "sarah"], TurnOrderService.Flatten(result));
    }

    [Fact]
    public void Only_tied_players_reroll_and_keep_their_slot()
    {
        var groups = new List<List<string>> { new() { "alice", "bob", "mike", "sarah" } };
        var round1 = TurnOrderService.Split(groups, new Dictionary<string, int>
        {
            ["alice"] = 5, ["bob"] = 5, ["mike"] = 3, ["sarah"] = 6,
        });

        Assert.False(TurnOrderService.IsResolved(round1));
        Assert.Equal(["alice", "bob"], TurnOrderService.PlayersNeedingRoll(round1).OrderBy(x => x));

        // Round 2: only Alice and Bob roll.
        var round2 = TurnOrderService.Split(round1, new Dictionary<string, int> { ["alice"] = 1, ["bob"] = 4 });

        Assert.True(TurnOrderService.IsResolved(round2));
        Assert.Equal(["sarah", "bob", "alice", "mike"], TurnOrderService.Flatten(round2));
    }

    [Fact]
    public void Multiple_separate_ties_are_resolved_independently()
    {
        var groups = new List<List<string>> { new() { "a", "b", "c", "d" } };
        var r1 = TurnOrderService.Split(groups, new Dictionary<string, int> { ["a"] = 6, ["b"] = 6, ["c"] = 2, ["d"] = 2 });
        Assert.Equal(2, r1.Count);

        var r2 = TurnOrderService.Split(r1, new Dictionary<string, int> { ["a"] = 3, ["b"] = 3, ["c"] = 5, ["d"] = 1 });
        Assert.Equal(["a", "b"], TurnOrderService.PlayersNeedingRoll(r2));

        var r3 = TurnOrderService.Split(r2, new Dictionary<string, int> { ["a"] = 2, ["b"] = 4 });
        Assert.Equal(["b", "a", "c", "d"], TurnOrderService.Flatten(r3));
    }
}
