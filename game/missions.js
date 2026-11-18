// Teluk Cerah — missions.
//
// Three jobs from Dimas the fixer, played in order:
//   1. Paket Kilat  — pick a parcel up at Pasar Pagi, deliver it to the
//                      Dermaga Teluk pier. Pays $150.
//   2. Tarik Mobil  — steal the gold car from the Parkir Mall lot and
//                      bring it to Bengkel Roda. Pays $250.
//   3. Jalan Keluar — the heat jumps to 3 stars; escape to the Rumah Aman
//                      safe house. Pays $400.
// After the third, Rani is free to roam the city.

import { PLACES } from './city.js';
import { sfx } from './audio.js';

export const MISSION_REWARDS = [150, 250, 400];

function setTarget(G, x, y, r, label) {
  G.missionTarget = { x, y, r, label };
}

export function startMission(G, idx) {
  G.missionIdx = idx;
  if (idx === 0) {
    G.missionStage = 'pickup';
    setTarget(G, PLACES.pasar.x, PLACES.pasar.y, PLACES.pasar.r, 'Pasar Pagi');
    G.objective = 'Ambil paket di Pasar Pagi';
    G.banner = { title: 'Misi 1 — Paket Kilat', sub: 'Ambil paket di Pasar Pagi, antar ke Dermaga Teluk.', t: 4 };
  } else if (idx === 1) {
    G.missionStage = 'steal';
    setTarget(G, G.goldCar.x, G.goldCar.y, 120, 'Mobil emas');
    G.objective = 'Curi mobil emas di Parkir Mall';
    G.banner = { title: 'Misi 2 — Tarik Mobil', sub: 'Curi mobil emas di Parkir Mall, bawa ke Bengkel Roda.', t: 4 };
  } else if (idx === 2) {
    G.missionStage = 'escape';
    G.player.wanted = 3;
    setTarget(G, PLACES.rumah.x, PLACES.rumah.y, PLACES.rumah.r, 'Rumah Aman');
    G.objective = 'Kabur ke Rumah Aman!';
    G.banner = { title: 'Misi 3 — Jalan Keluar', sub: 'Bintang 3! Kabur ke Rumah Aman sebelum tertangkap.', t: 4 };
  } else {
    G.missionStage = 'done';
    G.missionTarget = null;
    G.objective = 'Bebas! Jelajahi Teluk Cerah.';
  }
}

function completeMission(G, reward, nextTitle) {
  const p = G.player;
  p.cash += reward;
  sfx(G.audio, 'deliver');
  G.banner = { title: `Misi selesai! +$${reward}`, sub: nextTitle, t: 3.5 };
  // The save happens after the next mission starts, so the file records
  // the mission the player is about to play, not the one just finished.
}

export function updateMissions(G, dt) {
  void dt;
  const p = G.player;
  const idx = G.missionIdx;
  if (idx === 0) {
    if (G.missionStage === 'pickup') {
      const t = G.missionTarget;
      if (Math.hypot(p.x - t.x, p.y - t.y) < t.r && G.pressed.has('e')) {
        G.pressed.delete('e');
        G.missionStage = 'deliver';
        setTarget(G, PLACES.dermaga.x, PLACES.dermaga.y, PLACES.dermaga.r, 'Dermaga Teluk');
        G.objective = 'Antar paket ke Dermaga Teluk';
        sfx(G.audio, 'pickup');
        G.banner = { title: 'Paket diambil!', sub: 'Antar ke Dermaga Teluk di tepi pantai.', t: 2.5 };
      }
    } else if (G.missionStage === 'deliver') {
      const t = G.missionTarget;
      if (Math.hypot(p.x - t.x, p.y - t.y) < t.r && G.pressed.has('e')) {
        G.pressed.delete('e');
        completeMission(G, MISSION_REWARDS[0], 'Misi berikutnya: Tarik Mobil.');
        startMission(G, 1);
        if (G.saveGame) G.saveGame();
      }
    }
  } else if (idx === 1) {
    if (G.missionStage === 'steal') {
      // The gold car's marker follows the car until it is stolen.
      G.missionTarget.x = G.goldCar.x;
      G.missionTarget.y = G.goldCar.y;
      if (!p.onFoot && p.car === G.goldCar) {
        G.missionStage = 'deliver';
        setTarget(G, PLACES.bengkel.x, PLACES.bengkel.y, PLACES.bengkel.r, 'Bengkel Roda');
        G.objective = 'Bawa mobil emas ke Bengkel Roda';
        G.banner = { title: 'Mobil didapat!', sub: 'Bawa ke Bengkel Roda di tenggara.', t: 2.5 };
      }
    } else if (G.missionStage === 'deliver') {
      const t = G.missionTarget;
      if (Math.hypot(G.goldCar.x - t.x, G.goldCar.y - t.y) < t.r) {
        completeMission(G, MISSION_REWARDS[1], 'Misi terakhir: Jalan Keluar.');
        startMission(G, 2);
        if (G.saveGame) G.saveGame();
      }
    }
  } else if (idx === 2) {
    const t = G.missionTarget;
    if (Math.hypot(p.x - t.x, p.y - t.y) < t.r) {
      p.wanted = 0;
      completeMission(G, MISSION_REWARDS[2], 'Semua misi selesai — Teluk Cerah milikmu!');
      startMission(G, 3);
      if (G.saveGame) G.saveGame();
    }
  }
}

// Where the waypoint arrow and minimap marker should point, or null.
export function missionTargetPos(G) {
  return G.missionTarget;
}
