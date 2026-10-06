using GameServer.Models;
using GameServer.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace GameServer.Tests;

/// <summary>Returns queued values in order (each must be within range); falls back to the minimum.</summary>
public sealed class ScriptedRandom(params int[] values) : IRandomSource
{
    private readonly Queue<int> _values = new(values);

    public void Enqueue(params int[] more)
    {
        foreach (var v in more) _values.Enqueue(v);
    }

    public int Next(int minInclusive, int maxExclusive)
    {
        if (_values.Count == 0) return minInclusive;
        var v = _values.Dequeue();
        Assert.InRange(v, minInclusive, maxExclusive - 1);
        return v;
    }
}

public sealed class NullNotifier : IGameNotifier
{
    public List<(string Method, object Payload)> Sent { get; } = new();
    public void ToLobby(string lobbyCode, string method, object payload) => Sent.Add((method, payload));
    public void ToConnection(string lobbyCode, string connectionId, string method, object payload) => Sent.Add((method, payload));
    public void CloseLobby(string lobbyCode) { }
}

public static class TestBoards
{
    /// <summary>Board where index 0 is Start, last is Finish and the given overrides set specific tiles.</summary>
    public static BoardDefinition Make(int count, params (int Index, TileType Type)[] overrides)
    {
        var tiles = Enumerable.Range(0, count).Select(i =>
            new BoardTile(i, i == 0 ? TileType.Start : i == count - 1 ? TileType.Finish : TileType.Empty, Biome.Forest, i * 10, 0)).ToList();
        foreach (var (index, type) in overrides) tiles[index] = tiles[index] with { Type = type };
        return new BoardDefinition { World = new WorldSize(1000, 100), Biomes = [], Tiles = tiles };
    }

    public static PlayerState Player(string id, int position = 0, bool connected = true) => new()
    {
        PlayerId = id, SessionToken = "token-" + id + "-0000000000", DisplayName = id, BoardPosition = position, IsConnected = connected,
        Color = PawnColor.Red,
    };
}

public static class TestContent
{
    public static string GameDataPath()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var candidate = Path.Combine(dir.FullName, "GameServer", "GameData");
            if (Directory.Exists(candidate)) return candidate;
            dir = dir.Parent;
        }
        throw new DirectoryNotFoundException("Could not locate server/GameServer/GameData");
    }

    public static ContentService Load()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["GameDataPath"] = GameDataPath() })
            .Build();
        return new ContentService(NullLogger<ContentService>.Instance, config);
    }
}
