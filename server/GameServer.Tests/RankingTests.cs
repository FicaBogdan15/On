using GameServer.Models;
using GameServer.Services;

namespace GameServer.Tests;

public class RankingTests
{
    private static PlayerOutcome Ok(string id, params double[] key) => new(id, true, key, "");
    private static PlayerOutcome Fail(string id) => new(id, false, [0], "");

    [Fact]
    public void Top_three_move_3_2_1_and_the_rest_zero()
    {
        var players = new[] { "a", "b", "c", "d" }.Select(id => TestBoards.Player(id)).ToDictionary(p => p.PlayerId);
        var ranked = RankingService.Rank([Ok("c", 30), Ok("a", 10), Ok("d", 40), Ok("b", 20)]);

        var awards = RankingService.AssignMovement(ranked, id => players[id]);

        Assert.Equal(["a", "b", "c", "d"], awards.Select(a => a.PlayerId));
        Assert.Equal([3, 2, 1, 0], awards.Select(a => a.Steps));
    }

    [Fact]
    public void Failed_players_rank_below_solvers_and_never_move()
    {
        var players = new[] { "a", "b", "c" }.Select(id => TestBoards.Player(id)).ToDictionary(p => p.PlayerId);
        var ranked = RankingService.Rank([Fail("a"), Ok("b", 50), Fail("c")]);

        var awards = RankingService.AssignMovement(ranked, id => players[id]);

        Assert.Equal("b", awards[0].PlayerId);
        Assert.Equal(3, awards[0].Steps);
        Assert.All(awards.Skip(1), a => Assert.Equal(0, a.Steps));
    }

    [Fact]
    public void Lexicographic_sort_key_breaks_ties_with_later_criteria()
    {
        var ranked = RankingService.Rank([Ok("slow", 3, 31_100), Ok("worse", 4, 18_000), Ok("fast", 3, 22_300)]);
        Assert.Equal(["fast", "slow", "worse"], ranked.Select(r => r.PlayerId));
    }

    [Fact]
    public void Double_movement_doubles_reward_and_is_consumed()
    {
        var players = new[] { "a", "b", "c" }.Select(id => TestBoards.Player(id)).ToDictionary(p => p.PlayerId);
        foreach (var p in players.Values) p.DoubleMovementActive = true;

        var awards = RankingService.AssignMovement(RankingService.Rank([Ok("a", 1), Ok("b", 2), Ok("c", 3)]), id => players[id]);

        Assert.Equal([6, 4, 2], awards.Select(a => a.Steps));
        Assert.All(awards, a => Assert.True(a.Doubled));
        Assert.All(players.Values, p => Assert.False(p.DoubleMovementActive));
    }

    [Fact]
    public void Double_movement_is_kept_when_player_does_not_place()
    {
        var players = new[] { "a", "b", "c", "d" }.Select(id => TestBoards.Player(id)).ToDictionary(p => p.PlayerId);
        players["d"].DoubleMovementActive = true;

        RankingService.AssignMovement(RankingService.Rank([Ok("a", 1), Ok("b", 2), Ok("c", 3), Ok("d", 4)]), id => players[id]);

        Assert.True(players["d"].DoubleMovementActive);
    }
}
