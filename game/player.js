// Bandar Pelita — the player: Raka, ex-kurir. On foot and behind the wheel.
const Player = (() => {
  function create(x, y) {
    return {
      x, y, angle: -Math.PI / 2,
      speed: 0,
      health: 100,
      maxHealth: 100,
      inCar: null,
      punchCd: 0,
      hurtCd: 0,
      walkPhase: 0,
    };
  }

  function update(dt) {
    const p = G.player;
    if (!p) return;
    p.punchCd = Math.max(0, p.punchCd - dt);
    p.hurtCd = Math.max(0, p.hurtCd - dt);
    // slow health regen when calm
    if (G.wanted === 0 && p.health > 0) p.health = Math.min(p.maxHealth, p.health + 2.5 * dt);

    if (p.inCar) {
      const car = p.inCar;
      let throttle = 0, steer = 0;
      if (G.keys['KeyW'] || G.keys['ArrowUp']) throttle = 1;
      if (G.keys['KeyS'] || G.keys['ArrowDown']) throttle = -1;
      if (G.keys['KeyA'] || G.keys['ArrowLeft']) steer = -1;
      if (G.keys['KeyD'] || G.keys['ArrowRight']) steer = 1;
      Cars.drive(car, throttle, steer, dt);
      p.x = car.x; p.y = car.y; p.angle = car.angle;
      Snd.engine(Math.abs(car.speed) / car.maxSpeed);
      if (G.keys['KeyE']) { exitCar(); G.keys['KeyE'] = false; }
      return;
    }
    Snd.engine(0);
    // on foot
    let mx = 0, my = 0;
    if (G.keys['KeyW'] || G.keys['ArrowUp']) my -= 1;
    if (G.keys['KeyS'] || G.keys['ArrowDown']) my += 1;
    if (G.keys['KeyA'] || G.keys['ArrowLeft']) mx -= 1;
    if (G.keys['KeyD'] || G.keys['ArrowRight']) mx += 1;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      mx /= len; my /= len;
      p.angle = Math.atan2(my, mx);
      p.walkPhase += dt * 10;
      const nx = p.x + mx * 230 * dt;
      const ny = p.y + my * 230 * dt;
      if (!City.hitBuilding(nx, p.y, 12) && !City.inWater(nx, p.y)) p.x = nx;
      if (!City.hitBuilding(p.x, ny, 12) && !City.inWater(p.x, ny)) p.y = ny;
      p.x = clamp(p.x, 20, G.W - 20);
      p.y = clamp(p.y, 20, G.H - 20);
    }
    if (G.keys['KeyE']) { tryEnterCar(); G.keys['KeyE'] = false; }
    if (G.keys['KeyF'] && p.punchCd <= 0) { punch(); }
  }

  function tryEnterCar() {
    const p = G.player;
    const car = Cars.nearest(p.x, p.y, 60, c => c.ai !== 'police');
    if (!car) return;
    if (car.driver === 'npc') {
      // stealing a driven car
      car.driver = 'player';
      Police.addWanted(1);
      Hud.toast('Mobil dicuri! Wanted +1');
      Snd.thud();
    } else if (car.driver === null) {
      // parked car — stealing if anyone is watching
      car.driver = 'player';
      const witness = G.peds.some(pd => dist(pd.x, pd.y, p.x, p.y) < 260) ||
        Police.policeCars().some(c => dist(c.x, c.y, p.x, p.y) < 420);
      if (witness) { Police.addWanted(1); Hud.toast('Ada yang melihat! Wanted +1'); }
      else Hud.toast('Mobil diambil diam-diam');
    }
    p.inCar = car;
    car.ai = null;
    Snd.blip();
    Missions.onEnterCar(car);
  }

  function exitCar() {
    const p = G.player;
    if (!p.inCar) return;
    const car = p.inCar;
    car.driver = null;
    car.ai = null;
    car.speed = 0;
    p.inCar = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    if (City.hitBuilding(p.x, p.y, 12)) { p.x = car.x - Math.cos(car.angle + Math.PI / 2) * 34; p.y = car.y - Math.sin(car.angle + Math.PI / 2) * 34; }
    Snd.engine(0);
  }

  function punch() {
    const p = G.player;
    p.punchCd = 0.45;
    Snd.thud();
    // hit the nearest pedestrian in front
    let best = null, bd = 52;
    for (const pd of G.peds) {
      const d = dist(p.x, p.y, pd.x, pd.y);
      if (d < bd) { bd = d; best = pd; }
    }
    if (best) {
      best.angle = angTo(p.x, p.y, best.x, best.y);
      best.flee = 2.2;
      Traffic.fleeFrom(p.x, p.y, 180);
      const seen = Police.policeCars().some(c => dist(c.x, c.y, p.x, p.y) < 380);
      if (seen) { Police.addWanted(1); Hud.toast('Polisi melihat pemukulan! Wanted +1'); }
      else Hud.toast('Kamu memukul pejalan kaki!');
    }
  }

  function hurt(dmg) {
    const p = G.player;
    if (!p || p.hurtCd > 0 || p.health <= 0) return;
    p.health -= dmg;
    p.hurtCd = 0.35;
    G.shake = Math.max(G.shake, 5);
    if (p.health <= 0) {
      p.health = 0;
      gameOver('Raka tumbang. Bandar Pelita memang keras.');
    }
  }

  function busted() {
    const p = G.player;
    if (p.inCar) exitCar();
    gameOver('Tertangkap polisi! Misi gagal.');
    Snd.fail();
  }

  function gameOver(reason) {
    if (G.state !== 'playing') return;
    G.state = 'over';
    G.overReason = reason;
    Snd.engineStop();
    Snd.siren(false);
    Snd.fail();
    save();
  }

  function save() {
    try {
      localStorage.setItem('bandar-pelita-save', JSON.stringify({
        cash: G.cash, missionIndex: G.missionIndex,
        x: G.player ? G.player.x : 1400, y: G.player ? G.player.y : 1200,
      }));
    } catch (e) { /* storage unavailable */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem('bandar-pelita-save');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function draw(ctx) {
    const p = G.player;
    if (!p) return;
    if (p.inCar) return; // the car is drawn by Cars.draw
    // draw the player on foot
    const bob = Math.sin(p.walkPhase) * 2;
    A.drawPerson(ctx, p.x, p.y + bob * 0.3, p.angle, PAL.player);
    // punch swing
    if (p.punchCd > 0.25) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26, p.angle - 0.6, p.angle + 0.6);
      ctx.stroke();
    }
    // low health pulse
    if (p.health < 30) {
      ctx.strokeStyle = 'rgba(255,60,60,' + (0.4 + 0.3 * Math.sin(G.time * 6)) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, TAU); ctx.stroke();
    }
  }

  return { create, update, hurt, busted, gameOver, save, load, draw, exitCar };
})();
