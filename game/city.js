// Bandar Pelita — city map: roads, buildings, harbour, zones. Original layout.
// World 3200x2400. Roads on a 400px grid. Water strip on the east edge (x > 3000).

const City = (() => {
  const W = G.W, H = G.H;
  const ROAD_W = 130;
  const vRoads = [400, 800, 1200, 1600, 2000, 2400, 2800];
  const hRoads = [400, 800, 1200, 1600, 2000];

  const zones = {
    market: { x: 1400, y: 1200, label: 'Pasar Malam Pelita' },
    park: { x: 300, y: 300, label: 'Taman Pelita' },
    garage: { x: 300, y: 2100, label: 'Bengkel Pelita' },
    safehouse: { x: 2700, y: 300, label: 'Gubuk Nelayan' },
    lighthouse: { x: 3120, y: 2050, label: 'Mercusuar' },
    pier: { x: 3050, y: 2050 },
    harbour: { x: 3100, y: 1200, label: 'Pelabuhan' },
  };

  // Blocks that stay open (no buildings): park, market, garage, safehouse.
  const openBlocks = new Set(['0,0', '3,2', '0,4', '6,0']);

  const buildings = [];
  {
    const rng = mulberry32(20261121);
    const cols = ['#6b5b8f', '#8f6b5b', '#5b8f7a', '#7a5b8f', '#8f8f5b', '#5b7a8f', '#96606a'];
    const roofs = ['#4a3f66', '#664a3f', '#3f664f', '#553f66', '#66663f', '#3f5566', '#6b4248'];
    for (let bx = 0; bx < 7; bx++) {
      for (let by = 0; by < 5; by++) {
        if (openBlocks.has(bx + ',' + by)) continue;
        const x0 = vRoads[bx] + ROAD_W / 2 + 12;
        const y0 = hRoads[by] + ROAD_W / 2 + 12;
        const x1 = (bx < 6 ? vRoads[bx + 1] : 3000) - ROAD_W / 2 - 12;
        const y1 = (by < 4 ? hRoads[by + 1] : 2400) - ROAD_W / 2 - 12;
        const bw = x1 - x0, bh = y1 - y0;
        if (bw < 60 || bh < 60) continue;
        const big = rng() < 0.3;
        if (big) {
          const c = Math.floor(rng() * cols.length);
          buildings.push({ x: x0 + 14, y: y0 + 14, w: bw - 28, h: bh - 28, color: cols[c], roof: roofs[c] });
        } else {
          const hw = bw / 2, hh = bh / 2;
          for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
              if (rng() < 0.15) continue;
              const c = Math.floor(rng() * cols.length);
              buildings.push({
                x: x0 + i * hw + 8, y: y0 + j * hh + 8,
                w: hw - 16, h: hh - 16, color: cols[c], roof: roofs[c],
              });
            }
          }
        }
      }
    }
    // Harbour warehouses along the east road.
    buildings.push({ x: 2830, y: 500, w: 120, h: 90, color: '#5b6b8f', roof: '#3f4a66', label: 'GUDANG' });
    buildings.push({ x: 2830, y: 1500, w: 120, h: 90, color: '#6b5b6b', roof: '#4a3f3f', label: 'GUDANG' });
  }

  function onRoad(x, y) {
    for (const rx of vRoads) if (Math.abs(x - rx) <= ROAD_W / 2 + 6) return true;
    for (const ry of hRoads) if (Math.abs(y - ry) <= ROAD_W / 2 + 6) return true;
    return false;
  }
  function inWater(x, y) {
    if (x < 3000) return false;
    // Pier is walkable/drivable planks.
    if (x >= 3030 && x <= 3200 && Math.abs(y - 2050) <= 60) return false;
    return true;
  }
  function hitBuilding(x, y, r) {
    for (const b of buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    }
    return null;
  }
  // Push a circle out of a building AABB; returns true if a push happened.
  function resolveCircle(p, r) {
    const b = hitBuilding(p.x, p.y, r);
    if (!b) return false;
    const cx = clamp(p.x, b.x, b.x + b.w);
    const cy = clamp(p.y, b.y, b.y + b.h);
    let dx = p.x - cx, dy = p.y - cy;
    const d = Math.hypot(dx, dy);
    if (d === 0) { p.y = b.y - r - 0.5; return true; }
    p.x = cx + (dx / d) * r;
    p.y = cy + (dy / d) * r;
    return true;
  }
  function roadPoint(rng) {
    const vertical = rng() < 0.5;
    if (vertical) {
      const rx = vRoads[Math.floor(rng() * vRoads.length)];
      return { x: rx + (rng() < 0.5 ? -28 : 28), y: 100 + rng() * 2200 };
    }
    const ry = hRoads[Math.floor(rng() * hRoads.length)];
    return { x: 100 + rng() * 2800, y: ry + (rng() < 0.5 ? -28 : 28) };
  }
  function drawGround(ctx, cam) {
    // base ground
    ctx.fillStyle = PAL.ground;
    ctx.fillRect(cam.x, cam.y, 1280, 720);
    // subtle block tint
    ctx.fillStyle = PAL.ground2;
    for (let bx = 0; bx < 7; bx++) {
      for (let by = 0; by < 5; by++) {
        if ((bx + by) % 2 === 0) {
          const x0 = vRoads[bx] + ROAD_W / 2, y0 = hRoads[by] + ROAD_W / 2;
          const x1 = (bx < 6 ? vRoads[bx + 1] : 3000) - ROAD_W / 2;
          const y1 = (by < 4 ? hRoads[by + 1] : 2400) - ROAD_W / 2;
          ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        }
      }
    }
    // water (east strip)
    ctx.fillStyle = PAL.water;
    ctx.fillRect(3000, 0, 200, 2400);
    ctx.strokeStyle = PAL.water2; ctx.lineWidth = 3;
    for (let y = 60; y < 2400; y += 120) {
      ctx.beginPath();
      ctx.moveTo(3030, y); ctx.quadraticCurveTo(3080, y + 14, 3130, y);
      ctx.quadraticCurveTo(3170, y + 14, 3195, y);
      ctx.stroke();
    }
    // park
    ctx.fillStyle = PAL.park;
    ctx.fillRect(200, 200, 260, 260);
    ctx.fillStyle = PAL.park2;
    ctx.beginPath(); ctx.arc(300, 300, 70, 0, TAU); ctx.fill();
    // market square
    ctx.fillStyle = PAL.market;
    ctx.fillRect(1265, 1065, 270, 270);
    // stalls
    const stallColors = ['#e74c3c', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22'];
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = stallColors[i];
      const sx = 1290 + (i % 3) * 80, sy = 1090 + Math.floor(i / 3) * 110;
      ctx.fillRect(sx, sy, 56, 40);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(sx, sy, 56, 8);
    }
    // garage apron + safehouse yard
    ctx.fillStyle = '#3f4a3a';
    ctx.fillRect(200, 2000, 260, 260);
    ctx.fillStyle = '#4a5a6b';
    ctx.fillRect(2580, 200, 240, 200);
    // pier
    ctx.fillStyle = PAL.pier;
    ctx.fillRect(3000, 1990, 200, 120);
    ctx.fillStyle = PAL.pier2;
    for (let x = 3010; x < 3200; x += 24) ctx.fillRect(x, 1990, 4, 120);
    // lighthouse
    ctx.fillStyle = '#e8e0cc';
    ctx.beginPath(); ctx.arc(3120, 2050, 26, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.arc(3120, 2050, 18, 0, TAU); ctx.fill();
    // rotating beam
    const beam = G.time * 0.9;
    ctx.save();
    ctx.translate(3120, 2050); ctx.rotate(beam);
    const grad = ctx.createLinearGradient(0, 0, 420, 0);
    grad.addColorStop(0, 'rgba(255,240,180,0.55)');
    grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(420, -26); ctx.lineTo(420, 26); ctx.closePath(); ctx.fill();
    ctx.restore();
    // roads
    for (const rx of vRoads) {
      ctx.fillStyle = PAL.road;
      ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, 2400);
    }
    for (const ry of hRoads) {
      ctx.fillStyle = PAL.road;
      ctx.fillRect(0, ry - ROAD_W / 2, 3000, ROAD_W);
    }
    // lane dashes
    ctx.fillStyle = PAL.lane;
    for (const rx of vRoads) {
      for (let y = 20; y < 2400; y += 70) ctx.fillRect(rx - 2, y, 4, 34);
    }
    for (const ry of hRoads) {
      for (let x = 20; x < 3000; x += 70) ctx.fillRect(x, ry - 2, 34, 4);
    }
    // road edges
    ctx.strokeStyle = PAL.roadEdge; ctx.lineWidth = 2;
    for (const rx of vRoads) {
      ctx.beginPath(); ctx.moveTo(rx - ROAD_W / 2, 0); ctx.lineTo(rx - ROAD_W / 2, 2400); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rx + ROAD_W / 2, 0); ctx.lineTo(rx + ROAD_W / 2, 2400); ctx.stroke();
    }
    // labels
    ctx.fillStyle = 'rgba(255,233,168,0.9)';
    ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Pasar Malam Pelita', 1400, 1345);
    ctx.fillText('Taman Pelita', 300, 475);
    ctx.fillText('Bengkel Pelita', 330, 2275);
    ctx.fillText('Gubuk Nelayan', 2700, 415);
    ctx.fillText('Pelabuhan', 3100, 1180);
    ctx.fillText('Mercusuar', 3120, 1960);
    // buildings
    for (const b of buildings) A.drawBuilding(ctx, b);
    // lantern glow dots along main road
    ctx.fillStyle = PAL.lantern;
    for (let y = 100; y < 2400; y += 200) {
      ctx.beginPath(); ctx.arc(1600 - ROAD_W / 2 - 8, y, 5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(1600 + ROAD_W / 2 + 8, y, 5, 0, TAU); ctx.fill();
    }
  }

  return { W, H, vRoads, hRoads, zones, buildings, onRoad, inWater, hitBuilding, resolveCircle, roadPoint, drawGround };
})();
