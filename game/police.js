// Teluk Cerah — the police.
//
// Wanted stars call in cop cars: up to one per star, four at most. A cop
// steers straight at the player, rams their car, and arrests them on foot
// if it catches them standing still. Stay quiet and out of sight for a
// while and the heat cools off, one star at a time.

import { WORLD, nearestRoad, solidAt } from './city.js';
import { makeCar, drawCar } from './vehicles.js';
import { sfx } from './audio.js';

function copCount(G) {
  let n = 0;
  for (const c of G.cars) if (c.kind === 'cop') n += 1;
  return n;
}

function spawnCop(G) {
  const rng = G.rng;
  const p = G.player;
  const axis = rng() < 0.5 ? 'v' : 'h';
  const road = nearestRoad(axis, axis === 'v' ? p.x + (rng() - 0.5) * 1200 : p.y + (rng() - 0.5) * 1200);
  const dist = 680 + rng() * 260;
  const side = rng() < 0.5 ? -1 : 1;
  let x;
  let y;
  if (axis === 'v') {
    x = road + (rng() < 0.5 ? -17 : 17);
    y = Math.max(80, Math.min(WORLD.h - 80, p.y + side * dist));
  } else {
    x = Math.max(380, Math.min(WORLD.w - 80, p.x + side * dist));
    y = road + (rng() < 0.5 ? -17 : 17);
  }
  const cop = makeCar(x, y, 0, '#e8e8e8', 'cop');
  cop.cruise = 560;
  G.cars.push(cop);
}

export function updatePolice(G, dt) {
  const p = G.player;
  const want = Math.min(p.wanted, 4);
  const have = copCount(G);

  // Wanted went up: the heat is fresh, no cooling off yet.
  if (p.wanted > (G.prevWanted || 0)) G.quietT = 0;
  G.prevWanted = p.wanted;

  if (want > have) {
    G.spawnT = (G.spawnT || 0) - dt;
    if (G.spawnT <= 0) {
      spawnCop(G);
      G.spawnT = 1.2;
    }
  }
  if (want < have) {
    // Extra cops give up and leave when they are far away.
    let removed = false;
    G.cars = G.cars.filter((c) => {
      if (c.kind === 'cop' && !removed && Math.hypot(c.x - p.x, c.y - p.y) > 600) {
        removed = true;
        return false;
      }
      return true;
    });
  }

  if (want === 0) {
    // No heat left: every cop stands down, drives off and leaves the map.
    for (let i = G.cars.length - 1; i >= 0; i -= 1) {
      const cop = G.cars[i];
      if (cop.kind !== 'cop') continue;
      cop.speed = Math.min(cop.speed + 240 * dt, 320);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      if (Math.hypot(cop.x - p.x, cop.y - p.y) > 800) G.cars.splice(i, 1);
    }
    return;
  }

  // Cooling off: quiet and unseen for a while drops a star.
  let nearCop = false;
  for (const c of G.cars) {
    if (c.kind === 'cop' && Math.hypot(c.x - p.x, c.y - p.y) < 450) nearCop = true;
  }
  if (p.wanted > 0 && !nearCop) {
    G.quietT = (G.quietT || 0) + dt;
    if (G.quietT > 20) {
      p.wanted -= 1;
      G.quietT = 10;
    }
  } else {
    G.quietT = 0;
  }

  for (const cop of G.cars) {
    if (cop.kind !== 'cop') continue;
    cop.hitCd = Math.max(0, cop.hitCd - dt);
    // Steer toward the player.
    const wantAngle = Math.atan2(p.y - cop.y, p.x - cop.x);
    let diff = wantAngle - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const dist = Math.hypot(p.x - cop.x, p.y - cop.y);
    const throttle = dist > 60 ? 1 : 0.3;
    cop.speed += 470 * throttle * dt;
    cop.speed -= cop.speed * 0.25 * dt;
    if (cop.speed > 565) cop.speed = 565;
    // Move axis-separated so cops slide along walls instead of sticking.
    const dx = Math.cos(cop.angle) * cop.speed * dt;
    const dy = Math.sin(cop.angle) * cop.speed * dt;
    if (!solidAt(G.city, cop.x + dx, cop.y, 20)) cop.x += dx;
    else cop.speed *= 0.5;
    if (!solidAt(G.city, cop.x, cop.y + dy, 20)) cop.y += dy;
    else cop.speed *= 0.5;
    // Ramming the player's car hurts the player.
    if (!p.onFoot && p.car && dist < 48 && cop.hitCd <= 0) {
      cop.hitCd = 0.8;
      p.health = Math.max(0, p.health - 7);
      p.car.speed *= 0.55;
      sfx(G.audio, 'crash');
      G.toast = { title: 'Ditabrak polisi!', sub: 'Nyawa berkurang — kabur!', t: 1.5 };
    }
    // Caught on foot: arrested.
    if (p.onFoot && dist < 42 && cop.speed < 90) {
      G.mode = 'over';
      G.overReason = 'Tertangkap polisi!';
      sfx(G.audio, 'arrest');
      return;
    }
    if (p.health <= 0) {
      G.mode = 'over';
      G.overReason = 'Rani tidak sanggup lagi — polisi menangkapnya.';
      sfx(G.audio, 'arrest');
      return;
    }
  }
}

export function drawPolice(ctx, G) {
  for (const car of G.cars) {
    if (car.kind === 'cop') drawCar(ctx, car, G.time);
  }
}
