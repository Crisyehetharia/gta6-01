// Bandar Pelita — wanted level and police pursuit.
const Police = (() => {
  function addWanted(n) {
    const before = G.wanted;
    G.wanted = clamp(G.wanted + n, 0, 5);
    if (G.wanted > before) {
      G.wantDecay = 0;
      Hud.toast('Wanted naik ke ' + G.wanted + ' bintang!');
      Snd.siren(G.wanted > 0);
    }
  }
  function policeCars() { return G.cars.filter(c => c.ai === 'police'); }

  function spawn() {
    const p = G.player;
    if (!p) return;
    // spawn at a road point near the player but off-screen
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * TAU;
      const d = 700 + Math.random() * 300;
      const x = clamp(p.x + Math.cos(a) * d, 60, G.W - 60);
      const y = clamp(p.y + Math.sin(a) * d, 60, G.H - 60);
      if (City.onRoad(x, y) && !City.hitBuilding(x, y, 26)) {
        const car = Cars.make(x, y, angTo(x, y, p.x, p.y), PAL.police, {
          ai: 'police', driver: 'npc', police: true, maxSpeed: 470, accel: 330,
        });
        car.cruise = 430;
        return car;
      }
    }
  }

  function update(dt) {
    const p = G.player;
    if (!p || G.state !== 'playing') { Snd.siren(false); return; }
    // keep police count == wanted level (cap 5)
    const cops = policeCars();
    if (G.wanted > cops.length) spawn();
    else if (G.wanted < cops.length) {
      // extra cops give up and drive away
      const extra = cops[cops.length - 1];
      extra.ai = 'traffic';
      extra.police = false;
      extra.cruise = 150;
    }
    Snd.siren(G.wanted > 0 && policeCars().length > 0);
    // wanted decay: no cop within 520px for 15s
    let nearestCop = 1e9;
    for (const c of policeCars()) nearestCop = Math.min(nearestCop, dist(p.x, p.y, c.x, c.y));
    if (G.wanted > 0 && nearestCop > 520) {
      G.wantDecay += dt;
      if (G.wantDecay > 15) { G.wanted -= 1; G.wantDecay = 0; Hud.toast('Wanted turun ke ' + G.wanted + ' bintang'); }
    } else G.wantDecay = 0;

    // pursuit
    for (const c of policeCars()) {
      const targetAngle = angTo(c.x, c.y, p.x, p.y);
      const d = dist(c.x, c.y, p.x, p.y);
      const steer = clamp(angDiff(c.angle, targetAngle) * 1.6, -1, 1);
      const throttle = d > 60 ? 1 : 0.4;
      Cars.drive(c, throttle, steer, dt);
      // ram the player
      if (d < 44) {
        const push = angTo(c.x, c.y, p.x, p.y);
        if (p.inCar) {
          p.inCar.x += Math.cos(push) * 26;
          p.inCar.y += Math.sin(push) * 26;
          p.inCar.speed *= 0.55;
          G.shake = Math.max(G.shake, 7);
          Snd.crash();
          Player.hurt(6);
        } else {
          // caught on foot
          if (Math.abs(c.speed) < 120) {
            Player.busted();
          } else {
            p.x += Math.cos(push) * 30;
            p.y += Math.sin(push) * 30;
            G.shake = Math.max(G.shake, 8);
            Snd.crash();
            Player.hurt(14);
          }
        }
        c.speed *= 0.5;
      }
    }
  }

  function draw(ctx) {
    // police cars are drawn by Cars.draw; lightbar flash is in drawCar.
  }

  return { addWanted, update, draw, policeCars };
})();
