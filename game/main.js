// main.js — Teluk Cerah: an original open-world crime game in 2D top-down.
// Rani, a courier from Teluk Cerah, takes jobs from Dimas, a local fixer:
// deliver a package, repo a gold car, then outrun a police chase.
// No network, no external assets — everything is drawn in code.

import { City, PLACES, WORLD_W, WORLD_H } from './city.js';
import { AudioSys } from './audio.js';
import { Player } from './player.js';
import { Car, spawnParkedCars } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { drawHUD } from './hud.js';
import { drawCar } from './assets.js';

const SAVE_KEY = 'telukcerah-save-v1';

const S = {
  mode: 'menu', // menu | play | pause | over
  overReason: '',
  time: 0,
  cash: 0,
  best: 0,
  missionsDone: 0,
  keys: new Set(),
  cam: { x: 0, y: 0 },
  banner: null,
  bannerT: 0,
  city: null,
  player: null,
  traffic: null,
  police: null,
  missions: null,
  parkedCars: [],
  audio: new AudioSys(),
  canvas: null,
  ctx: null,
  vw: 1280,
  vh: 720,
};

S.setBanner = (title, sub, secs) => { S.banner = { title, sub }; S.bannerT = secs; };

S.save = () => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: S.cash, best: S.best, missionsDone: S.missionsDone }));
  } catch { /* storage unavailable — play on without saving */ }
};

S.load = () => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    S.cash = d.cash || 0;
    S.best = d.best || 0;
    S.missionsDone = d.missionsDone || 0;
  } catch { /* ignore a corrupt save */ }
};

S.gameOver = (reason) => {
  if (S.mode !== 'play') return;
  S.mode = 'over';
  S.overReason = reason;
  S.best = Math.max(S.best, S.cash);
  S.save();
  S.audio.stopAll();
  S.audio.busted();
};

S.hintText = () => {
  const p = S.player;
  if (S.mode !== 'play') return '';
  if (p.inCar) return 'E — Keluar mobil   •   P — Jeda   •   M — Suara';
  const def = S.missions.current;
  if (def) {
    const wp = S.missions.waypoint();
    if (wp && Math.hypot(p.x - wp.x, p.y - wp.y) < 90) {
      if (def.id === 1 && S.missions.stage === 'toPickup') return 'E — Ambil paket';
      if (def.id === 1) return 'E — Serahkan paket';
      if (def.id === 2 && S.missions.stage === 'toDeliver') return 'E — Serahkan mobil';
    }
  }
  const near = nearestCar(p.x, p.y, 70);
  if (near) return 'E — Masuk mobil';
  return 'WASD — Jalan   •   F — Pukul   •   E — Masuk mobil';
};

function nearestCar(x, y, maxD) {
  let best = null, bd = maxD;
  for (const c of S.parkedCars) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function enterExitCar() {
  const p = S.player;
  // Mission interaction first (package pickup / delivery), even from a car.
  if (S.missions.tryInteract(S)) return;
  if (p.inCar) {
    const car = p.inCar;
    car.parked = true;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    S.city.resolveCircle(p, 14);
    p.inCar = null;
    S.audio.click();
    return;
  }
  const car = nearestCar(p.x, p.y, 70);
  if (car) {
    p.inCar = car;
    car.parked = false;
    p.x = car.x; p.y = car.y;
    S.audio.click();
    if (car.target) {
      // Stealing the gold mission car is a crime, handled by the mission.
    } else if (car !== S.missions.targetCar) {
      S.police.addWanted(1, 'Mobil dicuri!');
      S.setBanner('Mobil dicuri!', 'Seseorang melihatmu — bintang wanted naik.', 2.5);
    }
  }
}

// Combat: punching pedestrians and foot officers.
S.combat = {
  punch(player) {
    const range = 42, arc = 1.15;
    for (const ped of S.traffic.peds) {
      if (ped.down > 0) continue;
      const dx = ped.x - player.x, dy = ped.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d > range) continue;
      let diff = Math.atan2(dy, dx) - player.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < arc) {
        ped.hit(S, false);
        ped.flee = 3;
      }
    }
    for (const f of S.police.footCops) {
      const dx = f.x - player.x, dy = f.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d > range) continue;
      let diff = Math.atan2(dy, dx) - player.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < arc) {
        f.hp -= 20;
        S.police.addWanted(1, 'Menyerang polisi!');
        S.audio.punch();
      }
    }
  },
};

function resetRun() {
  S.city = new City(citySeed);
  S.player = new Player(PLACES.plaza.x, PLACES.plaza.y + 60);
  S.parkedCars = spawnParkedCars(S.city, 16);
  S.traffic = new Traffic(S.city);
  S.police = new Police(S.city);
  S.police.onWantedUp = (n, reason) => {
    S.audio.wantedUp();
    if (reason) S.setBanner(`WANTED ★${n}`, reason, 2.5);
  };
  S.missions = new Missions(S);
  S.banner = null; S.bannerT = 0;
  S.cam.x = S.player.x - S.vw / 2;
  S.cam.y = S.player.y - S.vh / 2;
}

function startGame() {
  resetRun();
  S.mode = 'play';
  S.missions.start();
  S.audio.ensure();
  S.audio.click();
}

function update(dt) {
  S.time += dt;
  if (S.bannerT > 0) S.bannerT -= dt;
  if (S.mode !== 'play') return;
  const p = S.player;
  if (p.inCar) {
    const moving = p.inCar.drive(dt, S.keys, S);
    p.x = p.inCar.x; p.y = p.inCar.y;
    p.angle = p.inCar.angle;
    S.audio.engine(true, Math.min(1, Math.abs(p.inCar.speed) / 400));
    // Bump into traffic cars.
    for (const c of S.traffic.cars) {
      const d = Math.hypot(c.x - p.inCar.x, c.y - p.inCar.y);
      if (d < 42 && d > 0.1) {
        const push = (42 - d) / 2;
        const nx = (c.x - p.inCar.x) / d, ny = (c.y - p.inCar.y) / d;
        c.x += nx * push; c.y += ny * push;
        p.inCar.x -= nx * push; p.inCar.y -= ny * push;
        if (Math.abs(p.inCar.speed) > 180) {
          S.audio.crash();
          p.inCar.speed *= 0.5;
          p.damage(5, S);
        } else {
          p.inCar.speed *= 0.85;
        }
      }
    }
  } else {
    p.update(dt, S.keys, S);
    S.audio.engine(false, 0);
  }
  S.traffic.update(dt, S);
  S.police.update(dt, S);
  S.missions.update(dt, S);
  // Camera follows the player.
  const fx = p.inCar ? p.inCar.x : p.x;
  const fy = p.inCar ? p.inCar.y : p.y;
  const tx = Math.max(0, Math.min(WORLD_W - S.vw, fx - S.vw / 2));
  const ty = Math.max(0, Math.min(WORLD_H - S.vh, fy - S.vh / 2));
  S.cam.x += (tx - S.cam.x) * Math.min(1, dt * 6);
  S.cam.y += (ty - S.cam.y) * Math.min(1, dt * 6);
}

function draw() {
  const ctx = S.ctx, vw = S.vw, vh = S.vh;
  ctx.clearRect(0, 0, vw, vh);
  if (S.mode === 'menu') {
    // Slow pan over the plaza behind the title.
    S.cam.x = 1800 - vw / 2 + Math.sin(S.time * 0.08) * 260;
    S.cam.y = 1575 - vh / 2 + Math.cos(S.time * 0.06) * 160;
    ctx.save();
    ctx.translate(-S.cam.x, -S.cam.y);
    S.city.draw(ctx, S.cam, vw, vh);
    ctx.restore();
    ctx.fillStyle = 'rgba(8,12,20,0.72)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('TELUK CERAH', vw / 2, vh * 0.26);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('Kota terbuka di tepi teluk — antar paket, tarik mobil, kabur dari polisi.', vw / 2, vh * 0.26 + 36);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#cfe3ff';
    const lines = [
      'Rani, kurir Teluk Cerah, mengambil pekerjaan dari Dimas, sang fixer.',
      'Tiga misi menantimu: Paket Kilat, Tarik Mobil, dan Jalan Keluar.',
      '',
      'WASD / Panah — Jalan & mengemudi      E — Masuk / keluar mobil, ambil paket',
      'F / Spasi — Pukul      P — Jeda      M — Suara      R — Ulangi',
      '',
      `Uang: $${S.cash}   •   Misi selesai: ${S.missionsDone} / 3   •   Rekor uang: $${S.best}`,
    ];
    lines.forEach((l, i) => ctx.fillText(l, vw / 2, vh * 0.42 + i * 26));
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('Tekan ENTER untuk mulai', vw / 2, vh * 0.42 + lines.length * 26 + 22);
    ctx.textAlign = 'left';
    return;
  }

  ctx.save();
  ctx.translate(-Math.round(S.cam.x), -Math.round(S.cam.y));
  S.city.draw(ctx, S.cam, vw, vh);
  S.missions.drawMarker(ctx, S.cam, vw, vh);
  for (const c of S.parkedCars) {
    if (c === S.player.inCar) continue;
    c.draw(ctx);
  }
  S.traffic.draw(ctx);
  if (S.player.inCar) S.player.inCar.draw(ctx);
  else S.player.draw(ctx);
  S.police.draw(ctx);
  ctx.restore();

  drawHUD(ctx, S, vw, vh);

  if (S.mode === 'pause') {
    ctx.fillStyle = 'rgba(8,12,20,0.6)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText('JEDA', vw / 2, vh / 2 - 10);
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('Tekan P untuk lanjut — M untuk suara', vw / 2, vh / 2 + 28);
    ctx.textAlign = 'left';
  }

  if (S.mode === 'over') {
    ctx.fillStyle = 'rgba(8,12,20,0.78)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a4e';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText('GAME OVER', vw / 2, vh / 2 - 40);
    ctx.fillStyle = '#fff';
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillText(S.overReason, vw / 2, vh / 2);
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`Uang: $${S.cash}   •   Misi selesai: ${S.missions.done} / 3`, vw / 2, vh / 2 + 40);
    ctx.fillStyle = '#fff';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('Tekan R untuk main lagi', vw / 2, vh / 2 + 78);
    ctx.textAlign = 'left';
  }
}

let lastT = 0;
function loop(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// --- Input ---
const params = new URLSearchParams(location.search);
const citySeed = Number(params.get('seed') || 20261124) || 20261124;

function onKeyDown(e) {
  S.audio.ensure();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  S.keys.add(e.code);
  if (e.code === 'Enter' && S.mode === 'menu') { startGame(); return; }
  if (e.code === 'KeyR' && S.mode === 'over') { startGame(); return; }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (S.mode === 'play') { S.mode = 'pause'; S.audio.stopAll(); }
    else if (S.mode === 'pause') { S.mode = 'play'; }
    return;
  }
  if (e.code === 'KeyM') {
    S.audio.setMuted(!S.audio.muted);
    return;
  }
  if ((e.code === 'KeyF' || e.code === 'Space') && S.mode === 'play') S.player.tryPunch(S);
  if (e.code === 'KeyE' && S.mode === 'play') enterExitCar();
}
function onKeyUp(e) { S.keys.delete(e.code); }

function resize() {
  S.vw = window.innerWidth;
  S.vh = window.innerHeight;
  S.canvas.width = S.vw;
  S.canvas.height = S.vh;
}

function boot() {
  S.canvas = document.getElementById('game');
  S.ctx = S.canvas.getContext('2d');
  S.load();
  resetRun();
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('pointerdown', () => S.audio.ensure());
  const status = document.getElementById('status');
  if (status) status.textContent = 'Teluk Cerah: tekan Enter untuk mulai bermain.';
  requestAnimationFrame(loop);
  // Staging hooks for scripted screenshots (also reachable by hand in devtools).
  window.__tc = {
    S,
    start: startGame,
    stage: stageShot,
    state: () => ({
      mode: S.mode,
      cash: S.cash,
      hp: S.player.hp,
      wanted: S.police.wanted,
      cops: S.police.cops.length,
      mission: S.missions.current ? S.missions.current.title : 'none',
      stage: S.missions.stage,
      objective: S.missions.objectiveText(),
      inCar: !!S.player.inCar,
      x: Math.round(S.player.x),
      y: Math.round(S.player.y),
    }),
    ready: true,
  };
  // URL staging: ?shot=chase|drive|steal|combat
  const shot = params.get('shot');
  if (shot) setTimeout(() => { startGame(); stageShot(shot); }, 400);
}

// --- Scripted staging for screenshots ---
function stageShot(name) {
  const p = S.player;
  if (name === 'chase') {
    // Cover: police chase with wanted stars, minimap and mission objective.
    const car = new Car(1800, 1125, 0, '#d94f3d', { parked: false });
    car.speed = 240;
    S.parkedCars.push(car);
    p.inCar = car;
    p.x = car.x; p.y = car.y;
    S.cash = 150;
    S.police.addWanted(3, 'Polisi mengejarmu!');
    S.police.cops.push(new Car(1800 - 190, 1125 - 60, 0, '#f2f2f2', { police: true, maxSpeed: 430 }));
    S.police.cops.push(new Car(1800 - 260, 1125 + 60, 0, '#f2f2f2', { police: true, maxSpeed: 430 }));
    for (const c of S.police.cops) { c.speed = 260; c.angle = 0; }
    S.missions.stage = 'toDeliver';
    S.setBanner('Misi 1 — Paket Kilat', 'Antar paket ke Dermaga Teluk.', 600);
  } else if (name === 'drive') {
    const car = new Car(1575, 675, 0, '#3d7bd9', { parked: false });
    car.speed = 300;
    S.parkedCars.push(car);
    p.inCar = car;
    p.x = car.x; p.y = car.y;
    S.cash = 150;
    // Traffic nearby on the same road.
    for (let i = 0; i < 4; i++) {
      const t = S.traffic.cars[i];
      t.x = 1575 - 260 + i * 170;
      t.y = 675 + (i % 2 === 0 ? -14 : 14);
      t.angle = 0; t.horizontal = true; t.speed = t.cruise;
    }
    S.setBanner('Misi 2 — Tarik Mobil', 'Curi mobil emas di Parkir Mall.', 600);
  } else if (name === 'steal') {
    // On foot next to the gold mission car at the mall parking lot.
    S.missions.startMission(1);
    p.x = PLACES.parking.x - 60;
    p.y = PLACES.parking.y + 40;
    p.angle = 0;
    S.cash = 150;
  } else if (name === 'combat') {
    // On foot, punching, with pedestrians and a foot officer close by.
    // Staged on the open road junction east of the plaza (not on the fountain).
    p.x = 2025;
    p.y = 1575;
    p.angle = -0.4;
    p.punchT = 0.22;
    p.punchCooldown = 0.4;
    S.police.addWanted(1, 'Keributan di Alun-Alun!');
    const peds = S.traffic.peds;
    peds[0].x = p.x + 34; peds[0].y = p.y - 8; peds[0].down = 0;
    peds[1].x = p.x + 60; peds[1].y = p.y + 34; peds[1].flee = 2;
    S.police.footCops.push({ x: p.x + 90, y: p.y - 40, angle: Math.PI, hp: 50, walkPhase: 1, punchT: 0 });
    S.setBanner('Misi 1 — Paket Kilat', 'Ambil paket di Pasar Pagi.', 600);
  }
  S.cam.x = Math.max(0, Math.min(WORLD_W - S.vw, (p.inCar ? p.inCar.x : p.x) - S.vw / 2));
  S.cam.y = Math.max(0, Math.min(WORLD_H - S.vh, (p.inCar ? p.inCar.y : p.y) - S.vh / 2));
}

boot();
