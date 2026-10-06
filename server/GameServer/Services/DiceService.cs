using GameServer.Models;

namespace GameServer.Services;

public sealed class DiceService(IRandomSource rng)
{
    public int RollD6() => rng.Next(1, 7);

    public static MiniGameType MiniGameForFace(int face) => face switch
    {
        >= 1 and <= 6 => (MiniGameType)face,
        _ => throw new ArgumentOutOfRangeException(nameof(face), face, "A D6 face must be 1-6."),
    };
}
