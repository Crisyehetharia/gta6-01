// police.js — wanted stars and the Teluk Cerah police.
// Crime raises stars; police cars spawn, chase, ram, and arrest the player
// on foot if they hold them long enough.

import { drawCar, drawPerson } from './assets.js';
import { Car } from './vehicles.js';
import { WORLD_W, WORLD_H } from './city.js';

const STAR_NAMES = ['', '★', '★★', '★★★', '★★★★', '★★★★★'];

export class Police {
  constructor(city) {
    this.city = city;
    this.wanted = 0;
    this.cops = []; // police cars
    this.footCops = []; // officers on foot (spawn when player is on foot)
    this.quietT = 0; // seconds since last crime
    this.decayT = 0;
    this.spawnT = 0;
    this.arrestT = 0; // how long a cop has held the player
    this.lastReason = '';
  }

  stars() { return STAR_NAMES[this.wanted] || ''; }

  addWanted(n, reason = '') {
    const before = this.wanted;
    this.wanted = Math.max(0, Math.min(5, this.wanted + n));
    this.quietT = 0;
    this.lastReason = reason;
    if (this.wanted > before) {
      // Notify the player through the banner in main.js.
      if (this.onWantedUp) this.onWantedUp(this.wanted, reason);
    }
  }

  clearWanted() {
    this.wanted = 0;
    this.cops = [];
    this.footCops = [];
    this.arrestT = 0;
  }

  update(dt, S) {
    this.quietT += dt;
    if (this.wanted > 0 && this.quietT > 20) {
      this.decayT += dt;
      if (this.decayT > 10) {
        this.decayT = 0;
        this.addWanted(-1);
      }
    }
    // Spawn police cars up to wanted level (max 4 cars).
    this.spawnT -= dt;
    const wantCars = Math.min(4, this.wanted);
    if (this.wanted > 0 && this.cops.length < wantCars && this.spawnT <= 0) {
      this.spawnT = 2.2;
      const p = S.player;
      const edge = this.city.roadPoint(Math.random);
      const car = new Car(
        Math.max(60, Math.min(WORLD_W - 60, p.x + (Math.random() < 0.5 ? -700 : 700))),
        Math.max(60, Math.min(2200, p.y + (Math.random() < 0.5 ? -500 : 500))),
        0, '#f2f2f2', { police: true, maxSpeed: 430 },
      );
      car.angle = Math.atan2(p.y - car.y, p.x - car.x);
      car.speed = 200;
      this.cops.push(car);
    }
    // Chase behaviour: steer toward the player, ram on contact.
    const p = S.player;
    const target = p.inCar ?? p;
    for (const c of this.cops) {
      const dx = target.x - c.x, dy = target.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      const wantAngle = Math.atan2(dy, dx);
      let diff = wantAngle - c.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
      const cruise = Math.min(430, 300 + this.wanted * 30);
      c.speed += (cruise - c.speed) * Math.min(1, dt * 0.8);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      c.flash += dt * 6;
      if (this.city.solidAt(c.x, c.y)) {
        c.x -= Math.cos(c.angle) * c.speed * dt * 2;
        c.y -= Math.sin(c.angle) * c.speed * dt * 2;
        c.speed *= 0.5;
      }
      // Ram the player.
      if (d < 42) {
        if (p.inCar) {
          const push = 160 * dt;
          p.inCar.x += (dx / d) * push;
          p.inCar.y += (dy / d) * push;
          p.inCar.speed *= 0.92;
          if (Math.abs(c.speed) > 200) {
            S.audio.crash();
            p.damage(4, S);
          }
          c.speed *= 0.6;
        } else {
          // Officer holds the player: arrest after 1.4s.
          this.arrestT += dt;
          if (this.arrestT > 1.4) {
            this.arrestT = 0;
            S.gameOver('Polisi menangkapmu di tengah pengejaran.');
          }
        }
      }
    }
    if (this.cops.length === 0 || (p.inCar && Math.hypot(p.x - this.cops[0]?.x ?? 0, p.y - this.cops[0]?.y ?? 0) > 60)) {
      if (this.arrestT > 0) this.arrestT = Math.max(0, this.arrestT - dt * 2);
    }
    // Foot officers appear when the player is on foot and wanted.
    if (this.wanted > 0 && !p.inCar && this.footCops.length < Math.min(2, this.wanted)) {
      if (Math.random() < dt * 0.25) {
        this.footCops.push({
          x: p.x + (Math.random() < 0.5 ? -320 : 320),
          y: p.y + (Math.random() < 0.5 ? -240 : 240),
          angle: 0, hp: 50, walkPhase: 0, punchT: 0,
        });
      }
    }
    for (const f of this.footCops) {
      const dx = p.x - f.x, dy = p.y - f.y;
      const d = Math.hypot(dx, dy) || 1;
      f.angle = Math.atan2(dy, dx);
      if (d > 34) {
        f.x += (dx / d) * 132 * dt;
        f.y += (dy / d) * 132 * dt;
        f.walkPhase += dt * 10;
      } else if (!p.inCar) {
        this.arrestT += dt;
        if (this.arrestT > 1.4) {
          this.arrestT = 0;
          S.gameOver('Polisi menangkapmu di tengah pengejaran.');
        }
      }
      this.city.resolveCircle(f, 12);
    }
    this.footCops = this.footCops.filter((f) => f.hp > 0);
    if (this.wanted === 0) {
      this.cops = [];
      this.footCops = [];
      this.arrestT = 0;
    }
    S.audio.siren(this.wanted >= 2 && S.mode === 'play');
  }

  draw(ctx) {
    for (const c of this.cops) c.draw(ctx);
    for (const f of this.footCops) {
      drawPerson(ctx, f.x, f.y, f.angle, '#24355e', { walkPhase: f.walkPhase });
      // Police cap.
      ctx.fillStyle = '#16233f';
      ctx.beginPath(); ctx.arc(f.x + Math.cos(f.angle) * 11, f.y + Math.sin(f.angle) * 11, 5, 0, Math.PI * 2); ctx.fill();
    }
  }
}
