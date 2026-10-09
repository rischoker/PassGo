// ============================================================
// PASSPORT — explorer profile, rubber-stamp artwork, expedition log.
//   Profile      : name / country / age saved in localStorage
//   stamps      : the six illustrated unit stamps (assets/stamps)
//   Passport.render(state, justCompletedId, handlers)
// ============================================================
const Passport = (() => {
  const PROFILE_KEY = "passgo_a2_profile_v1";
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- countries (English + common Spanish spellings) ----------
  const COUNTRIES = [
    ["Colombia", "CO"], ["Mexico", "MX", "México"], ["Argentina", "AR"], ["Chile", "CL"], ["Peru", "PE", "Perú"], ["Ecuador", "EC"],
    ["Venezuela", "VE"], ["Bolivia", "BO"], ["Paraguay", "PY"], ["Uruguay", "UY"], ["Brazil", "BR", "Brasil"], ["Panama", "PA", "Panamá"],
    ["Costa Rica", "CR"], ["Guatemala", "GT"], ["Honduras", "HN"], ["El Salvador", "SV"], ["Nicaragua", "NI"], ["Cuba", "CU"],
    ["Dominican Republic", "DO", "República Dominicana"], ["Puerto Rico", "PR"], ["Spain", "ES", "España"], ["United States", "US", "Estados Unidos", "USA"],
    ["Canada", "CA", "Canadá"], ["United Kingdom", "GB", "Reino Unido", "England", "UK"], ["Ireland", "IE", "Irlanda"], ["France", "FR", "Francia"],
    ["Germany", "DE", "Alemania"], ["Italy", "IT", "Italia"], ["Portugal", "PT"], ["Netherlands", "NL", "Países Bajos", "Holanda"], ["Belgium", "BE", "Bélgica"],
    ["Switzerland", "CH", "Suiza"], ["Sweden", "SE", "Suecia"], ["Norway", "NO", "Noruega"], ["Poland", "PL", "Polonia"], ["China", "CN"],
    ["Japan", "JP", "Japón"], ["South Korea", "KR", "Corea del Sur", "Korea"], ["India", "IN"], ["Philippines", "PH", "Filipinas"], ["Australia", "AU"],
    ["New Zealand", "NZ", "Nueva Zelanda"], ["South Africa", "ZA", "Sudáfrica"], ["Nigeria", "NG"], ["Egypt", "EG", "Egipto"], ["Morocco", "MA", "Marruecos"],
    ["Turkey", "TR", "Turquía"], ["Russia", "RU", "Rusia"], ["Ukraine", "UA", "Ucrania"]
  ];
  const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  function findCountry(text) {
    const n = norm(text || "");
    if (!n) return null;
    for (const [name, iso, ...alts] of COUNTRIES) if ([name, ...alts].some(v => norm(v) === n)) return { name, iso };
    return null;
  }
  const flagOf = iso => iso ? String.fromCodePoint(...[...iso.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : "🧭";

  // ---------- profile ----------
  function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.abs(h); }
  function makeNumber(name) { const h = hash(name + Date.now()); return `PG-${new Date().getFullYear()}-${String(h % 1000).padStart(3, "0")}`; }
  function loadProfile() { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch (e) { return null; } }
  function saveProfile(p) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) {} }
  const fmtDate = d => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  function mrz(p) {
    const name = norm(p && p.name ? p.name : "explorer").toUpperCase().replace(/[^A-Z]/g, "<");
    const iso = (p && p.iso) || "PGI";
    const l1 = (`P<${iso.padEnd(3, "<")}${name}<<EXPLORER`).padEnd(40, "<").slice(0, 40);
    const num = ((p && p.number) || "PG0000000").replace(/[^A-Z0-9]/gi, "").toUpperCase();
    const age = String((p && p.age) || 0).padStart(2, "0");
    const l2 = (`${num}<${hash(num) % 10}${iso.padEnd(3, "<")}${age}<<ENGLISH<A2`).padEnd(40, "<").slice(0, 40);
    return [l1, l2];
  }

  // ---------- ranks ----------
  const RANKS = ["Rookie Explorer", "City Scout", "Street Navigator", "Urban Adventurer", "Legendary Explorer"];
  const rankFor = level => RANKS[Math.min(level, RANKS.length) - 1];

  // ---------- stamp layout ----------
  const TILT = [-7, 5, -4, 8, -9, 4];
  // ---------- number tween ----------
  function countTo(el, value, suffix = "") {
    if (!el) return;
    const from = parseFloat(el.dataset.v || "0"), to = value;
    el.dataset.v = to;
    if (from === to || REDUCED_MOTION) { el.textContent = to + suffix; return; }
    const start = performance.now(), dur = 900;
    const step = now => {
      const t = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * e) + suffix;
      if (t < 1) requestAnimationFrame(step);
      else { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
    };
    requestAnimationFrame(step);
  }

  // ---------- render ----------
  let cardKid = null, cardBird = null, cardTeam = null;
  function renderCard(profile, level) {
    const p = profile || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("pcName", p.name || "Explorer");
    set("pcCountry", p.country || "—");
    set("pcAge", p.age ? `${p.age} years` : "—");
    set("pcFlag", flagOf(p.iso));
    set("pcRank", rankFor(level));
    const team = TEAMS[p.team] || TEAMS.nico;
    set("pcTeam", `${team.kidName} & ${team.birdName}`);
    const [a, b] = mrz(p);
    const mz = document.getElementById("pcMrz"); if (mz) mz.innerHTML = `<span>${esc(a)}</span><span>${esc(b)}</span>`;
    const card = document.getElementById("passportCard");
    if (card) { card.classList.toggle("approved", !!profile); card.dataset.team = p.team || "nico"; }
    // animated idle of the chosen explorer + companion in the photo
    if (cardTeam !== team) {
      cardTeam = team;
      cardKid && cardKid.destroy(); cardBird && cardBird.destroy();
      cardKid = new SpriteView(document.getElementById("pcKid"), team.kid, "idle");
      cardBird = new SpriteView(document.getElementById("pcBird"), team.bird, "idle");
      cardBird.speed = 0.9;
    }
  }
  function cheerCard() { cardKid && cardKid.once("cheer"); cardBird && cardBird.once("cheer"); }

  function renderStamps(state, justId) {
    const grid = document.getElementById("stampGrid");
    grid.innerHTML = "";
    UNITS.forEach((u, i) => {
      const done = state.completed.includes(u.id);
      const cell = document.createElement("div");
      cell.className = "stamp" + (done ? " done" : "") + (u.id === justId ? " slam" : "") + (u.isFinal ? " final" : "");
      cell.style.setProperty("--rot", TILT[i % TILT.length] + "deg");
      cell.style.setProperty("--ink", u.color);
      const date = state.dates && state.dates[u.id];
      cell.innerHTML = done
        ? `<img src="${u.stamp}" alt="" class="stamp-art"><span class="stamp-date">${date ? fmtDate(date) : "DONE"}</span>`
        : `<span class="stamp-ghost"><span class="sg-emoji">${u.emoji}</span><span class="sg-unit">Unit ${u.id}</span></span>`;
      cell.insertAdjacentHTML("beforeend", `<span class="stamp-tip">${done ? `🏅 ${esc(u.badge)}` : `Unit ${u.id} · ${esc(u.title)}`}</span>`);
      cell.setAttribute("aria-label", done ? `Stamp: ${u.title}, ${u.badge}` : `Unit ${u.id} stamp not collected yet`);
      cell.setAttribute("role", "img");
      grid.appendChild(cell);
    });
    countTo(document.getElementById("stampCount"), state.completed.length);
  }

  let ticksDrawn = false;
  function renderLog(state, xpPerLevel, revealedPct, handlers) {
    if (!ticksDrawn) {
      const g = document.querySelector(".compass-ticks");
      if (g) g.innerHTML = Array.from({ length: 48 }, (_, i) => {
        const a = i * 7.5 * Math.PI / 180, long = i % 6 === 0, r1 = long ? 56 : 58.5, r2 = 61;
        return `<line x1="${70 + Math.sin(a) * r1}" y1="${70 - Math.cos(a) * r1}" x2="${70 + Math.sin(a) * r2}" y2="${70 - Math.cos(a) * r2}" stroke-width="${long ? 1.6 : .8}"/>`;
      }).join("");
      ticksDrawn = true;
    }
    const pct = Math.round(state.completed.length / UNITS.length * 100);
    document.getElementById("ringFill").setAttribute("stroke-dasharray", `${Math.max(pct, 0.01)} 100`);
    document.getElementById("needle").style.transform = `rotate(${pct * 3.6}deg)`;
    countTo(document.getElementById("progressPct"), pct, "%");
    const level = Math.floor(state.xp / xpPerLevel) + 1, into = state.xp % xpPerLevel;
    countTo(document.getElementById("levelVal"), level);
    document.getElementById("logRank").textContent = `Level ${level} · ${rankFor(level)}`;
    document.getElementById("xpFill").style.width = (into / xpPerLevel * 100) + "%";
    document.getElementById("xpCaption").textContent = `${into} / ${xpPerLevel} XP to Level ${level + 1}`;
    countTo(document.getElementById("xpVal"), state.xp);
    countTo(document.getElementById("coinVal"), state.coins);
    countTo(document.getElementById("islandPct"), revealedPct, "%");
    document.getElementById("progressFill").style.width = pct + "%";

    const next = UNITS.find(m => !state.completed.includes(m.id));
    const nc = document.getElementById("nextCard");
    nc.innerHTML = next
      ? `<span class="next-emoji">${next.emoji}</span>
         <span class="next-text"><small>Next adventure</small><b>Unit ${next.id} · ${esc(next.title)}</b></span>
         <button class="art-btn btn-go" id="nextGo"><span>Go!</span></button>`
      : `<span class="next-emoji">👑</span><span class="next-text"><small>Expedition complete</small><b>You are an English A2 Master!</b></span>`;
    if (next) document.getElementById("nextGo").addEventListener("click", () => handlers && handlers.openMission && handlers.openMission(next));
    return level;
  }

  function render(state, justId, opts) {
    renderStamps(state, justId);
    const level = renderLog(state, opts.xpPerLevel, opts.revealedPct, opts);
    renderCard(loadProfile(), level);
  }

  // ---------- 3D tilt + holographic glare ----------
  function enableTilt(el) {
    if (!el || REDUCED_MOTION || !window.matchMedia("(pointer: fine)").matches) return;
    el.addEventListener("pointermove", e => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty("--ry", ((x - 0.5) * 14).toFixed(2) + "deg");
      el.style.setProperty("--rx", ((0.5 - y) * 12).toFixed(2) + "deg");
      el.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
      el.style.setProperty("--my", (y * 100).toFixed(1) + "%");
      el.classList.add("tilting");
    });
    el.addEventListener("pointerleave", () => { el.classList.remove("tilting"); el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
  }

  return { COUNTRIES, findCountry, flagOf, loadProfile, saveProfile, makeNumber, mrz, fmtDate, render, enableTilt, rankFor, cheerCard, PROFILE_KEY };
})();
