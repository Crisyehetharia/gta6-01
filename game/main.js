// Bandar Pelita — game loop, input, camera, save, and screenshot staging.
const Game = (() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let last = 0;
  let firstFrame = false;

  function bindInput() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      G.keys[e.code] = true;
      if (e.code === 'KeyP') {
        if (G.state === 'playing') G.state = 'paused';
        else if (G.state === 'paused') G.state = 'playing';
      }
      if (e.code === 'KeyM') { G.muted = !G.muted; Hud.toast(G.muted ? 'Suara mati' : 'Suara hidup'); }
      if (e.code === 'Enter' && G.state === 'playing' && !G.mission && G.missionIndex < Missions.list.length) {
        Missions.start(G.missionIndex);
      }
      if (e.code === 'Space' && G.state === 'menu') startGame();
    });
    canvas.addEventListener('click', () => {
      Snd.init();
      if (G.state === 'menu') startGame();
      else if (G.state === 'paused') G.state = 'playing';
      else if (G.state === 'over') reset();
      else if (G.state === 'win') { G.state = 'playing'; }
    });
  }

  function startGame() {
    Snd.init();
    G.state = 'playing';
    if (!G.mission && G.missionIndex < Missions.list.length) Missions.start(G.missionIndex);
  }

  function reset() {
    const p = G.player;
    p.health = p.maxHealth;
    p.x = 1400; p.y = 1350; p.angle = -Math.PI / 2;
    if (p.inCar) { p.inCar.driver = null; p.inCar.ai = null; p.inCar = null; }
    G.wanted = 0; G.wantDecay = 0;
    G.cars = G.cars.filter(c => c.ai !== 'police');
    G.mission = null;
    G.state = 'playing';
    Missions.start(G.missionIndex);
  }

  function stageShot(name) {
    const p = G.player;
    G.state = 'playing';
    if (name === 'chase') {
      // police chase: player speeding north on the main road, 3 cops behind
      const car = Cars.make(1600, 1500, -Math.PI / 2, '#c0392b', { driver: 'player', maxSpeed: 430 });
      p.inCar = car; p.x = car.x; p.y = car.y; p.angle = car.angle;
      car.speed = 320;
      Missions.start(2);
      G.wanted = 3;
      const spots = [[1552, 1760], [1648, 1820], [1600, 1920]];
      for (const [x, y] of spots) {
        const cop = Cars.make(x, y, -Math.PI / 2, PAL.police, { ai: 'police', driver: 'npc', police: true, maxSpeed: 470, accel: 330 });
        cop.speed = 380;
      }
    } else if (name === 'drive') {
      const car = Cars.make(1200, 1200, 0, '#2980b9', { driver: 'player', maxSpeed: 420 });
      p.inCar = car; p.x = car.x; p.y = car.y; p.angle = car.angle;
      car.speed = 210;
      // traffic sharing the same road so the shot reads as city driving
      const t1 = Cars.make(1560, 1172, 0, '#e67e22', { ai: 'traffic', driver: 'npc', maxSpeed: 190, accel: 160 });
      t1.cruise = 150; t1.turnCd = 3;
      const t2 = Cars.make(900, 1228, Math.PI, '#2ecc71', { ai: 'traffic', driver: 'npc', maxSpeed: 190, accel: 160 });
      t2.cruise = 130; t2.turnCd = 3;
      const t3 = Cars.make(1980, 1228, Math.PI, '#9b59b6', { ai: 'traffic', driver: 'npc', maxSpeed: 190, accel: 160 });
      t3.cruise = 140; t3.turnCd = 3;
      Missions.start(0);
    } else if (name === 'steal') {
      Missions.start(1);
      p.x = 1300; p.y = 1150; p.angle = 0;
      // a couple of onlookers near the marked sedan
      G.peds.push({ x: 1330, y: 1090, angle: Math.PI, speed: 30, color: '#f1c40f', tx: 1330, ty: 1090, wait: 2, flee: 0, dead: false });
      G.peds.push({ x: 1180, y: 1230, angle: 0, speed: 30, color: '#2ecc71', tx: 1180, ty: 1230, wait: 2, flee: 0, dead: false });
    } else if (name === 'combat') {
      p.x = 1400; p.y = 1200; p.angle = 0;
      G.peds.push({ x: 1436, y: 1200, angle: Math.PI, speed: 30, color: '#e74c3c', tx: 1436, ty: 1200, wait: 2, flee: 0, dead: false });
      G.wanted = 1;
      const cop = Cars.make(2100, 1200, Math.PI, PAL.police, { ai: 'police', driver: 'npc', police: true, maxSpeed: 470, accel: 330 });
      cop.speed = 120;
      Missions.start(0);
      Hud.toast('Pukul pejalan kaki dengan F!');
    }
  }

  function updateCamera() {
    const p = G.player;
    G.cam.x = clamp(p.x - 640, 0, G.W - 1280);
    G.cam.y = clamp(p.y - 360, 0, G.H - 720);
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    G.time += dt;
    if (G.state === 'playing') {
      Player.update(dt);
      Traffic.update(dt);
      Police.update(dt);
      Missions.update(dt);
      Cars.collideCars(dt);
      updateCamera();
    }
    draw();
    if (!firstFrame) { firstFrame = true; window.__ready = true; }
  }

  function draw() {
    ctx.clearRect(0, 0, 1280, 720);
    const shx = (Math.random() - 0.5) * G.shake;
    const shy = (Math.random() - 0.5) * G.shake;
    G.shake = Math.max(0, G.shake - 0.8);
    ctx.save();
    ctx.translate(-G.cam.x + shx, -G.cam.y + shy);
    City.drawGround(ctx, G.cam);
    Cars.draw(ctx);
    Traffic.draw(ctx);
    Player.draw(ctx);
    ctx.restore();
    Hud.drawWaypoint(ctx);
    Hud.draw(ctx);
  }

  function init() {
    const params = new URLSearchParams(location.search);
    G.shot = params.get('shot');
    G.seed = parseInt(params.get('seed') || '1', 10);
    const rng = mulberry32(20261121);
    G.player = Player.create(1400, 1350);
    Cars.spawnParked(rng, 14);
    Traffic.init(rng);
    bindInput();
    const save = Player.load();
    if (save) {
      G.cash = save.cash || 0;
      G.missionIndex = clamp(save.missionIndex || 0, 0, 2);
    }
    updateCamera();
    if (G.shot) stageShot(G.shot);
    requestAnimationFrame(loop);
  }

  return { init, stageShot, reset, startGame };
})();

Game.init();
window.GAME = Game;
