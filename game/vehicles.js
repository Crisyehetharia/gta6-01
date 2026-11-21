// Bandar Pelita — cars: physics, spawning, drawing.
const Cars = (() => {
  const COLORS = PAL.car;
  let nextId = 1;

  function make(x, y, angle, color, opts) {
    opts = opts || {};
    const car = {
      id: nextId++,
      x, y, angle,
      speed: 0,
      maxSpeed: opts.maxSpeed || 400,
      accel: opts.accel || 260,
      color: color || COLORS[Math.floor(Math.random() * COLORS.length)],
      type: opts.type || 'sedan',
      ai: opts.ai || null, // null | 'traffic' | 'police'
      driver: opts.driver || null, // 'player' | 'npc' | null (parked)
      targetSpeed: 0,
      steer: 0,
      hp: 100,
      marked: !!opts.marked,
      police: !!opts.police,
      dead: false,
    };
    G.cars.push(car);
    return car;
  }

  function spawnParked(rng, n) {
    for (let i = 0; i < n; i++) {
      const p = City.roadPoint(rng);
      // park along the road edge
      const vertical = rng() < 0.5;
      let x = p.x, y = p.y, angle = 0;
      if (vertical) { x = p.x + (rng() < 0.5 ? -52 : 52); angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2; }
      else { y = p.y + (rng() < 0.5 ? -52 : 52); angle = rng() < 0.5 ? 0 : Math.PI; }
      if (City.hitBuilding(x, y, 26) || City.inWater(x, y)) continue;
      make(x, y, angle, COLORS[Math.floor(rng() * COLORS.length)], { driver: null });
    }
  }

  // Drive a car with normalized inputs: throttle -1..1, steer -1..1.
  function drive(car, throttle, steer, dt) {
    const maxFwd = car.maxSpeed;
    const maxRev = car.maxSpeed * 0.45;
    if (throttle > 0) car.speed += car.accel * throttle * dt;
    else if (throttle < 0) car.speed += car.accel * 0.9 * throttle * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
    car.speed = clamp(car.speed, -maxRev, maxFwd);
    const spd = Math.abs(car.speed);
    const turnRate = 2.4 * clamp(spd / 160, 0, 1) * (car.speed < 0 ? -1 : 1);
    car.angle += steer * turnRate * dt;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    // building collision: try x then y so the car slides along walls
    const probe = { x: nx, y: car.y };
    if (!City.hitBuilding(probe.x, probe.y, 22) && !City.inWater(probe.x, probe.y)) car.x = nx;
    else car.speed *= 0.4;
    probe.x = car.x; probe.y = ny;
    if (!City.hitBuilding(probe.x, probe.y, 22) && !City.inWater(probe.x, probe.y)) car.y = ny;
    else car.speed *= 0.4;
    car.x = clamp(car.x, 24, G.W - 24);
    car.y = clamp(car.y, 24, G.H - 24);
  }

  function collideCars(dt) {
    const cs = G.cars;
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        const a = cs[i], b = cs[j];
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < 46 && d > 0.01) {
          const push = (46 - d) / 2;
          const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          const rel = Math.abs(a.speed - b.speed);
          if (rel > 120) {
            if (a.driver === 'player' || b.driver === 'player') {
              G.shake = Math.max(G.shake, 6);
              Snd.crash();
              Player.hurt(4);
            }
            a.speed *= 0.6; b.speed *= 0.6;
          }
        }
      }
    }
  }

  function nearest(x, y, r, filter) {
    let best = null, bd = r;
    for (const c of G.cars) {
      if (filter && !filter(c)) continue;
      const d = dist(x, y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  function draw(ctx) {
    for (const c of G.cars) {
      A.drawCar(ctx, c.x, c.y, c.angle, c.color, { police: c.police, marked: c.marked });
    }
  }

  return { make, spawnParked, drive, collideCars, nearest, draw };
})();
