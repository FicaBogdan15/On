namespace GameServer.Models;

public enum GamePhase
{
    Lobby,
    RollingForOrder,
    ShowingTurnOrder,
    WaitingForDiceRoll,
    DiceRolling,
    MiniGamePreparing,
    MiniGamePlaying,
    MiniGameResults,
    MovingPlayers,
    WaitingForSwapChoice,
    GameFinished,
}

public enum PawnColor
{
    Red,
    Blue,
    Green,
    Yellow,
    Purple,
    Orange,
    Cyan,
    Pink,
}

/// <summary>Numeric values match the D6 face that selects the mini-game.</summary>
public enum MiniGameType
{
    Wordle = 1,
    Chain = 2,
    HigherLower = 3,
    NameX = 4,
    PixelGuess = 5,
    Logic = 6,
}

public enum TileType
{
    Start,
    Empty,
    Mystery,
    Shield,
    Swap,
    PlusTwo,
    MinusOne,
    DoubleMovement,
    Portal,
    Finish,
}

public enum Biome
{
    Forest,
    Village,
    Desert,
    Snow,
}
