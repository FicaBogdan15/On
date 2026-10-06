namespace GameServer.Models;

public sealed class PlayerState
{
    /// <summary>Public identifier shared with every client.</summary>
    public required string PlayerId { get; init; }

    /// <summary>Secret, client-generated token used to reclaim this seat after a refresh. Never broadcast.</summary>
    public required string SessionToken { get; init; }

    public string? ConnectionId { get; set; }
    public required string DisplayName { get; set; }
    public PawnColor? Color { get; set; }
    public bool IsReady { get; set; }

    public int BoardPosition { get; set; }
    public bool HasShield { get; set; }
    public bool DoubleMovementActive { get; set; }
    public int? InitialDiceRoll { get; set; }

    public bool IsConnected { get; set; } = true;
    public long? DisconnectedAt { get; set; }

    /// <summary>Set when the player explicitly leaves a running match; they cannot reclaim the seat.</summary>
    public bool HasLeft { get; set; }

    public long JoinedAt { get; init; }

    /// <summary>Server timestamp of the last accepted answer submission, used for basic rate limiting.</summary>
    public long LastSubmitAt { get; set; }

    public void ResetForNewMatch()
    {
        BoardPosition = 0;
        HasShield = false;
        DoubleMovementActive = false;
        InitialDiceRoll = null;
        LastSubmitAt = 0;
    }
}
