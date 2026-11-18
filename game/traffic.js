// Teluk Cerah — traffic and pedestrians.
//
// Traffic cars cruise the road grid: they keep to a lane, turn at
// intersections, and brake for the car ahead. Parked cars wait in lots.
// Pedestrians wander the pavements, flee a speeding car, and get knocked
// down if one hits them (which the police notice).

import { drawPerson } from './assets.js';
import { WORLD, solidAt, atCrossing, nearestRoad } from './city.js';
import { makeCar, randomCarColor, drawCar, goldColor } from './vehicles.js';
import { sfx } from './audio.js';
import { commitCrime } from './player.js';

const PED_COLORS = ['#c96f4a', '#4a90c9', '#7d5a9e', '#4a9e7d', '#c9a44a', '#8a5a3a'];

function randPed(rng) {
  return {
    x: 0,
    y: 0,
    angle: rng() * Math.PI * 2,
    speed: 42 + rng() * 22,
    color: PED_COLORS[Math.floor(rng() * PED_COLORS.length)],
    down: 0,
    wanderT: 1 + rng() * 3,
    fleeT: 0,
  };
}

export function initTraffic(G) {
  const rng = G.rng;
  G.cars = [];
  G.peds = [];
  // Moving traffic on the grid.
  for (let i = 0; i < 13; i += 1) {
    const axis = rng() < 0.5 ? 'v' : 'h';
    const road = nearestRoad(axis, axis === 'v' ? 400 + rng() * 3000 : 200 + rng() * 2200);
    const car = makeCar(0, 0, 0, randomCarColor(rng), 'traffic');
    car.axis = axis;
    car.dir = rng() < 0.5 ? 1 : -1;
    car.lane = rng() < 0.5 ? -17 : 17;
    car.road = road;
    car.cruise = 130 + rng() * 60;
    if (axis === 'v') {
      car.x = road + car.lane;
      car.y = 120 + rng() * (WORLD.h - 240);
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.x = 380 + rng() * (WORLD.w - 760);
      car.y = road + car.lane;
      car.angle = car.dir > 0 ? 0 : Math.PI;
    }
    car.speed = car.cruise;
    G.cars.push(car);
  }
  // Parked cars: a row at the mall lot and a few along the roads.
  const lotSpots = [
    [2520, 920, 0], [2590, 920, 0], [2660, 920, 0], [2800, 920, 0], [2870, 920, 0],
    [2520, 990, 0], [2590, 990, 0], [2800, 990, 0],
  ];
  for (const [x, y, a] of lotSpots) {
    const car = makeCar(x, y, a, randomCarColor(rng), 'parked');
    G.cars.push(car);
  }
  for (let i = 0; i < 4; i += 1) {
    const vx = WORLD.roadsV[Math.floor(rng() * WORLD.roadsV.length)];
    const hy = WORLD.roadsH[Math.floor(rng() * WORLD.roadsH.length)];
    const car = makeCar(vx + 78, hy + 200 + rng() * 300, Math.PI / 2, randomCarColor(rng), 'parked');
    if (!solidAt(G.city, car.x, car.y, 22)) G.cars.push(car);
  }
  // The gold mission car, parked in the mall lot.
  const gold = makeCar(2730, 880, Math.PI / 2, goldColor(), 'gold');
  G.cars.push(gold);
  G.goldCar = gold;
  // Pedestrians near roads and plazas.
  for (let i = 0; i < 22; i += 1) {
    const ped = randPed(rng);
    const vx = WORLD.roadsV[Math.floor(rng() * WORLD.roadsV.length)];
    const hy = WORLD.roadsH[Math.floor(rng() * WORLD.roadsH.length)];
    ped.x = vx + (rng() < 0.5 ? -1 : 1) * (70 + rng() * 60);
    ped.y = hy + (rng() < 0.5 ? -1 : 1) * (70 + rng() * 260);
    if (solidAt(G.city, ped.x, ped.y, 12)) {
      ped.x = 900 + rng() * 400;
      ped.y = 800 + rng() * 200;
    }
    G.peds.push(ped);
  }
}

function carAhead(G, car, dist) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const other of G.cars) {
    if (other === car || other.kind === 'cop') continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    if (along > 0 && along < dist && Math.abs(dx * fy - dy * fx) < 34) return true;
  }
  return false;
}

export function updateTraffic(G, dt) {
  const rng = G.rng;
  for (const car of G.cars) {
    if (car.kind !== 'traffic' || car.driven) continue;
    car.turnCd = Math.max(0, (car.turnCd || 0) - dt);
    // Turn at an intersection sometimes.
    if (car.turnCd <= 0 && atCrossing(car.x, car.y) && rng() < dt * 0.5) {
      const newAxis = car.axis === 'v' ? 'h' : 'v';
      car.axis = newAxis;
      car.road = nearestRoad(newAxis, newAxis === 'v' ? car.x : car.y);
      car.lane = rng() < 0.5 ? -17 : 17;
      car.dir = rng() < 0.5 ? 1 : -1;
      car.turnCd = 2.5;
    }
    // Turn around at the ends of the road.
    if (car.axis === 'v' && (car.y < 70 || car.y > WORLD.h - 70)) car.dir *= -1;
    if (car.axis === 'h' && (car.x < 380 || car.x > WORLD.w - 70)) car.dir *= -1;
    const want = carAhead(G, car, 85) ? 0 : car.cruise;
    car.speed += (want - car.speed) * Math.min(1, dt * 1.6);
    const step = car.dir * car.speed * dt;
    if (car.axis === 'v') {
      car.y += step;
      car.x = car.road + car.lane;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.x += step;
      car.y = car.road + car.lane;
      car.angle = car.dir > 0 ? 0 : Math.PI;
    }
  }

  const p = G.player;
  for (const ped of G.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      continue;
    }
    ped.wanderT -= dt;
    ped.fleeT = Math.max(0, ped.fleeT - dt);
    // Flee a fast car nearby.
    if (!p.onFoot && p.car && Math.abs(p.car.speed) > 150) {
      const d = Math.hypot(ped.x - p.car.x, ped.y - p.car.y);
      if (d < 140) {
        ped.fleeT = 1;
        ped.angle = Math.atan2(ped.y - p.car.y, ped.x - p.car.x);
      }
    }
    if (ped.fleeT > 0) {
      const nx = ped.x + Math.cos(ped.angle) * 135 * dt;
      const ny = ped.y + Math.sin(ped.angle) * 135 * dt;
      if (!solidAt(G.city, nx, ped.y, 12)) ped.x = nx;
      if (!solidAt(G.city, ped.x, ny, 12)) ped.y = ny;
      continue;
    }
    if (ped.wanderT <= 0) {
      ped.wanderT = 2 + rng() * 3;
      ped.angle = rng() * Math.PI * 2;
    }
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (!solidAt(G.city, nx, ped.y, 12)) ped.x = nx;
    else ped.angle += Math.PI / 2;
    if (!solidAt(G.city, ped.x, ny, 12)) ped.y = ny;
    else ped.angle += Math.PI / 2;
  }

  // A fast car that runs a pedestrian down.
  for (const ped of G.peds) {
    if (ped.down > 0) continue;
    for (const car of G.cars) {
      if (Math.abs(car.speed) < 120) continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26) {
        ped.down = 4;
        ped.angle = Math.atan2(ped.y - car.y, ped.x - car.x);
        if (car.driven) {
          commitCrime(G, 1);
          G.stats.knocked += 1;
          sfx(G.audio, 'crash');
        }
        break;
      }
    }
  }
}

export function drawTraffic(ctx, G) {
  for (const car of G.cars) {
    if (car.kind === 'cop') continue;
    drawCar(ctx, car, G.time);
  }
  for (const ped of G.peds) {
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, ped.down > 0);
  }
}
