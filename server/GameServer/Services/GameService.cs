using GameServer.MiniGames;
using GameServer.Models;

namespace GameServer.Services;

/// <summary>
/// Authoritative game rules and phase machine. Every public method must be called while holding
/// <c>lobby.Sync</c>. Commands validate the current phase and the calling player; time-based
/// transitions happen in <see cref="Tick"/>, which the game loop calls ~10x per second.
/// </summary>
public sealed class GameService(
    IGameNotifier notifier,
    DiceService dice,
    BoardService board,
    MiniGameService miniGames,
    LobbyService lobbies,
    IRandomSource rng,
    GameTimings timings,
    ILogger<GameService> log,
    DebugOptions? debug = null)
{
    private int FinishIndex => board.Board.FinishIndex;

    // ------------------------------------------------------------------ broadcasting

    public void BroadcastState(Lobby lobby, long now) =>
        notifier.ToLobby(lobby.Code, "StateUpdated", SnapshotBuilder.Build(lobby, now, FinishIndex, timings.MinPlayers));

    public void SendStateTo(Lobby lobby, PlayerState player, long now)
    {
        if (player.ConnectionId is null) return;
        notifier.ToConnection(lobby.Code, player.ConnectionId, "StateUpdated", SnapshotBuilder.Build(lobby, now, FinishIndex, timings.MinPlayers));
        SendPrivate(lobby, player);
    }

    private void SendPrivate(Lobby lobby, PlayerState player)
    {
        if (player.ConnectionId is null || lobby.ActiveMiniGame is null || lobby.Phase != GamePhase.MiniGamePlaying) return;
        var state = lobby.ActiveMiniGame.GetPrivateState(player.PlayerId);
        if (state is not null) notifier.ToConnection(lobby.Code, player.ConnectionId, "MiniGamePrivate", state);
    }

    private void SendPrivateToAll(Lobby lobby)
    {
        foreach (var p in lobby.Players) SendPrivate(lobby, p);
    }

    private void SetPhase(Lobby lobby, GamePhase phase, long now, int? durationMs)
    {
        lobby.Phase = phase;
        lobby.PhaseStartedAt = now;
        lobby.PhaseEndsAt = durationMs is { } d ? now + d : null;
        lobby.LastActivityAt = now;
    }

    // ------------------------------------------------------------------ lobby commands

    public CommandResult ChooseColor(Lobby lobby, PlayerState player, PawnColor color, long now)
    {
        if (lobby.Phase != GamePhase.Lobby) return CommandResult.Fail("Colours are locked once the game starts.");
        if (!Enum.IsDefined(color)) return CommandResult.Fail("That colour doesn't exist.");
        if (player.Color == color) return CommandResult.Success;
        if (lobby.Players.Any(p => p != player && p.Color == color)) return CommandResult.Fail("That colour was just taken!");

        player.Color = color;
        player.IsReady = false;
        BroadcastState(lobby, now);
        return CommandResult.Success;
    }

    public CommandResult SetReady(Lobby lobby, PlayerState player, bool ready, long now)
    {
        if (lobby.Phase != GamePhase.Lobby) return CommandResult.Fail("The game has already started.");
        if (ready && player.Color is null) return CommandResult.Fail("Pick a pawn colour first!");
        player.IsReady = ready;
        BroadcastState(lobby, now);
        return CommandResult.Success;
    }

    public string? CanStart(Lobby lobby, string playerId)
    {
        if (lobby.Phase != GamePhase.Lobby) return "The game has already started.";
        if (lobby.HostPlayerId != playerId) return "Only the host can start the game.";
        if (lobby.Players.Count < timings.MinPlayers)
            return timings.MinPlayers == 1 ? "You need at least 1 player." : $"You need at least {timings.MinPlayers} players.";
        if (lobby.Players.Any(p => !p.IsConnected)) return "Waiting for a disconnected player…";
        if (lobby.Players.Any(p => !p.IsReady || p.Color is null)) return "Everyone must be ready.";
        return null;
    }

    public CommandResult StartGame(Lobby lobby, PlayerState player, long now)
    {
        if (CanStart(lobby, player.PlayerId) is { } error) return CommandResult.Fail(error);

        foreach (var p in lobby.Players)
        {
            p.ResetForNewMatch();
            p.BoardPosition = Math.Clamp(debug?.StartPosition ?? 0, 0, FinishIndex - 1);
        }
        lobby.TurnOrder.Clear();
        lobby.TurnIndex = 0;
        lobby.TurnNumber = 0;
        lobby.CurrentTurnPlayerId = null;
        lobby.LastDiceValue = null;
        lobby.CurrentMiniGame = null;
        lobby.ActiveMiniGame = null;
        lobby.LastResults = null;
        lobby.Resolution = null;
        lobby.PendingSwap = null;
        lobby.WinnerPlayerId = null;
        lobby.FinalRanking = null;
        lobby.OrderRoll = new OrderRollState { Groups = [lobby.Players.Select(p => p.PlayerId).ToList()] };

        SetPhase(lobby, GamePhase.RollingForOrder, now, timings.OrderRollTimeout);
        log.LogInformation("Lobby {Code}: game started with {Count} players", lobby.Code, lobby.Players.Count);
        BroadcastState(lobby, now);
        return CommandResult.Success;
    }

    public CommandResult ReturnToLobby(Lobby lobby, PlayerState player, long now)
    {
        if (lobby.Phase != GamePhase.GameFinished) return CommandResult.Fail("The game isn't over yet.");
        if (lobby.HostPlayerId != player.PlayerId) return CommandResult.Fail("Only the host can do that.");

        foreach (var gone in lobby.Players.Where(p => p.HasLeft || !p.IsConnected).ToList())
            lobbies.RemovePlayerLocked(lobby, gone);
        foreach (var p in lobby.Players)
        {
            p.ResetForNewMatch();
            p.IsReady = false;
        }
        lobby.OrderRoll = null;
        lobby.TurnOrder.Clear();
        lobby.CurrentTurnPlayerId = null;
        lobby.WinnerPlayerId = null;
        lobby.FinalRanking = null;
        lobby.LastResults = null;
        SetPhase(lobby, GamePhase.Lobby, now, null);
        BroadcastState(lobby, now);
        return CommandResult.Success;
    }

    // ------------------------------------------------------------------ turn order

    public CommandResult RollInitialDice(Lobby lobby, PlayerState player, long now)
    {
        if (lobby.Phase != GamePhase.RollingForOrder || lobby.OrderRoll is not { } order)
            return CommandResult.Fail("It's not time to roll for order.");
        if (order.RoundComplete) return CommandResult.Fail("Hang on…");
        if (!order.PlayersRollingThisRound().Contains(player.PlayerId)) return CommandResult.Fail("You don't need to roll right now.");
        if (order.CurrentRolls.ContainsKey(player.PlayerId)) return CommandResult.Fail("You already rolled.");

        RecordOrderRoll(lobby, order, player, now);
        BroadcastState(lobby, now);
        return CommandResult.Success;
    }

    private void RecordOrderRoll(Lobby lobby, OrderRollState order, PlayerState player, long now)
    {
        var value = dice.RollD6();
        order.CurrentRolls[player.PlayerId] = value;
        (order.History.TryGetValue(player.PlayerId, out var h) ? h : order.History[player.PlayerId] = new()).Add(value);
        player.InitialDiceRoll = value;

        if (order.PlayersRollingThisRound().All(order.CurrentRolls.ContainsKey))
        {
            // Short pause so everyone sees the last die land before ties are resolved.
            order.RoundComplete = true;
            lobby.PhaseEndsAt = now + timings.OrderRoundPause;
        }
    }

    private void AdvanceOrderRound(Lobby lobby, OrderRollState order, long now)
    {
        order.Groups = TurnOrderService.Split(order.Groups, order.CurrentRolls);
        order.CurrentRolls.Clear();
        order.RoundComplete = false;

        if (TurnOrderService.IsResolved(order.Groups))
        {
            lobby.TurnOrder.Clear();
            lobby.TurnOrder.AddRange(TurnOrderService.Flatten(order.Groups));
            SetPhase(lobby, GamePhase.ShowingTurnOrder, now, timings.ShowTurnOrder);
        }
        else
        {
            order.Round++;
            lobby.PhaseEndsAt = now + timings.OrderRollTimeout;
        }
        BroadcastState(lobby, now);
    }

    // ------------------------------------------------------------------ turns

    private void StartTurn(Lobby lobby, int turnIndex, long now)
    {
        lobby.TurnIndex = turnIndex % lobby.TurnOrder.Count;
        lobby.TurnNumber++;
        lobby.CurrentTurnPlayerId = lobby.TurnOrder[lobby.TurnIndex];
        lobby.LastDiceValue = null;
        lobby.CurrentMiniGame = null;
        lobby.LastResults = null;
        lobby.Resolution = null;
        lobby.PendingSwap = null;
        SetPhase(lobby, GamePhase.WaitingForDiceRoll, now, timings.TurnRollTimeout);
        BroadcastState(lobby, now);
    }

    public CommandResult RollTurnDice(Lobby lobby, PlayerState player, long now)
    {
        if (lobby.Phase != GamePhase.WaitingForDiceRoll) return CommandResult.Fail("You can't roll right now.");
        if (lobby.CurrentTurnPlayerId != player.PlayerId) return CommandResult.Fail("It's not your turn!");
        RollTurnDiceInternal(lobby, now);
        return CommandResult.Success;
    }

    private void RollTurnDiceInternal(Lobby lobby, long now)
    {
        var face = dice.RollD6();
        lobby.LastDiceValue = face;
        var rolled = debug?.ForceMiniGame ?? DiceService.MiniGameForFace(face);
        lobby.CurrentMiniGame = miniGames.ResolvePlayable(rolled);
        SetPhase(lobby, GamePhase.DiceRolling, now, timings.DiceRolling);
        BroadcastState(lobby, now);
    }

    // ------------------------------------------------------------------ mini-games

    private void PrepareMiniGame(Lobby lobby, long now)
    {
        var round = miniGames.CreateRound(lobby.CurrentMiniGame!.Value, lobby);
        round.Begin(now + timings.MiniGamePreparing);
        lobby.ActiveMiniGame = round;
        SetPhase(lobby, GamePhase.MiniGamePreparing, now, timings.MiniGamePreparing);
        BroadcastState(lobby, now);
    }

    private void BeginMiniGamePlay(Lobby lobby, long now)
    {
        var round = lobby.ActiveMiniGame!;
        SetPhase(lobby, GamePhase.MiniGamePlaying, now, null);
        lobby.PhaseEndsAt = round.EndAt;
        BroadcastState(lobby, now);
        SendPrivateToAll(lobby);
    }

    private void EndMiniGame(Lobby lobby, long now)
    {
        var round = lobby.ActiveMiniGame!;
        var participants = lobby.Players.Select(p => p.PlayerId).ToList();
        var ranked = RankingService.Rank(round.Score(participants));
        var awards = RankingService.AssignMovement(ranked, lobby.FindPlayer);

        var entries = ranked.Select((o, i) =>
        {
            var award = awards[i];
            return new ResultEntryDto(o.PlayerId, i + 1, o.Eligible, o.Detail, award.Steps, award.Doubled);
        }).ToList();
        lobby.LastResults = new ResultsDto(round.Type, round.Title, entries, round.GetReveal());

        var resolution = new MovementResolution();
        foreach (var award in awards.Where(a => a.Steps > 0)) resolution.Pending.Enqueue((award.PlayerId, award.Steps));
        lobby.Resolution = resolution;
        lobby.ActiveMiniGame = null;

        SetPhase(lobby, GamePhase.MiniGameResults, now, timings.MiniGameResults);
        BroadcastState(lobby, now);
    }

    public CommandResult SubmitWordleGuess(Lobby l, PlayerState p, string? guess, long now) =>
        Submit<WordleRound>(l, p, now, r => r.SubmitGuess(p.PlayerId, guess, now));

    public CommandResult SubmitChainAnswer(Lobby l, PlayerState p, string? answer, long now) =>
        Submit<ChainRound>(l, p, now, r => r.Submit(p.PlayerId, answer, now));

    public CommandResult SubmitHigherLowerAnswer(Lobby l, PlayerState p, int questionIndex, int choice, long now) =>
        Submit<HigherLowerRound>(l, p, now, r => r.Submit(p.PlayerId, questionIndex, choice, now));

    public CommandResult SubmitNameXAnswer(Lobby l, PlayerState p, string? answer, long now) =>
        Submit<NameXRound>(l, p, now, r => r.Submit(p.PlayerId, answer, now));

    public CommandResult SubmitPixelGuess(Lobby l, PlayerState p, string? guess, long now) =>
        Submit<PixelGuessRound>(l, p, now, r => r.Submit(p.PlayerId, guess, now));

    public CommandResult SubmitLogicAnswer(Lobby l, PlayerState p, int choice, long now) =>
        Submit<LogicRound>(l, p, now, r => r.Submit(p.PlayerId, choice, now));

    private CommandResult Submit<TRound>(Lobby lobby, PlayerState player, long now, Func<TRound, SubmitResult> submit)
        where TRound : MiniGameRound
    {
        if (lobby.Phase != GamePhase.MiniGamePlaying || lobby.ActiveMiniGame is not TRound round)
            return CommandResult.Fail("That mini-game isn't running.");
        if (!round.IsOpen(now)) return CommandResult.Fail("Time's up!");
        if (now - player.LastSubmitAt < timings.MinSubmitInterval) return CommandResult.Fail("Slow down!");
        player.LastSubmitAt = now;

        var result = submit(round);
        if (result.Accepted)
        {
            SendPrivate(lobby, player);
            BroadcastState(lobby, now);
        }
        return new CommandResult(result.Accepted, result.Accepted ? null : result.Message, result);
    }

    // ------------------------------------------------------------------ board movement

    private void BeginMovement(Lobby lobby, long now) => RunResolution(lobby, now, new List<BoardAction>());

    private void RunResolution(Lobby lobby, long now, List<BoardAction> actions)
    {
        var resolution = lobby.Resolution ??= new MovementResolution();
        board.Engine.Continue(lobby.Players, resolution, actions);

        var duration = actions.Sum(a => a.DurationMs) + timings.MovementTail;
        SetPhase(lobby, GamePhase.MovingPlayers, now, duration);
        if (actions.Count > 0)
            notifier.ToLobby(lobby.Code, "BoardActions", new BoardActionsDto(++lobby.ActionSequence, actions));
        BroadcastState(lobby, now);
    }

    private void AfterMovement(Lobby lobby, long now)
    {
        var resolution = lobby.Resolution!;
        switch (resolution.Status)
        {
            case ResolutionStatus.Won:
                FinishGame(lobby, resolution.WinnerId!, now);
                break;

            case ResolutionStatus.NeedsSwap:
                var chooser = resolution.SwapChooserId!;
                var candidates = BoardEngine.SwapCandidates(lobby.Players, chooser);
                if (candidates.Count == 0)
                {
                    RunResolution(lobby, now, new List<BoardAction>());
                    return;
                }
                lobby.PendingSwap = new SwapRequest
                {
                    ChooserId = chooser, Candidates = candidates, StartedAt = now, Deadline = now + timings.SwapChoice,
                };
                SetPhase(lobby, GamePhase.WaitingForSwapChoice, now, timings.SwapChoice);
                BroadcastState(lobby, now);
                break;

            default:
                StartTurn(lobby, lobby.TurnIndex + 1, now);
                break;
        }
    }

    public CommandResult ChooseSwapTarget(Lobby lobby, PlayerState player, string? targetId, long now)
    {
        if (lobby.Phase != GamePhase.WaitingForSwapChoice || lobby.PendingSwap is not { } swap)
            return CommandResult.Fail("There's no swap to choose right now.");
        if (swap.ChooserId != player.PlayerId) return CommandResult.Fail("It's not your swap!");
        if (targetId is null || targetId == player.PlayerId) return CommandResult.Fail("Pick another player.");
        var target = lobby.FindPlayer(targetId);
        if (target is null || !swap.Candidates.Contains(targetId) || !target.IsConnected)
            return CommandResult.Fail("You can't swap with that player.");

        ResolveSwap(lobby, player, target, now);
        return CommandResult.Success;
    }

    private void ResolveSwap(Lobby lobby, PlayerState chooser, PlayerState target, long now)
    {
        lobby.PendingSwap = null;
        var actions = new List<BoardAction>();
        board.Engine.ApplySwap(chooser, target, actions);
        RunResolution(lobby, now, actions);
    }

    private void AutoSwap(Lobby lobby, long now)
    {
        var swap = lobby.PendingSwap!;
        var valid = swap.Candidates.Select(lobby.FindPlayer).Where(p => p is { IsConnected: true }).ToList();
        var chooser = lobby.FindPlayer(swap.ChooserId);
        if (valid.Count == 0 || chooser is null)
        {
            lobby.PendingSwap = null;
            RunResolution(lobby, now, new List<BoardAction>());
            return;
        }
        ResolveSwap(lobby, chooser, rng.Pick(valid)!, now);
    }

    private void FinishGame(Lobby lobby, string winnerId, long now)
    {
        lobby.WinnerPlayerId = winnerId;
        lobby.FinalRanking = lobby.Players
            .OrderByDescending(p => p.PlayerId == winnerId)
            .ThenByDescending(p => p.BoardPosition)
            .ThenBy(p => lobby.TurnOrder.IndexOf(p.PlayerId))
            .Select(p => p.PlayerId)
            .ToList();
        lobby.PendingSwap = null;
        lobby.Resolution = null;
        SetPhase(lobby, GamePhase.GameFinished, now, null);
        log.LogInformation("Lobby {Code}: {Winner} won", lobby.Code, lobby.FindPlayer(winnerId)?.DisplayName);
        BroadcastState(lobby, now);
    }

    // ------------------------------------------------------------------ game loop

    public void Tick(Lobby lobby, long now)
    {
        var due = lobby.PhaseEndsAt is { } end && now >= end;
        switch (lobby.Phase)
        {
            case GamePhase.Lobby:
                TickLobby(lobby, now);
                break;

            case GamePhase.RollingForOrder:
                TickOrderRoll(lobby, now, due);
                break;

            case GamePhase.ShowingTurnOrder when due:
                StartTurn(lobby, 0, now);
                break;

            case GamePhase.WaitingForDiceRoll:
                var current = lobby.CurrentTurnPlayerId is { } id ? lobby.FindPlayer(id) : null;
                // Disconnected turn owners are auto-rolled quickly so the game never stalls.
                var absent = current is null || (!current.IsConnected &&
                    now - Math.Max(lobby.PhaseStartedAt, current.DisconnectedAt ?? 0) >= timings.DisconnectedAutoAction);
                if (due || absent) RollTurnDiceInternal(lobby, now);
                break;

            case GamePhase.DiceRolling when due:
                PrepareMiniGame(lobby, now);
                break;

            case GamePhase.MiniGamePreparing when due:
                BeginMiniGamePlay(lobby, now);
                break;

            case GamePhase.MiniGamePlaying:
                TickMiniGame(lobby, now);
                break;

            case GamePhase.MiniGameResults when due:
                BeginMovement(lobby, now);
                break;

            case GamePhase.MovingPlayers when due:
                AfterMovement(lobby, now);
                break;

            case GamePhase.WaitingForSwapChoice:
                var swap = lobby.PendingSwap!;
                var chooser = lobby.FindPlayer(swap.ChooserId);
                var chooserGone = chooser is null || (!chooser.IsConnected && now - swap.StartedAt >= timings.DisconnectedAutoAction);
                if (due || chooserGone) AutoSwap(lobby, now);
                break;
        }
    }

    private void TickLobby(Lobby lobby, long now)
    {
        var changed = false;
        foreach (var p in lobby.Players.Where(p => !p.IsConnected && now - (p.DisconnectedAt ?? now) >= timings.ReconnectGrace).ToList())
        {
            lobbies.RemovePlayerLocked(lobby, p);
            changed = true;
        }

        var host = lobby.FindPlayer(lobby.HostPlayerId);
        if (host is { IsConnected: false } && now - (host.DisconnectedAt ?? now) >= timings.HostHandoverGrace
            && lobby.Players.Any(p => p.IsConnected))
        {
            LobbyService.ReassignHostLocked(lobby);
            changed = lobby.HostPlayerId != host.PlayerId || changed;
        }

        if (changed && lobby.Players.Count > 0) BroadcastState(lobby, now);
    }

    private void TickOrderRoll(Lobby lobby, long now, bool due)
    {
        var order = lobby.OrderRoll!;
        if (order.RoundComplete)
        {
            if (due) AdvanceOrderRound(lobby, order, now);
            return;
        }

        // Auto-roll for anyone who timed out or is disconnected.
        var pending = order.PlayersRollingThisRound().Where(id => !order.CurrentRolls.ContainsKey(id)).ToList();
        if (pending.Count == 0)
        {
            // Nobody needs to roll (solo game, or everyone already resolved): finish the order now.
            AdvanceOrderRound(lobby, order, now);
            return;
        }
        var changed = false;
        foreach (var id in pending)
        {
            var p = lobby.FindPlayer(id);
            if (p is null) continue;
            var offline = !p.IsConnected && now - (p.DisconnectedAt ?? now) >= timings.DisconnectedAutoAction;
            if (!due && !offline) continue;
            RecordOrderRoll(lobby, order, p, now);
            changed = true;
        }
        if (changed) BroadcastState(lobby, now);
    }

    private void TickMiniGame(Lobby lobby, long now)
    {
        var round = lobby.ActiveMiniGame!;
        var active = lobby.ActivePlayerIds();
        var changed = round.Tick(now, active);
        if (round.IsComplete(now, active))
        {
            EndMiniGame(lobby, now);
            return;
        }
        if (changed)
        {
            lobby.PhaseEndsAt = round.EndAt;
            BroadcastState(lobby, now);
            SendPrivateToAll(lobby);
        }
    }
}
