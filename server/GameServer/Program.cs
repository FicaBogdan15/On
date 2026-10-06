using System.Text.Json;
using System.Text.Json.Serialization;
using GameServer.Hubs;
using GameServer.Services;

var builder = WebApplication.CreateBuilder(args);

// Render (and most PaaS hosts) provide the port to listen on via $PORT.
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port)) builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

var enumConverter = new JsonStringEnumConverter(JsonNamingPolicy.CamelCase);

builder.Services
    .AddSignalR(o =>
    {
        o.MaximumReceiveMessageSize = 8 * 1024;
        o.EnableDetailedErrors = builder.Environment.IsDevelopment();
        o.KeepAliveInterval = TimeSpan.FromSeconds(10);
        o.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
    })
    .AddJsonProtocol(o => o.PayloadSerializerOptions.Converters.Add(enumConverter));
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(enumConverter));

builder.Services.AddSingleton<IRandomSource, SecureRandomSource>();
builder.Services.AddSingleton(builder.Configuration.GetSection("Game").Get<GameTimings>() ?? new GameTimings());
builder.Services.AddSingleton(builder.Environment.IsDevelopment()
    ? builder.Configuration.GetSection("Debug").Get<DebugOptions>() ?? new DebugOptions()
    : new DebugOptions());
builder.Services.AddSingleton<ContentService>();
builder.Services.AddSingleton<BoardService>();
builder.Services.AddSingleton<DiceService>();
builder.Services.AddSingleton<MiniGameService>();
builder.Services.AddSingleton<IGameNotifier, SignalRGameNotifier>();
builder.Services.AddSingleton<LobbyService>();
builder.Services.AddSingleton<GameService>();
builder.Services.AddHostedService<GameLoopService>();

var app = builder.Build();

// Load and validate all JSON content at startup so problems show up in the logs immediately.
app.Services.GetRequiredService<ContentService>();
var boardService = app.Services.GetRequiredService<BoardService>();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/api/board", () => Results.Ok(boardService.Board));
app.MapGet("/api/lobbies/{code}", (string code, LobbyService lobbies) =>
{
    var lobby = lobbies.Find(code);
    if (lobby is null) return Results.NotFound(new { exists = false });
    lock (lobby.Sync)
        return Results.Ok(new { exists = true, phase = lobby.Phase, players = lobby.Players.Count, maxPlayers = LobbyService.MaxPlayers });
});

app.MapHub<GameHub>("/gameHub");

// SPA fallback: any unknown non-API route serves the React app.
app.MapFallbackToFile("index.html");

app.Run();
