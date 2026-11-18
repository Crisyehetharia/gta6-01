// Teluk Cerah — small drawing helpers.
//
// Everything in this game is drawn in code: there are no image assets.
// This file only holds the palette and the reusable top-down shapes
// (people, buildings, trees). Cars have their own drawing in vehicles.js.

export const PALETTE = {
  ground: '#c9b78d', // dry grass between the roads
  sand: '#e7d6a4', // beach sand
  sea: '#3f8fbf', // bay water
  seaDeep: '#2e6d9c', // deeper water, further from shore
  road: '#3b404b', // asphalt
  roadLine: '#e8c95a', // centre dashes
  kerb: '#a89a7c', // pavement edge
  plaza: '#b3a586', // market square, parking lots
  roofA: '#8a6f5c',
  roofB: '#7c8a6f',
  roofC: '#6f7c8a',
  roofD: '#96684f',
  roofE: '#5f7d6a',
  wall: '#ddd3bf',
  window: '#4a5568',
  tree: '#4d7d4a',
  treeDark: '#3a6a3c',
  gold: '#e8b73a',
  white: '#f2f2ee',
  red: '#d64541',
  blue: '#2f6fd0',
};

// Rounded-rectangle path (does not fill or stroke on its own).
export function rr(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

// A person seen from above: shoulders, head, and a facing tick.
// `down` draws them lying flat (knocked out).
export function drawPerson(ctx, x, y, angle, color, down) {
  ctx.save();
  ctx.translate(x, y);
  if (down) {
    ctx.rotate(angle);
    ctx.fillStyle = color;
    rr(ctx, -13, -6, 26, 12, 6);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(15, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // nose / facing tick so the direction reads at a glance
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(9, -3);
  ctx.lineTo(15, 0);
  ctx.lineTo(9, 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// A city building: wall slab, coloured roof with a rim, and a window grid.
export function drawBuilding(ctx, b) {
  ctx.save();
  // soft drop shadow so blocks read as solid
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  rr(ctx, b.x + 4, b.y + 5, b.w, b.h, 6);
  ctx.fill();
  ctx.fillStyle = PALETTE.wall;
  rr(ctx, b.x, b.y, b.w, b.h, 4);
  ctx.fill();
  ctx.fillStyle = b.roof;
  rr(ctx, b.x + 5, b.y + 5, b.w - 10, b.h - 10, 3);
  ctx.fill();
  // window dots on the roof face
  const cols = Math.max(1, Math.floor((b.w - 24) / 22));
  const rows = Math.max(1, Math.floor((b.h - 24) / 22));
  ctx.fillStyle = PALETTE.window;
  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < rows; j += 1) {
      ctx.fillRect(b.x + 14 + i * 22, b.y + 14 + j * 22, 8, 8);
    }
  }
  // door on the south face
  ctx.fillStyle = '#3a3230';
  ctx.fillRect(b.x + b.w / 2 - 7, b.y + b.h - 6, 14, 6);
  ctx.restore();
}

// A round-crowned tree with a trunk dot.
export function drawTree(ctx, x, y, s) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.arc(x + 2, y + 3, s * 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.treeDark;
  ctx.beginPath();
  ctx.arc(x, y, s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.tree;
  ctx.beginPath();
  ctx.arc(x - s * 0.2, y - s * 0.2, s * 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
