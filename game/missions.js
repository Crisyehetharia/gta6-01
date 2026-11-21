// Bandar Pelita — story missions for Raka and Bu Sari.
const Missions = (() => {
  const list = [
    {
      id: 'paket',
      title: 'Misi 1 — Paket Kilat',
      desc: 'Bu Sari: "Antar paket ini ke Mercusuar sebelum 90 detik. Jangan sampai basah!"',
      target: { x: 3120, y: 2050, label: 'Mercusuar' },
      time: 90, reward: 500,
    },
    {
      id: 'tarik',
      title: 'Misi 2 — Tarik Mobil',
      desc: 'Bu Sari: "Sedan biru di dekat pasar itu milik rentenir. Ambil, antar ke Bengkel Pelita."',
      target: { x: 300, y: 2100, label: 'Bengkel Pelita' },
      time: 0, reward: 800,
      needsCar: true,
    },
    {
      id: 'razia',
      title: 'Misi 3 — Kabur dari Razia',
      desc: 'Razia besar! Wanted 3 bintang. Kabur ke Gubuk Nelayan tanpa tertangkap.',
      target: { x: 2700, y: 300, label: 'Gubuk Nelayan' },
      time: 120, reward: 1500,
    },
  ];
  let targetCar = null;

  function start(i) {
    const m = list[i];
    if (!m) { G.mission = null; return; }
    G.missionIndex = i;
    G.mission = {
      def: m, t: m.time, done: false,
      stage: m.needsCar ? 'steal' : 'go',
    };
    if (m.id === 'tarik') {
      // mark a parked sedan near the market as the target
      const rng = mulberry32(77 + i);
      targetCar = Cars.make(1240, 1150, Math.PI / 2, '#2980b9', { driver: null, type: 'sedan' });
      targetCar.marked = true;
      Hud.toast('Sedan biru sudah ditandai di peta!');
    }
    if (m.id === 'razia') {
      Police.addWanted(3);
      Hud.toast('RAZIA! Kabur ke Gubuk Nelayan!');
    }
    Hud.toast(m.title);
    Snd.blip();
  }

  function onEnterCar(car) {
    if (!G.mission) return;
    if (G.mission.def.id === 'tarik' && car === targetCar) {
      G.mission.stage = 'deliver';
      Hud.toast('Sedan didapat! Antar ke Bengkel Pelita.');
      Snd.pickup();
    }
  }

  function update(dt) {
    const m = G.mission;
    if (!m || G.state !== 'playing') return;
    if (m.t > 0) {
      m.t -= dt;
      if (m.t <= 0) {
        Hud.toast('Waktu habis! Misi gagal.');
        Snd.fail();
        G.mission = null;
        G.state = 'over';
        G.overReason = 'Waktu misi habis. Bu Sari kecewa.';
        Player.save();
        return;
      }
    }
    const p = G.player;
    if (!p) return;
    const tx = m.def.target.x, ty = m.def.target.y;
    const d = dist(p.x, p.y, tx, ty);
    if (m.def.id === 'tarik' && m.stage === 'steal') return; // must steal the car first
    if (m.def.id === 'tarik' && m.stage === 'deliver' && !p.inCar) return; // must arrive driving
    if (d < 70) complete();
  }

  function complete() {
    const m = G.mission;
    if (!m) return;
    G.cash += m.def.reward;
    Snd.jingle();
    Hud.toast(m.def.title + ' SELESAI! +$' + m.def.reward);
    if (targetCar) { targetCar.marked = false; targetCar = null; }
    G.mission = null;
    G.missionIndex += 1;
    Player.save();
    if (G.missionIndex >= list.length) {
      G.state = 'win';
      Snd.engineStop(); Snd.siren(false);
      return;
    }
    setTimeout(() => { if (G.state === 'playing') start(G.missionIndex); }, 1200);
  }

  function objectiveText() {
    const m = G.mission;
    if (!m) {
      if (G.missionIndex >= list.length) return 'Semua misi selesai! Jelajahi Bandar Pelita.';
      return 'Tekan Enter untuk mulai misi berikutnya.';
    }
    let extra = '';
    if (m.def.id === 'tarik') extra = m.stage === 'steal' ? ' (curi sedan biru dulu)' : ' (antar ke bengkel)';
    let timer = '';
    if (m.t > 0) timer = ' — ' + Math.ceil(m.t) + ' dtk';
    return m.def.title + extra + timer;
  }

  function targetPos() {
    const m = G.mission;
    if (!m) return null;
    if (m.def.id === 'tarik' && m.stage === 'steal' && targetCar) return { x: targetCar.x, y: targetCar.y };
    return m.def.target;
  }

  return { list, start, onEnterCar, update, complete, objectiveText, targetPos };
})();
