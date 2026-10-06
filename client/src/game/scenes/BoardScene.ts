import Phaser from 'phaser';
import type { BoardAction, BoardActionsDto, BoardData, Biome } from '../../types/contracts';
import { GameEventBus, type BusEvents, type PawnInfo } from '../GameEventBus';
import { biomeAt, biomeRect, clusterOffset, PathIndex, PX, smoothPath, type Point } from '../board/layout';
import { paintGround } from '../board/ground';
import { BoardTile } from '../objects/BoardTile';
import { Pawn } from '../objects/Pawn';
import type { AmbientSystem } from '../effects/AmbientSystem';
import { CloudSystem } from '../effects/CloudSystem';
import { ButterflySystem } from '../effects/ButterflySystem';
import { SandSystem } from '../effects/SandSystem';
import { SnowSystem } from '../effects/SnowSystem';
import { placeDecorations } from '../effects/Decorations';

const FONT = '"Press Start 2P", monospace';
const HOP_MS = 300;

const EFFECT_LABELS: Record<string, [string, string]> = {
  plusTwo: ['+2!', '#7dff7a'],
  minusOne: ['-1', '#ff6b6b'],
  shield: ['SHIELD!', '#8ccaff'],
  doubleMovement: ['2X MOVE!', '#ffe14a'],
  portal: ['PORTAL!', '#ff8cff'],
  swap: ['SWAP!', '#ffb14a'],
  mystery: ['MYSTERY!', '#d4a8ff'],
};

const MYSTERY_OUTCOMES: Record<string, [string, string, boolean]> = {
  PlusTwo: ['+2', '#7dff7a', true],
  MinusOne: ['-1', '#ff6b6b', false],
  Shield: ['SHIELD', '#8ccaff', true],
  DoubleMovement: ['2X MOVE', '#ffe14a', true],
  Swap: ['SWAP', '#ffb14a', true],
  AdvanceThree: ['+3', '#7dff7a', true],
};

export class BoardScene extends Phaser.Scene {
  private board!: BoardData;
  private tiles: BoardTile[] = [];
  private pawns = new Map<string, Pawn>();
  private synced = new Map<string, PawnInfo>();
  private currentTurn: string | null = null;
  private systems: AmbientSystem[] = [];
  private queue: BoardAction[] = [];
  private playing = false;
  private playingSince = 0;
  private watchdogTimer = 0;
  private lastSequence = 0;
  private lastBiome: Biome | null = null;
  private manualCameraUntil = 0;
  private cullTimer = 0;
  private overviewUntil = 0;
  private unsubscribers: (() => void)[] = [];

  constructor() {
    super('Board');
  }

  create() {
    this.unsubscribers.push(GameEventBus.on('BOARD_INITIALIZED', (p) => this.initBoard(p)));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribers.forEach((u) => u()));
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.unsubscribers.forEach((u) => u()));
  }

  // ------------------------------------------------------------------ world

  private initBoard({ board, players, currentTurnPlayerId }: BusEvents['BOARD_INITIALIZED']) {
    if (this.board) return;
    this.board = board;
    const W = board.world.width, H = board.world.height;

    const path = smoothPath(board.tiles.map((t) => ({ x: t.x, y: t.y })));
    const index = new PathIndex(path);
    const ground = paintGround(board, path, (x, y) => index.distance(x, y));
    if (this.textures.exists('ground')) this.textures.remove('ground');
    this.textures.addCanvas('ground', ground.canvas);
    this.add.image(0, 0, 'ground').setOrigin(0).setScale(PX).setDepth(0);

    this.tiles = board.tiles.map((t) => new BoardTile(this, t));
    this.systems.push(...placeDecorations(this, board, index, ground.pond));

    const rect = (b: Biome) => {
      const r = biomeRect(board, b);
      return new Phaser.Geom.Rectangle(r.x, r.y, r.width, r.height);
    };
    this.systems.push(new CloudSystem(this, W, H));
    this.systems.push(new ButterflySystem(this, rect('forest'), 12));
    this.systems.push(new ButterflySystem(this, rect('village'), 4));
    this.systems.push(new SandSystem(this, rect('desert')));
    this.systems.push(new SnowSystem(this, rect('snow')));

    this.setupCamera();
    this.syncPlayers({ players, currentTurnPlayerId });

    this.unsubscribers.push(
      GameEventBus.on('PLAYER_POSITION_UPDATED', (p) => this.syncPlayers(p)),
      GameEventBus.on('PLAY_BOARD_ACTIONS', (dto) => this.enqueueActions(dto), false),
      GameEventBus.on('CAMERA_OVERVIEW', () => this.overview(), false),
    );

    const onVisibility = () => {
      if (!document.hidden && this.playing) this.fastForward();
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.unsubscribers.push(() => document.removeEventListener('visibilitychange', onVisibility));

    GameEventBus.emit('SCENE_READY', {});
  }

  // ------------------------------------------------------------------ camera

  /** Smallest zoom at which the board still covers the whole viewport (no empty bands). */
  private minZoom() {
    const cam = this.cameras.main;
    return Math.max(cam.width / this.board.world.width, cam.height / this.board.world.height);
  }

  private clampZoom(z: number) {
    return Math.max(this.minZoom(), z);
  }

  private baseZoom() {
    const cam = this.cameras.main;
    return this.clampZoom(Phaser.Math.Clamp(Math.min(cam.height / 880, cam.width / 900), 0.42, 1.3));
  }

  private setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.board.world.width, this.board.world.height);
    cam.setZoom(this.baseZoom());
    const start = this.board.tiles[0];
    cam.centerOn(start.x, start.y);

    this.scale.on(Phaser.Scale.Events.RESIZE, () => cam.setZoom(this.baseZoom()));

    let dragStart: { x: number; y: number; sx: number; sy: number } | null = null;
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      dragStart = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY };
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (!dragStart || !p.isDown) return;
      const dx = p.x - dragStart.x, dy = p.y - dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) < 6) return;
      cam.stopFollow();
      cam.setScroll(dragStart.sx - dx / cam.zoom, dragStart.sy - dy / cam.zoom);
      this.manualCameraUntil = this.time.now + 6000;
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, () => (dragStart = null));
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const base = this.baseZoom();
      cam.setZoom(this.clampZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), base * 0.45, base * 1.7)));
      this.manualCameraUntil = this.time.now + 6000;
    });
  }

  private focusOn(x: number, y: number, duration = 700, force = false) {
    if (!force && (this.time.now < this.manualCameraUntil || this.time.now < this.overviewUntil)) return;
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(x, y, duration, 'Sine.easeInOut', true);
  }

  private overview() {
    const cam = this.cameras.main;
    const W = this.board.world.width, H = this.board.world.height;
    const fit = this.minZoom();
    this.overviewUntil = this.time.now + 3600;
    cam.stopFollow();
    cam.zoomTo(fit, 900, 'Sine.easeInOut', true);
    cam.pan(W / 2, H / 2, 900, 'Sine.easeInOut', true);
    this.time.delayedCall(2300, () => {
      const target = this.currentPawnPoint() ?? { x: this.board.tiles[0].x, y: this.board.tiles[0].y };
      cam.zoomTo(this.baseZoom(), 1200, 'Sine.easeInOut', true);
      cam.pan(target.x, target.y, 1200, 'Sine.easeInOut', true);
    });
  }

  private currentPawnPoint(): Point | null {
    const pawn = this.currentTurn ? this.pawns.get(this.currentTurn) : undefined;
    return pawn ? { x: pawn.x, y: pawn.y } : null;
  }

  /** Zoom out enough to show every tile involved in the upcoming action sequence. */
  private frameActions(actions: BoardAction[]) {
    const indices = new Set<number>();
    for (const a of actions) {
      if (a.from !== undefined) indices.add(a.from);
      if (a.to !== undefined) indices.add(a.to);
      a.path?.forEach((i) => indices.add(i));
      for (const id of [a.playerId, a.targetPlayerId]) {
        const pawn = id ? this.pawns.get(id) : undefined;
        if (pawn) indices.add(pawn.tileIndex);
      }
    }
    if (indices.size === 0) return;
    const pts = [...indices].map((i) => this.board.tiles[i]);
    const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
    const cam = this.cameras.main;
    const base = this.baseZoom();
    const zoom = this.clampZoom(Phaser.Math.Clamp(Math.min(cam.width / (maxX - minX + 360), cam.height / (maxY - minY + 360)), base * 0.5, base));
    this.manualCameraUntil = 0;
    cam.stopFollow();
    cam.zoomTo(zoom, 500, 'Sine.easeInOut', true);
    cam.pan((minX + maxX) / 2, (minY + maxY) / 2, 500, 'Sine.easeInOut', true);
  }

  // ------------------------------------------------------------------ pawns

  private syncPlayers({ players, currentTurnPlayerId }: BusEvents['PLAYER_POSITION_UPDATED']) {
    if (!this.board) return;
    const ids = new Set(players.map((p) => p.playerId));
    for (const [id, pawn] of this.pawns)
      if (!ids.has(id)) {
        pawn.destroy();
        this.pawns.delete(id);
      }

    const touched = new Set<number>();
    for (const p of players) {
      this.synced.set(p.playerId, p);
      let pawn = this.pawns.get(p.playerId);
      if (!pawn) {
        pawn = new Pawn(this, p.playerId, p.name, p.color, p.position);
        this.pawns.set(p.playerId, pawn);
        touched.add(p.position);
      }
      pawn.setStatus(p.hasShield, p.doubleMovement, p.isConnected);
      pawn.setActiveTurn(p.playerId === currentTurnPlayerId);
    }
    touched.forEach((t) => this.layoutTile(t, false));

    const turnChanged = currentTurnPlayerId !== this.currentTurn;
    this.currentTurn = currentTurnPlayerId;
    if (!this.playing && this.queue.length === 0) this.reconcile();
    if (turnChanged && !this.playing) {
      const pt = this.currentPawnPoint();
      if (pt) this.focusOn(pt.x, pt.y, 900);
    }
  }

  private pawnsOn(tileIndex: number) {
    return [...this.pawns.values()].filter((p) => p.tileIndex === tileIndex).sort((a, b) => a.playerId.localeCompare(b.playerId));
  }

  private slotFor(pawn: Pawn, tileIndex: number): Point {
    const group = this.pawnsOn(tileIndex);
    if (!group.includes(pawn)) group.push(pawn);
    const tile = this.board.tiles[tileIndex];
    const o = clusterOffset(group.indexOf(pawn), group.length);
    return { x: tile.x + o.x, y: tile.y + o.y - 4 };
  }

  /** Spread out the idle pawns standing on one tile. */
  private layoutTile(tileIndex: number, animate = true, except?: Pawn) {
    const group = this.pawnsOn(tileIndex);
    for (const pawn of group) pawn.setNameVisible(group.length === 1);
    for (const pawn of group) {
      if (pawn === except || pawn.pawnState !== 'idle') continue;
      const slot = this.slotFor(pawn, tileIndex);
      if (!animate) pawn.placeAt(slot.x, slot.y);
      else this.tweens.add({ targets: pawn, x: slot.x, y: slot.y, duration: 180, onUpdate: () => pawn.setDepth(pawn.y + 10) });
    }
  }

  /** Snap pawns to the authoritative positions (after animations, reconnects or a hidden tab). */
  private reconcile() {
    const touched = new Set<number>();
    for (const [id, info] of this.synced) {
      const pawn = this.pawns.get(id);
      if (!pawn) continue;
      if (pawn.pawnState !== 'idle') pawn.stopAllTweens();
      if (pawn.tileIndex === info.position) continue;
      touched.add(pawn.tileIndex);
      pawn.tileIndex = info.position;
      touched.add(info.position);
    }
    touched.forEach((t) => this.layoutTile(t, true));
  }

  // ------------------------------------------------------------------ action playback

  private enqueueActions(dto: BoardActionsDto) {
    if (!this.board || dto.sequence <= this.lastSequence) return;
    this.lastSequence = dto.sequence;
    if (document.hidden) return; // the next snapshot reconcile will snap pawns into place
    this.queue.push(...dto.actions);
    if (!this.playing) void this.runQueue(dto.sequence);
  }

  private fastForward() {
    this.queue = [];
    for (const pawn of this.pawns.values()) pawn.stopAllTweens();
    this.reconcile();
  }

  private wait(ms: number) {
    return new Promise<void>((resolve) => {
      this.time.delayedCall(ms, resolve);
      window.setTimeout(resolve, ms + 1500); // safety net if the scene clock is paused (hidden tab)
    });
  }

  private async runQueue(sequence: number) {
    this.playing = true;
    this.playingSince = Date.now();
    try {
      this.frameActions(this.queue);
      await this.wait(250);
      while (this.queue.length > 0) {
        if (document.hidden) {
          this.fastForward();
          break;
        }
        const action = this.queue.shift()!;
        const started = this.time.now;
        try {
          await Promise.race([this.playAction(action), new Promise((r) => window.setTimeout(r, action.durationMs + 2000))]);
        } catch (err) {
          // One broken animation must never freeze the board; the reconcile below fixes positions.
          console.error('Board action failed', action, err);
        }
        const remaining = action.durationMs - (this.time.now - started);
        if (remaining > 20) await this.wait(remaining);
      }
    } finally {
      this.finishQueue(sequence);
    }
  }

  private finishQueue(sequence: number) {
    this.queue = [];
    this.playing = false;
    this.reconcile();
    const cam = this.cameras.main;
    cam.zoomTo(this.baseZoom(), 600, 'Sine.easeInOut', true);
    const pt = this.currentPawnPoint();
    if (pt) this.focusOn(pt.x, pt.y, 800, true);
    GameEventBus.emit('ACTIONS_FINISHED', { sequence });
  }

  private sfx(name: string) {
    GameEventBus.emit('SFX', { name });
  }

  private async playAction(a: BoardAction) {
    const pawn = a.playerId ? this.pawns.get(a.playerId) : undefined;
    if (!pawn) return;

    switch (a.type) {
      case 'move': {
        const from = pawn.tileIndex;
        for (const idx of a.path ?? []) {
          const prev = pawn.tileIndex;
          pawn.tileIndex = idx;
          this.layoutTile(prev, true, pawn);
          const slot = this.slotFor(pawn, idx);
          this.layoutTile(idx, true, pawn);
          this.keepInView(slot);
          await pawn.hopTo(slot.x, slot.y, HOP_MS);
          this.tiles[idx]?.pulse(this);
          this.sfx('hop');
        }
        if (from !== pawn.tileIndex) this.layoutTile(pawn.tileIndex, true);
        break;
      }

      case 'portal': {
        const from = this.board.tiles[a.from!], to = this.board.tiles[a.to!];
        this.sfx('portal');
        this.portalBurst(from.x, from.y);
        await pawn.vanish(380);
        const prev = pawn.tileIndex;
        pawn.tileIndex = a.to!;
        this.layoutTile(prev, true);
        const slot = this.slotFor(pawn, a.to!);
        pawn.placeAt(slot.x, slot.y);
        this.focusOn(to.x, to.y, 300, true);
        await this.wait(300);
        this.portalBurst(to.x, to.y);
        await pawn.appear(420);
        this.layoutTile(a.to!, true);
        break;
      }

      case 'swap': {
        const other = a.targetPlayerId ? this.pawns.get(a.targetPlayerId) : undefined;
        if (!other) return;
        const pa = a.from!, pb = a.to!;
        this.sfx('swap');
        pawn.tileIndex = pb;
        other.tileIndex = pa;
        const sa = this.slotFor(pawn, pb), sb = this.slotFor(other, pa);
        this.frameActions([a]);
        await Promise.all([pawn.arcTo(sa.x, sa.y, 1000, 160), other.arcTo(sb.x, sb.y, 1000, 100)]);
        this.layoutTile(pa, true);
        this.layoutTile(pb, true);
        break;
      }

      case 'effect': {
        const [label, color] = EFFECT_LABELS[a.effect ?? ''] ?? ['?', '#ffffff'];
        this.keepInView({ x: pawn.x, y: pawn.y });
        if (a.effect === 'mystery') {
          this.sfx('mystery');
          this.popLabel(pawn.x, pawn.y - 90, label, color);
          await this.wait(750);
          const [text, c, good] = MYSTERY_OUTCOMES[a.outcome ?? ''] ?? ['?', '#ffffff', true];
          this.popLabel(pawn.x, pawn.y - 70, text, c, 26);
          this.sfx(good ? 'positive' : 'negative');
          if (good) this.sparkles(pawn.x, pawn.y - 30, 0xffe14a);
          await pawn.react(good ? 'positive' : 'negative');
        } else {
          const positive = a.effect !== 'minusOne';
          this.popLabel(pawn.x, pawn.y - 90, label, color);
          this.sfx(a.effect === 'shield' ? 'shield' : positive ? 'positive' : 'negative');
          if (positive) this.sparkles(pawn.x, pawn.y - 30, a.effect === 'shield' ? 0x8ccaff : 0x7dff7a);
          await pawn.react(positive ? 'positive' : 'negative');
        }
        break;
      }

      case 'shieldBlock': {
        this.sfx('shield');
        const bubble = this.add.image(pawn.x, pawn.y - 34, 'softGlow').setTint(0x6ab8ff).setAlpha(0.6).setScale(PX * 2.4).setDepth(pawn.depth + 1);
        this.tweens.add({ targets: bubble, scale: PX * 3.6, alpha: 0, duration: 900, onComplete: () => bubble.destroy() });
        this.popLabel(pawn.x, pawn.y - 90, 'BLOCKED!', '#8ccaff');
        this.sparkles(pawn.x, pawn.y - 34, 0x8ccaff);
        await this.wait(600);
        break;
      }

      case 'finish': {
        this.sfx('winner');
        this.focusOn(pawn.x, pawn.y, 400, true);
        this.confetti(pawn.x, pawn.y - 60);
        this.popLabel(pawn.x, pawn.y - 110, 'FINISH!', '#ffe14a', 28);
        await pawn.react('positive');
        await pawn.react('positive');
        break;
      }
    }
  }

  private keepInView(p: Point) {
    const view = this.cameras.main.worldView;
    const inner = new Phaser.Geom.Rectangle(view.x + view.width * 0.18, view.y + view.height * 0.18, view.width * 0.64, view.height * 0.64);
    if (!inner.contains(p.x, p.y)) this.focusOn(p.x, p.y, 400, true);
  }

  // ------------------------------------------------------------------ juice

  private popLabel(x: number, y: number, text: string, color: string, size = 20) {
    const t = this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#1a1426', strokeThickness: 7 })
      .setOrigin(0.5)
      .setDepth(200_000)
      .setResolution(2)
      .setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, delay: 650, duration: 600, onComplete: () => t.destroy() });
  }

  private sparkles(x: number, y: number, tint: number) {
    const e = this.add.particles(x, y, 'sparkle', {
      speed: { min: 90, max: 220 },
      lifespan: 700,
      scale: { start: PX * 1.2, end: 0 },
      tint,
      emitting: false,
    });
    e.setDepth(150_000);
    e.explode(18);
    this.time.delayedCall(900, () => e.destroy());
  }

  private portalBurst(x: number, y: number) {
    const ring = this.add.image(x, y - 10, 'portalRing').setScale(PX * 0.5).setDepth(150_000).setTint(0xff8cff);
    this.tweens.add({ targets: ring, scale: PX * 3, angle: 270, alpha: 0, duration: 650, onComplete: () => ring.destroy() });
    const flash = this.add.image(x, y - 20, 'softGlow').setScale(PX * 3).setTint(0xffd0ff).setAlpha(0.8).setDepth(150_001);
    this.tweens.add({ targets: flash, alpha: 0, scale: PX * 5, duration: 450, onComplete: () => flash.destroy() });
    this.sparkles(x, y - 20, 0xff8cff);
  }

  private confetti(x: number, y: number) {
    const e = this.add.particles(x, y, 'dot2', {
      speed: { min: 150, max: 420 },
      angle: { min: 200, max: 340 },
      gravityY: 400,
      lifespan: 1800,
      scale: PX * 1.4,
      rotate: { min: 0, max: 360 },
      tint: [0xff5a5a, 0xffe14a, 0x5aff8a, 0x5ab8ff, 0xd45aff],
      emitting: false,
    });
    e.setDepth(150_000);
    e.explode(80);
    this.time.delayedCall(2200, () => e.destroy());
  }

  // ------------------------------------------------------------------ frame loop

  update(time: number, delta: number) {
    if (!this.board) return;
    this.cullTimer -= delta;
    if (this.cullTimer <= 0) {
      this.cullTimer = 300;
      const view = this.cameras.main.worldView;
      for (const s of this.systems) s.setActive(!s.region || Phaser.Geom.Rectangle.Overlaps(view, s.region));
      const biome = biomeAt(this.board, view.centerX);
      if (biome !== this.lastBiome) {
        this.lastBiome = biome;
        GameEventBus.emit('BIOME_CHANGED', { biome });
      }
    }
    for (const s of this.systems) s.update?.(time, delta);

    // Self-healing: whatever happens to an animation, pawns end up where the server says they are.
    this.watchdogTimer -= delta;
    if (this.watchdogTimer <= 0) {
      this.watchdogTimer = 1000;
      if (this.playing && Date.now() - this.playingSince > 30_000) this.finishQueue(this.lastSequence);
      else if (!this.playing) {
        this.reconcile();
        const cam = this.cameras.main;
        if (cam.zoom < this.minZoom() - 0.001) cam.setZoom(this.baseZoom());
      }
    }
  }
}
