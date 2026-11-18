// Teluk Cerah — Rani, the player.
//
// On foot she walks the streets, punches with F, and slips into cars with E.
// In a car she drives it. Stealing a parked or traffic car is a crime, so
// it raises the wanted level the first time per car. Health creeps back
// while the police are not after her.

import { drawPerson } from './assets.js';
import { solidAt } from './city.js';
import { driveCar } from './vehicles.js';
import { sfx } from './audio.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: -Math.PI / 2,
    onFoot: true,
    car: null,
    health: 100,
    cash: 0,
    wanted: 0,
    punchT: 0,
    punchCd: 0,
    walkPhase: 0,
    crimeCd: 0,
  };
}

function raiseWanted(G, n) {
  const p = G.player;
  const before = p.wanted;
  p.wanted = Math.min(5, p.wanted + n);
  if (before === 0 && p.wanted > 0) {
    G.banner = { title: 'POLISI MENGEJARMU', sub: 'Tingkat buronan naik — kabur dari kejaran!', t: 2.5 };
  }
}

export function commitCrime(G, n) {
  const p = G.player;
  if (p.crimeCd > 0) return;
  p.crimeCd = 2;
  raiseWanted(G, n);
}

function nearestCar(G, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (car.kind === 'cop' || car.driven) continue;
    const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function updatePlayer(G, dt) {
  const p = G.player;
  p.punchT = Math.max(0, p.punchT - dt);
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.crimeCd = Math.max(0, p.crimeCd - dt);
  if (p.wanted === 0 && p.health < 100) p.health = Math.min(100, p.health + 2 * dt);

  const k = G.keys;
  if (p.onFoot) {
    let mx = 0;
    let my = 0;
    if (k['a'] || k['arrowleft']) mx -= 1;
    if (k['d'] || k['arrowright']) mx += 1;
    if (k['w'] || k['arrowup']) my -= 1;
    if (k['s'] || k['arrowdown']) my += 1;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
      const target = Math.atan2(my, mx);
      let diff = target - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.angle += diff * Math.min(1, dt * 14);
      const spd = 178;
      const nx = p.x + mx * spd * dt;
      const ny = p.y + my * spd * dt;
      if (!solidAt(G.city, nx, p.y, 12)) p.x = nx;
      if (!solidAt(G.city, p.x, ny, 12)) p.y = ny;
      p.walkPhase += dt * 11;
    }
    // Punch: a short forward swipe that floors pedestrians.
    if (G.pressed.has('f') && p.punchCd <= 0) {
      p.punchT = 0.28;
      p.punchCd = 0.55;
      sfx(G.audio, 'punch');
      let hit = false;
      for (const ped of G.peds) {
        if (ped.down > 0) continue;
        const d = Math.hypot(ped.x - p.x, ped.y - p.y);
        if (d > 62) continue;
        const ang = Math.atan2(ped.y - p.y, ped.x - p.x);
        let diff = ang - p.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) < 1.2) {
          ped.down = 4;
          ped.angle = ang;
          hit = true;
        }
      }
      if (hit) {
        commitCrime(G, 1);
        G.stats.knocked += 1;
      }
    }
    // Enter a nearby car (E). Mission pickups are handled by missions.js
    // before this runs, so E here only ever means "get in the car".
    if (G.pressed.has('e')) {
      const car = nearestCar(G, 72);
      if (car) {
        p.onFoot = false;
        p.car = car;
        car.driven = true;
        car.speed = 0;
        if (!car.stolenFlag && (car.kind === 'parked' || car.kind === 'traffic' || car.kind === 'gold')) {
          car.stolenFlag = true;
          commitCrime(G, 1);
          G.stats.stolen += 1;
          sfx(G.audio, 'steal');
          G.banner = { title: 'Mobil dicuri!', sub: 'Polisi sudah diberi tahu — hati-hati.', t: 2 };
        }
      }
    }
    return;
  }

  // Driving the player's car.
  const car = p.car;
  let throttle = 0;
  if (k['w'] || k['arrowup']) throttle += 1;
  if (k['s'] || k['arrowdown']) throttle -= 1;
  let steer = 0;
  if (k['a'] || k['arrowleft']) steer -= 1;
  if (k['d'] || k['arrowright']) steer += 1;
  const bumped = driveCar(G, car, dt, throttle, steer);
  if (bumped && Math.abs(car.speed) > 200) sfx(G.audio, 'crash');
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;

  if (G.pressed.has('e')) {
    // Step out on the car's left side.
    const side = car.angle - Math.PI / 2;
    const ox = car.x + Math.cos(side) * 34;
    const oy = car.y + Math.sin(side) * 34;
    if (!solidAt(G.city, ox, oy, 12)) {
      p.x = ox;
      p.y = oy;
    }
    p.onFoot = true;
    p.car = null;
    car.driven = false;
    car.speed *= 0.3;
  }
}

export function drawPlayer(ctx, G) {
  const p = G.player;
  if (!p.onFoot) return;
  const bob = Math.sin(p.walkPhase) * 1.5;
  drawPerson(ctx, p.x, p.y + bob, p.angle, '#3f6fb5', false);
  if (p.punchT > 0) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 42, -0.7, 0.7);
    ctx.stroke();
    ctx.restore();
  }
}
