// vehicles.js — drivable cars: parked cars to steal, the mission target car,
// and the cars the player drives. Arcade handling, no physics engine.

import { drawCar } from './assets.js';
import { mulberry32, pick } from './assets.js';

const COLORS = ['#d94f3d', '#3d7bd9', '#e8b93b', '#57a773', '#8a5fc0', '#e8e8e8', '#3a3f4a', '#e07b39'];
const NPC_COLORS = ['#c9a227', '#5b8c5a', '#7a6a9a', '#b0b8c4', '#d97b8f'];

export class Car {
  constructor(x, y, angle, color, opts = {}) {
    this.x = x; this.y = y;
    this.angle = angle;
    this.color = color;
    this.speed = 0;
    this.maxSpeed = opts.maxSpeed ?? 400;
    this.maxReverse = 150;
    this.accel = 330;
    this.parked = opts.parked ?? false;
    this.npc = opts.npc ?? false; // an NPC is driving it
    this.police = opts.police ?? false;
    this.target = opts.target ?? false; // mission target marker
    this.driver = opts.driver ?? null; // pedestrian who owns it
    this.id = Car.nextId++;
    this.flash = 0;
  }

  // Arcade drive: W/S throttle, A/D steer. Returns true while moving.
  drive(dt, input, S) {
    const fwd = (input.has('KeyW') || input.has('ArrowUp')) ? 1 : 0;
    const back = (input.has('KeyS') || input.has('ArrowDown')) ? 1 : 0;
    const left = (input.has('KeyA') || input.has('ArrowLeft')) ? 1 : 0;
    const right = (input.has('KeyD') || input.has('ArrowRight')) ? 1 : 0;
    if (fwd) this.speed += this.accel * dt;
    else if (back) this.speed -= this.accel * 0.9 * dt;
    else this.speed *= Math.pow(0.25, dt); // coast
    this.speed = Math.max(-this.maxReverse, Math.min(this.maxSpeed, this.speed));
    const steer = (left ? -1 : 0) + (right ? 1 : 0);
    if (Math.abs(this.speed) > 8) {
      this.angle += steer * 2.4 * dt * (this.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(this.speed) / 120);
    }
    const nx = this.x + Math.cos(this.angle) * this.speed * dt;
    const ny = this.y + Math.sin(this.angle) * this.speed * dt;
    const before = { x: this.x, y: this.y };
    this.x = nx; this.y = ny;
    if (S.city.solidAt(this.x, this.y)) {
      // Hit a wall: stop and bounce a little.
      this.x = before.x; this.y = before.y;
      if (Math.abs(this.speed) > 140) {
        S.audio.crash();
        if (S.player.inCar === this) S.player.damage(6, S);
      }
      this.speed *= -0.25;
    }
    this.flash += dt * 6;
    return Math.abs(this.speed) > 5;
  }

  draw(ctx) {
    drawCar(ctx, this.x, this.y, this.angle, this.color, {
      police: this.police,
      flash: Math.floor(this.flash),
      target: this.target,
      length: this.police ? 48 : 46,
    });
  }
}
Car.nextId = 1;

// Parked cars along road edges for the player to steal.
export function spawnParkedCars(city, count = 16) {
  const rng = mulberry32(777);
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard++ < 400) {
    const p = city.roadPoint(rng);
    const off = (rng() < 0.5 ? -1 : 1) * (46 / 2 + 8);
    const x = p.horizontal ? p.x : p.x + off;
    const y = p.horizontal ? p.y + off : p.y;
    if (city.solidAt(x, y)) continue;
    if (cars.some((c) => Math.hypot(c.x - x, c.y - y) < 120)) continue;
    cars.push(new Car(x, y, p.horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2), pick(rng, COLORS), { parked: true }));
  }
  return cars;
}

export function randomCarColor(rng) { return pick(rng, NPC_COLORS); }
