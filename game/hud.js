// hud.js — HUD (health, cash, wanted stars, speed, objective) and the
// minimap with player, police, waypoint and car markers.

import { WORLD_W, WORLD_H } from './city.js';

export function drawHUD(ctx, S, vw, vh) {
  const p = S.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Top-left: health + cash.
  ctx.fillStyle = 'rgba(10,14,22,0.55)';
  roundRect(ctx, 12, 12, 218, 64, 10); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('RANI', 24, 34);
  ctx.fillStyle = '#2b2f38';
  roundRect(ctx, 24, 42, 150, 12, 6); ctx.fill();
  ctx.fillStyle = p.hp > 50 ? '#57c465' : p.hp > 25 ? '#f2a007' : '#e0483e';
  roundRect(ctx, 24, 42, Math.max(0, 150 * (p.hp / 100)), 12, 6); ctx.fill();
  ctx.fillStyle = '#ffd21f';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`$${S.cash}`, 184, 54);

  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(10,14,22,0.55)';
  roundRect(ctx, vw - 212, 12, 200, 44, 10); ctx.fill();
  ctx.font = 'bold 22px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < S.police.wanted ? '#ffd21f' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', vw - 196 + i * 34, 44);
  }
  if (S.police.wanted > 0) {
    ctx.fillStyle = '#ff5a4e';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('POLISI MENGEJARMU', vw - 24, 70);
    ctx.textAlign = 'left';
  }

  // Top-centre: mission objective.
  const obj = S.missions.objectiveText();
  ctx.font = 'bold 15px system-ui, sans-serif';
  const ow = ctx.measureText(obj).width + 28;
  ctx.fillStyle = 'rgba(10,14,22,0.55)';
  roundRect(ctx, (vw - ow) / 2, 12, ow, 34, 10); ctx.fill();
  ctx.fillStyle = '#ffd21f';
  ctx.textAlign = 'center';
  ctx.fillText(obj, vw / 2, 34);
  ctx.textAlign = 'left';
  if (S.missions.timer > 0) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`⏱ ${Math.ceil(S.missions.timer)} dtk`, (vw - ow) / 2, 62);
  }

  // Bottom-left: contextual hint + speed while driving.
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(10,14,22,0.55)';
  const hint = S.hintText();
  if (hint) {
    const hw = ctx.measureText(hint).width + 20;
    roundRect(ctx, 12, vh - 44, hw, 30, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(hint, 22, vh - 24);
  }
  if (p.inCar) {
    const kmh = Math.round(Math.abs(p.inCar.speed) * 0.32);
    ctx.fillStyle = 'rgba(10,14,22,0.55)';
    roundRect(ctx, 12, vh - 84, 120, 30, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(`${kmh} km/jam`, 24, vh - 62);
  }

  // Banner (mission title / rewards), centre.
  if (S.banner && S.bannerT > 0) {
    const a = Math.min(1, S.bannerT);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(10,14,22,0.7)';
    const bw = Math.max(ctx.measureText(S.banner.title).width, ctx.measureText(S.banner.sub).width) + 48;
    roundRect(ctx, (vw - bw) / 2, vh * 0.22, bw, 74, 12); ctx.fill();
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(S.banner.title, vw / 2, vh * 0.22 + 32);
    ctx.fillStyle = '#fff';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(S.banner.sub, vw / 2, vh * 0.22 + 58);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  drawMinimap(ctx, S, vw, vh);
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function drawMinimap(ctx, S, vw, vh) {
  const MW = 210, MH = 152;
  const mx = vw - MW - 12, my = vh - MH - 12;
  const sx = MW / WORLD_W, sy = MH / WORLD_H;
  ctx.fillStyle = 'rgba(10,14,22,0.65)';
  roundRect(ctx, mx - 4, my - 4, MW + 8, MH + 8, 10); ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, MW, MH);
  ctx.clip();
  // Water + ground.
  ctx.fillStyle = '#3d9bd6';
  ctx.fillRect(mx, my + 2280 * sy, MW, MH - 2280 * sy);
  ctx.fillStyle = '#8fce7d';
  ctx.fillRect(mx, my, MW, 2280 * sy);
  // Roads.
  ctx.strokeStyle = '#3a4150';
  ctx.lineWidth = 3;
  for (const rx of S.city.roadsV) {
    ctx.beginPath(); ctx.moveTo(mx + rx * sx, my); ctx.lineTo(mx + rx * sx, my + 2280 * sy); ctx.stroke();
  }
  for (const ry of S.city.roadsH) {
    ctx.beginPath(); ctx.moveTo(mx, my + ry * sy); ctx.lineTo(mx + MW, my + ry * sy); ctx.stroke();
  }
  // Waypoint (pulsing yellow).
  const wp = S.missions.waypoint();
  if (wp) {
    const pulse = 3 + Math.sin(performance.now() / 250) * 1.5;
    ctx.fillStyle = '#ffd21f';
    ctx.beginPath(); ctx.arc(mx + wp.x * sx, my + wp.y * sy, pulse + 3, 0, Math.PI * 2); ctx.fill();
  }
  // Parked cars (grey), police (red), player (green triangle).
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (const c of S.parkedCars) ctx.fillRect(mx + c.x * sx - 1, my + c.y * sy - 1, 2, 2);
  for (const c of S.police.cops) {
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath(); ctx.arc(mx + c.x * sx, my + c.y * sy, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  const p = S.player.inCar ?? S.player;
  ctx.save();
  ctx.translate(mx + p.x * sx, my + p.y * sy);
  ctx.rotate(S.player.inCar ? S.player.inCar.angle : S.player.angle);
  ctx.fillStyle = '#2fe05a';
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('TELUK CERAH', mx + 4, my + MH - 6);
}
