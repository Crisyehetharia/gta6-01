// missions.js — three short missions with an original story.
// Rani, a courier from Teluk Cerah, takes jobs from Dimas, a local fixer.
// 1. Paket Kilat — pick up a package at Pasar Pagi, deliver it to the pier.
// 2. Tarik Mobil — steal the gold car at Parkir Mall, bring it to the garage.
// 3. Jalan Keluar — lose a 3-star chase by reaching the safe house.

import { PLACES } from './city.js';
import { Car } from './vehicles.js';

export const MISSION_DEFS = [
  {
    id: 1,
    title: 'Misi 1 — Paket Kilat',
    brief: 'Dimas: "Paket buat pelanggan di Dermaga. Antar cepat, jangan sampai ketahuan."',
    objective: 'Ambil paket di Pasar Pagi, lalu antar ke Dermaga Teluk.',
    target: PLACES.market,
    timeLimit: 0,
  },
  {
    id: 2,
    title: 'Misi 2 — Tarik Mobil',
    brief: 'Dimas: "Ada mobil emas di Parkir Mall. Bawa ke Bengkel Roda. Hati-hati, ada yang punya."',
    objective: 'Curi mobil emas di Parkir Mall, bawa ke Bengkel Roda.',
    target: PLACES.parking,
    timeLimit: 0,
  },
  {
    id: 3,
    title: 'Misi 3 — Jalan Keluar',
    brief: 'Dimas: "Polisi sudah mengepung! Kabur ke Rumah Aman, jangan sampai ketangkap."',
    objective: 'Lolos dari kejaran polisi (bintang 3) dan sampai di Rumah Aman.',
    target: PLACES.hideout,
    timeLimit: 0,
  },
];

export class Missions {
  constructor(S) {
    this.S = S;
    this.index = 0; // 0-based into MISSION_DEFS
    this.stage = 'toPickup'; // toPickup | toDeliver | done
    this.active = null;
    this.timer = 0;
    this.done = 0;
    this.targetCar = null;
    this.allDone = false;
    this.between = false; // breather between missions
    this.bannerT = 0;
  }

  get current() { return (this.allDone || this.between) ? null : MISSION_DEFS[this.index]; }

  start() {
    this.index = 0;
    this.done = 0;
    this.allDone = false;
    this.between = false;
    this.startMission(0);
  }

  startMission(i) {
    this.index = i;
    this.between = false;
    const def = MISSION_DEFS[i];
    this.active = def;
    this.stage = 'toPickup';
    this.timer = def.timeLimit;
    if (def.id === 2) {
      // The gold target car at the mall parking lot.
      this.targetCar = new Car(PLACES.parking.x + 40, PLACES.parking.y + 20, Math.PI / 2, '#e8b93b', { parked: true, target: true });
      this.S.parkedCars.push(this.targetCar);
    }
    if (def.id === 3) {
      // A three-star chase, whatever the player did before.
      this.S.police.wanted = 3;
      this.S.police.quietT = 0;
      this.S.police.lastReason = 'Polisi mengepungmu!';
    }
    this.S.setBanner(def.title, def.brief, 5);
  }

  // Where the player must go right now.
  waypoint() {
    if (this.between) return null;
    const def = this.current;
    if (!def) return null;
    if (def.id === 1) return this.stage === 'toPickup' ? PLACES.market : PLACES.pier;
    if (def.id === 2) return this.stage === 'toPickup' ? PLACES.parking : PLACES.garage;
    return PLACES.hideout;
  }

  objectiveText() {
    if (this.between) return 'Misi berikutnya segera dimulai...';
    const def = this.current;
    if (!def) return 'Semua misi selesai — jelajahi Teluk Cerah sesukamu!';
    if (def.id === 1) return this.stage === 'toPickup' ? 'Ambil paket di Pasar Pagi (E)' : 'Antar paket ke Dermaga Teluk';
    if (def.id === 2) return this.stage === 'toPickup' ? 'Curi mobil emas di Parkir Mall (E)' : 'Bawa mobil emas ke Bengkel Roda';
    return 'Kabur ke Rumah Aman — jangan ketangkap polisi!';
  }

  // Called when the player presses E near something.
  tryInteract(S) {
    const def = this.current;
    if (!def) return false;
    const wp = this.waypoint();
    const p = S.player;
    const at = (x, y, r = 70) => Math.hypot(p.x - x, p.y - y) < r || (p.inCar && Math.hypot(p.inCar.x - x, p.inCar.y - y) < r);
    if (def.id === 1 && this.stage === 'toPickup' && at(wp.x, wp.y)) {
      this.stage = 'toDeliver';
      S.audio.pickup();
      S.setBanner('Paket diambil!', 'Antar ke Dermaga Teluk sebelum pelanggan marah.', 3);
      return true;
    }
    if (def.id === 1 && this.stage === 'toDeliver' && at(PLACES.pier.x, PLACES.pier.y, 90)) {
      this.complete(S, 150);
      return true;
    }
    if (def.id === 2 && this.stage === 'toDeliver' && at(PLACES.garage.x, PLACES.garage.y, 90)) {
      this.complete(S, 250);
      return true;
    }
    return false;
  }

  update(dt, S) {
    if (this.between) return;
    const def = this.current;
    if (!def) return;
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) S.gameOver('Waktu habis — pelanggan membatalkan pesanan.');
    }
    // Mission 2: stealing the gold car advances the stage.
    if (def.id === 2 && this.stage === 'toPickup' && this.targetCar && S.player.inCar === this.targetCar) {
      this.stage = 'toDeliver';
      S.police.addWanted(1, 'Mobil emas dicuri!');
      S.audio.pickup();
      S.setBanner('Mobil didapat!', 'Bawa ke Bengkel Roda. Polisi sudah curiga.', 3);
    }
    // Mission 3: reaching the hideout with the chase on completes it.
    if (def.id === 3) {
      const p = S.player;
      const d = Math.hypot(p.x - PLACES.hideout.x, p.y - PLACES.hideout.y);
      if (d < 80) {
        S.police.clearWanted();
        this.complete(S, 400);
      }
    }
  }

  complete(S, reward) {
    this.done++;
    S.missionsDone = this.done;
    S.cash += reward;
    S.audio.complete();
    S.save();
    const def = this.current;
    S.setBanner(`${def.title} SELESAI!`, `+$${reward} — kerja bagus, Rani.`, 4);
    if (this.done >= MISSION_DEFS.length) {
      this.allDone = true;
      this.active = null;
      S.setBanner('SEMUA MISI SELESAI!', 'Teluk Cerah sekarang kotamu. Jelajahi sesukamu!', 6);
      return;
    }
    this.active = null;
    this.between = true;
    // Next mission starts after a short breather.
    const next = this.index + 1;
    setTimeout(() => { if (S.mode === 'play' && this.between) this.startMission(next); }, 3500);
  }

  drawMarker(ctx, cam, vw, vh) {
    const wp = this.waypoint();
    if (!wp) return;
    const onScreen = wp.x >= cam.x && wp.x <= cam.x + vw && wp.y >= cam.y && wp.y <= cam.y + vh;
    const pulse = 1 + Math.sin(performance.now() / 300) * 0.25;
    if (onScreen) {
      ctx.save();
      ctx.translate(wp.x, wp.y);
      ctx.strokeStyle = '#ffd21f';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd21f';
      ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(10, -14); ctx.lineTo(-10, -14); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else {
      // Edge arrow pointing at the off-screen waypoint.
      const cx = cam.x + vw / 2, cy = cam.y + vh / 2;
      const ang = Math.atan2(wp.y - cy, wp.x - cx);
      const ex = cx + Math.cos(ang) * (vw / 2 - 50);
      const ey = cy + Math.sin(ang) * (vh / 2 - 50);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffd21f';
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
}
