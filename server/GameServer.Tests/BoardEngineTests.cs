using GameServer.Models;
using GameServer.Services;

namespace GameServer.Tests;

public class BoardEngineTests
{
    private static (BoardEngine Engine, MovementResolution Res, List<BoardAction> Actions) Setup(
        BoardDefinition board, IRandomSource? rng = null, params (string Id, int Steps)[] moves)
    {
        var res = new MovementResolution();
        foreach (var m in moves) res.Pending.Enqueue(m);
        return (new BoardEngine(board, rng ?? new ScriptedRandom()), res, new List<BoardAction>());
    }

    [Fact]
    public void Normal_move_hops_through_every_tile()
    {
        var p = TestBoards.Player("a", 5);
        var (engine, res, actions) = Setup(TestBoards.Make(53), null, ("a", 3));

        var status = engine.Continue([p], res, actions);

        Assert.Equal(ResolutionStatus.Completed, status);
        Assert.Equal(8, p.BoardPosition);
        var move = Assert.Single(actions);
        Assert.Equal("move", move.Type);
        Assert.Equal([6, 7, 8], move.Path);
    }

    [Fact]
    public void Plus_two_tile_moves_two_more()
    {
        var p = TestBoards.Player("a", 0);
        var (engine, res, actions) = Setup(TestBoards.Make(53, (3, TileType.PlusTwo)), null, ("a", 3));

        engine.Continue([p], res, actions);

        Assert.Equal(5, p.BoardPosition);
        Assert.Contains(actions, a => a is { Type: "effect", Effect: "plusTwo" });
    }

    [Fact]
    public void Minus_one_tile_moves_back_one()
    {
        var p = TestBoards.Player("a", 0);
        var (engine, res, actions) = Setup(TestBoards.Make(53, (2, TileType.MinusOne)), null, ("a", 2));

        engine.Continue([p], res, actions);

        Assert.Equal(1, p.BoardPosition);
        Assert.Equal([1], actions.Last(a => a.Type == "move").Path);
    }

    [Fact]
    public void Shield_blocks_minus_one_and_is_consumed()
    {
        var p = TestBoards.Player("a", 0);
        p.HasShield = true;
        var (engine, res, actions) = Setup(TestBoards.Make(53, (2, TileType.MinusOne)), null, ("a", 2));

        engine.Continue([p], res, actions);

        Assert.Equal(2, p.BoardPosition);
        Assert.False(p.HasShield);
        Assert.Contains(actions, a => a.Type == "shieldBlock");
    }

    [Fact]
    public void Shield_and_double_tiles_set_flags()
    {
        var a = TestBoards.Player("a", 0);
        var b = TestBoards.Player("b", 0);
        var (engine, res, actions) = Setup(TestBoards.Make(53, (1, TileType.Shield), (2, TileType.DoubleMovement)), null, ("a", 1), ("b", 2));

        engine.Continue([a, b], res, actions);

        Assert.True(a.HasShield);
        Assert.True(b.DoubleMovementActive);
    }

    [Fact]
    public void Portal_teleports_five_spaces()
    {
        var p = TestBoards.Player("a", 0);
        var (engine, res, actions) = Setup(TestBoards.Make(53, (2, TileType.Portal)), null, ("a", 2));

        engine.Continue([p], res, actions);

        Assert.Equal(7, p.BoardPosition);
        var portal = Assert.Single(actions, x => x.Type == "portal");
        Assert.Equal(2, portal.From);
        Assert.Equal(7, portal.To);
    }

    [Fact]
    public void Portal_clamps_to_finish_and_wins()
    {
        var p = TestBoards.Player("a", 48);
        var (engine, res, actions) = Setup(TestBoards.Make(53, (50, TileType.Portal)), null, ("a", 2));

        var status = engine.Continue([p], res, actions);

        Assert.Equal(ResolutionStatus.Won, status);
        Assert.Equal(52, p.BoardPosition);
        Assert.Equal("a", res.WinnerId);
    }

    [Fact]
    public void Finish_does_not_need_exact_roll()
    {
        var p = TestBoards.Player("a", 50);
        var other = TestBoards.Player("b", 10);
        var (engine, res, actions) = Setup(TestBoards.Make(53), null, ("a", 3), ("b", 2));

        var status = engine.Continue([p, other], res, actions);

        Assert.Equal(ResolutionStatus.Won, status);
        Assert.Equal(52, p.BoardPosition);
        Assert.Equal("finish", actions.Last().Type);
        Assert.Equal(10, other.BoardPosition); // remaining movement is discarded once someone wins
    }

    [Fact]
    public void Chained_effects_are_limited_to_prevent_infinite_loops()
    {
        // 2(+2) -> 4(-1) -> 3(-1) -> 2(+2) -> ... would loop forever without the limit.
        var board = TestBoards.Make(20, (2, TileType.PlusTwo), (4, TileType.MinusOne), (3, TileType.MinusOne));
        var p = TestBoards.Player("a", 0);
        var (engine, res, actions) = Setup(board, null, ("a", 2));

        var status = engine.Continue([p], res, actions);

        Assert.Equal(ResolutionStatus.Completed, status);
        Assert.Equal(BoardEngine.MaxChainedEffects, actions.Count(a => a.Type == "effect"));
    }

    [Fact]
    public void Swap_tile_requests_a_choice_and_resumes_remaining_moves()
    {
        var a = TestBoards.Player("a", 0);
        var b = TestBoards.Player("b", 10);
        var (engine, res, actions) = Setup(TestBoards.Make(53, (2, TileType.Swap)), null, ("a", 2), ("b", 1));

        Assert.Equal(ResolutionStatus.NeedsSwap, engine.Continue([a, b], res, actions));
        Assert.Equal("a", res.SwapChooserId);
        Assert.Single(res.Pending);

        engine.ApplySwap(a, b, actions);
        Assert.Equal(10, a.BoardPosition);
        Assert.Equal(2, b.BoardPosition);

        Assert.Equal(ResolutionStatus.Completed, engine.Continue([a, b], res, actions));
        Assert.Equal(3, b.BoardPosition); // the swap destination (tile 2) was not re-triggered; b then moved +1
    }

    [Fact]
    public void Swap_does_not_trigger_destination_tile()
    {
        var a = TestBoards.Player("a", 1);
        var b = TestBoards.Player("b", 9);
        var engine = new BoardEngine(TestBoards.Make(53, (9, TileType.PlusTwo), (1, TileType.MinusOne)), new ScriptedRandom());
        var actions = new List<BoardAction>();

        engine.ApplySwap(a, b, actions);

        Assert.Equal(9, a.BoardPosition);
        Assert.Equal(1, b.BoardPosition);
        Assert.Single(actions);
    }

    [Fact]
    public void Shield_protects_target_from_being_swapped_backwards()
    {
        var a = TestBoards.Player("a", 2);
        var b = TestBoards.Player("b", 20);
        b.HasShield = true;
        var engine = new BoardEngine(TestBoards.Make(53), new ScriptedRandom());
        var actions = new List<BoardAction>();

        engine.ApplySwap(a, b, actions);

        Assert.Equal(2, a.BoardPosition);
        Assert.Equal(20, b.BoardPosition);
        Assert.False(b.HasShield);
        Assert.Equal("shieldBlock", Assert.Single(actions).Type);
    }

    [Fact]
    public void Swap_candidates_exclude_self_and_disconnected_players()
    {
        var players = new[] { TestBoards.Player("a"), TestBoards.Player("b"), TestBoards.Player("c", connected: false) };
        Assert.Equal(["b"], BoardEngine.SwapCandidates(players, "a"));
    }

    [Fact]
    public void Swap_with_no_valid_targets_is_skipped()
    {
        var a = TestBoards.Player("a", 0);
        var b = TestBoards.Player("b", 5, connected: false);
        var (engine, res, actions) = Setup(TestBoards.Make(53, (2, TileType.Swap)), null, ("a", 2));

        Assert.Equal(ResolutionStatus.Completed, engine.Continue([a, b], res, actions));
    }

    [Fact]
    public void Mystery_outcome_is_chosen_by_server_random()
    {
        var p = TestBoards.Player("a", 0);
        var rng = new ScriptedRandom(Array.IndexOf(BoardEngine.MysteryPool, MysteryOutcome.PlusTwo));
        var (engine, res, actions) = Setup(TestBoards.Make(53, (1, TileType.Mystery)), rng, ("a", 1));

        engine.Continue([p], res, actions);

        Assert.Equal(3, p.BoardPosition);
        var reveal = Assert.Single(actions, a => a.Effect == "mystery");
        Assert.Equal("PlusTwo", reveal.Outcome);
    }

    [Fact]
    public void Shield_blocks_negative_mystery()
    {
        var p = TestBoards.Player("a", 0);
        p.HasShield = true;
        var rng = new ScriptedRandom(Array.IndexOf(BoardEngine.MysteryPool, MysteryOutcome.MinusOne));
        var (engine, res, actions) = Setup(TestBoards.Make(53, (2, TileType.Mystery)), rng, ("a", 2));

        engine.Continue([p], res, actions);

        Assert.Equal(2, p.BoardPosition);
        Assert.False(p.HasShield);
    }
}
