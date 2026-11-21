// Bandar Pelita — shared state + drawing helpers (original code, written fresh).
// Dusk harbour city. All art is drawn in code; no external assets.

window.G = {
  W: 3200, H: 2400,
  time: 0,
  state: 'menu', // menu | playing | paused | over | win
  cash: 0,
  wanted: 0,
  wantDecay: 0,
  player: null,
  cars: [],
  peds: [],
  missionIndex: 0,
  mission: null,
  cam: { x: 0, y: 0 },
  keys: {},
  shake: 0,
  toasts: [],
  muted: false,
  overReason: '',
  shot: null,
  seed: 1,
};

// Deterministic RNG (mulberry32) for city generation and staged screenshots.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const angTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
function angDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
const TAU = Math.PI * 2;

const PAL = {
  ground: '#262a45', ground2: '#2e3352',
  road: '#3b4062', roadEdge: '#4b5178', lane: '#d9c46a',
  sidewalk: '#4a507a',
  water: '#17465f', water2: '#1e5a78',
  park: '#2c6b46', park2: '#35804f',
  market: '#7a5a30',
  pier: '#6b4e2e', pier2: '#7d5c36',
  building: ['#6b5b8f', '#8f6b5b', '#5b8f7a', '#7a5b8f', '#8f8f5b', '#5b7a8f', '#96606a'],
  roof: ['#4a3f66', '#664a3f', '#3f664f', '#553f66', '#66663f', '#3f5566', '#6b4248'],
  lantern: '#ffb347',
  car: ['#c0392b', '#2980b9', '#f1c40f', '#ecf0f1', '#2ecc71', '#e67e22', '#9b59b6', '#1abc9c'],
  police: '#2c3e50',
  player: '#ff5e78',
};

const A = {
  PAL,
  clamp, lerp, dist, angTo, angDiff, mulberry32, TAU,
  rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },
  drawCar(ctx, x, y, angle, color, opts) {
    opts = opts || {};
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    A.rr(ctx, -24 + 2, -12 + 3, 50, 26, 7); ctx.fill();
    // body
    ctx.fillStyle = color;
    A.rr(ctx, -24, -12, 50, 26, 7); ctx.fill();
    // roof + windows
    ctx.fillStyle = 'rgba(20,24,40,0.9)';
    A.rr(ctx, -8, -9, 18, 18, 4); ctx.fill();
    ctx.fillStyle = 'rgba(160,210,255,0.75)';
    A.rr(ctx, 8, -8, 8, 16, 3); ctx.fill();
    // wheels
    ctx.fillStyle = '#101018';
    ctx.fillRect(-18, -14, 10, 5); ctx.fillRect(-18, 9, 10, 5);
    ctx.fillRect(10, -14, 10, 5); ctx.fillRect(10, 9, 10, 5);
    // headlights
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(24, -9, 3, 5); ctx.fillRect(24, 4, 3, 5);
    ctx.fillStyle = '#ff5a4e';
    ctx.fillRect(-25, -9, 3, 5); ctx.fillRect(-25, 4, 3, 5);
    if (opts.police) {
      const t = Math.floor(G.time * 6) % 2;
      ctx.fillStyle = t === 0 ? '#ff2e2e' : '#2e7bff';
      ctx.fillRect(-4, -13, 8, 4);
      ctx.fillStyle = t === 0 ? '#2e7bff' : '#ff2e2e';
      ctx.fillRect(-4, 9, 8, 4);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('POLISI', 0, 3);
    }
    if (opts.marked) {
      ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      A.rr(ctx, -28, -16, 58, 34, 8); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  },
  drawPerson(ctx, x, y, angle, color, opts) {
    opts = opts || {};
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(1, 2, 9, 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath(); ctx.arc(3, 0, 4.5, 0, TAU); ctx.fill();
    ctx.fillStyle = color;
    ctx.fillRect(-6, -3, 5, 6);
    if (opts.police) {
      ctx.fillStyle = '#1d2b3a';
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#dfe9ff';
      ctx.fillRect(-6, -2, 12, 4);
    }
    ctx.restore();
  },
  drawBuilding(ctx, b) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    A.rr(ctx, b.x + 4, b.y + 5, b.w, b.h, 4); ctx.fill();
    ctx.fillStyle = b.color;
    A.rr(ctx, b.x, b.y, b.w, b.h, 4); ctx.fill();
    ctx.fillStyle = b.roof;
    A.rr(ctx, b.x + 6, b.y + 6, b.w - 12, b.h - 12, 3); ctx.fill();
    // lit windows
    ctx.fillStyle = 'rgba(255,210,120,0.85)';
    const cols = Math.max(1, Math.floor((b.w - 20) / 18));
    const rows = Math.max(1, Math.floor((b.h - 20) / 18));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (((i * 7 + j * 13 + b.x) % 5) < 2) {
          ctx.fillRect(b.x + 10 + i * 18, b.y + 10 + j * 18, 8, 8);
        }
      }
    }
    if (b.label) {
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 5);
    }
  },
};
