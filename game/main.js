// Teluk Cerah — entry point.
//
// Builds the shared game state, runs the loop, reads the keyboard, moves
// the camera, and wires the systems together. It also owns the two things
// the other modules do not: the save file (localStorage) and the staging
// API the screenshots use (?shot=chase|drive|steal|combat, ?seed=N).
//
// The game is plain ES modules loaded by game/index.html; nothing here
// needs the network.

import { buildCity, mulberry32, WORLD, PLACES } from './city.js';
import { createAudio, ensureAudio, sfx, updateAudio, setMuted } from './audio.js';
import { createPlayer, updatePlayer, drawPlayer } from './player.js';
import { initTraffic, updateTraffic, drawTraffic } from './traffic.js';
import { updatePolice, drawPolice } from './police.js';
import { startMission, updateMissions } from './missions.js';
import { drawCity } from './city.js';
import { drawHUD } from './hud.js';
import { makeCar } from './vehicles.js';

const SAVE_KEY = 'telukcerah-save-v1';

function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeSave(G) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: G.player.cash,
      health: G.player.health,
      missionIdx: G.missionIdx,
      missionStage: G.missionStage,
      x: G.player.x,
      y: G.player.y,
      wanted: G.player.wanted,
    }));
    G.hasSave = true;
  } catch (e) {
    /* storage unavailable: the game still plays */
  }
}

function buildState(seed) {
  const rng = mulberry32(seed);
  const G = {
    mode: 'menu',
    overReason: '',
    time: 0,
    seed,
    rng,
    keys: Object.create(null),
    pressed: new Set(),
    cam: { x: 0, y: 0 },
    vw: 1280,
    vh: 720,
    city: null,
    player: null,
    cars: [],
    peds: [],
    goldCar: null,
    missionIdx: 0,
    missionStage: 'pickup',
    missionTarget: null,
    objective: 'Tekan Enter untuk main',
    banner: { title: '', sub: '', t: 0 },
    // A short-lived message under the banner (a ram, a near miss) that
    // never replaces the mission banner.
    toast: { title: '', sub: '', t: 0 },
    audio: createAudio(),
    stats: { stolen: 0, knocked: 0 },
    quietT: 0,
    prevWanted: 0,
    spawnT: 0,
    hasSave: !!readSave(),
    shot: null,
  };
  G.city = buildCity();
  G.player = createPlayer(700, 760);
  initTraffic(G);
  startMission(G, 0);
  // Arrow closes over this state object, so re-bind it after any reset.
  G.saveGame = () => writeSave(G);
  return G;
}

function resetWorld(G) {
  const keepSeed = G.seed;
  const fresh = buildState(keepSeed);
  // Keep the same object identity so the loop and the test hook keep working.
  for (const key of Object.keys(fresh)) {
    if (key === 'audio' || key === 'keys' || key === 'pressed') continue;
    G[key] = fresh[key];
  }
  G.saveGame = () => writeSave(G);
  G.mode = 'play';
  G.banner = { title: 'Teluk Cerah', sub: 'Selamat datang, Rani. Dimas menunggumu.', t: 3 };
}

function restoreMission(G, idx, stage) {
  startMission(G, idx);
  if (idx === 0 && stage === 'deliver') {
    G.missionStage = 'deliver';
    G.missionTarget = { x: PLACES.dermaga.x, y: PLACES.dermaga.y, r: PLACES.dermaga.r, label: 'Dermaga Teluk' };
    G.objective = 'Antar paket ke Dermaga Teluk';
  } else if (idx === 1 && stage === 'deliver') {
    G.missionStage = 'deliver';
    G.missionTarget = { x: PLACES.bengkel.x, y: PLACES.bengkel.y, r: PLACES.bengkel.r, label: 'Bengkel Roda' };
    G.objective = 'Bawa mobil emas ke Bengkel Roda';
  }
}

function loadGame(G) {
  const s = readSave();
  if (!s) return false;
  G.player.cash = s.cash || 0;
  G.player.health = s.health || 100;
  G.player.x = s.x || 700;
  G.player.y = s.y || 760;
  G.player.wanted = 0;
  restoreMission(G, s.missionIdx || 0, s.missionStage || 'pickup');
  if (typeof s.wanted === 'number') G.player.wanted = Math.min(3, s.wanted);
  G.mode = 'play';
  return true;
}

// --- Staging --------------------------------------------------------------
// ?shot= puts the game straight into a scene for screenshots, with a fixed
// seed so the shot is reproducible. The player never sees the menu.

function putPlayerInCar(G, car) {
  const p = G.player;
  p.onFoot = false;
  p.car = car;
  car.driven = true;
  car.speed = 260;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
}

function addCopNear(G, x, y, angle) {
  const cop = makeCar(x, y, angle, '#e8e8e8', 'cop');
  cop.speed = 320;
  G.cars.push(cop);
  return cop;
}

function stageShot(G, name) {
  const p = G.player;
  G.mode = 'play';
  if (name === 'chase') {
    const car = G.cars.find((c) => c.kind === 'traffic');
    car.x = 1500;
    car.y = 1100;
    car.axis = 'h';
    car.dir = 1;
    car.road = 1100;
    car.lane = 17;
    car.angle = 0;
    putPlayerInCar(G, car);
    p.wanted = 3;
    addCopNear(G, 1250, 1100, 0);
    addCopNear(G, 1180, 1134, 0);
    addCopNear(G, 1330, 1066, 0);
    startMission(G, 0);
    G.banner = { title: 'Misi 1 — Paket Kilat', sub: 'Antar paket ke Dermaga Teluk.', t: 30 };
    // The staged driver floors it, so the chase is moving, not parked.
    G.keys['w'] = true;
  } else if (name === 'drive') {
    const car = G.cars.find((c) => c.kind === 'traffic');
    car.x = 1800;
    car.y = 900;
    car.axis = 'v';
    car.dir = 1;
    car.road = 1800;
    car.lane = 17;
    car.angle = Math.PI / 2;
    putPlayerInCar(G, car);
    p.wanted = 0;
    startMission(G, 0);
    G.banner = { title: 'Misi 1 — Paket Kilat', sub: 'Antar paket ke Dermaga Teluk.', t: 30 };
    G.keys['w'] = true;
  } else if (name === 'steal') {
    p.x = 2660;
    p.y = 950;
    p.angle = -Math.PI / 2;
    p.onFoot = true;
    p.car = null;
    p.wanted = 0;
    startMission(G, 1);
    G.banner = { title: 'Misi 2 — Tarik Mobil', sub: 'Curi mobil emas di Parkir Mall.', t: 30 };
  } else if (name === 'combat') {
    // An open stretch of road, away from place labels, so Rani and the
    // punch are the focus of the frame.
    p.x = 1250;
    p.y = 1150;
    p.angle = 0;
    p.onFoot = true;
    p.car = null;
    p.wanted = 1;
    p.punchT = 0.22;
    for (let i = 0; i < 3; i += 1) {
      G.peds.push({
        x: 1300 + i * 46,
        y: 1130 + (i % 2) * 50,
        angle: Math.PI,
        speed: 50,
        color: ['#c96f4a', '#4a90c9', '#7d5a9e'][i],
        down: i === 2 ? 4 : 0,
        wanderT: 3,
        fleeT: 0,
      });
    }
    startMission(G, 0);
    G.banner = { title: 'Misi 1 — Paket Kilat', sub: 'Antar paket ke Dermaga Teluk.', t: 30 };
  }
  G.cam.x = Math.max(0, Math.min(WORLD.w - G.vw, p.x - G.vw / 2));
  G.cam.y = Math.max(0, Math.min(WORLD.h - G.vh, p.y - G.vh / 2));
}

// --- Boot -----------------------------------------------------------------

const params = new URLSearchParams(window.location.search);
const seedParam = Number.parseInt(params.get('seed') || '', 10);
const seed = Number.isSafeInteger(seedParam) ? seedParam : (Math.random() * 1e9) | 0;
const G = buildState(seed);
const shot = params.get('shot');
if (shot) {
  G.shot = shot;
  stageShot(G, shot);
}

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault();
  if (!e.repeat) G.pressed.add(key);
  G.keys[key] = true;
  ensureAudio(G.audio);
  if (key === 'enter' && G.mode === 'menu') {
    resetWorld(G);
    sfx(G.audio, 'click');
  } else if (key === 'l' && G.mode === 'menu') {
    if (loadGame(G)) sfx(G.audio, 'click');
  } else if (key === 'p' && (G.mode === 'play' || G.mode === 'paused')) {
    G.mode = G.mode === 'play' ? 'paused' : 'play';
    sfx(G.audio, 'click');
  } else if (key === 'm') {
    setMuted(G.audio, !G.audio.muted);
  } else if (key === 'r' && G.mode === 'over') {
    resetWorld(G);
    sfx(G.audio, 'click');
  }
});
window.addEventListener('keyup', (e) => {
  G.keys[e.key.toLowerCase()] = false;
});
canvas.addEventListener('pointerdown', () => ensureAudio(G.audio));

// Test hook for scripted playthroughs: window.__tc
window.__tc = {
  G,
  state() {
    const p = G.player;
    return {
      mode: G.mode,
      missionIdx: G.missionIdx,
      missionStage: G.missionStage,
      cash: p.cash,
      wanted: p.wanted,
      health: Math.round(p.health),
      x: Math.round(p.x),
      y: Math.round(p.y),
      onFoot: p.onFoot,
      inCar: !p.onFoot,
      cops: G.cars.filter((c) => c.kind === 'cop').length,
      pedsDown: G.peds.filter((d) => d.down > 0).length,
      objective: G.objective,
    };
  },
};

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += dt;
  if (G.banner) G.banner.t = Math.max(0, G.banner.t - dt);
  if (G.toast) G.toast.t = Math.max(0, G.toast.t - dt);

  if (G.mode === 'play') {
    updateMissions(G, dt);
    updatePlayer(G, dt);
    updateTraffic(G, dt);
    updatePolice(G, dt);
    const speed = G.player.onFoot ? 0 : Math.abs(G.player.car ? G.player.car.speed : 0);
    updateAudio(G.audio, speed, !G.player.onFoot, G.player.wanted, dt);
    // Camera follows the player, clamped to the city.
    const tx = Math.max(0, Math.min(WORLD.w - G.vw, G.player.x - G.vw / 2));
    const ty = Math.max(0, Math.min(WORLD.h - G.vh, G.player.y - G.vh / 2));
    const k = Math.min(1, dt * 5);
    G.cam.x += (tx - G.cam.x) * k;
    G.cam.y += (ty - G.cam.y) * k;
  }

  ctx.clearRect(0, 0, G.vw, G.vh);
  ctx.save();
  ctx.translate(-Math.round(G.cam.x), -Math.round(G.cam.y));
  drawCity(ctx, G);
  drawTraffic(ctx, G);
  drawPolice(ctx, G);
  drawPlayer(ctx, G);
  ctx.restore();
  drawHUD(ctx, G);

  G.pressed.clear();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
