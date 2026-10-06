# Pixel Pawns

A 2D pixel-art **online party board game** for 2–8 players. Classic board-game pawns race along a winding trail through four living biomes (Forest → Village → Desert → Snow) to a castle at the finish. Each turn the active player rolls a D6 that picks a quick puzzle mini-game. **Everyone** plays it at the same time, and the top three move +3 / +2 / +1.

- **Mini-games**: 1 Wordle Rush · 2 Chain · 3 Higher or Lower · 4 Name X with Y · 5 Guess From Pixels · 6 Logic & Patterns
- **Special spaces**: Mystery, Shield, Swap, +2, −1, Double Movement, Portal
- **Fully server-authoritative multiplayer** over SignalR. No database: lobbies live in server memory, and content lives in JSON files.

---

## Technology stack

| Layer | Tech |
|---|---|
| Client | React 19, TypeScript, Vite, **Phaser 3** (board scene), plain CSS |
| Realtime | ASP.NET Core **SignalR** (`/gameHub`) + `@microsoft/signalr` client |
| Server | ASP.NET Core (.NET 10), C# |
| Content | JSON files in `server/GameServer/GameData/` |
| Deploy | One multi-stage Docker image → one Render Web Service |

All artwork is original. Sprites are defined as character grids in `client/src/game/art/sprites.ts` and rendered to textures at startup, so there are no image files to download and no third-party assets.

---

## Running locally

Prerequisites: **.NET 10 SDK** and **Node 20.19+** (Node 22 LTS recommended).

```bash
# Terminal 1 – backend on http://localhost:5080
cd server/GameServer
dotnet run
```

```bash
# Terminal 2 – frontend on http://localhost:5173 (proxies /api and /gameHub to :5080)
cd client
npm install
npm run dev
```

Open http://localhost:5173 in **two browser tabs** (or two browsers), host in one and join with the room code in the other. The reconnect token is kept in `sessionStorage`, so each tab is a separate player and refreshing a tab reclaims the same seat.

### Frontend commands (`client/`)

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Type-check + production build into `client/dist` |
| `npm run typecheck` | TypeScript only |

### Backend commands (`server/`)

| Command | Purpose |
|---|---|
| `dotnet run --project GameServer` | Run the server (Development, port 5080) |
| `dotnet test` | Run the xUnit test suite (`GameServer.Tests`) |
| `dotnet publish GameServer -c Release` | Production build |

### Minimum players

The host can start once `Game:MinPlayers` players are ready. It is **1 in Development** (`appsettings.Development.json`) so you can test alone, and **2 in production**. To allow solo games on a deployed server (for example on Render), set the environment variable `Game__MinPlayers=1`.

### Development shortcuts

In the **Development** environment only, two config values speed up manual testing (ignored in production):

```bash
Debug__ForceMiniGame=PixelGuess Debug__StartPosition=45 dotnet run
```

- `ForceMiniGame`: every turn plays this mini-game (`Wordle`, `Chain`, `HigherLower`, `NameX`, `PixelGuess`, `Logic`)
- `StartPosition`: all pawns start on this space (handy for testing the finish)

---

## Architecture

```
client/src/
  app/            App shell + global pixel UI kit (styles.css)
  pages/          MainMenu, Lobby, Game (HUD + phase overlays)
  minigames/      One React component per mini-game + shared timer/answer form
  game/           Phaser: PhaserGame, GameEventBus, scenes/, objects/, effects/, board/, art/
  multiplayer/    signalr.ts (connection + typed API), events.ts
  state/          tiny global store, server clock sync, session token
  audio/          AudioManager (synthesized placeholder SFX + volume settings)
  types/          TypeScript mirrors of server DTOs

server/
  GameServer/
    Hubs/GameHub.cs          client → server commands
    Services/                LobbyService, GameService (phase machine), BoardEngine, DiceService,
                             TurnOrderService, RankingService, MiniGameService, ContentService,
                             GameLoopService (100 ms tick), GameNotifier (ordered outbox)
    MiniGames/               WordleEngine, ChainEngine, HigherLowerEngine, NameXEngine,
                             PixelGuessEngine, LogicEngine
    Models/                  Lobby, PlayerState, BoardTile, BoardAction, MiniGameRound, DTOs
    GameData/                board.json + all puzzle JSON
  GameServer.Tests/          xUnit tests for the game logic
tools/                       content generators (board layout, word list, pixel-art normaliser)
```

### Server-authoritative design

- The **server owns everything**: membership, colours, ready state, turn order, dice, mini-game choice, puzzles, timers, answers, scoring, movement, tile effects, shields, swaps and the winner.
- Clients only express intent: `RollTurnDice()`, `SubmitWordleGuess("crane")`, `ChooseSwapTarget(id)`. Every command checks the current **phase** and the **calling player** (for example, `RollTurnDice` only succeeds in `WaitingForDiceRoll` for `CurrentTurnPlayerId`).
- Each `Lobby` has its own lock. Hub calls and the game loop take it before touching state.
- `GameLoopService` ticks every 100 ms and drives all timed transitions: dice → mini-game → results → movement → next turn, plus timeouts, auto-rolls and reconnect grace periods.
- Randomness (dice, mystery tiles, puzzle choice, fallback swap target) uses `RandomNumberGenerator`.

### Phase model

`Lobby → RollingForOrder → ShowingTurnOrder → WaitingForDiceRoll → DiceRolling → MiniGamePreparing → MiniGamePlaying → MiniGameResults → MovingPlayers ⇄ WaitingForSwapChoice → (next turn | GameFinished)`

### How SignalR is used

Client → server (hub methods): `CreateLobby`, `JoinLobby`, `ReconnectLobby`, `LeaveLobby`, `ChooseColor`, `SetReady`, `StartGame`, `ReturnToLobby`, `RollInitialDice`, `RollTurnDice`, `SubmitWordleGuess`, `SubmitChainAnswer`, `SubmitHigherLowerAnswer`, `SubmitNameXAnswer`, `SubmitPixelGuess`, `SubmitLogicAnswer`, `ChooseSwapTarget`, `GetServerTime`.

Server → client:

| Message | Meaning |
|---|---|
| `StateUpdated` | Full sanitized snapshot of the lobby (players, phase, timers, public mini-game state, results…). It covers lobby updates, joins/leaves, colour/ready changes, host changes, dice results, turn order, turn start, mini-game start/end and results. |
| `MiniGamePrivate` | Sent only to one player: their own guesses, lockouts and answers |
| `BoardActions` | Animation script for movement: `move` (hop path), `portal`, `swap`, `effect`, `shieldBlock`, `finish`, each with a server-chosen duration |
| `Notice` | Session moved to another tab, etc. |

The snapshot is the single source of truth. That keeps reconnects and late joins trivial: one message restores everything. Outgoing messages are queued per lobby and delivered in order by a single pump, so clients never see events out of order.

**Timers** come from server timestamps (`startAt`, `endAt`, `phaseEndsAt`). Clients estimate their clock offset with `GetServerTime` pings and render countdowns from server time. Ranking uses server receive timestamps only.

**Anti-cheat basics:** hidden answers (Wordle word, Higher/Lower values, logic answer, pixel-puzzle answers) never leave the server before the reveal. Pixel puzzles are pixelated server-side, so the full image is only sent at the end. Opponents only see each other's Wordle colour patterns, never letters. Submissions are rate-limited (200 ms, plus per-game lockouts after wrong answers), and logic puzzles allow one answer.

### React ↔ Phaser

React never touches Phaser objects. `GameEventBus` (in `client/src/game/`) is the only bridge:

- React → Phaser: `BOARD_INITIALIZED`, `PLAYER_POSITION_UPDATED` (authoritative positions/status), `PLAY_BOARD_ACTIONS` (server animation script), `CAMERA_OVERVIEW`
- Phaser → React: `SCENE_READY`, `BIOME_CHANGED`, `ACTIONS_FINISHED`, `SFX`

The scene plays `BoardActions` step by step (hop per tile with squash and stretch, portal vanish/appear, arcing swaps, popups, sparkles, confetti), then reconciles with the latest snapshot. A hidden tab simply snaps pawns into place.

### Disconnects and reconnects

- Each tab generates a session token (stored in `sessionStorage`). Refreshing calls `ReconnectLobby(code, token)` and restores the same seat and the full state.
- A disconnected player is marked offline, not removed. In the lobby, the seat is freed after **60 s**, and the host role passes to the oldest connected player after a short grace period.
- During a match the game never waits on a disconnected player. Their turn and order rolls are auto-rolled after ~4 s, they score nothing in mini-games, and a swap they owe is picked at random. A connected but idle player is auto-rolled after 30 s.
- If the whole server restarts, clients show a "lobby no longer exists" message and return to the menu.

---

## Game rules (as implemented)

- **Turn order**: everyone rolls a D6, highest first. Only tied players reroll, and they keep their slot relative to everyone else.
- **Movement**: 1st +3, 2nd +2, 3rd +1, everyone else +0. Only players who actually solved or answered correctly can earn movement (at least one correct answer in Higher or Lower).
- **Double Movement**: doubles the *next* mini-game reward (6/4/2), then is consumed. +2 and Portal moves are never doubled.
- **Shield**: blocks one negative effect (−1 tile, a negative Mystery result, or being swapped *backwards* by another player), then is consumed.
- **Chained tile effects** are allowed, up to **5** automatic effects per landing, to prevent loops.
- **Portal**: +5 with a teleport animation, clamped to the finish.
- **Swap**: the lander chooses any connected opponent (10 s, otherwise random). The destination tile is **not** triggered.
- **Mystery**: one of +2, −1, Shield, Double Movement, Swap, or +3.
- **Finish**: no exact roll needed. Movement is clamped to the last space, and the first pawn there wins. The final ranking is the winner first, then board position.

---

## Editing game content

All files live in `server/GameServer/GameData/`. They load at startup, and every entry is validated on its own. A malformed entry is **logged and skipped**, and never crashes the server. Puzzles don't repeat within a lobby until the pool runs out.

### Add a Wordle word: `wordle-words.json`

```json
{ "answers": ["crane", "..."], "allowed": ["aahed", "..."] }
```

Add the word to `answers` (5 letters, a–z). `allowed` is the list of accepted guesses. To regenerate it from the system dictionary, edit the answer list in `tools/build-wordle-words.mjs` and run `node tools/build-wordle-words.mjs`.

### Add a Chain puzzle: `chain-puzzles.json`

```json
{ "id": "chain_100", "left": "BLACK", "right": "BOARD", "answers": ["KEY"], "difficulty": "easy" }
```

`LEFT + answer` and `answer + RIGHT` should both be real words or phrases. List every valid answer. Difficulty (`easy` / `medium` / `hard`) sets the timer to 25 / 30 / 40 s.

### Add a Higher/Lower question: `higher-lower.json`

```json
{ "id": "hl_100", "category": "population", "prompt": "Which country has a larger population?",
  "optionA": { "name": "Romania", "value": 19000000 },
  "optionB": { "name": "Netherlands", "value": 17900000 },
  "unit": "people", "pick": "higher" }
```

Use `"pick": "lower"` for questions like "founded earlier". Values must differ. Which side each option appears on is randomized per round.

### Add a Name X prompt: `name-x.json`

```json
{ "id": "nx_animal_c", "category": "animal", "letter": "C",
  "prompt": "Name an animal beginning with C", "validAnswers": ["cat", "camel", "capybara"] }
```

Answers are normalized (case, spaces, punctuation, diacritics, simple plurals). Every valid answer must start with `letter`, or the entry is rejected at startup. An optional *Rare Answer Mode* (answers fewer lobby players gave rank higher) exists in `NameXRound` (`rareAnswerMode: true`) but is off by default.

### Add a pixel puzzle: `pixel-puzzles.json`

Pixel puzzles are drawn **as data**, so the server can pixelate them itself and never reveal the picture early:

```json
{ "id": "pixel_apple", "category": "food", "answers": ["apple"],
  "palette": { "r": "#e23b3b", "g": "#4caf3a" }, "background": "#dfeefa",
  "rows": ["......g.", "..rrrr..", ".rrrrrr.", "..rrrr.."] }
```

`.` is transparent (shows `background`). All rows must have the same width, and 16×16 works best. After drawing, run `node tools/normalize-pixel-puzzles.mjs` to trim and centre every puzzle on a 16×16 grid. Over about 10 seconds the reveal goes through 2×2 → 3×3 → 4×4 → 6×6 → 8×8 → 11×11 → 16×16.

### Add a logic puzzle: `logic-puzzles.json`

```json
{ "id": "seq_100", "type": "sequence", "prompt": "2, 4, 8, 16, ?",
  "choices": ["18", "24", "30", "32"], "correctChoice": 3, "explanation": "Each number doubles." }
```

Types: `sequence`, `shape` (unicode shapes in `prompt`), `oddOneOut` (`items`), and `grid` (`grid`: rows of strings, with `"?"` for the gap). Choices are shuffled every round.

### Edit the board: `board.json`

```json
{ "world": { "width": 5000, "height": 1500 },
  "biomes": [{ "id": "forest", "x0": 0, "x1": 1385 }, "..."],
  "tiles": [{ "index": 0, "type": "start", "biome": "forest", "x": 180, "y": 603 }, "..."] }
```

Tile `type` is one of `start, empty, mystery, shield, swap, plusTwo, minusOne, doubleMovement, portal, finish`. Indices must be contiguous. The first tile is always Start and the last is always Finish. You can hand-edit coordinates, export them from a tool like Tiled, or tweak `tools/generate-board.mjs` (curve shape and the `SPECIALS` map) and run `node tools/generate-board.mjs`. The client draws the trail, terrain and decorations around whatever tiles the board contains.

### Add or change art

Sprites are character grids in `client/src/game/art/sprites.ts` (palette per sprite, `.` = transparent). `BootScene` turns them into Phaser textures, and React reuses them for icons. Procedural pieces (tiles, mountains, castle, ground) live in `art/textures.ts` and `board/ground.ts`. To use PNG sprite sheets instead, load them in `BootScene.preload()` under the same texture keys.

Sound effects are synthesized placeholders in `client/src/audio/AudioManager.ts`. Swap in real samples inside `play()` without touching call sites. Master, music and SFX volumes live in Settings.

---

## Docker

```bash
docker build -t pixel-pawns .
docker run -p 8080:8080 pixel-pawns          # → http://localhost:8080
```

The multi-stage build does this:

1. **Node stage**: `npm ci` and `npm run build`
2. **.NET SDK stage**: `dotnet restore` and `dotnet publish`
3. **ASP.NET runtime stage**: copies the published server, then puts the React `dist` into `wwwroot`

ASP.NET Core serves `/` (the React app with an SPA fallback to `index.html`), `/api/*` and `/gameHub` (SignalR over WebSockets) from one origin. It listens on `$PORT`, defaulting to 8080 in the image.

## Deploying to Render

1. Push this repository to GitHub or GitLab.
2. In Render, choose **New → Blueprint** and select the repo. `render.yaml` defines one Docker web service. (Or use **New → Web Service → Docker** with the defaults; no build or start commands are needed.)
3. Render builds the Dockerfile and injects `PORT`, which the server picks up automatically.
4. Open the public URL, host a lobby, and share the room code or the **Copy invite link** button.

WebSockets work out of the box on Render. Health check: `/api/health`.

---

## Known MVP limitations

- **State is memory-only.** If the Render process restarts or redeploys (or a free instance sleeps), active lobbies disappear and players return to the menu. This is intentional for the MVP.
- **Run exactly one instance.** Lobbies live in one process, so scaling out would need a backplane and shared state.
- Reconnect tokens are per-tab (`sessionStorage`). Closing the tab entirely loses the seat (refresh is fine).
- Music is a tiny synthesized placeholder loop.

## Tests

```bash
cd server && dotnet test
```

The 54 tests cover dice range and face mapping, turn order and tie rerolls, ranking and 3/2/1 movement, double movement, shield, +2, −1, portal, the chained-effect limit, swap validation and timeouts, finish clamping, Wordle marking and ranking, Higher/Lower ranking and value hiding, logic validation, pixel hiding and lockout, content loading, and a full simulated turn through the real `GameService` state machine.
