using System.Collections.Concurrent;
using System.Threading.Channels;
using GameServer.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace GameServer.Services;

/// <summary>
/// Outgoing messages are queued while the lobby lock is held (never awaited inside the lock),
/// then delivered in order by a single pump task per lobby.
/// </summary>
public interface IGameNotifier
{
    void ToLobby(string lobbyCode, string method, object payload);
    void ToConnection(string lobbyCode, string connectionId, string method, object payload);
    void CloseLobby(string lobbyCode);
}

public sealed class SignalRGameNotifier(IHubContext<GameHub> hub, ILogger<SignalRGameNotifier> log) : IGameNotifier
{
    private sealed record Outgoing(string? ConnectionId, string Method, object Payload);

    private readonly ConcurrentDictionary<string, Channel<Outgoing>> _channels = new();

    public static string GroupName(string lobbyCode) => "lobby:" + lobbyCode;

    public void ToLobby(string lobbyCode, string method, object payload) =>
        ChannelFor(lobbyCode).Writer.TryWrite(new Outgoing(null, method, payload));

    public void ToConnection(string lobbyCode, string connectionId, string method, object payload) =>
        ChannelFor(lobbyCode).Writer.TryWrite(new Outgoing(connectionId, method, payload));

    public void CloseLobby(string lobbyCode)
    {
        if (_channels.TryRemove(lobbyCode, out var channel)) channel.Writer.TryComplete();
    }

    private Channel<Outgoing> ChannelFor(string lobbyCode) =>
        _channels.GetOrAdd(lobbyCode, code =>
        {
            var channel = Channel.CreateUnbounded<Outgoing>(new UnboundedChannelOptions { SingleReader = true });
            _ = Task.Run(() => Pump(code, channel.Reader));
            return channel;
        });

    private async Task Pump(string code, ChannelReader<Outgoing> reader)
    {
        await foreach (var msg in reader.ReadAllAsync())
        {
            try
            {
                var target = msg.ConnectionId is null ? hub.Clients.Group(GroupName(code)) : hub.Clients.Client(msg.ConnectionId);
                await target.SendAsync(msg.Method, msg.Payload);
            }
            catch (Exception ex)
            {
                log.LogWarning(ex, "Failed to deliver {Method} for lobby {Code}", msg.Method, code);
            }
        }
    }
}
