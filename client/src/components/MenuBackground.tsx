import { useEffect, useRef } from 'react';
import * as S from '../game/art/sprites';
import { mulberry32, renderMountain, renderSprite } from '../game/art/textures';

const SCALE = 4;

/** Animated pixel landscape behind the menus: sky, mountains, forest, drifting clouds and butterflies. */
export function MenuBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const sprites = {
      cloud: renderSprite(S.CLOUD),
      cloudSmall: renderSprite(S.CLOUD_SMALL),
      tree: renderSprite(S.TREE_ROUND),
      tall: renderSprite(S.TREE_TALL),
      pine: renderSprite(S.PINE),
      bush: renderSprite(S.BUSH),
      grass: renderSprite(S.GRASS),
      flowers: ['#ff8fc8', '#ffe14a', '#ffffff', '#8fc8ff'].map((c) => renderSprite(S.flower(c))),
      mountains: [0, 1, 2].map((i) => renderMountain(80 + i * 20, 50 + i * 8, i + 3, true)),
      butterfly: S.BUTTERFLY.map((b) => renderSprite(b)),
    };

    let w = 0, h = 0;
    let staticLayer: HTMLCanvasElement | null = null;
    const clouds: { x: number; y: number; speed: number; small: boolean }[] = [];
    const flies: { cx: number; cy: number; phase: number; tint: number }[] = [];

    const build = () => {
      w = Math.ceil(window.innerWidth / SCALE);
      h = Math.ceil(window.innerHeight / SCALE);
      canvas.width = w;
      canvas.height = h;
      const layer = document.createElement('canvas');
      layer.width = w;
      layer.height = h;
      const g = layer.getContext('2d')!;
      const rand = mulberry32(7);

      // Sky bands with dithered seams
      const bands = ['#5ab4f0', '#6cc0f4', '#82ccf6', '#9ad8f8', '#b4e4fa'];
      const bandH = Math.ceil((h * 0.62) / bands.length);
      bands.forEach((c, i) => {
        g.fillStyle = c;
        g.fillRect(0, i * bandH, w, bandH + 1);
        if (i > 0) {
          g.fillStyle = bands[i - 1];
          for (let x = 0; x < w; x += 2) g.fillRect(x + (i % 2), i * bandH, 1, 1);
        }
      });
      g.fillStyle = '#b4e4fa';
      g.fillRect(0, bandH * bands.length, w, h);

      // Mountains
      for (let x = -20, i = 0; x < w; i++) {
        const m = sprites.mountains[i % 3];
        g.drawImage(m, x, Math.round(h * 0.6) - m.height + 4);
        x += m.width * 0.7;
      }
      // Hills
      g.fillStyle = '#4f9a3c';
      for (let x = 0; x < w; x++) g.fillRect(x, Math.round(h * 0.66 + Math.sin(x * 0.03) * 6 + Math.sin(x * 0.011) * 8), 1, h);
      // Back tree line
      for (let x = -10; x < w; x += 9 + rand() * 6) g.drawImage(rand() < 0.4 ? sprites.pine : sprites.tall, Math.round(x), Math.round(h * 0.66 - 18 + rand() * 6));
      // Meadow
      g.fillStyle = '#62b548';
      for (let x = 0; x < w; x++) g.fillRect(x, Math.round(h * 0.78 + Math.sin(x * 0.05) * 3), 1, h);
      g.fillStyle = '#7fcb5a';
      for (let i = 0; i < w * 1.5; i++) g.fillRect(Math.floor(rand() * w), Math.floor(h * 0.8 + rand() * h * 0.2), 2, 1);
      // Front trees at the edges + bushes
      for (let x = -6; x < w; x += 22 + rand() * 30) {
        const edge = x < w * 0.22 || x > w * 0.78;
        if (edge) g.drawImage(rand() < 0.5 ? sprites.tree : sprites.tall, Math.round(x), Math.round(h * 0.78 - 16 + rand() * 8));
        else g.drawImage(sprites.bush, Math.round(x), Math.round(h * 0.8 + rand() * 4));
      }
      for (let i = 0; i < w / 6; i++) {
        const f = rand() < 0.5 ? sprites.grass : sprites.flowers[Math.floor(rand() * 4)];
        g.drawImage(f, Math.floor(rand() * w), Math.floor(h * 0.84 + rand() * h * 0.15));
      }
      staticLayer = layer;

      clouds.length = 0;
      for (let i = 0; i < Math.max(4, w / 60); i++) clouds.push({ x: rand() * w, y: 4 + rand() * h * 0.35, speed: 1.5 + rand() * 3, small: rand() < 0.4 });
      flies.length = 0;
      for (let i = 0; i < 5; i++) flies.push({ cx: rand() * w, cy: h * (0.75 + rand() * 0.15), phase: rand() * 10, tint: i });
    };

    build();
    window.addEventListener('resize', build);

    let raf = 0, last = performance.now(), acc = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = now - last;
      last = now;
      acc += dt;
      if (acc < 33) return; // ~30 fps is plenty for a background
      acc = 0;
      if (!staticLayer) return;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(staticLayer, 0, 0);
      for (const c of clouds) {
        c.x += (c.speed * dt) / 1000;
        const img = c.small ? sprites.cloudSmall : sprites.cloud;
        if (c.x > w + 10) c.x = -img.width;
        ctx.drawImage(img, Math.round(c.x), Math.round(c.y));
      }
      for (const f of flies) {
        const t = now / 1000 + f.phase;
        const frameImg = sprites.butterfly[Math.floor(now / 120) % 2];
        ctx.drawImage(frameImg, Math.round(f.cx + Math.sin(t * 0.7) * 30), Math.round(f.cy + Math.sin(t * 1.6) * 8));
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', build);
    };
  }, []);

  return <canvas ref={ref} className="menu-bg" aria-hidden="true" />;
}
