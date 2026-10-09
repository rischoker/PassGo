// ============================================================
// FX — lightweight particle engine (sparkles, magic dust,
// confetti, mist puffs, fireflies). One instance per canvas.
// Coordinates are CSS pixels relative to the canvas.
// The loop only runs while particles are alive.
// ============================================================
const REDUCED_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

class FX {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
    this.p = [];
    this.running = false;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(canvas);
    else window.addEventListener("resize", () => this.resize());
    this.sprites = FX.sprites || (FX.sprites = FX.makeSprites());
  }
  resize() {
    const r = this.c.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.c.width = Math.max(1, Math.round(r.width * this.dpr));
    this.c.height = Math.max(1, Math.round(r.height * this.dpr));
  }
  static makeSprites() {
    const mk = (size, draw) => { const c = document.createElement("canvas"); c.width = c.height = size; draw(c.getContext("2d"), size); return c; };
    const glow = (col) => mk(64, (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, col); gr.addColorStop(1, "rgba(255,200,80,0)");
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    });
    const star = (col) => mk(64, (g, s) => {
      const h = s / 2;
      const gr = g.createRadialGradient(h, h, 0, h, h, h);
      gr.addColorStop(0, "rgba(255,250,220,.9)"); gr.addColorStop(0.3, "rgba(255,210,110,.35)"); gr.addColorStop(1, "rgba(255,200,80,0)");
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
      g.fillStyle = col; g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, r = i % 2 === 0 ? h * 0.95 : h * 0.16;
        g.lineTo(h + Math.cos(a) * r, h + Math.sin(a) * r);
      }
      g.closePath(); g.fill();
    });
    const mist = mk(128, (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, "rgba(255,255,250,.75)"); gr.addColorStop(0.6, "rgba(245,245,240,.25)"); gr.addColorStop(1, "rgba(240,240,235,0)");
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    });
    return { glowGold: glow("rgba(255,205,90,.8)"), glowWarm: glow("rgba(255,170,70,.7)"), glowTeal: glow("rgba(120,230,220,.7)"),
             star: star("#fff6d8"), starGold: star("#ffd66b"), mist };
  }

  // ---------- emitters ----------
  add(o) {
    if (this.p.length > 600) return;
    this.p.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, drag: 0.985, life: 1, age: 0, size: 8, rot: 0, vr: 0,
      type: "glow", sprite: "glowGold", alpha: 1, fadeIn: 0.08, twinkle: 0, grow: 0 }, o));
    if (!this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame(t => this.tick(t)); }
  }
  sparkle(x, y, n = 14, spread = 60, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (0.3 + Math.random()) * spread;
      this.add(Object.assign({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, ay: 18, life: 0.7 + Math.random() * 0.8,
        size: 6 + Math.random() * 12, sprite: Math.random() < 0.5 ? "star" : "starGold", vr: (Math.random() - 0.5) * 4, twinkle: 12 }, opts));
    }
  }
  dust(x, y, n = 20, spread = 40, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = Math.random() * spread;
      this.add(Object.assign({ x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 15, ay: -6,
        life: 1 + Math.random() * 1.2, size: 3 + Math.random() * 6, sprite: "glowGold", twinkle: 6 }, opts));
    }
  }
  confetti(x, y, n = 40, spread = 220) {
    const cols = ["#D9A441", "#2F6B3C", "#1E7A93", "#C1443A", "#F3E5C0", "#f0c53a", "#39b3c4"];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, sp = spread * (0.4 + Math.random() * 0.8);
      this.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 260, drag: 0.97, life: 1.4 + Math.random() * 0.8,
        size: 5 + Math.random() * 5, type: "confetti", color: cols[i % cols.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, fadeIn: 0 });
    }
  }
  ink(x, y, n = 18, spread = 140, color = "#c8102e") {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = spread * (0.3 + Math.random() * 0.9);
      this.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, drag: 0.86, life: 0.9 + Math.random() * 0.6,
        size: 2 + Math.random() * 6, type: "ink", color, fadeIn: 0, alpha: 0.85 });
    }
  }
  mist(x, y, n = 6, size = 60, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.add(Object.assign({ x: x + Math.cos(a) * size * 0.3, y: y + Math.sin(a) * size * 0.3, vx: Math.cos(a) * 18, vy: Math.sin(a) * 12 - 6,
        life: 1.6 + Math.random(), size: size * (0.6 + Math.random() * 0.6), sprite: "mist", grow: 0.6, alpha: 0.8, drag: 0.99 }, opts));
    }
  }
  ring(x, y, r = 40, n = 24, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      this.add(Object.assign({ x: x + Math.cos(a) * r * 0.2, y: y + Math.sin(a) * r * 0.2, vx: Math.cos(a) * r * 2.2, vy: Math.sin(a) * r * 2.2,
        drag: 0.9, life: 0.7, size: 5 + Math.random() * 4, sprite: "glowGold" }, opts));
    }
  }

  // ---------- loop ----------
  tick(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const g = this.ctx, s = this.sprites;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    g.globalCompositeOperation = "lighter";
    for (let i = this.p.length - 1; i >= 0; i--) {
      const p = this.p[i];
      p.age += dt;
      if (p.age >= p.life) { this.p.splice(i, 1); continue; }
      p.vx += p.ax * dt; p.vy += p.ay * dt;
      p.vx *= p.drag; p.vy *= p.drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const k = p.age / p.life;
      let a = p.alpha * Math.min(1, p.fadeIn ? p.age / (p.life * p.fadeIn) : 1) * (1 - Math.pow(k, 2));
      if (p.twinkle) a *= 0.65 + 0.35 * Math.sin(p.age * p.twinkle + i);
      const size = p.size * (1 + p.grow * k);
      if (p.img) {
        // colourful silhouettes (animals) and other image sprites
        g.globalCompositeOperation = "source-over";
        const sy = p.flap ? 0.62 + 0.38 * Math.abs(Math.sin(p.age * p.flap)) : 1;
        const sw = p.wobble ? Math.sin(p.age * p.wobble) * 0.25 : 0;
        g.save(); g.globalAlpha = Math.max(0, a); g.translate(p.x, p.y); g.rotate(p.rot + sw);
        g.scale(p.face || 1, sy);
        const ar = p.img.height / p.img.width;
        g.drawImage(p.img, -size / 2, -size * ar / 2, size, size * ar);
        g.restore();
        g.globalCompositeOperation = "lighter";
      } else if (p.type === "ink") {
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = Math.max(0, a); g.fillStyle = p.color;
        g.beginPath(); g.arc(p.x, p.y, size / 2, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = "lighter";
      } else if (p.type === "confetti") {
        g.globalCompositeOperation = "source-over";
        g.save(); g.globalAlpha = Math.max(0, a); g.translate(p.x, p.y); g.rotate(p.rot);
        g.scale(1, Math.abs(Math.cos(p.rot * 1.7)) * 0.8 + 0.2);
        g.fillStyle = p.color; g.fillRect(-size / 2, -size / 3, size, size * 0.66); g.restore();
        g.globalCompositeOperation = "lighter";
      } else {
        const img = s[p.sprite];
        if (p.sprite === "mist") g.globalCompositeOperation = "source-over";
        g.globalAlpha = Math.max(0, a);
        if (p.vr) { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.drawImage(img, -size / 2, -size / 2, size, size); g.restore(); }
        else g.drawImage(img, p.x - size / 2, p.y - size / 2, size, size);
        if (p.sprite === "mist") g.globalCompositeOperation = "lighter";
      }
    }
    g.globalAlpha = 1;
    if (this.p.length) requestAnimationFrame(t => this.tick(t));
    else { this.running = false; g.clearRect(0, 0, this.w, this.h); }
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
