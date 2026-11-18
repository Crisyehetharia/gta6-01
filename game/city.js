// Teluk Cerah — the city itself.
//
// A coastal grid city, 3600 x 2600: the sea along the west edge, a beach,
// then a road grid with named places. The layout is built once from a fixed
// seed so the city is identical on every load; traffic and pedestrians use
// the run's own seed instead.
//
// Exports: WORLD (sizes and road lists), PLACES (named spots the missions
// use), the building list, collision helpers, and drawCity.

import { PALETTE, drawBuilding, drawTree } from './assets.js';

// Deterministic little PRNG so the city never changes between loads.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const WORLD = {
  w: 3600,
  h: 2600,
  seaEdge: 200, // water is x < 200
  sandEdge: 330, // sand runs 200..330
  roadW: 110,
  roadsV: [600, 1200, 1800, 2400, 3000],
  roadsH: [500, 1100, 1700, 2300],
};

// Named places. Missions and the HUD point at these.
export const PLACES = {
  pasar: { name: 'Pasar Pagi', x: 900, y: 800, r: 90 },
  dermaga: { name: 'Dermaga Teluk', x: 170, y: 1900, r: 80 },
  mall: { name: 'Parkir Mall', x: 2700, y: 800, r: 110 },
  bengkel: { name: 'Bengkel Roda', x: 2700, y: 2000, r: 100 },
  rumah: { name: 'Rumah Aman', x: 900, y: 2000, r: 90 },
  taman: { name: 'Taman Kota', x: 1500, y: 1400, r: 120 },
  hotel: { name: 'Hotel Surya', x: 2100, y: 800, r: 90 },
  stasiun: { name: 'Stasiun', x: 1500, y: 2000, r: 100 },
};

// The pier deck is walkable even though it sits over the water.
const PIER = { x: 40, y: 1855, w: 300, h: 90 };

function blockRects() {
  const xs = [WORLD.sandEdge, ...WORLD.roadsV, WORLD.w];
  const ys = [0, ...WORLD.roadsH, WORLD.h];
  const out = [];
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      out.push({ x0: xs[i], x1: xs[i + 1], y0: ys[j], y1: ys[j + 1] });
    }
  }
  return out;
}

function blockKey(b) {
  return `${Math.round(b.x0)}:${Math.round(b.y0)}`;
}

// Blocks that hold a named place instead of generic buildings.
const SPECIAL = {
  '600:500': 'pasar',
  '2400:500': 'mall',
  '2400:1700': 'bengkel',
  '600:1700': 'rumah',
  '1200:1100': 'taman',
  '1800:500': 'hotel',
  '1200:1700': 'stasiun',
};

const ROOFS = [PALETTE.roofA, PALETTE.roofB, PALETTE.roofC, PALETTE.roofD, PALETTE.roofE];

export function buildCity() {
  const rng = mulberry32(1337);
  const buildings = [];
  const trees = [];
  const stalls = [];
  for (const b of blockRects()) {
    const key = blockKey(b);
    const special = SPECIAL[key];
    const ix0 = b.x0 + 78;
    const ix1 = b.x1 - 78;
    const iy0 = b.y0 + 78;
    const iy1 = b.y1 - 78;
    if (ix1 - ix0 < 90 || iy1 - iy0 < 90) continue;
    if (special === 'taman') {
      for (let i = 0; i < 14; i += 1) {
        trees.push({ x: ix0 + rng() * (ix1 - ix0), y: iy0 + rng() * (iy1 - iy0), s: 12 + rng() * 8 });
      }
      continue;
    }
    if (special === 'pasar') {
      for (let i = 0; i < 6; i += 1) {
        stalls.push({
          x: ix0 + 30 + (i % 3) * 150,
          y: iy0 + 40 + Math.floor(i / 3) * 130,
          w: 110,
          h: 70,
          color: ['#c96f4a', '#4a90c9', '#c9a44a'][i % 3],
        });
      }
      continue;
    }
    if (special === 'mall') {
      buildings.push({ x: ix0 + 40, y: iy0 + 20, w: ix1 - ix0 - 80, h: 150, roof: PALETTE.roofC, place: 'mall' });
      continue;
    }
    if (special === 'bengkel') {
      buildings.push({ x: ix0 + 60, y: iy0 + 30, w: 220, h: 150, roof: PALETTE.roofD, place: 'bengkel' });
      continue;
    }
    if (special === 'rumah') {
      buildings.push({ x: ix0 + 90, y: iy0 + 60, w: 180, h: 140, roof: PALETTE.roofA, place: 'rumah' });
      for (let i = 0; i < 5; i += 1) {
        trees.push({ x: ix0 + 40 + rng() * (ix1 - ix0 - 80), y: iy0 + 240 + rng() * 60, s: 11 + rng() * 6 });
      }
      continue;
    }
    if (special === 'hotel') {
      buildings.push({ x: ix0 + 50, y: iy0 + 30, w: 200, h: 320, roof: PALETTE.roofB, place: 'hotel' });
      continue;
    }
    if (special === 'stasiun') {
      buildings.push({ x: ix0 + 40, y: iy0 + 40, w: ix1 - ix0 - 80, h: 130, roof: PALETTE.roofE, place: 'stasiun' });
      continue;
    }
    // Generic block: one big building, or two small ones, or a green lot.
    const roll = rng();
    if (roll < 0.55) {
      const w = 160 + rng() * 140;
      const h = 130 + rng() * 120;
      buildings.push({
        x: ix0 + rng() * Math.max(1, ix1 - ix0 - w),
        y: iy0 + rng() * Math.max(1, iy1 - iy0 - h),
        w,
        h,
        roof: ROOFS[Math.floor(rng() * ROOFS.length)],
      });
    } else if (roll < 0.85) {
      for (let i = 0; i < 2; i += 1) {
        const w = 120 + rng() * 90;
        const h = 100 + rng() * 80;
        buildings.push({
          x: ix0 + (i % 2) * ((ix1 - ix0) / 2) + 10,
          y: iy0 + 20 + rng() * Math.max(1, iy1 - iy0 - h - 40),
          w,
          h,
          roof: ROOFS[Math.floor(rng() * ROOFS.length)],
        });
      }
    } else {
      for (let i = 0; i < 6; i += 1) {
        trees.push({ x: ix0 + rng() * (ix1 - ix0), y: iy0 + rng() * (iy1 - iy0), s: 11 + rng() * 7 });
      }
    }
  }
  return { buildings, trees, stalls, pier: PIER };
}

// --- Collision ------------------------------------------------------------

// True when a circle of radius r at (x, y) hits something solid.
export function solidAt(city, x, y, r) {
  if (x < 14 + r || x > WORLD.w - 14 - r || y < 14 + r || y > WORLD.h - 14 - r) return true;
  const onPier = x > PIER.x - r && x < PIER.x + PIER.w + r && y > PIER.y - r && y < PIER.y + PIER.h + r;
  if (x < WORLD.seaEdge + r && !onPier) return true;
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

// True when the point is on a road (with a small margin).
export function onRoad(x, y) {
  const half = WORLD.roadW / 2 + 6;
  for (const vx of WORLD.roadsV) if (Math.abs(x - vx) < half) return true;
  for (const hy of WORLD.roadsH) if (Math.abs(y - hy) < half) return true;
  return false;
}

// True when the point sits on an intersection of two roads.
export function atCrossing(x, y) {
  const half = WORLD.roadW / 2 + 10;
  const onV = WORLD.roadsV.some((vx) => Math.abs(x - vx) < half);
  const onH = WORLD.roadsH.some((hy) => Math.abs(y - hy) < half);
  return onV && onH;
}

// The road centre closest to (x, y) on the given axis.
export function nearestRoad(axis, v) {
  const list = axis === 'v' ? WORLD.roadsV : WORLD.roadsH;
  let best = list[0];
  for (const c of list) if (Math.abs(c - v) < Math.abs(best - v)) best = c;
  return best;
}

// --- Drawing --------------------------------------------------------------

function inView(cam, vw, vh, x, y, pad) {
  return x > cam.x - pad && x < cam.x + vw + pad && y > cam.y - pad && y < cam.y + vh + pad;
}

export function drawCity(ctx, G) {
  const { cam } = G;
  const { vw, vh } = G;
  const city = G.city;

  // Ground
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(cam.x, cam.y, vw, vh);

  // Sea (west) with slow wave lines, then the sand strip.
  ctx.fillStyle = PALETTE.seaDeep;
  ctx.fillRect(cam.x, cam.y, Math.max(0, WORLD.seaEdge - cam.x), vh);
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(cam.x, cam.y, Math.max(0, Math.min(WORLD.seaEdge, cam.x + vw) - cam.x), vh);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i += 1) {
    const wy = ((G.time * 22 + i * 260) % 700) + cam.y - 100;
    ctx.beginPath();
    for (let x = 0; x <= WORLD.seaEdge; x += 24) {
      const y = wy + Math.sin(x * 0.05 + G.time * 1.4 + i * 2) * 7;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(cam.x, WORLD.seaEdge), cam.y, Math.max(0, Math.min(WORLD.sandEdge, cam.x + vw) - Math.max(cam.x, WORLD.seaEdge)), vh);

  // Roads
  ctx.fillStyle = PALETTE.road;
  for (const vx of WORLD.roadsV) ctx.fillRect(vx - WORLD.roadW / 2, 0, WORLD.roadW, WORLD.h);
  for (const hy of WORLD.roadsH) ctx.fillRect(0, hy - WORLD.roadW / 2, WORLD.w, WORLD.roadW);

  // Centre dashes, clipped to the view.
  ctx.fillStyle = PALETTE.roadLine;
  for (const vx of WORLD.roadsV) {
    if (vx < cam.x - 20 || vx > cam.x + vw + 20) continue;
    for (let y = Math.floor(cam.y / 90) * 90; y < cam.y + vh; y += 90) {
      if (WORLD.roadsH.some((hy) => Math.abs(y - hy) < 80)) continue;
      ctx.fillRect(vx - 3, y, 6, 44);
    }
  }
  for (const hy of WORLD.roadsH) {
    if (hy < cam.y - 20 || hy > cam.y + vh + 20) continue;
    for (let x = Math.floor(cam.x / 90) * 90; x < cam.x + vw; x += 90) {
      if (WORLD.roadsV.some((vx) => Math.abs(x - vx) < 80)) continue;
      ctx.fillRect(x, hy - 3, 44, 6);
    }
  }

  // Crosswalks at every intersection in view.
  ctx.fillStyle = 'rgba(240,240,230,0.75)';
  for (const vx of WORLD.roadsV) {
    for (const hy of WORLD.roadsH) {
      if (!inView(cam, vw, vh, vx, hy, 90)) continue;
      for (let i = -2; i <= 2; i += 1) {
        ctx.fillRect(vx - 44 + i * 18, hy - 62, 10, 18);
        ctx.fillRect(vx - 44 + i * 18, hy + 44, 10, 18);
      }
    }
  }

  // Market stalls and the pier.
  for (const s of city.stalls) {
    if (!inView(cam, vw, vh, s.x, s.y, 120)) continue;
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(s.x + 6, s.y + 6, s.w - 12, 10);
  }
  ctx.fillStyle = '#8a6a44';
  ctx.fillRect(PIER.x, PIER.y, PIER.w, PIER.h);
  ctx.strokeStyle = '#6d5233';
  ctx.lineWidth = 2;
  for (let x = PIER.x + 20; x < PIER.x + PIER.w; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, PIER.y);
    ctx.lineTo(x, PIER.y + PIER.h);
    ctx.stroke();
  }

  // Buildings, trees, then place labels.
  for (const b of city.buildings) {
    if (inView(cam, vw, vh, b.x + b.w / 2, b.y + b.h / 2, 160)) drawBuilding(ctx, b);
  }
  for (const t of city.trees) {
    if (inView(cam, vw, vh, t.x, t.y, 30)) drawTree(ctx, t.x, t.y, t.s);
  }

  ctx.save();
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const key of Object.keys(PLACES)) {
    const p = PLACES[key];
    if (!inView(cam, vw, vh, p.x, p.y, 140)) continue;
    const tw = ctx.measureText(p.name).width + 18;
    ctx.fillStyle = 'rgba(20,26,34,0.62)';
    ctx.beginPath();
    ctx.roundRect(p.x - tw / 2, p.y - 42, tw, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#f5efdd';
    ctx.fillText(p.name, p.x, p.y - 27);
  }
  ctx.restore();
}
