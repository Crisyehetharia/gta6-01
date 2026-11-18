// traffic.js — ambient life: traffic cars driving the road grid and
// pedestrians strolling the sidewalks. Pedestrians react to crime.

import { drawCar, drawPerson, mulberry32, pick } from './assets.js';
import { Car, randomCarColor } from './vehicles.js';
import { randomShirt } from './player.js';

const NAMES = ['Budi', 'Sari', 'Agus', 'Dewi', 'Rizky', 'Maya', 'Joko', 'Lina', 'Andi', 'Tari'];

export class Ped {
  constructor(x, y, rng) {
    this.x = x; this.y = y;
    this.angle = rng() * Math.PI * 2;
    this.speed = 42 + rng() * 26;
    this.shirt = randomShirt(rng);
    this.name = pick(rng, NAMES);
    this.hp = 30;
    this.down = 0; // seconds lying on the ground after being hit
    this.flee = 0; // seconds running away
    this.walkPhase = rng() * 6;
    this.retarget = 0;
    this.tx = x; this.ty = y;
  }

  update(dt, S) {
    if (this.down > 0) {
      this.down -= dt;
      return;
    }
    this.retarget -= dt;
    if (this.flee > 0) {
      this.flee -= dt;
      const p = S.player;
      const dx = this.x - p.x, dy = this.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      this.angle = Math.atan2(dy, dx);
      this.x += (dx / d) * 150 * dt;
      this.y += (dy / d) * 150 * dt;
      S.city.resolveCircle(this, 12);
      this.walkPhase += dt * 16;
      return;
    }
    if (this.retarget <= 0) {
      const r = S.city.nearestRoad(this.x, this.y);
      const along = (Math.random() - 0.5) * 700;
      if (r.horizontal) { this.tx = this.x + along; this.ty = r.y + (Math.random() < 0.5 ? -58 : 58); }
      else { this.tx = r.x + (Math.random() < 0.5 ? -58 : 58); this.ty = this.y + along; }
      this.retarget = 2 + Math.random() * 4;
    }
    const dx = this.tx - this.x, dy = this.ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d > 12) {
      this.angle = Math.atan2(dy, dx);
      this.x += (dx / d) * this.speed * dt;
      this.y += (dy / d) * this.speed * dt;
      this.walkPhase += dt * 8;
    }
    S.city.resolveCircle(this, 12);
  }

  hit(S, fromCar) {
    if (this.down > 0) return;
    this.hp -= 20;
    this.down = 2.5;
    if (this.hp <= 0) this.down = 6;
    S.police.addWanted(1, 'Pedestrian tertabrak!');
    if (!fromCar) S.audio.punch();
  }

  draw(ctx) {
    drawPerson(ctx, this.x, this.y, this.angle, this.shirt, {
      walkPhase: this.walkPhase,
      down: this.down > 0,
    });
  }
}

export class Traffic {
  constructor(city) {
    this.city = city;
    this.cars = [];
    this.peds = [];
    const rng = mulberry32(4242);
    for (let i = 0; i < 14; i++) this.cars.push(this._spawnCar(rng));
    for (let i = 0; i < 22; i++) {
      const p = city.roadPoint(rng);
      const off = (rng() < 0.5 ? -1 : 1) * 58;
      this.peds.push(new Ped(
        p.horizontal ? p.x : p.x + off,
        p.horizontal ? p.y + off : p.y,
        rng,
      ));
    }
  }

  _spawnCar(rng) {
    const p = this.city.roadPoint(rng);
    const car = new Car(p.x, p.y, p.horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2), randomCarColor(rng), { npc: true });
    car.cruise = 110 + rng() * 60;
    car.speed = car.cruise;
    car.horizontal = p.horizontal;
    return car;
  }

  update(dt, S) {
    // Traffic cars cruise along roads and turn at intersections.
    for (const c of this.cars) {
      const step = c.speed * dt;
      c.x += Math.cos(c.angle) * step;
      c.y += Math.sin(c.angle) * step;
      const r = this.city.nearestRoad(c.x, c.y);
      const onRoad = Math.abs(c.x - r.x) < 4 || Math.abs(c.y - r.y) < 4;
      // Snap back onto the lane centre if drifting.
      if (c.horizontal && Math.abs(c.y - r.y) > 40) c.y += Math.sign(r.y - c.y) * step * 0.5;
      if (!c.horizontal && Math.abs(c.x - r.x) > 40) c.x += Math.sign(r.x - c.x) * step * 0.5;
      // At an intersection, sometimes turn.
      if (onRoad && Math.random() < dt * 0.12) {
        if (c.horizontal && Math.random() < 0.5) {
          c.horizontal = false;
          c.angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
          c.x = r.x;
        } else if (!c.horizontal && Math.random() < 0.5) {
          c.horizontal = true;
          c.angle = Math.random() < 0.5 ? 0 : Math.PI;
          c.y = r.y;
        }
      }
      // Wrap around the world edges.
      if (c.x < -60) c.x = 3660; if (c.x > 3660) c.x = -60;
      if (c.y < -60) c.y = 2280; if (c.y > 2280) c.y = -60;
      // Slow down if the player car is right ahead.
      const p = S.player.inCar;
      if (p) {
        const d = Math.hypot(p.x - c.x, p.y - c.y);
        if (d < 70) c.speed = Math.max(30, c.cruise * 0.3);
        else c.speed = c.cruise;
      }
    }
    for (const ped of this.peds) ped.update(dt, S);
    // Player car hitting pedestrians.
    const car = S.player.inCar;
    if (car && Math.abs(car.speed) > 60) {
      for (const ped of this.peds) {
        if (ped.down <= 0 && Math.hypot(ped.x - car.x, ped.y - car.y) < 30) {
          ped.hit(S, true);
          car.speed *= 0.6;
          S.audio.crash();
        }
      }
    }
  }

  draw(ctx) {
    for (const c of this.cars) drawCar(ctx, c.x, c.y, c.angle, c.color, {});
    for (const p of this.peds) p.draw(ctx);
  }
}
