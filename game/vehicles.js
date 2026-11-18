// Teluk Cerah — cars.
//
// A car is a small top-down body with simple arcade physics: throttle,
// brake/reverse, steering that bites harder the faster you go, and
// axis-separated movement so cars slide along walls instead of sticking.
// Kinds: 'traffic' (drives the roads), 'parked', 'cop' and 'gold'
// (the mission target car). Drawing lives here too.

import { PALETTE, rr } from './assets.js';
import { solidAt } from './city.js';

const CAR_COLORS = ['#c94f4f', '#4f7ec9', '#e8e4da', '#5a6b7d', '#c98a4a', '#7d5a9e', '#4a9e7d'];

export function randomCarColor(rng) {
  return CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
}

export function makeCar(x, y, angle, color, kind) {
  return {
    x,
    y,
    angle,
    speed: 0,
    color,
    kind,
    w: 48,
    h: 26,
    // traffic AI state
    axis: 'v',
    dir: 1,
    lane: 0,
    road: 0,
    // police / ramming state
    hitCd: 0,
    flash: 0,
  };
}

// Arcade drive: throttle -1..1, steer -1..1. Returns true if the car bumped
// into something solid this step.
export function driveCar(G, car, dt, throttle, steer) {
  const MAX_FWD = 540;
  const MAX_REV = -150;
  if (throttle > 0) {
    car.speed += 430 * throttle * dt;
  } else if (throttle < 0) {
    if (car.speed > 8) car.speed -= 640 * dt; // brake
    else car.speed -= 260 * dt; // reverse
  } else {
    car.speed -= car.speed * 0.9 * dt; // coast
  }
  car.speed -= car.speed * 0.12 * dt; // rolling drag
  if (car.speed > MAX_FWD) car.speed = MAX_FWD;
  if (car.speed < MAX_REV) car.speed = MAX_REV;
  if (Math.abs(car.speed) < 2 && throttle === 0) car.speed = 0;

  const grip = Math.min(1, Math.abs(car.speed) / 180);
  car.angle += steer * 2.1 * grip * dt * (car.speed < 0 ? -1 : 1);

  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  let bumped = false;
  if (!solidAt(G.city, car.x + dx, car.y, 20)) {
    car.x += dx;
  } else {
    car.speed *= 0.45;
    bumped = true;
  }
  if (!solidAt(G.city, car.x, car.y + dy, 20)) {
    car.y += dy;
  } else {
    car.speed *= 0.45;
    bumped = true;
  }
  return bumped;
}

// Top-down car: shadow, body, cabin, windows, wheels and lights.
// Police cars get a light bar that flashes with time.
export function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  rr(ctx, -23, -11, 48, 26, 8);
  ctx.fill();
  ctx.fillStyle = car.color;
  rr(ctx, -24, -13, 48, 26, 8);
  ctx.fill();
  // cabin + windows
  ctx.fillStyle = 'rgba(30,40,55,0.85)';
  rr(ctx, -8, -10, 18, 20, 4);
  ctx.fill();
  ctx.fillStyle = '#9fc4de';
  ctx.fillRect(7, -9, 3, 18);
  ctx.fillRect(-11, -9, 3, 18);
  // wheels
  ctx.fillStyle = '#1c1e22';
  ctx.fillRect(-18, -14, 10, 5);
  ctx.fillRect(-18, 9, 10, 5);
  ctx.fillRect(10, -14, 10, 5);
  ctx.fillRect(10, 9, 10, 5);
  // headlights / taillights
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(23, -9, 2, 4);
  ctx.fillRect(23, 5, 2, 4);
  ctx.fillStyle = '#e33';
  ctx.fillRect(-25, -9, 2, 4);
  ctx.fillRect(-25, 5, 2, 4);
  if (car.kind === 'cop') {
    // white doors stripe and a flashing light bar
    ctx.fillStyle = '#f2f2ee';
    ctx.fillRect(-6, -13, 12, 26);
    const on = Math.floor(time * 2.4) % 2 === 0;
    ctx.fillStyle = on ? '#ff2e2e' : '#2e5cff';
    rr(ctx, -4, -13, 8, 7, 2);
    ctx.fill();
    ctx.fillStyle = on ? '#2e5cff' : '#ff2e2e';
    rr(ctx, -4, 6, 8, 7, 2);
    ctx.fill();
  }
  if (car.kind === 'gold') {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    rr(ctx, -20, -10, 40, 6, 3);
    ctx.fill();
  }
  ctx.restore();
}

// The palette's gold, used for the mission car.
export function goldColor() {
  return PALETTE.gold;
}
