// ============================================================
// APP — units, progress and the living city.
// Progress lives in this browser (localStorage), no login needed.
// Units unlock in order. "I've finished!" marks a unit complete:
// stamp → XP → the explorer celebrates and walks the street to the
// next unit → the parrot flies ahead → the clouds clear → new unit.
// ============================================================

const STORAGE_KEY = "passgo_a2_progress_v1";
const XP_PER_LEVEL = 300;

function loadState() {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
  return { completed: [], xp: 0, coins: 0, dates: {} };
}
function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {} }

let state = loadState();
let pendingUnlock = null;
let sequenceRunning = false;

const isUnlocked = u => u.id === 1 || state.completed.includes(u.id - 1);
const isComplete = id => state.completed.includes(id);
function frontierId() { const u = UNITS.find(u => !isComplete(u.id)); return u ? u.id : UNITS.length; }
function revealedIds() { return UNITS.filter(u => isUnlocked(u) && u.id !== pendingUnlock).map(u => u.id); }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- unit signs on the map ----------
const LOCK_SVG = `<svg class="lock" viewBox="0 0 24 28" aria-hidden="true">
  <path class="shackle" d="M7 13V9a5 5 0 0 1 10 0v4" fill="none" stroke="#5b4a3a" stroke-width="3" stroke-linecap="round"/>
  <rect x="3.5" y="12" width="17" height="13" rx="3" fill="#e2b04a" stroke="#5b3a22" stroke-width="1.6"/>
  <circle cx="12" cy="17.5" r="2" fill="#5b3a22"/><rect x="11.1" y="18" width="1.8" height="4" rx=".9" fill="#5b3a22"/></svg>`;

const nodeEls = {};
function buildNodes() {
  const layer = document.getElementById("nodesLayer");
  layer.innerHTML = "";
  UNITS.forEach((u, i) => {
    const n = WORLD.nodes[i];
    const node = document.createElement("button");
    node.className = "node" + (u.isFinal ? " final" : "");
    node.style.left = n.sign[0] + "%"; node.style.top = n.sign[1] + "%";
    node.style.width = n.sign[2] + "%"; node.style.height = n.sign[3] + "%";
    // icon position inside the sign box
    node.style.setProperty("--ix", ((n.icon[0] - n.sign[0]) / n.sign[2] * 100) + "%");
    node.style.setProperty("--iy", ((n.icon[1] - n.sign[1]) / n.sign[3] * 100) + "%");
    node.style.setProperty("--ink", u.color);
    node.innerHTML = `
      <span class="node-frame"></span>
      <span class="node-ring"></span>
      <span class="node-chip"><span class="node-num">${u.id}</span>${LOCK_SVG}<span class="node-check">✓</span></span>
      <span class="node-new">New adventure!</span>
      <span class="node-tag">Unit ${u.id}</span>`;
    node.addEventListener("click", () => handleNodeClick(u, node));
    node.addEventListener("mouseenter", () => { if (node.classList.contains("locked") && explorer && !explorer.busy && !explorer.walking) explorer.think("That place is still in the clouds…"); });
    layer.appendChild(node);
    nodeEls[u.id] = node;
  });
  updateNodes();
}
function updateNodes() {
  const cur = frontierId();
  UNITS.forEach(u => {
    const node = nodeEls[u.id], done = isComplete(u.id), unlocked = isUnlocked(u) && u.id !== pendingUnlock;
    node.classList.toggle("done", done);
    node.classList.toggle("unlocked", unlocked && !done);
    node.classList.toggle("locked", !unlocked);
    node.classList.toggle("current", unlocked && !done && u.id === cur);
    node.setAttribute("aria-label", unlocked ? `Unit ${u.id}: ${u.title}${done ? " (completed)" : ""}` : `Unit ${u.id}: locked`);
  });
}
function handleNodeClick(unit, nodeEl) {
  if (sequenceRunning) return;
  if (!isUnlocked(unit)) {
    nodeEl.classList.remove("shake"); void nodeEl.offsetWidth; nodeEl.classList.add("shake");
    PassAudio.sfx("locked");
    showToast(`🔒 Finish unit ${unit.id - 1} first!`);
    return;
  }
  PassAudio.sfx("click");
  nodeEl.classList.add("clicked"); setTimeout(() => nodeEl.classList.remove("clicked"), 260);
  openUnit(unit);
}

// ---------- walked trail ----------
function routeD(points) { return points.length ? "M " + points.map(p => `${p[0]},${p[1]}`).join(" L ") : ""; }
function drawTrail(extraPartial) {
  const parts = [];
  const cur = frontierId();
  for (let i = 0; i < cur - 1 && i < WORLD.routes.length; i++) {
    if (pendingUnlock && i >= pendingUnlock - 2) break;
    parts.push(routeD(WORLD.routes[i]));
  }
  if (extraPartial && extraPartial.length > 1) parts.push(routeD(extraPartial));
  const d = parts.join(" ");
  document.getElementById("routePath").setAttribute("d", d);
  document.getElementById("routeGlow").setAttribute("d", d);
}

// ---------- passport column ----------
function renderPassport(justCompletedId) {
  const explored = state.completed.length >= UNITS.length ? 100 : Math.round(revealedIds().length / UNITS.length * 100);
  Passport.render(state, justCompletedId, {
    xpPerLevel: XP_PER_LEVEL, revealedPct: explored,
    openMission: u => { scrollMapIntoView(true); setTimeout(() => openUnit(u), 350); }
  });
  if (justCompletedId) setTimeout(() => PassAudio.sfx("stamp"), 450);
}
function renderAll(justCompletedId) { updateNodes(); renderPassport(justCompletedId); drawTrail(); }

// ---------- unit window ----------
const RES_ICON = { video: "🎬", activity: "🧩", game: "🎮", quiz: "✅", reading: "📖", app: "🎧", test: "🏆" };
function resourceCard(r, i) {
  const ico = RES_ICON[r.kind] || "⭐";
  if (r.kind === "video") {
    return r.youtube
      ? `<section class="res res-video" style="--d:${i}"><h3><span class="res-ico">${ico}</span>${esc(r.title)}</h3>
           <div class="video-wrap"><iframe src="https://www.youtube.com/embed/${r.youtube}?rel=0" title="${esc(r.title)}" allowfullscreen loading="lazy"></iframe></div></section>`
      : `<section class="res res-soon" style="--d:${i}"><span class="res-ico">${ico}</span><div><h3>${esc(r.title)}</h3><p>The video is coming soon!</p></div><span class="soon-badge">Soon</span></section>`;
  }
  return `<a class="res res-link" href="${esc(r.url)}" target="_blank" rel="noopener" style="--d:${i}">
      <span class="res-ico">${ico}</span>
      <span class="res-text"><small>${esc(r.kind)}</small><b>${esc(r.title)}</b>${r.note ? `<em>${esc(r.note)}</em>` : ""}</span>
      <span class="res-go">${esc(r.label || "Open")} ↗</span></a>`;
}
const overlay = document.getElementById("modalOverlay");
const modalEl = document.getElementById("missionModal");
// ---------- unit video: cropped player for letterboxed Shorts ----------
// The unit Shorts are 16:9 footage inside a 9:16 frame (black bars above and below).
// We show a 16:9 window and enlarge the vertical player so only the picture band is
// visible; our own controls replace YouTube's (which would sit in the hidden bars).
let vp = null;
function videoStage(r) {
  if (!r || !r.youtube) {
    return `<div class="vstage vsoon"><span class="vsoon-ico">🎬</span><b>Video coming soon!</b><span>Start with the activities on the right.</span></div>`;
  }
  return `<div class="vstage ${r.letterbox ? "letterbox" : ""}" id="vstage">
      <div class="vp-crop"><div id="vpFrame"></div></div>
      <button class="vp-big" id="vpBig" aria-label="Play video"><span>▶</span></button>
      <div class="vp-bar">
        <button class="vp-btn" id="vpPlay" aria-label="Play or pause">▶</button>
        <div class="vp-track" id="vpTrack"><div class="vp-fill" id="vpFill"></div></div>
        <span class="vp-time" id="vpTime">0:00</span>
        <button class="vp-btn" id="vpMute" aria-label="Mute">🔊</button>
        <button class="vp-btn" id="vpFull" aria-label="Full screen">⛶</button>
      </div>
    </div>`;
}
function mountVideo(r) {
  const stage = document.getElementById("vstage"); if (!stage) return;
  const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  const state = { player: null, timer: null, playing: false };
  const set = playing => { state.playing = playing; stage.classList.toggle("playing", playing); document.getElementById("vpPlay").textContent = playing ? "❚❚" : "▶"; };
  if (window.YT && YT.Player) {
    state.player = new YT.Player("vpFrame", {
      videoId: r.youtube,
      playerVars: { controls: r.letterbox ? 0 : 1, rel: 0, playsinline: 1, modestbranding: 1, fs: 0, iv_load_policy: 3, disablekb: 1 },
      events: {
        onReady: () => stage.classList.add("ready"),
        onStateChange: e => {
          if (e.data === YT.PlayerState.PLAYING) set(true);
          if (e.data === YT.PlayerState.PAUSED) set(false);
          if (e.data === YT.PlayerState.ENDED) { set(false); stage.classList.add("ended"); PassAudio.sfx("sparkle"); }
        }
      }
    });
    const p = () => state.player;
    const toggle = () => { if (!p() || !p().getPlayerState) return; stage.classList.remove("ended"); state.playing ? p().pauseVideo() : p().playVideo(); };
    document.getElementById("vpBig").addEventListener("click", toggle);
    document.getElementById("vpPlay").addEventListener("click", toggle);
    stage.querySelector(".vp-crop").addEventListener("click", toggle);
    document.getElementById("vpMute").addEventListener("click", e => {
      if (!p().isMuted) return; if (p().isMuted()) { p().unMute(); e.target.textContent = "🔊"; } else { p().mute(); e.target.textContent = "🔇"; }
    });
    document.getElementById("vpTrack").addEventListener("click", e => {
      const rr = e.currentTarget.getBoundingClientRect(), d = p().getDuration ? p().getDuration() : 0;
      if (d) p().seekTo((e.clientX - rr.left) / rr.width * d, true);
    });
    state.timer = setInterval(() => {
      if (!p() || !p().getDuration) return;
      const d = p().getDuration() || 0, t = p().getCurrentTime() || 0;
      document.getElementById("vpFill").style.width = d ? (t / d * 100) + "%" : "0";
      document.getElementById("vpTime").textContent = `${fmt(t)} / ${fmt(d)}`;
    }, 250);
  } else {
    // YouTube API unavailable: plain embed (still cropped), YouTube's own click-to-play
    stage.classList.add("ready", "no-api");
    document.getElementById("vpFrame").outerHTML = `<iframe src="https://www.youtube.com/embed/${r.youtube}?rel=0&playsinline=1&modestbranding=1" title="Unit video" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
  }
  document.getElementById("vpFull").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen(); else if (stage.requestFullscreen) stage.requestFullscreen();
  });
  vp = state;
}
function unmountVideo() {
  if (!vp) return;
  clearInterval(vp.timer);
  try { vp.player && vp.player.destroy && vp.player.destroy(); } catch (e) {}
  vp = null;
}

function openUnit(u) {
  const done = isComplete(u.id);
  const video = u.resources.find(r => r.kind === "video");
  const others = u.resources.filter(r => r.kind !== "video");
  modalEl.style.setProperty("--ink", u.color);
  modalEl.classList.add("unit-modal");
  modalEl.innerHTML = `
    <button class="modal-close" aria-label="Close">✕</button>
    <header class="unit-head">
      <img src="${u.stamp}" alt="" class="unit-stamp">
      <div>
        <span class="unit-kicker">Unit ${u.id} of ${UNITS.length}</span>
        <h2>${esc(u.title)}</h2>
        <p class="unit-goal">${esc(u.goal)}</p>
      </div>
    </header>
    <div class="unit-grid">
      <div class="unit-main">
        <h3 class="col-title"><span>1</span> Watch &amp; learn</h3>
        ${videoStage(video)}
        <section class="unit-words"><h3>🗝️ Key words</h3><div class="vocab-chips">${u.words.map(w => `<span class="chip">${esc(w)}</span>`).join("")}</div></section>
      </div>
      <div class="unit-side">
        <h3 class="col-title"><span>2</span> Practise &amp; play</h3>
        <div class="res-list">${others.map(resourceCard).join("")}</div>
        <section class="reward"><img src="assets/star.png" alt=""><p>Earn the <b>${esc(u.badge)}</b> stamp and <b>+${u.xp} XP</b></p></section>
        ${done ? `<div class="already-done">✓ Unit completed — great job!</div>`
               : `<button class="art-btn btn-complete btn-xl" id="completeBtn"><span class="btn-ico">🏅</span>I've finished!</button>`}
      </div>
    </div>`;
  modalEl.querySelector(".modal-close").addEventListener("click", closeModal);
  modalEl.querySelectorAll(".res-link").forEach(a => a.addEventListener("click", () => { PassAudio.sfx("click"); if (vp && vp.player && vp.player.pauseVideo) vp.player.pauseVideo(); }));
  if (!done) modalEl.querySelector("#completeBtn").addEventListener("click", () => completeUnit(u));
  openOverlay();
  mountVideo(video);
}
function openOverlay() { overlay.classList.add("open"); PassAudio.duck(true); }
function closeModal() {
  if (!overlay.classList.contains("open")) return;
  unmountVideo(); overlay.classList.remove("open"); modalEl.innerHTML = ""; modalEl.classList.remove("unit-modal"); PassAudio.duck(false);
}
overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

// ---------- completing a unit ----------
function completeUnit(u) {
  if (isComplete(u.id)) return;
  const next = UNITS.find(x => x.id === u.id + 1);
  state.completed.push(u.id);
  state.dates = state.dates || {}; state.dates[u.id] = Date.now();
  state.xp += u.xp; state.coins += Math.round(u.xp / 10);
  saveState();
  if (next) pendingUnlock = next.id;
  closeModal();
  renderAll(u.id);
  playCompletionSequence(u, next);
}
function worldPx(left, top) { const r = worldEl.getBoundingClientRect(); return [left / 100 * r.width, top / 100 * r.height]; }
function floatText(left, top, html, cls = "") {
  const el = document.createElement("div");
  el.className = "float-text " + cls; el.innerHTML = html;
  el.style.left = left + "%"; el.style.top = top + "%";
  worldEl.appendChild(el); setTimeout(() => el.remove(), 2200);
}
function scrollMapIntoView(force) {
  const r = document.getElementById("map").getBoundingClientRect();
  if (force || r.top < -r.height * 0.3 || r.bottom > window.innerHeight + r.height * 0.3)
    document.getElementById("map").scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth", block: "center" });
}

async function playCompletionSequence(u, next) {
  sequenceRunning = true; document.body.classList.add("sequence");
  explorer.busy = true; bird.busy = true;
  scrollMapIntoView();
  const n = WORLD.nodes[u.id - 1];
  const [bx, by] = worldPx(...n.icon);
  fx.sparkle(bx, by, 22, 90); fx.ring(bx, by, 30);
  floatText(n.icon[0], n.icon[1] - 3, `+${u.xp} XP <img src="assets/star.png" alt="">`, "xp");
  setTimeout(() => floatText(n.icon[0] + 5, n.icon[1], `+${Math.round(u.xp / 10)} <img src="assets/coin.png" alt="">`, "coin"), 350);
  PassAudio.sfx("xp");
  showToast(`🏅 "${u.badge}" stamp collected! +${u.xp} XP`);
  Passport.cheerCard();
  await sleep(600);
  bird.cheer();
  await explorer.celebrate();
  if (!next) { await playFinale(); endSequence(); return; }

  const route = WORLD.routes[u.id - 1];
  const nn = WORLD.nodes[next.id - 1];
  const perch = { at: [nn.icon[0] + 2, nn.sign[1] - 0.5], zone: next.id, name: "next unit" };
  setTimeout(() => bird.flyToPerch(perch), 900);
  PassAudio.sfx("reveal");
  let lastSpark = 0;
  await explorer.walk(route, (t, p) => {
    fog.set(next.id, Math.min(1, t * 1.05 + 0.05));
    drawTrail(trailUpTo(route, t, p));
    const now = performance.now();
    if (now - lastSpark > 160) { lastSpark = now; const [x, y] = worldPx(p[0], p[1]); fx.dust(x, y - 8, 2, 16); }
  });
  await fog.reveal(next.id, 700);
  await unlockNode(next);
  pendingUnlock = null;
  renderAll();
  explorer.wave(`Next stop: ${next.title}!`);
  await sleep(600);
  bird.cheer();
  endSequence();
}
let _trailIdx = 0;
function trailUpTo(route, t, p) {
  if (t < 0.02) _trailIdx = 0;
  while (_trailIdx < route.length - 1 &&
         Math.hypot(route[_trailIdx + 1][0] - p[0], route[_trailIdx + 1][1] - p[1]) <
         Math.hypot(route[_trailIdx][0] - p[0], route[_trailIdx][1] - p[1])) _trailIdx++;
  return route.slice(0, _trailIdx + 1).concat([p]);
}
function endSequence() { sequenceRunning = false; document.body.classList.remove("sequence"); explorer.busy = false; bird.busy = false; }

async function unlockNode(u) {
  const node = nodeEls[u.id], n = WORLD.nodes[u.id - 1];
  const [x, y] = worldPx(...n.icon);
  node.classList.add("unlocking");
  PassAudio.sfx("unlock");
  await sleep(650);
  fx.sparkle(x, y, 30, 110); fx.ring(x, y, 36, 28); fx.dust(x, y, 20, 60);
  node.classList.remove("unlocking");
  pendingUnlock = null; updateNodes();
  node.classList.add("just-unlocked");
  setTimeout(() => node.classList.remove("just-unlocked"), 2800);
  showToast(`✨ New adventure: Unit ${u.id} — ${u.title}!`);
  await sleep(700);
}

async function playFinale() {
  PassAudio.sfx("finale");
  const r = worldEl.getBoundingClientRect();
  fog.clearAll(2800);
  for (let i = 0; i < 6; i++) setTimeout(() => {
    fx.confetti(r.width * (0.2 + Math.random() * 0.6), r.height * (0.3 + Math.random() * 0.4), 40, 260);
    fx.sparkle(r.width * Math.random(), r.height * Math.random(), 16, 90);
  }, i * 380);
  bird.flyToPerch(WORLD.perches[5]);
  await sleep(2400);
  renderPassport();
  document.getElementById("finale").hidden = false;
}
document.getElementById("finaleClose").addEventListener("click", () => { document.getElementById("finale").hidden = true; PassAudio.sfx("click"); });

// ---------- toast ----------
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg; toast.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 3400);
}

// ---------- reset / replay / video ----------
document.getElementById("resetBtn").addEventListener("click", () => {
  if (confirm("Start with a new explorer? This deletes the name, team, stamps and progress saved on this computer.")) {
    try {
      localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(Passport.PROFILE_KEY);
      localStorage.removeItem(GATE_KEY); sessionStorage.removeItem(INTRO_SESSION_KEY);
    } catch (e) {}
    location.reload();
  }
});
document.getElementById("replayIntroBtn").addEventListener("click", () => { try { sessionStorage.removeItem(INTRO_SESSION_KEY); } catch (e) {} location.reload(); });
document.getElementById("introVideoBtn").addEventListener("click", () => {
  modalEl.style.setProperty("--ink", "#1f7fa0");
  modalEl.innerHTML = `<button class="modal-close" aria-label="Close">✕</button>
    <header class="unit-head"><div><span class="unit-kicker">PassGO! City</span><h2>${esc(WELCOME_VIDEO.title)}</h2></div></header>
    <div class="video-wrap"><iframe src="https://www.youtube.com/embed/${WELCOME_VIDEO.youtube}?rel=0" title="Welcome video" allowfullscreen></iframe></div>`;
  modalEl.querySelector(".modal-close").addEventListener("click", closeModal);
  openOverlay();
});
document.getElementById("startBtn").addEventListener("click", e => {
  e.preventDefault(); scrollMapIntoView(true);
  const u = UNITS.find(u => isUnlocked(u) && !isComplete(u.id));
  if (u) { const n = nodeEls[u.id]; n.classList.remove("shake"); void n.offsetWidth; n.classList.add("clicked"); setTimeout(() => openUnit(u), 400); }
});

// ---------- sound control ----------
(function soundControl() {
  const ctrl = document.getElementById("soundCtrl"), btn = document.getElementById("soundBtn");
  const vol = document.getElementById("volMaster"), mus = document.getElementById("volMusic");
  const sync = () => {
    ctrl.classList.toggle("muted", PassAudio.prefs.muted || PassAudio.prefs.volume === 0);
    ctrl.classList.toggle("pending", !PassAudio.started);
  };
  vol.value = Math.round(PassAudio.prefs.volume * 100);
  mus.value = Math.round(PassAudio.prefs.music * 100);
  btn.addEventListener("click", () => {
    if (!PassAudio.started) { PassAudio.unlock(); if (PassAudio.prefs.muted) PassAudio.toggleMute(); }
    else PassAudio.toggleMute();
    sync();
  });
  vol.addEventListener("input", () => { PassAudio.unlock(); PassAudio.setVolume(vol.value / 100); sync(); });
  mus.addEventListener("input", () => { PassAudio.unlock(); PassAudio.setMusic(mus.value / 100); });
  PassAudio.onStart(sync);
  const first = () => { PassAudio.unlock(); sync(); window.removeEventListener("pointerdown", first); window.removeEventListener("keydown", first); };
  window.addEventListener("pointerdown", first); window.addEventListener("keydown", first);
  sync();
})();

// ============================================================
// BOOT
// ============================================================
const worldEl = document.getElementById("world");
const fx = new FX(document.getElementById("fxCanvas"));
const fog = new WorldFX.Fog(document.getElementById("fogCanvas"), "assets/world/city-fog-mask.png");
let explorer, bird;

(function placeProps() {
  const put = (el, b) => { el.style.left = b.left + "%"; el.style.top = b.top + "%"; el.style.width = b.width + "%"; el.style.height = b.height + "%"; };
  put(document.getElementById("boat"), WORLD.boat);
  put(document.getElementById("pirateFlag"), WORLD.flag);
})();

UNITS.forEach(u => { if (isUnlocked(u)) fog.set(u.id, 1); });
if (state.completed.length >= UNITS.length) fog.opacity = 0;
buildNodes();
drawTrail();
WorldFX.startGulls(document.getElementById("gulls"));
WorldFX.startMotes(fx, worldEl, revealedIds);

function spawnTeam(profile) {
  const team = TEAMS[profile && profile.team] || TEAMS.nico;
  explorer = new Explorer(document.getElementById("explorer"), team, worldEl, fx);
  const stand = WORLD.stand[frontierId() - 1];
  explorer.place(stand.left, stand.top);
  const perches = () => WORLD.perches.filter(p => revealedIds().includes(p.zone));
  bird = new Bird(document.getElementById("bird"), team, worldEl, fx, perches, () => explorer);
  bird.place(104, 8);
  return team;
}

async function enterWorld(profile) {
  explorer.busy = true;
  await sleep(REDUCED_MOTION ? 100 : 500);
  await explorer.appear(profile && profile.name ? `Hi, ${profile.name}! Let's go!` : undefined);
  const near = WORLD.perches.filter(p => revealedIds().includes(p.zone))
    .sort((a, b) => Math.hypot(a.at[0] - explorer.x, a.at[1] - explorer.y) - Math.hypot(b.at[0] - explorer.x, b.at[1] - explorer.y))[0] || WORLD.perches[0];
  await bird.flyToPerch(near);
  bird.cheer();
  explorer.busy = false; bird.busy = false;
  if (state.completed.length === 0) showToast("🗺️ Tap the glowing sign to start Unit 1!");
}

(async function start() {
  let watched = false, seen = false;
  try { watched = localStorage.getItem(GATE_KEY) === "1"; seen = sessionStorage.getItem(INTRO_SESSION_KEY) === "1"; } catch (e) {}
  const saved = Passport.loadProfile();
  if (watched && seen && saved) Intro.skipEntirely();
  else await Intro.run({ needGate: !watched });
  const profile = Passport.loadProfile();
  spawnTeam(profile);
  renderPassport();
  Passport.enableTilt(document.getElementById("passportCard"));
  enterWorld(profile);
})();
