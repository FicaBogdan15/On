using GameServer.Models;

namespace GameServer.Services;

public enum ResolutionStatus
{
    Completed,
    NeedsSwap,
    Won,
}

public enum MysteryOutcome
{
    PlusTwo,
    MinusOne,
    Shield,
    DoubleMovement,
    Swap,
    AdvanceThree,
}

/// <summary>Pending movement for one mini-game result. Resumable so a Swap choice can pause it.</summary>
public sealed class MovementResolution
{
    public Queue<(string PlayerId, int Steps)> Pending { get; } = new();
    public ResolutionStatus Status { get; set; } = ResolutionStatus.Completed;
    public string? SwapChooserId { get; set; }
    public string? WinnerId { get; set; }
}

/// <summary>
/// Pure board rules: walking, tile effects, chained effects, shields, swaps and finishing.
/// It mutates PlayerState positions/flags directly and records the animation sequence as BoardActions.
/// </summary>
public sealed class BoardEngine(BoardDefinition board, IRandomSource rng)
{
    /// <summary>Upper bound on automatic tile effects triggered by one landing (prevents +2/-1 ping-pong loops).</summary>
    public const int MaxChainedEffects = 5;

    public const int PortalDistance = 5;
    public const int MysteryAdvance = 3;

    public static readonly MysteryOutcome[] MysteryPool = Enum.GetValues<MysteryOutcome>();

    public BoardDefinition Board => board;

    /// <summary>Process queued moves until done, a swap choice is needed, or someone reaches the finish.</summary>
    public ResolutionStatus Continue(IReadOnlyList<PlayerState> players, MovementResolution res, List<BoardAction> actions)
    {
        while (res.Pending.Count > 0)
        {
            var (playerId, steps) = res.Pending.Dequeue();
            var player = players.FirstOrDefault(p => p.PlayerId == playerId);
            if (player is null || steps == 0) continue;

            var status = Walk(player, steps, actions);
            if (status == ResolutionStatus.Completed)
                status = Land(player, players, res, actions, 0);

            if (status == ResolutionStatus.Won) res.WinnerId = player.PlayerId;
            if (status != ResolutionStatus.Completed) return res.Status = status;
        }
        return res.Status = ResolutionStatus.Completed;
    }

    public static List<string> SwapCandidates(IEnumerable<PlayerState> players, string chooserId) =>
        players.Where(p => p.PlayerId != chooserId && p.IsConnected && !p.HasLeft).Select(p => p.PlayerId).ToList();

    /// <summary>
    /// Swap positions. A shield protects the target from being swapped backwards (the shield is consumed).
    /// The destination tiles are intentionally NOT triggered to avoid confusing chain reactions.
    /// </summary>
    public void ApplySwap(PlayerState chooser, PlayerState target, List<BoardAction> actions)
    {
        if (target.HasShield && target.BoardPosition > chooser.BoardPosition)
        {
            target.HasShield = false;
            actions.Add(BoardAction.ShieldBlock(target.PlayerId));
            return;
        }

        var chooserFrom = chooser.BoardPosition;
        var targetFrom = target.BoardPosition;
        chooser.BoardPosition = targetFrom;
        target.BoardPosition = chooserFrom;
        actions.Add(BoardAction.Swap(chooser.PlayerId, target.PlayerId, chooserFrom, targetFrom));
    }

    /// <summary>Animated step-by-step movement, clamped to [0, finish]. Reaching the finish needs no exact roll.</summary>
    internal ResolutionStatus Walk(PlayerState player, int delta, List<BoardAction> actions)
    {
        var from = player.BoardPosition;
        var target = Math.Clamp(from + delta, 0, board.FinishIndex);
        if (target == from) return ResolutionStatus.Completed;

        var dir = Math.Sign(target - from);
        var path = new List<int>();
        for (var i = from + dir; i != target + dir; i += dir) path.Add(i);

        actions.Add(BoardAction.Move(player.PlayerId, from, path.ToArray()));
        player.BoardPosition = target;
        return CheckFinish(player, actions);
    }

    private ResolutionStatus Teleport(PlayerState player, int distance, List<BoardAction> actions)
    {
        var from = player.BoardPosition;
        var target = Math.Clamp(from + distance, 0, board.FinishIndex);
        if (target == from) return ResolutionStatus.Completed;

        actions.Add(BoardAction.Portal(player.PlayerId, from, target));
        player.BoardPosition = target;
        return CheckFinish(player, actions);
    }

    private ResolutionStatus CheckFinish(PlayerState player, List<BoardAction> actions)
    {
        if (player.BoardPosition < board.FinishIndex) return ResolutionStatus.Completed;
        actions.Add(BoardAction.Finish(player.PlayerId));
        return ResolutionStatus.Won;
    }

    private ResolutionStatus Land(PlayerState player, IReadOnlyList<PlayerState> players, MovementResolution res,
        List<BoardAction> actions, int depth)
    {
        if (depth >= MaxChainedEffects) return ResolutionStatus.Completed;
        var tile = board.Tiles[player.BoardPosition];
        return ApplyEffect(tile.Type, player, players, res, actions, depth, announce: true);
    }

    private ResolutionStatus ApplyEffect(TileType type, PlayerState player, IReadOnlyList<PlayerState> players,
        MovementResolution res, List<BoardAction> actions, int depth, bool announce)
    {
        void Announce(string effect)
        {
            if (announce) actions.Add(BoardAction.TileEffect(player.PlayerId, effect));
        }

        ResolutionStatus Then(ResolutionStatus moved) =>
            moved == ResolutionStatus.Completed ? Land(player, players, res, actions, depth + 1) : moved;

        switch (type)
        {
            case TileType.PlusTwo:
                Announce("plusTwo");
                return Then(Walk(player, 2, actions));

            case TileType.MinusOne:
                Announce("minusOne");
                if (player.HasShield)
                {
                    player.HasShield = false;
                    actions.Add(BoardAction.ShieldBlock(player.PlayerId));
                    return ResolutionStatus.Completed;
                }
                return Then(Walk(player, -1, actions));

            case TileType.Shield:
                Announce("shield");
                player.HasShield = true;
                return ResolutionStatus.Completed;

            case TileType.DoubleMovement:
                Announce("doubleMovement");
                player.DoubleMovementActive = true;
                return ResolutionStatus.Completed;

            case TileType.Portal:
                Announce("portal");
                return Then(Teleport(player, PortalDistance, actions));

            case TileType.Swap:
                Announce("swap");
                if (SwapCandidates(players, player.PlayerId).Count == 0) return ResolutionStatus.Completed;
                res.SwapChooserId = player.PlayerId;
                return ResolutionStatus.NeedsSwap;

            case TileType.Mystery:
                return ApplyMystery(player, players, res, actions, depth);

            default:
                return ResolutionStatus.Completed;
        }
    }

    private ResolutionStatus ApplyMystery(PlayerState player, IReadOnlyList<PlayerState> players,
        MovementResolution res, List<BoardAction> actions, int depth)
    {
        var outcome = rng.Pick(MysteryPool);
        actions.Add(BoardAction.TileEffect(player.PlayerId, "mystery", outcome.ToString()));

        if (outcome == MysteryOutcome.AdvanceThree)
        {
            var moved = Walk(player, MysteryAdvance, actions);
            return moved == ResolutionStatus.Completed ? Land(player, players, res, actions, depth + 1) : moved;
        }

        var asTile = outcome switch
        {
            MysteryOutcome.PlusTwo => TileType.PlusTwo,
            MysteryOutcome.MinusOne => TileType.MinusOne,
            MysteryOutcome.Shield => TileType.Shield,
            MysteryOutcome.DoubleMovement => TileType.DoubleMovement,
            _ => TileType.Swap,
        };
        // The reveal already announced the outcome, so skip the duplicate tile popup.
        return ApplyEffect(asTile, player, players, res, actions, depth, announce: false);
    }
}
