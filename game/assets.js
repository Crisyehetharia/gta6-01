// assets.js — all art is drawn in code. No external images, no network.
// Palette: bright modern coastal city in daylight ("Teluk Cerah").

export const PALETTE = {
  grass: '#8fce7d',
  grassDark: '#7cbf6a',
  sand: '#ecd9a0',
  water: '#3d9bd6',
  waterDeep: '#2b7fc0',
  road: '#3a4150',
  roadLine: '#f2d06b',
  sidewalk: '#d9d2c2',
  block: '#cfc8b8',
  buildingColors: ['#e8a0a0', '#a0c4e8', '#f2d38a', '#b5e0a8', '#d9b3e0', '#f5b08a', '#9ad6d0', '#e8e8e8'],
  roofColors: ['#8a7f72', '#6f7f8a', '#7a6a58', '#5d6b52'],
};

// Seeded RNG (mulberry32) so the city layout is stable every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// A top-down building: body, roof, windows, rooftop detail.
export function drawBuilding(ctx, b) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  roundRect(ctx, b.x + 5, b.y + 6, b.w, b.h, 4); ctx.fill();
  ctx.fillStyle = b.color;
  roundRect(ctx, b.x, b.y, b.w, b.h, 4); ctx.fill();
  ctx.fillStyle = b.roof;
  roundRect(ctx, b.x + 5, b.y + 5, b.w - 10, b.h - 10, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  const cols = Math.max(1, Math.floor((b.w - 16) / 16));
  const rows = Math.max(1, Math.floor((b.h - 16) / 16));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if ((i * 7 + j * 13 + b.seed) % 5 === 0) continue;
      ctx.fillRect(b.x + 9 + i * 16, b.y + 9 + j * 16, 8, 8);
    }
  }
  if (b.w > 60 && b.h > 60) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h / 2 - 8, 16, 16);
  }
}

// A top-down car. angle in radians, 0 = facing east.
export function drawCar(ctx, x, y, angle, color, opts = {}) {
  const L = opts.length ?? 46, W = opts.width ?? 22;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -L / 2 + 2, -W / 2 + 3, L, W, 7); ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 7); ctx.fill();
  ctx.fillStyle = '#20242c';
  ctx.fillRect(-L * 0.18, -W / 2 + 2, L * 0.30, W - 4); // windshield + roof
  ctx.fillStyle = '#9fc4e8';
  ctx.fillRect(-L * 0.30, -W / 2 + 3, L * 0.14, W - 6); // rear window
  ctx.fillStyle = '#f5e9c8';
  ctx.fillRect(L / 2 - 3, -W / 2 + 3, 2, 5);
  ctx.fillRect(L / 2 - 3, W / 2 - 8, 2, 5); // headlights
  ctx.fillStyle = '#e0483e';
  ctx.fillRect(-L / 2 + 1, -W / 2 + 3, 2, 5);
  ctx.fillRect(-L / 2 + 1, W / 2 - 8, 2, 5); // taillights
  if (opts.police) {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-L * 0.05, -W / 2 + 1, L * 0.22, W - 2);
    const t = opts.flash ?? 0;
    ctx.fillStyle = t % 2 === 0 ? '#e0342b' : '#2b6fe0';
    ctx.fillRect(-L * 0.02, -W / 2 - 2, 7, 5);
    ctx.fillStyle = t % 2 === 0 ? '#2b6fe0' : '#e0342b';
    ctx.fillRect(-L * 0.02 + 8, -W / 2 - 2, 7, 5);
  }
  if (opts.target) {
    ctx.strokeStyle = '#ffd21f';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    roundRect(ctx, -L / 2 - 6, -W / 2 - 6, L + 12, W + 12, 9); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

// A top-down walking person.
export function drawPerson(ctx, x, y, angle, shirt, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  if (opts.down) {
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = shirt;
    roundRect(ctx, -11, -6, 22, 12, 6); ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(13, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const bob = opts.walkPhase ? Math.sin(opts.walkPhase) * 2 : 0;
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(1, 2, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2c3242'; // legs
  ctx.fillRect(-8, -7 + bob, 6, 5);
  ctx.fillRect(-8, 2 - bob, 6, 5);
  ctx.fillStyle = shirt; // torso
  roundRect(ctx, -9, -8, 18, 16, 6); ctx.fill();
  ctx.fillStyle = '#e8b98a'; // head
  ctx.beginPath(); ctx.arc(11, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2c2418';
  ctx.beginPath(); ctx.arc(11, 0, 7, Math.PI, Math.PI * 2); ctx.fill();
  if (opts.punch) {
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(24, 0, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawTree(ctx, x, y, s = 1) {
  ctx.fillStyle = '#5d8a4a';
  ctx.beginPath(); ctx.arc(x, y, 11 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#79b264';
  ctx.beginPath(); ctx.arc(x - 3 * s, y - 3 * s, 7 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8fce7d';
  ctx.beginPath(); ctx.arc(x - 4 * s, y - 4 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
}

export function drawPalm(ctx, x, y, s = 1) {
  ctx.strokeStyle = '#8a6b45';
  ctx.lineWidth = 4 * s;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3 * s, y - 14 * s); ctx.stroke();
  ctx.strokeStyle = '#4e9b47';
  ctx.lineWidth = 3 * s;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.55;
    ctx.beginPath();
    ctx.moveTo(x + 3 * s, y - 14 * s);
    ctx.quadraticCurveTo(x + Math.cos(a) * 12 * s, y - 14 * s + Math.sin(a) * 10 * s - 4, x + Math.cos(a) * 18 * s, y - 14 * s + Math.sin(a) * 14 * s + 6);
    ctx.stroke();
  }
}
