namespace GameServer.Models;

public sealed record BoardTile(int Index, TileType Type, Biome Biome, double X, double Y);

public sealed record BiomeRegion(Biome Id, double X0, double X1);

public sealed record WorldSize(double Width, double Height);

public sealed class BoardDefinition
{
    public required WorldSize World { get; init; }
    public required IReadOnlyList<BiomeRegion> Biomes { get; init; }
    public required IReadOnlyList<BoardTile> Tiles { get; init; }

    public int FinishIndex => Tiles.Count - 1;
}
