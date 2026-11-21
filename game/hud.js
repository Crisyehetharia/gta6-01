// Bandar Pelita — HUD, minimap, waypoint, and screens.
const Hud = (() => {
  function toast(msg) {
    G.toasts.push({ text: msg, t: 0 });
    if (G.toasts.length > 3) G.toasts.shift();
  }

  function drawStars(ctx, x, y, n) {
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < n ? '#ffd94d' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', x + i * 28, y);
    }
  }

  function drawMinimap(ctx) {
    const mw = 200, mh = 150, mx = 1280 - mw - 14, my = 14;
    const sx = mw / G.W, sy = mh / G.H;
    ctx.save();
    ctx.fillStyle = 'rgba(10,12,24,0.82)';
    A.rr(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8); ctx.fill();
    ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 2;
    A.rr(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8); ctx.stroke();
    ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
    // water
    ctx.fillStyle = PAL.water;
    ctx.fillRect(mx + 3000 * sx, my, (G.W - 3000) * sx, mh);
    // roads
    ctx.strokeStyle = '#565e86'; ctx.lineWidth = 3;
    for (const rx of City.vRoads) { ctx.beginPath(); ctx.moveTo(mx + rx * sx, my); ctx.lineTo(mx + rx * sx, my + mh); ctx.stroke(); }
    for (const ry of City.hRoads) { ctx.beginPath(); ctx.moveTo(mx, my + ry * sy); ctx.lineTo(mx + mw, my + ry * sy); ctx.stroke(); }
    // buildings
    ctx.fillStyle = '#8d94c4';
    for (const b of City.buildings) ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
    // mission target
    const tp = Missions.targetPos();
    if (tp) {
      ctx.fillStyle = '#ffe14d';
      const tx = mx + tp.x * sx, ty = my + tp.y * sy;
      ctx.beginPath();
      ctx.moveTo(tx, ty - 6); ctx.lineTo(tx + 6, ty); ctx.lineTo(tx, ty + 6); ctx.lineTo(tx - 6, ty);
      ctx.closePath(); ctx.fill();
    }
    // police
    ctx.fillStyle = '#ff3b30';
    for (const c of Police.policeCars()) {
      ctx.beginPath(); ctx.arc(mx + c.x * sx, my + c.y * sy, 3, 0, TAU); ctx.fill();
    }
    // player
    const p = G.player;
    if (p) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(mx + p.x * sx, my + p.y * sy, 4, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ff5e78'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx + p.x * sx, my + p.y * sy, 6.5, 0, TAU); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('BANDAR PELITA', mx + mw / 2, my + mh + 18);
  }

  function drawWaypoint(ctx) {
    const tp = Missions.targetPos();
    if (!tp || G.state !== 'playing') return;
    const p = G.player;
    const sx = tp.x - G.cam.x, sy = tp.y - G.cam.y;
    const d = dist(p.x, p.y, tp.x, tp.y);
    ctx.save();
    if (sx > 40 && sx < 1240 && sy > 40 && sy < 680) {
      // on screen: pulsing diamond + distance
      const pulse = 1 + 0.18 * Math.sin(G.time * 5);
      ctx.translate(sx, sy - 46 * pulse);
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      ctx.moveTo(0, -12); ctx.lineTo(10, 0); ctx.lineTo(0, 12); ctx.lineTo(-10, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(Math.round(d) + 'm', 0, 30);
    } else {
      // off screen: edge arrow
      const cx = clamp(sx, 50, 1230), cy = clamp(sy, 50, 670);
      const a = Math.atan2(sy - 360, sx - 640);
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
      ctx.rotate(-a);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(Math.round(d) + 'm', 0, 26);
    }
    ctx.restore();
  }

  function draw(ctx) {
    if (G.state === 'menu') { drawMenu(ctx); return; }
    const p = G.player;
    // health bar
    ctx.fillStyle = 'rgba(10,12,24,0.75)';
    A.rr(ctx, 12, 12, 220, 54, 8); ctx.fill();
    ctx.fillStyle = '#e74c3c';
    A.rr(ctx, 22, 22, 200, 14, 4); ctx.fill();
    ctx.fillStyle = p.health > 30 ? '#2ecc71' : '#e74c3c';
    A.rr(ctx, 22, 22, 200 * clamp(p.health / 100, 0, 1), 14, 4); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('RAKA  ♥ ' + Math.ceil(p.health), 22, 48);
    // cash
    ctx.fillStyle = 'rgba(10,12,24,0.75)';
    A.rr(ctx, 12, 74, 220, 30, 8); ctx.fill();
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('$ ' + G.cash.toLocaleString('en-US'), 22, 95);
    // wanted stars
    drawStars(ctx, 22, 132, G.wanted);
    // speed
    if (p.inCar) {
      ctx.fillStyle = 'rgba(10,12,24,0.75)';
      A.rr(ctx, 12, 640, 150, 56, 8); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(Math.round(Math.abs(p.inCar.speed) * 0.36) + ' km/j', 24, 676);
    }
    // objective
    const obj = Missions.objectiveText();
    ctx.font = 'bold 15px sans-serif';
    const w = ctx.measureText(obj).width + 28;
    ctx.fillStyle = 'rgba(10,12,24,0.78)';
    A.rr(ctx, (1280 - w) / 2, 12, w, 32, 8); ctx.fill();
    ctx.fillStyle = '#ffe14d';
    ctx.textAlign = 'center';
    ctx.fillText(obj, 640, 33);
    // toasts
    ctx.font = '14px sans-serif';
    G.toasts.forEach((t, i) => {
      t.t += 1 / 60;
      const alpha = t.t > 3 ? Math.max(0, 1 - (t.t - 3)) : 1;
      if (alpha <= 0) return;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(10,12,24,0.8)';
      const tw = ctx.measureText(t.text).width + 24;
      A.rr(ctx, (1280 - tw) / 2, 52 + i * 30, tw, 24, 6); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(t.text, 640, 69 + i * 30);
      ctx.globalAlpha = 1;
    });
    G.toasts = G.toasts.filter(t => t.t < 4);
    drawMinimap(ctx);
    // controls hint
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '12px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('WASD jalan/kemudi • E naik/turun mobil • F pukul • P jeda • M suara', 14, 708);
    if (G.state === 'paused') drawPaused(ctx);
    if (G.state === 'over') drawOver(ctx);
    if (G.state === 'win') drawWin(ctx);
  }

  function overlay(ctx, title, lines, foot) {
    ctx.fillStyle = 'rgba(8,10,22,0.82)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#ffb347';
    ctx.font = 'bold 52px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(title, 640, 200);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    lines.forEach((l, i) => ctx.fillText(l, 640, 260 + i * 30));
    ctx.fillStyle = '#ffe14d';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(foot, 640, 260 + lines.length * 30 + 40);
  }

  function drawMenu(ctx) {
    overlay(ctx, 'BANDAR PELITA', [
      'Kota pelabuhan di ujung senja. Raka, mantan kurir, berutang pada Bu Sari.',
      'Tiga misi menanti: antar paket, tarik mobil, dan kabur dari razia besar.',
      '',
      'WASD / panah — jalan & kemudi    E — naik / turun mobil',
      'F — pukul    P — jeda    M — suara    Enter — mulai misi',
      '',
      'Curi mobil, hindari polisi, dan jangan sampai tertangkap.',
    ], 'Klik untuk mulai');
  }
  function drawPaused(ctx) {
    overlay(ctx, 'JEDA', ['Istirahat dulu. Bandar Pelita menunggumu.', 'Uang: $' + G.cash.toLocaleString('en-US')], 'Tekan P atau klik untuk lanjut');
  }
  function drawOver(ctx) {
    overlay(ctx, 'GAME OVER', [G.overReason, '', 'Uang: $' + G.cash.toLocaleString('en-US') + '   •   Misi: ' + G.missionIndex + '/3'], 'Klik untuk coba lagi');
  }
  function drawWin(ctx) {
    overlay(ctx, 'SEMUA MISI SELESAI!', ['Raka lunas dari Bu Sari. Bandar Pelita akhirnya tenang.', '', 'Total uang: $' + G.cash.toLocaleString('en-US')], 'Klik untuk free roam');
  }

  return { toast, draw, drawWaypoint };
})();
