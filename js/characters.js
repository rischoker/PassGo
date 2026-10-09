// ============================================================
// CHARACTERS — spritesheet animation + the explorer team on the map.
//   SpriteView : draws one animated sprite (idle / walk / jump / cheer)
//                inside any element, at any size (CSS background sheet).
//   Explorer   : Nico or Massie walking the city streets.
//   Bird       : Luma or Luna, independent companion that flies around.
// Sheets come from tools/build_characters.py (js/char-data.js).
// ============================================================

// ---------- one shared animation clock ----------
const SpriteClock = (() => {
  const views = new Set();
  let running = false;
  function loop(now) {
    views.forEach(v => v.tick(now));
    if (views.size) requestAnimationFrame(loop); else running = false;
  }
  return {
    add(v) { views.add(v); if (!running) { running = true; requestAnimationFrame(loop); } },
    remove(v) { views.delete(v); }
  };
})();

class SpriteView {
  // el: element that will show the sprite (its height decides the size)
  constructor(el, charName, anim = "idle") {
    this.el = el; this.sheet = CHAR_SHEETS[charName]; this.name = charName;
    el.classList.add("sprite");
    el.style.backgroundImage = `url("${this.sheet.src}")`;
    el.style.backgroundSize = `${this.sheet.cols * 100}% ${this.sheet.rows * 100}%`;
    el.style.aspectRatio = `${this.sheet.fw} / ${this.sheet.fh}`;
    this.speed = 1; this.frame = 0; this.last = 0; this.onEnd = null;
    this.play(anim);
    SpriteClock.add(this);
  }
  play(anim, { loop = true, speed = 1, onEnd = null, restart = false } = {}) {
    if (!restart && anim === this.anim && loop === this.loop) { this.speed = speed; return; }
    this.anim = anim; this.loop = loop; this.speed = speed; this.onEnd = onEnd;
    this.frame = 0; this.last = 0; this.draw();
  }
  once(anim, speed = 1) { return new Promise(res => this.play(anim, { loop: false, speed, onEnd: res, restart: true })); }
  draw() {
    const a = this.sheet.anims[this.anim];
    const x = this.frame / (this.sheet.cols - 1) * 100, y = a.row / (this.sheet.rows - 1) * 100;
    this.el.style.backgroundPosition = `${x}% ${y}%`;
  }
  tick(now) {
    const a = this.sheet.anims[this.anim];
    const step = 1000 / (a.fps * this.speed);
    if (!this.last) this.last = now;
    if (REDUCED_MOTION && this.anim === "idle") return;
    while (now - this.last >= step) {
      this.last += step;
      if (this.frame < a.frames - 1) this.frame++;
      else if (this.loop) this.frame = 0;
      else { const cb = this.onEnd; this.onEnd = null; this.play("idle"); cb && cb(); return; }
    }
    this.draw();
  }
  destroy() { SpriteClock.remove(this); }
}

const ASPECT_WH = WORLD.size[1] / WORLD.size[0];
const dist2d = (a, b) => Math.hypot(b[0] - a[0], (b[1] - a[1]) * ASPECT_WH);
const rand = (a, b) => a + Math.random() * (b - a);
function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ------------------------------------------------------------
// Map actor base: a pivot-anchored box positioned in % of the map
// ------------------------------------------------------------
class MapActor {
  constructor(el, charName, worldEl, fx) {
    this.el = el; this.world = worldEl; this.fx = fx;
    this.body = el.querySelector(".actor-sprite");
    this.view = new SpriteView(this.body, charName);
    const [px, py] = this.view.sheet.pivot;
    el.style.setProperty("--px", (-px * 100) + "%");
    el.style.setProperty("--py", (-py * 100) + "%");
    el.style.setProperty("--feet", ((1 - py) * 100) + "%");
    el.style.aspectRatio = `${this.view.sheet.fw} / ${this.view.sheet.fh}`;
    this.bubbleEl = el.querySelector(".bubble");
    this.x = 0; this.y = 0; this.face = 1; this.busy = false;
  }
  setFace(dir) { this.face = dir; this.el.style.setProperty("--face", dir); }
  place(x, y) { this.x = x; this.y = y; this.el.style.left = x + "%"; this.el.style.top = y + "%"; this.el.style.zIndex = 12 + Math.round(y / 4); }
  px() { const r = this.world.getBoundingClientRect(); return [this.x / 100 * r.width, this.y / 100 * r.height]; }
  headPx() { const [x, y] = this.px(); return [x, y - this.body.offsetHeight * 0.55]; }
  say(text, ms = 2400, kind = "speech") {
    if (!this.bubbleEl) return;
    const b = this.bubbleEl;
    b.textContent = text;
    b.className = "bubble show " + kind;
    clearTimeout(this._bubT);
    this._bubT = setTimeout(() => b.classList.remove("show"), ms);
  }
  pulse(cls, ms) {
    this.el.classList.remove(cls); void this.el.offsetWidth; this.el.classList.add(cls);
    setTimeout(() => this.el.classList.remove(cls), ms);
  }
}

// ------------------------------------------------------------
class Explorer extends MapActor {
  constructor(el, team, worldEl, fx) {
    super(el, team.kid, worldEl, fx);
    this.team = team;
    el.addEventListener("click", () => { if (!this.busy && !this.walking) this.wave(pickOne(["Hello!", "Let's explore the city!", "Tap a glowing sign!", "Where shall we go?"])); });
    this.idleLoop();
  }
  async appear(greeting) {
    const [x, y] = this.px();
    this.fx.mist(x, y - 30, 8, 80);
    this.fx.sparkle(x, y - 40, 18, 80);
    this.el.classList.add("visible");
    this.pulse("appear", 800);
    PassAudio.sfx("pop");
    await sleep(600);
    await this.wave(greeting || "Hello, explorer!");
  }
  async celebrate(text = "Yes! Unit complete!") {
    PassAudio.sfx("celebrate");
    const [x, y] = this.headPx();
    this.fx.confetti(x, y, 50, 240);
    this.fx.sparkle(x, y, 14, 70);
    this.say(text, 2000);
    await this.view.once("cheer");
    await this.view.once("jump");
  }
  async wave(text) {
    PassAudio.sfx("wave");
    if (text) this.say(text, 2200);
    await this.view.once("cheer", 1.2);
  }
  async think(text = "Hmm…") {
    this.say(text, 2200, "thought");
    PassAudio.sfx("think");
    this.pulse("thinking", 2200);
    await sleep(2200);
  }
  walk(route, onProgress) {
    return new Promise(resolve => {
      const segs = []; let total = 0;
      for (let i = 1; i < route.length; i++) { const d = dist2d(route[i - 1], route[i]); segs.push(d); total += d; }
      const dur = Math.max(1800, Math.min(7000, total / 10 * 1000)) * (REDUCED_MOTION ? 0.4 : 1);
      const at = s => {
        let acc = 0;
        for (let i = 0; i < segs.length; i++) {
          if (acc + segs[i] >= s || i === segs.length - 1) {
            const k = segs[i] ? Math.min(1, (s - acc) / segs[i]) : 0, a = route[i], b = route[i + 1];
            return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
          }
          acc += segs[i];
        }
        return route[route.length - 1];
      };
      const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const soft = t => 0.3 * t + 0.7 * ease(t);
      this.walking = true; this.el.classList.add("walking");
      this.view.play("walk", { speed: 1.1 });
      const start = performance.now(); let lastStep = 0;
      const frame = now => {
        const t = Math.min(1, (now - start) / dur), s = soft(t) * total;
        const p = at(s), ahead = at(Math.min(total, s + 1.5));
        const dx = ahead[0] - p[0], dy = (ahead[1] - p[1]) * ASPECT_WH;
        if (Math.abs(dx) > Math.abs(dy) * 0.3 && Math.abs(dx) > 0.02) this.setFace(dx > 0 ? 1 : -1);
        this.place(p[0], p[1]);
        if (now - lastStep > 330) { lastStep = now; PassAudio.sfx("step"); }
        onProgress && onProgress(t, p);
        if (t < 1) requestAnimationFrame(frame);
        else { this.walking = false; this.el.classList.remove("walking"); this.view.play("idle"); this.setFace(1); resolve(); }
      };
      requestAnimationFrame(frame);
    });
  }
  idleLoop() {
    const next = () => setTimeout(async () => {
      if (!this.busy && !this.walking && !document.hidden && this.el.classList.contains("visible") && !REDUCED_MOTION) {
        const r = Math.random();
        if (r < 0.3) await this.think(pickOne(["Hmm… what's next?", "What's behind the clouds?", "I love this city!"]));
        else if (r < 0.55) await this.view.once("jump");
        else if (r < 0.75) { this.setFace(-this.face); setTimeout(() => this.setFace(1), 2400); }
        else if (r < 0.88) await this.wave();
      }
      next();
    }, rand(9000, 16000));
    next();
  }
}

// ------------------------------------------------------------
class Bird extends MapActor {
  constructor(el, team, worldEl, fx, getPerches, getExplorer) {
    super(el, team.bird, worldEl, fx);
    this.team = team; this.getPerches = getPerches; this.getExplorer = getExplorer;
    this.perch = null; this.busy = true;
    el.addEventListener("click", () => this.poke());
    this.behave();
  }
  lookAt(tx) { this.setFace(tx >= this.x ? 1 : -1); }
  lookAtExplorer() { const e = this.getExplorer(); if (e) this.lookAt(e.x); }
  flyTo(x, y, { speed = 1 } = {}) {
    return new Promise(resolve => {
      const p0 = [this.x, this.y], p1 = [x, y], d = dist2d(p0, p1);
      const dur = Math.max(900, Math.min(2800, d / 22 * 1000)) / speed * (REDUCED_MOTION ? 0.5 : 1);
      const lift = Math.max(6, d * 0.35);
      const c = [(p0[0] + p1[0]) / 2, Math.min(p0[1], p1[1]) - lift];
      PassAudio.sfx("flap");
      this.el.classList.add("visible", "flying");
      this.view.play("walk", { speed: 1.6 });
      this.setFace(x >= this.x ? 1 : -1);
      const start = performance.now();
      const frame = now => {
        const t = Math.min(1, (now - start) / dur);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, u = 1 - e;
        const px = u * u * p0[0] + 2 * u * e * c[0] + e * e * p1[0];
        const py = u * u * p0[1] + 2 * u * e * c[1] + e * e * p1[1];
        if (Math.abs(px - this.x) > 0.01) this.setFace(px > this.x ? 1 : -1);
        this.place(px, py);
        if (t < 1) requestAnimationFrame(frame);
        else { this.el.classList.remove("flying"); this.view.play("idle"); this.pulse("land", 400); resolve(); }
      };
      requestAnimationFrame(frame);
    });
  }
  async flyToPerch(perch) { this.perch = perch; await this.flyTo(perch.at[0], perch.at[1]); this.lookAtExplorer(); }
  async cheer() {
    PassAudio.sfx("squawk");
    const [x, y] = this.px(); this.fx.sparkle(x, y - 25, 10, 45);
    await this.view.once("cheer");
    this.lookAtExplorer();
  }
  poke() {
    if (this.busy) return;
    PassAudio.sfx("squawk");
    this.view.once("jump");
    this.say(pickOne([`I'm ${this.team.birdName}!`, "Squawk! Hello!", "Let's fly!"]), 1800);
  }
  behave() {
    const next = () => setTimeout(async () => {
      if (!this.busy && !document.hidden && !REDUCED_MOTION) {
        const r = Math.random();
        if (r < 0.3) this.lookAtExplorer();
        else if (r < 0.48) await this.view.once("jump");
        else if (r < 0.62) await this.view.once("cheer");
        else if (r < 0.7) this.setFace(-this.face);
        else {
          const options = this.getPerches().filter(p => p !== this.perch);
          if (options.length) { this.busy = true; await this.flyToPerch(pickOne(options)); this.busy = false; }
        }
      }
      next();
    }, rand(3800, 8500));
    next();
  }
}
