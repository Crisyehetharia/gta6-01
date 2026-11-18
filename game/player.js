// player.js — the hero on foot: Rani, a courier from Teluk Cerah.
// Walks with WASD/arrows, punches with F/Space, enters cars with E.

import { drawPerson } from './assets.js';

const SHIRTS = ['#e0483e', '#2b6fe0', '#f2a007', '#7a4fd0', '#3aa655'];

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.angle = 0;
    this.hp = 100;
    this.speed = 175;
    this.inCar = null; // Car instance or null
    this.shirt = '#e0483e';
    this.walkPhase = 0;
    this.punchT = 0; // seconds left in the punch animation
    this.punchCooldown = 0;
    this.hurtT = 0;
    this.moving = false;
  }

  reset(x, y) {
    this.x = x; this.y = y;
    this.hp = 100; this.inCar = null;
    this.punchT = 0; this.punchCooldown = 0; this.hurtT = 0;
  }

  update(dt, input, S) {
    if (this.inCar) return; // the car drives instead
    let dx = 0, dy = 0;
    if (input.has('KeyW') || input.has('ArrowUp')) dy -= 1;
    if (input.has('KeyS') || input.has('ArrowDown')) dy += 1;
    if (input.has('KeyA') || input.has('ArrowLeft')) dx -= 1;
    if (input.has('KeyD') || input.has('ArrowRight')) dx += 1;
    this.moving = dx !== 0 || dy !== 0;
    if (this.moving) {
      const len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
      this.angle = Math.atan2(dy, dx);
      this.x += dx * this.speed * dt;
      this.y += dy * this.speed * dt;
      this.walkPhase += dt * 11;
      S.city.resolveCircle(this, 14);
    }
    if (this.punchCooldown > 0) this.punchCooldown -= dt;
    if (this.punchT > 0) this.punchT -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
  }

  // Called from the keydown handler so a quick tap always lands a punch.
  tryPunch(S) {
    if (this.inCar || this.punchCooldown > 0) return;
    this.punchT = 0.22;
    this.punchCooldown = 0.45;
    S.audio.punch();
    S.combat.punch(this);
  }

  damage(n, S) {
    if (this.hurtT > 0 || this.hp <= 0) return;
    this.hp = Math.max(0, this.hp - n);
    this.hurtT = 0.5;
    if (this.hp <= 0) S.gameOver('Kamu pingsan di tengah jalan.');
  }

  draw(ctx) {
    if (this.inCar) return;
    const flash = this.hurtT > 0 && Math.floor(this.hurtT * 12) % 2 === 0;
    if (flash) return; // brief invulnerability blink
    drawPerson(ctx, this.x, this.y, this.angle, this.shirt, {
      walkPhase: this.walkPhase,
      punch: this.punchT > 0,
    });
  }
}

export function randomShirt(rng) { return SHIRTS[Math.floor(rng() * SHIRTS.length)]; }
