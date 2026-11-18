// city.js — Teluk Cerah: a bright coastal city on a grid of roads.
// World: 3600 x 2600. Roads every 450px. A bay (water) along the south edge
// with a beach and a wooden pier. Named places used by the missions.

import { PALETTE, drawBuilding, drawTree, drawPalm, mulberry32, pick } from './assets.js';

export const WORLD_W = 3600;
export const WORLD_H = 2600;
export const ROAD_W = 92;
export const SPACING = 450;

export const PLACES = {
  market: { name: 'Pasar Pagi', x: 675, y: 675 },
  pier: { name: 'Dermaga Teluk', x: 1800, y: 2430 },
  garage: { name: 'Bengkel Roda', x: 2925, y: 1125 },
  hideout: { name: 'Rumah Aman', x: 1125, y: 2025 },
  parking: { name: 'Parkir Mall', x: 2475, y: 675 },
  plaza: { name: 'Alun-Alun', x: 1800, y: 1575 },
};

export class City {
  constructor(seed = 20261124) {
    this.rng = mulberry32(seed);
    this.roadsV = [];
    this.roadsH = [];
    for (let x = 225; x < WORLD_W; x += SPACING) this.roadsV.push(x);
    for (let y = 225; y < WORLD_H - 350; y += SPACING) this.roadsH.push(y);
    // Bay occupies the bottom strip; beach above it; pier juts into the water.
    this.water = { x: 0, y: 2280, w: WORLD_W, h: 320 };
    this.beach = { x: 0, y: 2210, w: WORLD_W, h: 70 };
    this.pier = { x: 1760, y: 2210, w: 80, h: 220 };
    this.buildings = [];
    this.trees = [];
    this.solids = []; // {x,y,w,h} collision rects: buildings + water (pier is walkable)
    this._genBlocks();
    this.solids.push({ x: this.water.x, y: this.water.y, w: this.water.w, h: this.water.h });
  }

  _genBlocks() {
    const rng = this.rng;
    for (let ix = 0; ix < this.roadsV.length - 1; ix++) {
      for (let iy = 0; iy < this.roadsH.length - 1; iy++) {
        const bx = this.roadsV[ix] + ROAD_W / 2 + 14;
        const by = this.roadsH[iy] + ROAD_W / 2 + 14;
        const bw = SPACING - ROAD_W - 28;
        const bh = SPACING - ROAD_W - 28;
        if (by + bh > this.beach.y - 10) continue; // keep the beach clear
        // Plaza block in the middle stays open with trees.
        if (ix === 3 && iy === 3) {
          for (let t = 0; t < 8; t++) {
            this.trees.push({ x: bx + 30 + rng() * (bw - 60), y: by + 30 + rng() * (bh - 60), s: 0.9 + rng() * 0.5 });
          }
          continue;
        }
        // 1-3 buildings per block.
        const n = 1 + Math.floor(rng() * 3);
        for (let k = 0; k < n; k++) {
          const w = 90 + rng() * 120;
          const h = 80 + rng() * 110;
          const x = bx + rng() * Math.max(1, bw - w);
          const y = by + rng() * Math.max(1, bh - h);
          const b = {
            x, y, w, h,
            color: pick(rng, PALETTE.buildingColors),
            roof: pick(rng, PALETTE.roofColors),
            seed: Math.floor(rng() * 100),
          };
          // Keep mission spots clear of buildings.
          let clash = false;
          for (const p of Object.values(PLACES)) {
            if (p.x > x - 90 && p.x < x + w + 90 && p.y > y - 90 && p.y < y + h + 90) clash = true;
          }
          if (clash) continue;
          this.buildings.push(b);
          this.solids.push({ x: b.x, y: b.y, w: b.w, h: b.h });
        }
        if (rng() < 0.6) {
          this.trees.push({ x: bx + 20 + rng() * (bw - 40), y: by + 20 + rng() * (bh - 40), s: 0.8 + rng() * 0.6 });
        }
      }
    }
    // Palms along the beach.
    for (let x = 120; x < WORLD_W; x += 260) {
      this.trees.push({ x: x + rng() * 60, y: 2235 + rng() * 30, s: 1.1, palm: true });
    }
  }

  // Point inside any solid rect (buildings or water, not the pier).
  solidAt(x, y) {
    if (x < 8 || y < 8 || x > WORLD_W - 8 || y > WORLD_H - 8) return true;
    if (y >= this.water.y && !(x >= this.pier.x && x <= this.pier.x + this.pier.w && y <= this.pier.y + this.pier.h)) return true;
    for (const s of this.solids) {
      if (s.y < this.water.y && x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
    }
    return false;
  }

  // Push a circle (x,y,r) out of solids. Mutates and returns the entity.
  resolveCircle(e, r) {
    for (const s of this.solids) {
      const nx = Math.max(s.x, Math.min(e.x, s.x + s.w));
      const ny = Math.max(s.y, Math.min(e.y, s.y + s.h));
      const dx = e.x - nx, dy = e.y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          e.x = nx + (dx / d) * r;
          e.y = ny + (dy / d) * r;
        } else {
          e.y = s.y - r; // inside: push up out of the rect
        }
      }
    }
    e.x = Math.max(10, Math.min(WORLD_W - 10, e.x));
    e.y = Math.max(10, Math.min(WORLD_H - 10, e.y));
    return e;
  }

  // A random point on a road (for spawning traffic / parked cars).
  roadPoint(rng) {
    if (rng() < 0.5) {
      return { x: this.roadsV[Math.floor(rng() * this.roadsV.length)], y: 100 + rng() * (this.beach.y - 200), horizontal: false };
    }
    return { x: 100 + rng() * (WORLD_W - 200), y: this.roadsH[Math.floor(rng() * this.roadsH.length)], horizontal: true };
  }

  nearestRoad(x, y) {
    let best = null, bd = 1e9;
    for (const rx of this.roadsV) { const d = Math.abs(x - rx); if (d < bd) { bd = d; best = { x: rx, y, horizontal: false }; } }
    for (const ry of this.roadsH) { const d = Math.abs(y - ry); if (d < bd) { bd = d; best = { x, y: ry, horizontal: true }; } }
    return best;
  }

  draw(ctx, cam, vw, vh) {
    const x0 = Math.max(0, cam.x - 60), y0 = Math.max(0, cam.y - 60);
    const x1 = Math.min(WORLD_W, cam.x + vw + 60), y1 = Math.min(WORLD_H, cam.y + vh + 60);
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // City blocks.
    ctx.fillStyle = PALETTE.block;
    for (let ix = 0; ix < this.roadsV.length - 1; ix++) {
      for (let iy = 0; iy < this.roadsH.length - 1; iy++) {
        const bx = this.roadsV[ix] + ROAD_W / 2;
        const by = this.roadsH[iy] + ROAD_W / 2;
        if (bx + SPACING < x0 || bx > x1 || by + SPACING < y0 || by > y1) continue;
        if (by + SPACING - ROAD_W > this.beach.y) continue;
        ctx.fillRect(bx, by, SPACING - ROAD_W, SPACING - ROAD_W);
      }
    }
    // Beach, water, pier.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(x0, this.beach.y, x1 - x0, this.beach.h);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x0, this.water.y, x1 - x0, this.water.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let wy = this.water.y + 26; wy < this.water.y + this.water.h; wy += 44) {
      ctx.beginPath();
      for (let wx = Math.floor(x0 / 90) * 90; wx < x1; wx += 90) {
        ctx.moveTo(wx, wy);
        ctx.quadraticCurveTo(wx + 22, wy - 6, wx + 45, wy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#a9805a';
    ctx.fillRect(this.pier.x, this.pier.y, this.pier.w, this.pier.h);
    ctx.strokeStyle = '#8a6b45';
    ctx.lineWidth = 2;
    for (let py = this.pier.y + 18; py < this.pier.y + this.pier.h; py += 18) {
      ctx.beginPath(); ctx.moveTo(this.pier.x, py); ctx.lineTo(this.pier.x + this.pier.w, py); ctx.stroke();
    }
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const rx of this.roadsV) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, this.beach.y);
    for (const ry of this.roadsH) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
    // Sidewalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of this.roadsV) {
      ctx.fillRect(rx - ROAD_W / 2 - 12, 0, 12, this.beach.y);
      ctx.fillRect(rx + ROAD_W / 2, 0, 12, this.beach.y);
    }
    for (const ry of this.roadsH) {
      ctx.fillRect(0, ry - ROAD_W / 2 - 12, WORLD_W, 12);
      ctx.fillRect(0, ry + ROAD_W / 2, WORLD_W, 12);
    }
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const rx of this.roadsV) {
      for (let y = 0; y < this.beach.y; y += 56) ctx.fillRect(rx - 2, y, 4, 30);
    }
    for (const ry of this.roadsH) {
      for (let x = 0; x < WORLD_W; x += 56) ctx.fillRect(x, ry - 2, 30, 4);
    }
    // Crosswalks at intersections.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const rx of this.roadsV) {
      for (const ry of this.roadsH) {
        for (let i = -3; i <= 3; i++) ctx.fillRect(rx + i * 11 - 3, ry - ROAD_W / 2 + 4, 6, 12);
      }
    }
    // Buildings.
    for (const b of this.buildings) {
      if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
      drawBuilding(ctx, b);
    }
    // Trees.
    for (const t of this.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      if (t.palm) drawPalm(ctx, t.x, t.y, t.s);
      else drawTree(ctx, t.x, t.y, t.s);
    }
    // Place labels.
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const p of Object.values(PLACES)) {
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const w = ctx.measureText(p.name).width + 14;
      ctx.fillRect(p.x - w / 2, p.y - 34, w, 20);
      ctx.fillStyle = '#2c3242';
      ctx.fillText(p.name, p.x, p.y - 20);
    }
    // Plaza fountain.
    ctx.fillStyle = '#3d9bd6';
    ctx.beginPath(); ctx.arc(1800, 1575, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8f4ff';
    ctx.beginPath(); ctx.arc(1800, 1575, 20, 0, Math.PI * 2); ctx.fill();
  }
}
