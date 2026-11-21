// Bandar Pelita — traffic cars and pedestrians.
const Traffic = (() => {
  const PED_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#e67e22', '#9b59b6', '#ecf0f1', '#1abc9c'];

  function init(rng) {
    // Traffic cars cruising the roads.
    for (let i = 0; i < 10; i++) {
      const p = City.roadPoint(rng);
      const vertical = Math.abs(p.x - 400) % 400 < 70 || City.vRoads.some(r => Math.abs(p.x - r) < 40);
      const angle = vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
      const car = Cars.make(p.x, p.y, angle, PAL.car[Math.floor(rng() * PAL.car.length)], {
        ai: 'traffic', driver: 'npc', maxSpeed: 130 + rng() * 70, accel: 160,
      });
      car.cruise = 120 + rng() * 60;
      car.turnCd = 2 + rng() * 4;
    }
    // Pedestrians on the sidewalks.
    for (let i = 0; i < 16; i++) {
      const p = City.roadPoint(rng);
      G.peds.push({
        x: clamp(p.x + (rng() - 0.5) * 120, 40, G.W - 40),
        y: clamp(p.y + (rng() - 0.5) * 120, 40, G.H - 40),
        angle: rng() * TAU,
        speed: 28 + rng() * 30,
        color: PED_COLORS[Math.floor(rng() * PED_COLORS.length)],
        tx: 0, ty: 0, wait: rng() * 2,
        flee: 0, dead: false,
      });
      const ped = G.peds[G.peds.length - 1];
      ped.tx = ped.x; ped.ty = ped.y;
    }
  }

  function update(dt) {
    // Traffic AI: follow the road, turn at intersections, brake for cars ahead.
    for (const car of G.cars) {
      if (car.ai !== 'traffic') continue;
      car.turnCd -= dt;
      const aheadX = car.x + Math.cos(car.angle) * 70;
      const aheadY = car.y + Math.sin(car.angle) * 70;
      let blocked = false;
      for (const o of G.cars) {
        if (o === car) continue;
        if (dist(aheadX, aheadY, o.x, o.y) < 42) { blocked = true; break; }
      }
      // At an intersection, sometimes turn left/right.
      const nearV = City.vRoads.some(r => Math.abs(car.x - r) < 26);
      const nearH = City.hRoads.some(r => Math.abs(car.y - r) < 26);
      if (nearV && nearH && car.turnCd <= 0) {
        car.turnCd = 3 + Math.random() * 4;
        const r = Math.random();
        if (r < 0.3) car.angle += Math.PI / 2;
        else if (r < 0.6) car.angle -= Math.PI / 2;
      }
      // Keep on the road: if drifting off, steer back toward the nearest road centre.
      if (!City.onRoad(car.x, car.y)) {
        let best = null, bd = 1e9;
        for (const rx of City.vRoads) { const d = Math.abs(car.x - rx); if (d < bd) { bd = d; best = { axis: 'v', at: rx }; } }
        for (const ry of City.hRoads) { const d = Math.abs(car.y - ry); if (d < bd) { bd = d; best = { axis: 'h', at: ry }; } }
        const want = best.axis === 'v' ? (car.y > 1200 ? Math.PI / 2 : -Math.PI / 2) : (car.x > 1600 ? 0 : Math.PI);
        car.angle += clamp(angDiff(car.angle, want), -1.6 * dt, 1.6 * dt);
      }
      const target = blocked ? 0 : car.cruise;
      const throttle = target > car.speed ? 1 : (target < car.speed ? -0.4 : 0);
      Cars.drive(car, throttle, 0, dt);
    }
    // Pedestrians.
    for (const p of G.peds) {
      if (p.dead) continue;
      if (p.flee > 0) {
        p.flee -= dt;
        p.x += Math.cos(p.angle) * 150 * dt;
        p.y += Math.sin(p.angle) * 150 * dt;
      } else if (p.wait > 0) {
        p.wait -= dt;
      } else {
        const d = dist(p.x, p.y, p.tx, p.ty);
        if (d < 12) {
          // pick a new nearby sidewalk target
          const q = City.roadPoint(Math.random);
          p.tx = clamp(q.x + (Math.random() - 0.5) * 100, 40, G.W - 40);
          p.ty = clamp(q.y + (Math.random() - 0.5) * 100, 40, G.H - 40);
          p.wait = Math.random() * 1.5;
        } else {
          p.angle = angTo(p.x, p.y, p.tx, p.ty);
          p.x += Math.cos(p.angle) * p.speed * dt;
          p.y += Math.sin(p.angle) * p.speed * dt;
        }
      }
      p.x = clamp(p.x, 30, G.W - 30);
      p.y = clamp(p.y, 30, G.H - 30);
      if (City.hitBuilding(p.x, p.y, 8)) {
        p.tx = p.x + (Math.random() - 0.5) * 200;
        p.ty = p.y + (Math.random() - 0.5) * 200;
      }
      // Hit by a fast car: knocked down, crime if the player did it.
      for (const c of G.cars) {
        if (Math.abs(c.speed) > 90 && dist(p.x, p.y, c.x, c.y) < 26) {
          p.dead = true;
          if (c.driver === 'player') {
            Police.addWanted(1);
            Hud.toast('Pejuang kaki tertabrak! Wanted +1');
            Snd.thud();
          }
          break;
        }
      }
    }
    G.peds = G.peds.filter(p => !p.dead);
    if (G.peds.length < 10) {
      const p = City.roadPoint(Math.random);
      G.peds.push({
        x: clamp(p.x, 40, G.W - 40), y: clamp(p.y, 40, G.H - 40),
        angle: Math.random() * TAU, speed: 30 + Math.random() * 30,
        color: PED_COLORS[Math.floor(Math.random() * PED_COLORS.length)],
        tx: p.x, ty: p.y, wait: 0, flee: 0, dead: false,
      });
    }
  }

  function fleeFrom(x, y, radius) {
    for (const p of G.peds) {
      if (dist(p.x, p.y, x, y) < radius) {
        p.angle = angTo(x, y, p.x, p.y);
        p.flee = 1.6;
      }
    }
  }

  function draw(ctx) {
    for (const p of G.peds) A.drawPerson(ctx, p.x, p.y, p.angle, p.color);
  }

  return { init, update, fleeFrom, draw };
})();
