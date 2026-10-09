// ============================================================
// INTRO — the magic leather passport.
//  1. tap the passport (this tap also unlocks audio)
//  2. cover opens, pages riffle one by one, magic light grows and
//     colourful animal silhouettes fly out → the book opens wide
//  3. a flash sweeps the screen → "Welcome, Explorer!" (waits for a tap)
//  4. choose your team: Nico & Luma or Massie & Luna (voice lines)
//  5. passport details (name · country · age) with character-creation
//     music → "I'm ready!" → red APPROVED stamp
//  6. first visit only: welcome video → light floods into the city
// ============================================================
const GATE_KEY = "passgo_a2_videoWatched_v1";
const INTRO_SESSION_KEY = "passgo_a2_introSeen_v1";

const Intro = (() => {
  const $ = id => document.getElementById(id);
  let fx, dustTimer, ytPlayer = null, ytReady = false, gateOpen = false;
  const ANIMALS = ["🦜", "🐢", "🦋", "🐬", "🐒", "🐆", "🐘", "🦒", "🐸", "🐠", "🦩", "🐳", "🦉", "🐙", "🦥", "🐝", "🦎", "🐞", "🦀", "🐇"];
  const FLYERS = new Set(["🦜", "🦋", "🦩", "🦉", "🐝", "🐞"]);
  const GRADIENTS = [["#ff4f81", "#ffb347"], ["#00d2a8", "#3a86ff"], ["#a66cff", "#ff6ec7"], ["#ffd23f", "#ff6b00"],
                     ["#3ddc97", "#00a6fb"], ["#ff5a5f", "#ffc857"], ["#7b2ff7", "#00c2ff"], ["#f15bb5", "#fee440"]];
  let animalSprites = [];

  // ---------- YouTube gate ----------
  window.onYouTubeIframeAPIReady = function () { ytReady = true; if (gateOpen) createPlayer(); };
  function createPlayer() {
    if (ytPlayer || !window.YT || !YT.Player) return;
    ytPlayer = new YT.Player("gateYtPlayer", {
      videoId: WELCOME_VIDEO.youtube,
      playerVars: { rel: 0 },
      events: {
        onStateChange: e => {
          if (e.data === YT.PlayerState.PLAYING) PassAudio.duck(true);
          if (e.data === YT.PlayerState.PAUSED) PassAudio.duck(false);
          if (e.data === YT.PlayerState.ENDED) { PassAudio.duck(false); unlockContinue(); }
        }
      }
    });
  }
  function unlockContinue() {
    const btn = $("gateContinueBtn");
    btn.disabled = false;
    btn.textContent = "I watched it! Continue →";
    PassAudio.sfx("unlock");
  }

  // ---------- colourful animal silhouettes (emoji → gradient silhouette) ----------
  function makeAnimalSprites() {
    const out = [];
    ANIMALS.forEach((emo, i) => {
      const S = 120, c = document.createElement("canvas"); c.width = c.height = S;
      const g = c.getContext("2d");
      g.font = `${S * 0.78}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif`;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(emo, S / 2, S / 2 + S * 0.04);
      // silhouette: keep the glyph's alpha, replace colours with a vivid gradient
      g.globalCompositeOperation = "source-in";
      const [c1, c2] = GRADIENTS[i % GRADIENTS.length];
      const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
      // check that the platform could draw the glyph at all
      const px = g.getImageData(0, 0, S, S).data; let filled = 0;
      for (let k = 3; k < px.length; k += 16) if (px[k] > 100) filled++;
      if (filled < 40) return;
      // soft glow halo
      const o = document.createElement("canvas"); o.width = o.height = S + 24;
      const og = o.getContext("2d");
      og.shadowColor = c1; og.shadowBlur = 14; og.drawImage(c, 12, 12);
      og.shadowBlur = 0; og.drawImage(c, 12, 12);
      out.push({ img: o, flyer: FLYERS.has(emo) });
    });
    return out;
  }
  function releaseAnimals(x, y, n, power = 1) {
    if (!animalSprites.length) { fx.sparkle(x, y, n * 2, 160 * power); return; }
    for (let k = 0; k < n; k++) {
      const s = animalSprites[Math.floor(Math.random() * animalSprites.length)];
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, sp = (140 + Math.random() * 260) * power;
      fx.add({ img: s.img, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.9, ay: -18, drag: 0.975,
        life: 2 + Math.random() * 1.4, size: 34 + Math.random() * 44, grow: 0.8, rot: (Math.random() - 0.5) * 0.5,
        vr: (Math.random() - 0.5) * 0.8, flap: s.flyer ? 14 + Math.random() * 6 : 0, wobble: s.flyer ? 0 : 3 + Math.random() * 2,
        face: Math.cos(a) < 0 ? -1 : 1, fadeIn: 0.08, alpha: 1 });
    }
    if (Math.random() < 0.6) PassAudio.sfx("critter");
  }

  // ---------- helpers ----------
  function show(sceneId) {
    document.querySelectorAll(".intro .scene").forEach(s => {
      const on = s.id === sceneId;
      s.classList.toggle("is-active", on);
      s.setAttribute("aria-hidden", on ? "false" : "true");
    });
    $("intro").dataset.scene = sceneId;
  }
  const center = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  function ambientDust() {
    dustTimer = setInterval(() => {
      if (document.hidden || $("intro").dataset.scene !== "sceneBook") return;
      const r = $("book").getBoundingClientRect();
      const open = $("bookStage").classList.contains("open");
      const x = open ? r.left + Math.random() * r.width : r.left + r.width / 2 + Math.random() * r.width / 2;
      const y = r.top + Math.random() * r.height;
      fx.add({ x, y, vx: (Math.random() - .5) * 20, vy: -10 - Math.random() * 25, drag: 1, life: 2 + Math.random() * 1.5,
        size: 4 + Math.random() * 7, sprite: Math.random() < 0.3 ? "star" : "glowGold", twinkle: 8, alpha: 0.9, fadeIn: 0.2 });
    }, REDUCED_MOTION ? 600 : 110);
  }
  function waitClick(el, alsoKeys = true) {
    return new Promise(res => {
      const go = () => { el.removeEventListener("click", go); document.removeEventListener("keydown", key); res(); };
      const key = e => { if (alsoKeys && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); go(); } };
      el.addEventListener("click", go);
      if (alsoKeys) document.addEventListener("keydown", key);
    });
  }

  // ---------- 1–3: the book ----------
  async function openBook() {
    const stage = $("bookStage"), book = $("book"), intro = $("intro");
    PassAudio.unlock(); PassAudio.setScene("intro");
    PassAudio.sfx("open");
    $("introHint").classList.add("hide");
    stage.classList.add("open");
    intro.classList.add("magic");
    const leaves = [...document.querySelectorAll(".book .leaf")].sort((a, b) => a.style.getPropertyValue("--n") - b.style.getPropertyValue("--n"));
    const T0 = REDUCED_MOTION ? 100 : 720, STEP = REDUCED_MOTION ? 40 : 290;
    await sleep(T0);
    // pages turn one by one — each one lets out a little more magic
    for (let i = 0; i < leaves.length; i++) {
      PassAudio.sfx("page");
      stage.style.setProperty("--magic", ((i + 1) / leaves.length).toFixed(2));
      const [cx, cy] = center(book);
      fx.dust(cx, cy, 6 + i * 2, 50 + i * 12);
      releaseAnimals(cx, cy, 1 + Math.floor(i / 2), 0.7 + i * 0.06);
      await sleep(STEP);
    }
    await sleep(REDUCED_MOTION ? 50 : 380);
    // open wide in the middle
    stage.classList.add("spread");
    PassAudio.sfx("magic");
    const [cx, cy] = center(book);
    fx.sparkle(cx, cy, 40, 240);
    releaseAnimals(cx, cy, 16, 1.25);
    await sleep(REDUCED_MOTION ? 200 : 1300);
  }

  async function flashToWelcome(withFlash = true) {
    if (withFlash) {
      const flash = $("flash");
      PassAudio.sfx("flash");
      flash.classList.remove("go"); void flash.offsetWidth; flash.classList.add("go");
      await sleep(REDUCED_MOTION ? 120 : 380);          // peak of the flash: swap scenes behind it
    }
    show("sceneWelcome");
    $("intro").classList.remove("magic");
    PassAudio.sfx("welcome");
    const [x, y] = center($("welcomeArt"));
    setTimeout(() => { fx.sparkle(x, y, 36, 260); fx.confetti(x, y + 40, 50, 320); }, 250);
    // keep the welcome on screen (gentle sparkles) until the explorer taps
    const twinkle = setInterval(() => { const r = $("welcomeArt").getBoundingClientRect(); fx.sparkle(r.left + Math.random() * r.width, r.top + Math.random() * r.height, 3, 40); }, 700);
    await waitClick($("welcomeGo"));
    clearInterval(twinkle);
    PassAudio.sfx("open");
  }

  // ---------- 4: choose your team ----------
  function runSelect() {
    return new Promise(resolve => {
      show("sceneSelect"); fx.p.length = 0;
      PassAudio.setScene("create");
      const cards = [...document.querySelectorAll(".team-card")];
      const views = {};
      let chosen = null;
      cards.forEach(card => {
        const id = card.dataset.team, team = TEAMS[id];
        const kid = new SpriteView($("selKid_" + id), team.kid, "idle");
        const bird = new SpriteView($("selBird_" + id), team.bird, "idle");
        views[id] = { kid, bird };
        const hoverOn = () => { if (chosen && chosen !== id) return; kid.play("cheer"); bird.play("walk", { speed: 1.5 }); card.classList.add("hot"); PassAudio.sfx("sparkle"); };
        const hoverOff = () => { if (chosen === id) return; kid.play("idle"); bird.play("idle"); card.classList.remove("hot"); };
        card.addEventListener("pointerenter", hoverOn);
        card.addEventListener("focus", hoverOn);
        card.addEventListener("pointerleave", hoverOff);
        card.addEventListener("blur", hoverOff);
        card.addEventListener("click", () => {
          chosen = id;
          cards.forEach(c => {
            const on = c === card;
            c.classList.toggle("chosen", on); c.classList.toggle("dim", !on); c.classList.toggle("hot", on);
            c.setAttribute("aria-checked", on ? "true" : "false");
            if (!on) { views[c.dataset.team].kid.play("idle"); views[c.dataset.team].bird.play("idle"); }
          });
          PassAudio.voice(team.voice);
          kid.once("jump").then(() => { if (chosen === id) kid.play("cheer"); });
          bird.once("cheer").then(() => { if (chosen === id) bird.play("walk", { speed: 1.4 }); });
          const r = card.getBoundingClientRect();
          fx.confetti(r.left + r.width / 2, r.top + r.height * 0.35, 46, 300);
          fx.sparkle(r.left + r.width / 2, r.top + r.height * 0.4, 24, 160);
          $("teamGo").disabled = false;
          $("teamGo").innerHTML = `<span class="btn-ico">🧭</span>Let's go, ${team.kidName} & ${team.birdName}!`;
        });
      });
      $("teamGo").addEventListener("click", () => {
        if (!chosen) return;
        PassAudio.sfx("click");
        Object.values(views).forEach(v => { v.kid.destroy(); v.bird.destroy(); });
        resolve(chosen);
      }, { once: true });
    });
  }

  // ---------- 5: welcome-video gate (first visit only) ----------
  function runGate() {
    return new Promise(resolve => {
      gateOpen = true; fx.p.length = 0;
      const panel = $("introGate");
      panel.hidden = false;
      show("introGate");
      if (ytReady) createPlayer();
      const done = () => { try { localStorage.setItem(GATE_KEY, "1"); } catch (e) {} try { ytPlayer && ytPlayer.pauseVideo && ytPlayer.pauseVideo(); } catch (e) {} PassAudio.duck(false); resolve(); };
      $("gateContinueBtn").addEventListener("click", () => { if (!$("gateContinueBtn").disabled) done(); });
      setTimeout(() => $("gateSkipBtn").classList.add("visible"), 20000);  // safety net (ad blockers, offline…)
      $("gateSkipBtn").addEventListener("click", done);
    });
  }

  // ---------- 6: passport registration ----------
  function runRegister(teamId) {
    return new Promise(resolve => {
      show("sceneRegister"); fx.p.length = 0;
      const team = TEAMS[teamId];
      const regKid = new SpriteView($("regKid"), team.kid, "idle"), regBird = new SpriteView($("regBird"), team.bird, "idle");
      $("regTeam").textContent = `${team.kidName} & ${team.birdName}`;
      const form = $("passportForm"), name = $("regName"), country = $("regCountry"), age = $("regAge"), err = $("regError");
      const prev = Passport.loadProfile();
      const number = (prev && prev.number) || Passport.makeNumber(String(Math.random()));
      $("regNumber").textContent = number;
      $("regIssued").textContent = Passport.fmtDate(prev && prev.issued || Date.now());
      $("countryList").innerHTML = Passport.COUNTRIES.map(c => `<option value="${c[0]}">`).join("");
      if (prev) { name.value = prev.name || ""; country.value = prev.country || ""; age.value = prev.age || 9; }
      const draft = () => {
        const c = Passport.findCountry(country.value);
        $("regFlag").textContent = Passport.flagOf(c && c.iso);
        const [l1, l2] = Passport.mrz({ name: name.value || "explorer", iso: c && c.iso, number, age: age.value });
        $("mrz1").textContent = l1; $("mrz2").textContent = l2;
      };
      [name, country, age].forEach(el => el.addEventListener("input", () => { draft(); err.textContent = ""; PassAudio.sfx("type"); }));
      const clampAge = v => Math.max(4, Math.min(99, parseInt(v, 10) || 9));
      $("ageMinus").addEventListener("click", () => { age.value = clampAge(age.value) - 1 < 4 ? 4 : clampAge(age.value) - 1; draft(); PassAudio.sfx("click"); });
      $("agePlus").addEventListener("click", () => { age.value = Math.min(99, clampAge(age.value) + 1); draft(); PassAudio.sfx("click"); });
      draft();
      setTimeout(() => { if (!prev) name.focus({ preventScroll: true }); }, 700);

      form.addEventListener("submit", async e => {
        e.preventDefault();
        const n = name.value.trim(), ct = country.value.trim(), ag = parseInt(age.value, 10);
        let problem = "", bad = null;
        if (!n) { problem = "Please write your name, explorer!"; bad = name; }
        else if (!ct) { problem = "Which country are you from?"; bad = country; }
        else if (!(ag >= 4 && ag <= 99)) { problem = "Please choose an age between 4 and 99."; bad = age; }
        if (problem) {
          err.textContent = problem; bad.focus();
          form.classList.remove("nope"); void form.offsetWidth; form.classList.add("nope");
          PassAudio.sfx("locked");
          return;
        }
        const c = Passport.findCountry(ct);
        const profile = { name: n.charAt(0).toUpperCase() + n.slice(1), country: c ? c.name : ct, iso: c ? c.iso : "", age: ag, number, team: teamId,
                          issued: (prev && prev.issued) || Date.now() };
        Passport.saveProfile(profile);
        form.classList.add("locked");
        form.querySelectorAll("input,button").forEach(el => el.disabled = true);
        // the APPROVED stamp
        const st = $("approvedStamp");
        $("stampDate").textContent = "ENTRY · " + Passport.fmtDate(Date.now());
        st.classList.add("slam");
        await sleep(REDUCED_MOTION ? 50 : 300);
        PassAudio.sfx("stamp");
        form.classList.add("thump");
        const pr = st.parentElement.getBoundingClientRect();
        const sx = pr.left + pr.width * 0.5, sy = pr.top + pr.height * 0.58;   // where the stamp lands
        fx.ink(sx, sy, 26, 190);
        fx.sparkle(sx, sy, 14, 120);
        regKid.once("cheer"); regBird.once("cheer");
        await sleep(REDUCED_MOTION ? 400 : 1800);
        regKid.destroy(); regBird.destroy();
        resolve(profile);
      });
    });
  }

  // ---------- light flood into the world ----------
  async function lightBurst(fromEl) {
    const burst = $("lightBurst");
    const [x, y] = center(fromEl || $("intro"));
    burst.style.setProperty("--cx", x + "px");
    burst.style.setProperty("--cy", y + "px");
    PassAudio.sfx("reveal");
    burst.classList.add("go");
    await sleep(REDUCED_MOTION ? 250 : 900);
    $("intro").classList.add("done");
    document.body.classList.remove("intro-active");
    document.body.classList.add("gate-passed", "entering");
    clearInterval(dustTimer);
    PassAudio.setScene("map");
    await sleep(REDUCED_MOTION ? 200 : 900);
    $("intro").hidden = true;
    setTimeout(() => document.body.classList.remove("entering"), 1400);
  }

  async function run({ needGate }) {
    fx = new FX($("introFx"));
    try { animalSprites = makeAnimalSprites(); } catch (e) { animalSprites = []; }
    ambientDust();
    show("sceneBook");
    const skipped = await Promise.race([waitClick($("book")).then(() => false), waitClick($("introSkip"), false).then(() => true)]);
    PassAudio.unlock(); PassAudio.setScene("intro");
    $("introSkip").hidden = true;
    if (!skipped) { await openBook(); await flashToWelcome(true); }
    else await flashToWelcome(false);
    const teamId = await runSelect();
    await runRegister(teamId);
    if (needGate) { PassAudio.setScene("intro"); await runGate(); }
    try { sessionStorage.setItem(INTRO_SESSION_KEY, "1"); } catch (e) {}
    await lightBurst(needGate ? $("introGate") : $("approvedStamp"));
  }

  function skipEntirely() {
    $("intro").hidden = true;
    document.body.classList.remove("intro-active");
    document.body.classList.add("gate-passed");
    PassAudio.setScene("map");
  }

  return { run, skipEntirely };
})();
