// Teluk Cerah — the HUD.
//
// Everything the player reads while playing: health and cash, the wanted
// stars, the current objective, mission banners, speed, the control hints,
// a live minimap, and the menu / pause / game-over screens. The waypoint
// arrow points at the mission target even when it is off screen.

function pill(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(18,24,32,0.72)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
}

function star(ctx, x, y, r, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = Math.cos(ang) * rad;
    const py = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffc93a' : 'rgba(255,255,255,0.25)';
  ctx.fill();
  ctx.restore();
}

function drawMinimap(ctx, G) {
  const mw = 210;
  const mh = 150;
  const mx = G.vw - mw - 18;
  const my = G.vh - mh - 28;
  ctx.save();
  pill(ctx, mx - 4, my - 4, mw + 8, mh + 8);
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  // land, sea strip, roads
  ctx.fillStyle = '#7fae62';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#3f8fbf';
  ctx.fillRect(mx, my, (200 / 3600) * mw, mh);
  ctx.strokeStyle = 'rgba(40,44,54,0.85)';
  ctx.lineWidth = 3;
  for (const vx of [600, 1200, 1800, 2400, 3000]) {
    ctx.beginPath();
    ctx.moveTo(mx + (vx / 3600) * mw, my);
    ctx.lineTo(mx + (vx / 3600) * mw, my + mh);
    ctx.stroke();
  }
  for (const hy of [500, 1100, 1700, 2300]) {
    ctx.beginPath();
    ctx.moveTo(mx, my + (hy / 2600) * mh);
    ctx.lineTo(mx + mw, my + (hy / 2600) * mh);
    ctx.stroke();
  }
  const dot = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx + (x / 3600) * mw, my + (y / 2600) * mh, r, 0, Math.PI * 2);
    ctx.fill();
  };
  // waypoint pulses green
  if (G.missionTarget) {
    const pr = 5 + Math.sin(G.time * 5) * 1.5;
    dot(G.missionTarget.x, G.missionTarget.y, pr, '#37e05a');
  }
  for (const car of G.cars) {
    if (car.kind === 'cop') dot(car.x, car.y, 3, '#ff2e2e');
    else if (!car.driven) dot(car.x, car.y, 2, 'rgba(240,240,240,0.8)');
  }
  const p = G.player;
  dot(p.x, p.y, 4, '#ffd94a');
  ctx.restore();
  ctx.fillStyle = '#f5efdd';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TELUK CERAH', mx + mw / 2, my + mh + 14);
  ctx.textAlign = 'left';
}

function drawBanner(ctx, G) {
  const b = G.banner;
  if (!b || b.t <= 0) return;
  const alpha = Math.min(1, b.t);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  const tw = Math.max(ctx.measureText(b.title).width, ctx.measureText(b.sub || '').width) + 48;
  pill(ctx, G.vw / 2 - tw / 2, 210, tw, 64);
  ctx.fillStyle = '#ffc93a';
  ctx.font = 'bold 21px system-ui, sans-serif';
  ctx.fillText(b.title, G.vw / 2, 236);
  if (b.sub) {
    ctx.fillStyle = '#f5efdd';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(b.sub, G.vw / 2, 260);
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

function drawToast(ctx, G) {
  const t = G.toast;
  if (!t || t.t <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, t.t);
  ctx.textAlign = 'center';
  const tw = Math.max(ctx.measureText(t.title).width, ctx.measureText(t.sub || '').width) + 40;
  pill(ctx, G.vw / 2 - tw / 2, 292, tw, 54);
  ctx.fillStyle = '#ff8a7a';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(t.title, G.vw / 2, 314);
  if (t.sub) {
    ctx.fillStyle = '#f5efdd';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(t.sub, G.vw / 2, 334);
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

export function drawHUD(ctx, G) {
  const p = G.player;

  // Top-left: name, health, cash.
  pill(ctx, 12, 12, 190, 56);
  ctx.fillStyle = '#f5efdd';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('RANI', 24, 33);
  ctx.fillStyle = '#2a2f38';
  ctx.beginPath();
  ctx.roundRect(24, 40, 110, 12, 6);
  ctx.fill();
  ctx.fillStyle = p.health > 40 ? '#58c96b' : '#e05252';
  ctx.beginPath();
  ctx.roundRect(24, 40, Math.max(0, 110 * (p.health / 100)), 12, 6);
  ctx.fill();
  ctx.fillStyle = '#ffc93a';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`$${p.cash}`, 142, 53);

  // Top-centre: current objective.
  if (G.objective) {
    ctx.font = 'bold 14px system-ui, sans-serif';
    const w = ctx.measureText(G.objective).width + 28;
    pill(ctx, G.vw / 2 - w / 2, 12, w, 32);
    ctx.fillStyle = '#ffc93a';
    ctx.textAlign = 'center';
    ctx.fillText(G.objective, G.vw / 2, 33);
    ctx.textAlign = 'left';
  }

  // Top-right: wanted stars.
  pill(ctx, G.vw - 208, 12, 196, 52);
  for (let i = 0; i < 5; i += 1) star(ctx, G.vw - 188 + i * 34, 34, 12, i < p.wanted);
  if (p.wanted > 0) {
    ctx.fillStyle = '#ff5a4e';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLISI MENGEJARMU', G.vw - 110, 56);
    ctx.textAlign = 'left';
  }

  drawBanner(ctx, G);
  drawToast(ctx, G);

  // Waypoint arrow at the screen edge when the target is off screen.
  if (G.missionTarget && G.mode === 'play') {
    const t = G.missionTarget;
    const sx = t.x - G.cam.x;
    const sy = t.y - G.cam.y;
    if (sx < 0 || sx > G.vw || sy < 0 || sy > G.vh) {
      const cx = G.vw / 2;
      const cy = G.vh / 2;
      const ang = Math.atan2(sy - cy, sx - cx);
      const ax = cx + Math.cos(ang) * (G.vw / 2 - 70);
      const ay = cy + Math.sin(ang) * (G.vh / 2 - 70);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = '#37e05a';
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-12, -13);
      ctx.lineTo(-12, 13);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // "Press E" hint near a mission pickup/delivery point.
  if (G.missionTarget && G.mode === 'play' && G.missionIdx === 0) {
    const t = G.missionTarget;
    if (Math.hypot(p.x - t.x, p.y - t.y) < t.r + 10) {
      ctx.font = 'bold 15px system-ui, sans-serif';
      const label = G.missionStage === 'pickup' ? 'Tekan E — ambil paket' : 'Tekan E — antar paket';
      const w = ctx.measureText(label).width + 28;
      pill(ctx, G.vw / 2 - w / 2, G.vh - 84, w, 34);
      ctx.fillStyle = '#f5efdd';
      ctx.textAlign = 'center';
      ctx.fillText(label, G.vw / 2, G.vh - 62);
      ctx.textAlign = 'left';
    }
  }

  // Bottom-left: speed and controls.
  const speedKmh = p.onFoot ? 0 : Math.round(Math.abs(p.car ? p.car.speed : 0) * 0.45);
  pill(ctx, 12, G.vh - 52, 130, 36);
  ctx.fillStyle = '#f5efdd';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(p.onFoot ? 'Jalan kaki' : `${speedKmh} km/jam`, 24, G.vh - 29);
  pill(ctx, 12, G.vh - 96, 330, 34);
  ctx.fillStyle = '#d8d2c2';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('E — keluar/masuk mobil   •   F — pukul   •   P — jeda   •   M — suara', 24, G.vh - 74);

  drawMinimap(ctx, G);

  // --- Screens ------------------------------------------------------------
  if (G.mode === 'menu') {
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    ctx.fillRect(0, 0, G.vw, G.vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffc93a';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('TELUK CERAH', G.vw / 2, 210);
    ctx.fillStyle = '#f5efdd';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Kota terbuka di tepi teluk — kurir, mobil curian, dan polisi.', G.vw / 2, 252);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#d8d2c2';
    ctx.fillText('Rani, kurir Teluk Cerah, mengambil pekerjaan dari Dimas sang pengatur.', G.vw / 2, 286);
    ctx.fillText('WASD / panah — jalan & nyetir      E — masuk/keluar mobil & ambil paket', G.vw / 2, 330);
    ctx.fillText('F — pukul      P — jeda      M — suara      R — ulang', G.vw / 2, 358);
    ctx.fillStyle = '#37e05a';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('Tekan Enter untuk main', G.vw / 2, 420);
    if (G.hasSave) {
      ctx.fillStyle = '#f5efdd';
      ctx.font = '17px system-ui, sans-serif';
      ctx.fillText('Tekan L untuk melanjutkan simpanan terakhir', G.vw / 2, 452);
    }
    ctx.textAlign = 'left';
  } else if (G.mode === 'paused') {
    ctx.fillStyle = 'rgba(10,14,20,0.6)';
    ctx.fillRect(0, 0, G.vw, G.vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5efdd';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText('Jeda', G.vw / 2, G.vh / 2 - 10);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Tekan P untuk lanjut', G.vw / 2, G.vh / 2 + 28);
    ctx.textAlign = 'left';
  } else if (G.mode === 'over') {
    ctx.fillStyle = 'rgba(10,14,20,0.78)';
    ctx.fillRect(0, 0, G.vw, G.vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a4e';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText(G.overReason || 'Game Over', G.vw / 2, G.vh / 2 - 40);
    ctx.fillStyle = '#f5efdd';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(`Uang yang dikumpulkan: $${p.cash}`, G.vw / 2, G.vh / 2 + 4);
    ctx.fillStyle = '#37e05a';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('Tekan R untuk main lagi', G.vw / 2, G.vh / 2 + 52);
    ctx.textAlign = 'left';
  }
}
