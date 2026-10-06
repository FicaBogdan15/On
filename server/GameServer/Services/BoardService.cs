using System.Text.Json;
using GameServer.Models;

namespace GameServer.Services;

/// <summary>Loads the declarative board from GameData/board.json and owns the rule engine.</summary>
public sealed class BoardService
{
    public BoardDefinition Board { get; }
    public BoardEngine Engine { get; }

    public BoardService(ContentService content, IRandomSource rng, ILogger<BoardService> log)
    {
        Board = Load(Path.Combine(content.DataDirectory, "board.json"), log);
        Engine = new BoardEngine(Board, rng);
        log.LogInformation("Board loaded: {Tiles} tiles, finish at {Finish}", Board.Tiles.Count, Board.FinishIndex);
    }

    public static bool TryParseTileType(string? raw, out TileType type) =>
        Enum.TryParse((raw ?? "").Replace("_", "").Replace("-", ""), ignoreCase: true, out type);

    public static BoardDefinition Load(string path, ILogger log)
    {
        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            var root = doc.RootElement;

            var world = root.GetProperty("world");
            var size = new WorldSize(world.GetProperty("width").GetDouble(), world.GetProperty("height").GetDouble());

            var biomes = root.GetProperty("biomes").EnumerateArray()
                .Select(b => new BiomeRegion(
                    Enum.Parse<Biome>(b.GetProperty("id").GetString()!, ignoreCase: true),
                    b.GetProperty("x0").GetDouble(),
                    b.GetProperty("x1").GetDouble()))
                .ToList();

            var tiles = new List<BoardTile>();
            foreach (var t in root.GetProperty("tiles").EnumerateArray())
            {
                var index = t.GetProperty("index").GetInt32();
                if (index != tiles.Count) throw new InvalidDataException($"tile indices must be contiguous; expected {tiles.Count}, got {index}");

                var rawType = t.GetProperty("type").GetString();
                if (!TryParseTileType(rawType, out var type))
                {
                    log.LogError("board.json tile {Index}: unknown type '{Type}', treating as empty", index, rawType);
                    type = TileType.Empty;
                }
                var biome = Enum.TryParse<Biome>(t.GetProperty("biome").GetString(), true, out var b) ? b : Biome.Forest;
                tiles.Add(new BoardTile(index, type, biome, t.GetProperty("x").GetDouble(), t.GetProperty("y").GetDouble()));
            }

            if (tiles.Count < 10) throw new InvalidDataException("board needs at least 10 tiles");
            tiles[0] = tiles[0] with { Type = TileType.Start };
            tiles[^1] = tiles[^1] with { Type = TileType.Finish };
            return new BoardDefinition { World = size, Biomes = biomes, Tiles = tiles };
        }
        catch (Exception ex)
        {
            log.LogError(ex, "board.json at {Path} is invalid. Falling back to a generated straight board.", path);
            return Fallback();
        }
    }

    private static BoardDefinition Fallback()
    {
        var tiles = Enumerable.Range(0, 53).Select(i =>
        {
            var biome = (Biome)Math.Min(3, i / 14);
            var type = i == 0 ? TileType.Start : i == 52 ? TileType.Finish : TileType.Empty;
            return new BoardTile(i, type, biome, 150 + i * 120, 700 + Math.Sin(i * 0.5) * 300);
        }).ToList();
        return new BoardDefinition
        {
            World = new WorldSize(150 + 53 * 120 + 150, 1400),
            Biomes = Enum.GetValues<Biome>().Select((b, i) => new BiomeRegion(b, i * 1650, (i + 1) * 1650)).ToList(),
            Tiles = tiles,
        };
    }
}
