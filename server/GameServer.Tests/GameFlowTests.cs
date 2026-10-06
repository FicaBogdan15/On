using GameServer.Models;
using GameServer.Services;
using Microsoft.Extensions.Logging.Abstractions;

namespace GameServer.Tests;

public class GameFlowTests
{
    private const string TokenA = "token-alice-0000000000";
    private const string TokenB = "token-bob-00000000000";

    private sealed record Harness(GameService Game, LobbyService Lobbies, Lobby Lobby, PlayerState Alice, PlayerState Bob);

    private static Harness CreateLobbyWithTwoPlayers(long now = 1_000)
    {
        var content = TestContent.Load();
        var rng = new SecureRandomSource();
        var notifier = new NullNotifier();
        var board = new BoardService(content, rng, NullLogger<BoardService>.Instance);
        var lobbies = new LobbyService(rng, notifier, NullLogger<LobbyService>.Instance);
        var game = new GameService(notifier, new DiceService(rng), board, new MiniGameService(content, rng), lobbies, rng,
            new GameTimings(), NullLogger<GameService>.Instance);

        var created = lobbies.Create("conn-a", "Alice", PawnColor.Red, TokenA, now);
        var joined = lobbies.Join("conn-b", created.Lobby!.Code, "Bob", TokenB, now);
        Assert.True(joined.Ok, joined.Error);
        return new Harness(game, lobbies, created.Lobby, created.Player!, joined.Player!);
    }

    [Fact]
    public void Room_codes_use_unambiguous_characters()
    {
        var h = CreateLobbyWithTwoPlayers();
        Assert.InRange(h.Lobby.Code.Length, 4, 6);
        Assert.DoesNotContain(h.Lobby.Code, c => "O0I1L".Contains(c));
    }

    [Fact]
    public void Colours_are_unique_and_validated_by_server()
    {
        var h = CreateLobbyWithTwoPlayers();
        Assert.False(h.Game.SetReady(h.Lobby, h.Bob, true, 2_000).Ok); // no colour yet
        Assert.False(h.Game.ChooseColor(h.Lobby, h.Bob, PawnColor.Red, 2_000).Ok); // taken by Alice
        Assert.True(h.Game.ChooseColor(h.Lobby, h.Bob, PawnColor.Blue, 2_000).Ok);
        Assert.True(h.Game.SetReady(h.Lobby, h.Bob, true, 2_000).Ok);
    }

    [Fact]
    public void Joining_rejects_duplicate_names_and_started_games()
    {
        var h = CreateLobbyWithTwoPlayers();
        Assert.False(h.Lobbies.Join("conn-c", h.Lobby.Code, "alice", "token-carl-00000000000", 2_000).Ok);
        Assert.False(h.Lobbies.Join("conn-c", "ZZZZ", "Carl", "token-carl-00000000000", 2_000).Ok);

        h.Game.ChooseColor(h.Lobby, h.Bob, PawnColor.Blue, 2_000);
        h.Game.SetReady(h.Lobby, h.Alice, true, 2_000);
        h.Game.SetReady(h.Lobby, h.Bob, true, 2_000);
        h.Game.StartGame(h.Lobby, h.Alice, 2_000);

        var late = h.Lobbies.Join("conn-c", h.Lobby.Code, "Carl", "token-carl-00000000000", 3_000);
        Assert.False(late.Ok);
        // ...but the same session token can always reconnect.
        Assert.True(h.Lobbies.Reconnect("conn-b2", h.Lobby.Code, TokenB, 3_000).Ok);
    }

    [Fact]
    public void Only_host_can_start_and_only_when_everyone_is_ready()
    {
        var h = CreateLobbyWithTwoPlayers();
        h.Game.ChooseColor(h.Lobby, h.Bob, PawnColor.Blue, 2_000);
        h.Game.SetReady(h.Lobby, h.Alice, true, 2_000);

        Assert.False(h.Game.StartGame(h.Lobby, h.Alice, 2_000).Ok); // bob not ready
        h.Game.SetReady(h.Lobby, h.Bob, true, 2_000);
        Assert.False(h.Game.StartGame(h.Lobby, h.Bob, 2_000).Ok); // not host
        Assert.True(h.Game.StartGame(h.Lobby, h.Alice, 2_000).Ok);
        Assert.Equal(GamePhase.RollingForOrder, h.Lobby.Phase);
    }

    [Fact]
    public void Full_turn_runs_from_order_roll_to_next_turn()
    {
        var h = CreateLobbyWithTwoPlayers();
        long now = 2_000;
        h.Game.ChooseColor(h.Lobby, h.Bob, PawnColor.Blue, now);
        h.Game.SetReady(h.Lobby, h.Alice, true, now);
        h.Game.SetReady(h.Lobby, h.Bob, true, now);
        h.Game.StartGame(h.Lobby, h.Alice, now);

        Assert.False(h.Game.RollTurnDice(h.Lobby, h.Alice, now).Ok); // wrong phase

        // Roll for order until ties are resolved.
        for (var guard = 0; h.Lobby.Phase == GamePhase.RollingForOrder && guard < 100; guard++)
        {
            foreach (var p in new[] { h.Alice, h.Bob }) h.Game.RollInitialDice(h.Lobby, p, now);
            now += 3_000;
            h.Game.Tick(h.Lobby, now);
        }
        Assert.Equal(GamePhase.ShowingTurnOrder, h.Lobby.Phase);
        Assert.Equal(2, h.Lobby.TurnOrder.Count);

        now += 6_000;
        h.Game.Tick(h.Lobby, now);
        Assert.Equal(GamePhase.WaitingForDiceRoll, h.Lobby.Phase);

        var first = h.Lobby.FindPlayer(h.Lobby.CurrentTurnPlayerId!)!;
        var second = first == h.Alice ? h.Bob : h.Alice;
        Assert.False(h.Game.RollTurnDice(h.Lobby, second, now).Ok);
        Assert.True(h.Game.RollTurnDice(h.Lobby, first, now).Ok);
        Assert.Equal(GamePhase.DiceRolling, h.Lobby.Phase);
        Assert.InRange(h.Lobby.LastDiceValue!.Value, 1, 6);

        var sawMiniGame = false;
        for (var guard = 0; guard < 5_000 && !(h.Lobby.Phase == GamePhase.WaitingForDiceRoll && h.Lobby.TurnNumber == 2); guard++)
        {
            now += 250;
            h.Game.Tick(h.Lobby, now);
            sawMiniGame |= h.Lobby.Phase == GamePhase.MiniGamePlaying;
            if (h.Lobby.Phase == GamePhase.WaitingForSwapChoice) h.Game.Tick(h.Lobby, now + 20_000);
            if (h.Lobby.Phase == GamePhase.GameFinished) break;
        }

        Assert.True(sawMiniGame);
        Assert.Equal(GamePhase.WaitingForDiceRoll, h.Lobby.Phase);
        Assert.Equal(second.PlayerId, h.Lobby.CurrentTurnPlayerId);
    }

    [Fact]
    public void Solo_game_starts_and_plays_a_turn_when_min_players_is_one()
    {
        var content = TestContent.Load();
        var rng = new SecureRandomSource();
        var notifier = new NullNotifier();
        var lobbies = new LobbyService(rng, notifier, NullLogger<LobbyService>.Instance);
        var game = new GameService(notifier, new DiceService(rng), new BoardService(content, rng, NullLogger<BoardService>.Instance),
            new MiniGameService(content, rng), lobbies, rng, new GameTimings { MinPlayers = 1 }, NullLogger<GameService>.Instance);
        var created = lobbies.Create("conn-a", "Solo", PawnColor.Red, TokenA, 1_000);
        var lobby = created.Lobby!;
        var solo = created.Player!;

        game.SetReady(lobby, solo, true, 1_000);
        Assert.True(game.StartGame(lobby, solo, 1_000).Ok);

        long now = 1_000;
        for (var guard = 0; guard < 100 && lobby.Phase != GamePhase.WaitingForDiceRoll; guard++) game.Tick(lobby, now += 1_000);
        Assert.Equal(GamePhase.WaitingForDiceRoll, lobby.Phase);
        Assert.Equal(solo.PlayerId, lobby.CurrentTurnPlayerId);
        Assert.True(game.RollTurnDice(lobby, solo, now).Ok);
    }

    [Fact]
    public void Default_minimum_is_two_players()
    {
        var content = TestContent.Load();
        var rng = new SecureRandomSource();
        var notifier = new NullNotifier();
        var lobbies = new LobbyService(rng, notifier, NullLogger<LobbyService>.Instance);
        var game = new GameService(notifier, new DiceService(rng), new BoardService(content, rng, NullLogger<BoardService>.Instance),
            new MiniGameService(content, rng), lobbies, rng, new GameTimings(), NullLogger<GameService>.Instance);
        var created = lobbies.Create("conn-a", "Solo", PawnColor.Red, TokenA, 1_000);
        game.SetReady(created.Lobby!, created.Player!, true, 1_000);
        Assert.False(game.StartGame(created.Lobby!, created.Player!, 1_000).Ok);
    }

    [Fact]
    public void Swap_target_is_validated_by_server()
    {
        var h = CreateLobbyWithTwoPlayers();
        h.Alice.BoardPosition = 3;
        h.Bob.BoardPosition = 12;
        h.Lobby.Phase = GamePhase.WaitingForSwapChoice;
        h.Lobby.Resolution = new MovementResolution();
        h.Lobby.PendingSwap = new SwapRequest { ChooserId = h.Alice.PlayerId, Candidates = [h.Bob.PlayerId], StartedAt = 0, Deadline = 10_000 };

        Assert.False(h.Game.ChooseSwapTarget(h.Lobby, h.Bob, h.Alice.PlayerId, 100).Ok); // not the chooser
        Assert.False(h.Game.ChooseSwapTarget(h.Lobby, h.Alice, h.Alice.PlayerId, 100).Ok); // self
        Assert.False(h.Game.ChooseSwapTarget(h.Lobby, h.Alice, "nobody", 100).Ok); // invalid

        h.Bob.IsConnected = false;
        Assert.False(h.Game.ChooseSwapTarget(h.Lobby, h.Alice, h.Bob.PlayerId, 100).Ok); // disconnected
        h.Bob.IsConnected = true;

        Assert.True(h.Game.ChooseSwapTarget(h.Lobby, h.Alice, h.Bob.PlayerId, 100).Ok);
        Assert.Equal(12, h.Alice.BoardPosition);
        Assert.Equal(3, h.Bob.BoardPosition);
        Assert.Equal(GamePhase.MovingPlayers, h.Lobby.Phase);
    }

    [Fact]
    public void Swap_timeout_picks_a_random_valid_opponent()
    {
        var h = CreateLobbyWithTwoPlayers();
        h.Alice.BoardPosition = 1;
        h.Bob.BoardPosition = 9;
        h.Lobby.Phase = GamePhase.WaitingForSwapChoice;
        h.Lobby.PhaseEndsAt = 10_000;
        h.Lobby.Resolution = new MovementResolution();
        h.Lobby.PendingSwap = new SwapRequest { ChooserId = h.Alice.PlayerId, Candidates = [h.Bob.PlayerId], StartedAt = 0, Deadline = 10_000 };

        h.Game.Tick(h.Lobby, 10_001);

        Assert.Equal(9, h.Alice.BoardPosition);
        Assert.Equal(1, h.Bob.BoardPosition);
    }
}
