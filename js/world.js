// ============================================================
// WORLD — the living island: fog of discovery, gulls, fireflies.
// (Sea, foam, ship, clouds and leaves are pure CSS in world.css.)
//
// Fog logic: zone k = the area around mission k plus the road that
// leads to it from mission k-1. A zone is revealed when mission k is
// unlocked, so the student's learning progress literally uncovers
// the island.
// ============================================================
const WorldFX = (() => {
  // ---------- helpers ----------
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const ASPECT = WORLD.size[1] / WORLD.size[0];

  // tileable fractal value noise -> soft cloud texture
  function cloudTexture(size, seed, cell, tint) {
    const rand = mulberry32(seed);
    const octaves = 4, grids = [];
    for (let o = 0; o < octaves; o++) {
      const n = cell * Math.pow(2, o), g = [];
      for (let i = 0; i < n * n; i++) g.push(rand());
      grids.push({ n, g });
    }
    const c = document.createElement("canvas"); c.width = c.height = size;
    const ctx = c.getContext("2d"), img = ctx.createImageData(size, size), d = img.data;
    const smooth = t => t * t * (3 - 2 * t);
    const sample = (x, y) => {
      let v = 0, amp = 1, tot = 0;
      for (const { n, g } of grids) {
        const fx = x / size * n, fy = y / size * n;
        const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = smooth(fx - x0), ty = smooth(fy - y0);
        const at = (i, j) => g[((j % n + n) % n) * n + ((i % n + n) % n)];
        const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
        const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
        v += (a + (b - a) * ty) * amp; tot += amp; amp *= 0.5;
      }
      return v / tot;
    };
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const v = sample(x, y), lit = sample(x - 3, y - 3) - v; // fake light from top-left
      const cloud = clamp01((v - 0.32) / 0.4);
      const shade = clamp01(0.5 + lit * 5);
      const i = (y * size + x) * 4;
      d[i] = tint[0] - 46 * (1 - shade); d[i + 1] = tint[1] - 36 * (1 - shade); d[i + 2] = tint[2] - 18 * (1 - shade);
      d[i + 3] = 255 * (tint[3] + (1 - tint[3]) * cloud);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---------- FOG ----------
  class Fog {
    constructor(canvas, densitySrc) {
      this.c = canvas; this.g = canvas.getContext("2d");
      this.W = 420; this.H = Math.round(420 * ASPECT);
      canvas.width = this.W; canvas.height = this.H;
      this.holes = document.createElement("canvas"); this.holes.width = this.W; this.holes.height = this.H;
      this.hg = this.holes.getContext("2d");
      this.texA = cloudTexture(160, 7, 3, [246, 245, 238, 0.58]);
      this.texB = cloudTexture(128, 21, 2, [255, 254, 248, 0.0]);
      this.patA = this.g.createPattern(this.texA, "repeat");
      this.patB = this.g.createPattern(this.texB, "repeat");
      this.density = new Image(); this.density.src = densitySrc;
      this.zones = {};        // k -> { blobs, p }
      this.opacity = 1;
      this.t0 = performance.now();
      this.frame = this.frame.bind(this);
      requestAnimationFrame(this.frame);
    }
    buildZone(k) {
      const rand = mulberry32(k * 7919 + 13), blobs = [], W = this.W, H = this.H;
      const n = WORLD.nodes[k - 1], s = WORLD.stand[k - 1];
      const px = (l, t) => [l / 100 * W, t / 100 * H];
      const route = k > 1 ? WORLD.routes[k - 2] : null;
      if (route) { // corridor along the street from the previous unit
        let acc = 0; const L = [];
        for (let i = 1; i < route.length; i++) { const [a, b] = [px(...route[i - 1]), px(...route[i])]; acc += Math.hypot(b[0] - a[0], b[1] - a[1]); L.push(acc); }
        const total = acc || 1; let next = 0;
        for (let i = 1; i < route.length; i++) {
          if (L[i - 1] >= next) {
            const [x, y] = px(...route[i]);
            blobs.push({ x: x + (rand() - .5) * 6, y: y + (rand() - .5) * 6, r: W * (0.04 + rand() * 0.02), t: L[i - 1] / total, kind: "road" });
            next += W * 0.02;
          }
        }
      }
      const pts = [px(...n.icon), px(n.sign[0] + n.sign[2] / 2, n.sign[1] + n.sign[3] / 2), px(...n.home), px(s.left, s.top)];
      pts.forEach(([x, y], i) => blobs.push({ x, y, r: W * (i === 2 ? 0.11 : 0.085), t: i * 0.08, kind: "zone" }));
      const [hx, hy] = pts[2], [sx, sy] = pts[1];
      for (let i = 0; i < 8; i++) {
        const f = rand(), a = rand() * Math.PI * 2, d = W * (0.03 + rand() * 0.05);
        blobs.push({ x: hx + (sx - hx) * f + Math.cos(a) * d, y: hy + (sy - hy) * f + Math.sin(a) * d, r: W * (0.05 + rand() * 0.04), t: rand() * 0.6, kind: "zone" });
      }
      return blobs;
    }
    set(k, p) {
      if (!this.zones[k]) this.zones[k] = { blobs: this.buildZone(k), p: 0 };
      this.zones[k].p = p; this.drawHoles();
    }
    revealed(k) { return this.zones[k] && this.zones[k].p >= 1; }
    // road blobs follow `p` (Nico's walk); zone blobs bloom in the last 40%
    drawHoles() {
      const g = this.hg; g.clearRect(0, 0, this.W, this.H);
      for (const k in this.zones) {
        const { blobs, p } = this.zones[k];
        for (const b of blobs) {
          const s = b.kind === "road" ? clamp01((p - b.t * 0.8) / 0.2) : clamp01((p - 0.6 - b.t * 0.15) / 0.3);
          if (s <= 0) continue;
          const r = b.r * easeOut(s);
          const gr = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
          gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.55, "rgba(0,0,0,.95)"); gr.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.fill();
        }
      }
    }
    // animate a zone from 0 -> 1 (or drive it externally with set())
    reveal(k, ms = 1800) {
      return new Promise(res => {
        const start = performance.now(), from = this.zones[k] ? this.zones[k].p : 0;
        const step = now => {
          const t = clamp01((now - start) / ms);
          this.set(k, from + (1 - from) * t);
          if (t < 1) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
      });
    }
    clearAll(ms = 2600) {
      return new Promise(res => {
        const start = performance.now();
        const step = now => { const t = clamp01((now - start) / ms); this.opacity = 1 - easeOut(t); if (t < 1) requestAnimationFrame(step); else res(); };
        requestAnimationFrame(step);
      });
    }
    frame(now) {
      // ~30 fps is plenty for slow drifting mist
      if (!this._last || now - this._last > 33) {
        this._last = now;
        const g = this.g, t = (now - this.t0) / 1000;
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = 1;
        g.clearRect(0, 0, this.W, this.H);
        if (this.opacity > 0.001) {
          const drift = REDUCED_MOTION ? 0 : t;
          this.patA.setTransform(new DOMMatrix().translate(drift * 2.2, drift * 0.7).scale(1.7));
          g.fillStyle = this.patA; g.fillRect(0, 0, this.W, this.H);
          this.patB.setTransform(new DOMMatrix().translate(-drift * 3.4, drift * 1.3).scale(1.35));
          g.globalAlpha = 0.8; g.fillStyle = this.patB; g.fillRect(0, 0, this.W, this.H);
          g.globalAlpha = 1;
          // fog lives inside the parchment frame and is thinner over water
          if (this.density.complete && this.density.naturalWidth) { g.globalCompositeOperation = "destination-in"; g.drawImage(this.density, 0, 0, this.W, this.H); }
          g.globalCompositeOperation = "destination-out";
          g.drawImage(this.holes, 0, 0);
          this.c.style.opacity = this.opacity;
        } else this.c.style.opacity = 0;
      }
      requestAnimationFrame(this.frame);
    }
  }

  // ---------- GULLS (occasional, small, background) ----------
  function startGulls(layer) {
    if (REDUCED_MOTION) return;
    const svg = `<svg viewBox="0 0 26 10"><path d="M1 7 Q7 0 13 6 Q19 0 25 7" /></svg>`;
    function flock() {
      const n = 1 + Math.floor(Math.random() * 3);
      const lane = Math.random() < 0.5 ? 6 + Math.random() * 6 : 82 + Math.random() * 8; // sky over the mountains, or over the bay
      const dur = 22 + Math.random() * 10;
      for (let i = 0; i < n; i++) {
        const g = document.createElement("div");
        g.className = "gull";
        g.innerHTML = svg;
        g.style.top = (lane + (Math.random() - .5) * 4) + "%";
        g.style.setProperty("--dur", dur + i * 0.6 + "s");
        g.style.setProperty("--delay", i * 0.7 + Math.random() * 0.5 + "s");
        g.style.setProperty("--size", (1.6 + Math.random() * 0.8) + "%");
        g.style.setProperty("--flap", (0.45 + Math.random() * 0.2) + "s");
        layer.appendChild(g);
        setTimeout(() => g.remove(), (dur + 4) * 1000);
      }
      setTimeout(flock, (18 + Math.random() * 22) * 1000);
    }
    setTimeout(flock, 6000);
  }

  // ---------- FIREFLIES / POLLEN in explored areas ----------
  function startMotes(fx, worldEl, revealedIds) {
    if (REDUCED_MOTION) return;
    setInterval(() => {
      if (document.hidden) return;
      const ids = revealedIds(); if (!ids.length) return;
      const n = WORLD.nodes[ids[Math.floor(Math.random() * ids.length)] - 1];
      const r = worldEl.getBoundingClientRect();
      const x = (n.home[0] + (Math.random() - .5) * 16) / 100 * r.width;
      const y = (n.home[1] + (Math.random() - .5) * 14) / 100 * r.height;
      fx.add({ x, y, vx: (Math.random() - .5) * 8, vy: -4 - Math.random() * 6, drag: 1, life: 3 + Math.random() * 2, size: 4 + Math.random() * 4,
        sprite: Math.random() < 0.3 ? "glowTeal" : "glowWarm", alpha: 0.55, twinkle: 3, fadeIn: 0.3 });
    }, 900);
  }

  return { Fog, startGulls, startMotes };
})();
