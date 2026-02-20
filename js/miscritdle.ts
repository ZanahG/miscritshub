const $ = (sel: string) => document.querySelector(sel) as HTMLElement | null;

const TIMEZONE = "America/Santiago";
const MAX_TRIES = 6;

const MISCRITS_JSON_URL = "../assets/data/spawns.json";
const MISCRITDLE_POOL_URL = "../assets/data/miscritdle_pool.json";

const AVATAR_FOLDER = "../assets/images/miscrits_avatar/";
const AVATAR_FALLBACK = `${AVATAR_FOLDER}preset_avatar.png`;
const TYPE_FOLDER = "../assets/images/type/";

const RESET_HOUR = 21;
let endTimerInterval: ReturnType<typeof setInterval> | null = null;

let MISCRITS: any[] = [];
let MISCRITDLE_POOL: any[] = [];
let PLAYABLE: any[] = [];
let todayTarget: any = null;

const COLS = [
  { key: "miscrit", label: "MISCRIT" },
  { key: "element", label: "ELEMENT" },
  { key: "rarity", label: "RARITY" },
  { key: "place", label: "SPAWN PLACE" },
  { key: "variant", label: "IS VARIANT/FORM" }
];

const RARITY_ORDER = ["Common", "Rare", "Epic", "Exotic", "Legendary"];

const ELEMENTS = ["fire", "water", "nature", "earth", "wind","lightning"];

function parseElements(typeRaw: any) {
  const s = normalize(typeRaw).replace(/[^a-z]/g, "");
  const found = ELEMENTS.filter(el => s.includes(el));
  return [...new Set(found)];
}

function compareElements(guessType: any, targetType: any) {
  const g = parseElements(guessType);
  const t = parseElements(targetType);

  const gSet = new Set(g);
  const tSet = new Set(t);

  let common = 0;
  for (const el of gSet) if (tSet.has(el)) common++;

  const exact = (gSet.size === tSet.size) && common === gSet.size;
  const partial = !exact && common > 0;

  return { exact, partial, g, t, common };
}

/* ===============================
   Utils
=============================== */

function normalize(s: any) {
  return (s ?? "").toString().trim().toLowerCase();
}

function sameName(a: any, b: any) {
  return normalize(a) === normalize(b);
}

const VARIANT_PREFIXES = [
  "dark",
  "light",
  "foil",
  "blighted",
  "grimm",
  "alpha"
];

function isVariantName(name: any) {
  const n = normalize(name);
  return VARIANT_PREFIXES.some(p => n.startsWith(p + " "));
}

function rarityRank(r: any) {
  const rr = (r ?? "").toString().trim().toLowerCase();
  const idx = RARITY_ORDER.findIndex(x => x.toLowerCase() === rr);
  return idx >= 0 ? idx : -1;
}

function avatarSrc(m: any) {
  const file = (m?.avatar ?? "").toString().trim();
  return file ? `${AVATAR_FOLDER}${file}` : AVATAR_FALLBACK;
}

function elementIconSrc(type: any) {
  const el = normalize(type || "physical");
  return `${TYPE_FOLDER}${el}.png`;
}

function primaryPlace(m: any) {
  return (m?.spawns?.[0]?.place ?? "Unknown").toString();
}

/* ===============================
   Reset timer
=============================== */

function getNextResetTimestampChile() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = Number(parts.find(p => p.type === "year")?.value);
  const m = Number(parts.find(p => p.type === "month")?.value);
  const d = Number(parts.find(p => p.type === "day")?.value);

  const candidate = new Date(Date.UTC(y, m - 1, d, RESET_HOUR + 3, 0, 0));

  const chileHour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    hour12: false
  }).format(now));

  const chileMin = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    minute: "2-digit"
  }).format(now));

  const alreadyPassed = (chileHour > RESET_HOUR) || (chileHour === RESET_HOUR && chileMin >= 0);
  if (alreadyPassed) candidate.setUTCDate(candidate.getUTCDate() + 1);

  return candidate.getTime();
}

function fmt2(n: any) {
  return String(n).padStart(2, "0");
}

function startNextTimer() {
  const timerEl = $("#md-next-timer");
  if (!timerEl) return;

  if (endTimerInterval) clearInterval(endTimerInterval);

  const tick = () => {
    const next = getNextResetTimestampChile();
    const diff = Math.max(0, next - Date.now());

    const totalSec = Math.floor(diff / 1000);
    const hh = Math.floor(totalSec / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;

    timerEl.textContent = `${fmt2(hh)}:${fmt2(mm)}:${fmt2(ss)}`;
  };

  tick();
  endTimerInterval = setInterval(tick, 1000);
}

function stopNextTimer() {
  if (endTimerInterval) clearInterval(endTimerInterval);
  endTimerInterval = null;
}

/* ===============================
   Date key for "game day"
=============================== */

function getGameDateKey() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const y = Number(parts.find(p => p.type === "year")?.value);
  const m = Number(parts.find(p => p.type === "month")?.value);
  const d = Number(parts.find(p => p.type === "day")?.value);
  const hh = Number(parts.find(p => p.type === "hour")?.value);
  const mm = Number(parts.find(p => p.type === "minute")?.value);

  const afterReset = (hh > RESET_HOUR) || (hh === RESET_HOUR && mm >= 0);

  const base = new Date(Date.UTC(y, m - 1, d));
  if (afterReset) base.setUTCDate(base.getUTCDate() + 1);

  const yy = base.getUTCFullYear();
  const mm2 = String(base.getUTCMonth() + 1).padStart(2, "0");
  const dd2 = String(base.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm2}-${dd2}`;
}

function hashStringToInt(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

function storageKey() {
  return `miscritdle:${getGameDateKey()}`;
}

/* ===============================
   Pool loading + building
=============================== */

async function loadMiscritdlePool() {
  const res = await fetch(MISCRITDLE_POOL_URL, { cache: "no-store" });
  if (!res.ok) {
    console.warn("miscritdle_pool.json no encontrado, usando todos los Miscrits");
    MISCRITDLE_POOL = [];
    return;
  }

  const json = await res.json();
  if (Array.isArray(json?.pool)) {
    MISCRITDLE_POOL = json.pool
      .map((n: any) => n.toString().trim())
      .filter(Boolean);
  } else {
    MISCRITDLE_POOL = [];
  }
}

function buildMiscritdlePool(allMiscrits: any[]) {
  if (!MISCRITDLE_POOL.length) return allMiscrits;

  const byName = new Map(allMiscrits.map(m => [normalize(m.name), m]));
  const pool = MISCRITDLE_POOL
    .map(name => byName.get(normalize(name)))
    .filter(Boolean);

  if (!pool.length) {
    console.warn("Pool vacío (no matcheó nombres), usando todos los Miscrits");
    return allMiscrits;
  }

  return pool;
}

/* ===============================
   Pick today target
=============================== */

function pickTodayTarget(list: any[]) {
  const key = getGameDateKey();
  const idx = hashStringToInt(key) % list.length;
  return list[idx];
}

/* ===============================
   State
=============================== */

function setStatus(txt: string) {
  const el = $("#md-status");
  if (el) el.textContent = txt || "";
}

function loadState() {
  const raw = localStorage.getItem(storageKey());
  if (!raw) return { guesses: [], solved: false, finished: false };

  try {
    const st = JSON.parse(raw);
    if (!Array.isArray(st.guesses)) st.guesses = [];
    st.solved = !!st.solved;
    st.finished = !!st.finished;
    return st;
  } catch {
    return { guesses: [], solved: false, finished: false };
  }
}

function saveState(state: any) {
  localStorage.setItem(storageKey(), JSON.stringify(state));
}

/* ===============================
   Data helpers
=============================== */

function findByName(name: any) {
  const n = normalize(name);
  return MISCRITS.find(m => normalize(m?.name) === n) || null;
}

/* ===============================
   UI render
=============================== */

function renderHeader() {
  const header = $("#md-header");
  if (!header) return;

  header.innerHTML = "";
  for (const c of COLS) {
    const div = document.createElement("div");
    div.className = "cell";
    div.textContent = c.label;
    header.appendChild(div);
  }
}

function renderEndCard(state: any) {
  const card = $("#md-endcard");
  if (!card) return;

  if (!state.finished) {
    card.hidden = true;
    stopNextTimer();
    return;
  }

  const titleEl = $("#md-end-title");
  const avatarEl = $("#md-end-avatar") as HTMLImageElement | null;
  const line1El = $("#md-end-line1");
  const nameEl = $("#md-end-name");

  const isWin = state.solved === true;

  if (titleEl) titleEl.textContent = isWin ? "VICTORY!" : "YOU FAILED THIS TIME";
  if (line1El) line1El.textContent = isWin ? "You guessed it" : "The Miscrit was";
  if (nameEl) nameEl.textContent = todayTarget?.name ?? "-";
  if (avatarEl) {
    avatarEl.src = todayTarget ? avatarSrc(todayTarget) : AVATAR_FALLBACK;
    avatarEl.alt = todayTarget?.name ?? "";
  }

  card.hidden = false;
  startNextTimer();
}

function renderRow(guess: any, target: any) {
  const row = document.createElement("div");
  row.className = "miscritdle__row";

  /* ================= MISCRIT ================= */
  const c1 = document.createElement("div");
  const miscritMatch = sameName(guess.name, target.name);
  c1.className = `mdcell ${miscritMatch ? "ok" : "no"}`;
  c1.dataset.label = "Miscrit";
  c1.innerHTML = `<img class="md-avatar" src="${avatarSrc(guess)}" alt="${guess.name}">`;
  row.appendChild(c1);

  /* ================= ELEMENT ================= */
  const gType = (guess.type ?? "?").toString();
  const tType = (target.type ?? "?").toString();

  const cmp = compareElements(gType, tType);

  const c2 = document.createElement("div");
  c2.className = `mdcell ${cmp.exact ? "ok" : (cmp.partial ? "mid" : "no")}`;
  c2.dataset.label = "Element";

  const icons = (cmp.g.length ? cmp.g : [normalize(gType)]).slice(0, 2).map(el =>
    `<img class="md-elem" src="${elementIconSrc(el)}" alt="${el}">`
  ).join("");

  c2.innerHTML = `<div class="md-elemRow">${icons}</div>`;
  row.appendChild(c2);

  /* ================= RARITY ================= */
  const gR = (guess.rarity ?? "?").toString();
  const tR = (target.rarity ?? "?").toString();

  const gr = rarityRank(gR);
  const tr = rarityRank(tR);

  const c3 = document.createElement("div");

  if (normalize(gR) === normalize(tR)) {
    c3.className = "mdcell ok";
    c3.innerHTML = `<div class="mdtext">${gR}</div>`;
  } else if (gr === -1 || tr === -1) {
    c3.className = "mdcell no";
    c3.innerHTML = `<div class="mdtext">${gR}</div>`;
  } else {
    const hint = gr < tr ? "higher" : "lower";
    const arrow = hint === "higher" ? "↑" : "↓";
    const label = hint === "higher" ? "Higher" : "Lower";

    c3.className = `mdcell no mdhint mdhint--${hint}`;
    c3.innerHTML = `
      <div class="mdtext">
        ${gR}
        <span class="mdhint__arrow">${arrow}</span>
        <span class="mdhint__label">${label}</span>
      </div>
    `;
  }

  c3.dataset.label = "Rarity";
  row.appendChild(c3);

  /* ================= SPAWN ================= */
  const gP = primaryPlace(guess);
  const tP = primaryPlace(target);

  const c4 = document.createElement("div");
  c4.className = `mdcell ${normalize(gP) === normalize(tP) ? "ok" : "no"}`;
  c4.dataset.label = "Spawn";
  c4.innerHTML = `<div class="mdtext">${gP}</div>`;
  row.appendChild(c4);

  /* ================= VARIANT / FORM ================= */
  const targetIsVariant = isVariantName(target.name);
  const guessIsVariant = isVariantName(guess.name);

  const variantMatch = guessIsVariant === targetIsVariant;

  const c5 = document.createElement("div");
  c5.className = `mdcell ${variantMatch ? "ok" : "no"}`;
  c5.dataset.label = "Variant / Form";

  const guessTxt = guessIsVariant ? "VARIANT" : "NORMAL";
  c5.innerHTML = `<div class="mdtext md-yn">${variantMatch ? "NO VARIANT" : guessTxt}</div>`;

  row.appendChild(c5);

  return row;
}

function renderBoard(state: any) {
  const board = $("#md-board");
  if (!board) return;

  board.innerHTML = "";

  for (const g of state.guesses) {
    const gObj = findByName(g.name);
    if (!gObj) continue;
    board.appendChild(renderRow(gObj, todayTarget));
  }

  const shareBtn = $("#md-share") as HTMLButtonElement | null;
  if (state.solved) {
    setStatus(`You Win! ${state.guesses.length}/${MAX_TRIES}.`);
    if (shareBtn) shareBtn.disabled = false;
  } else if (state.finished) {
    if (shareBtn) shareBtn.disabled = false;
  } else {
    setStatus(`${state.guesses.length}/${MAX_TRIES} tries.`);
    if (shareBtn) shareBtn.disabled = true;
  }

  renderEndCard(state);
}

/* ===============================
   Share
=============================== */

function buildShareText(state: any, target: any) {
  const solved = state.solved === true;
  const tries = state.guesses.length;
  const dayKey = getGameDateKey();

  const title = `Miscritdle ${dayKey} — ${solved ? tries : "X"}/${MAX_TRIES}`;

  const tType = normalize(target.type || "");
  const tR = normalize(target.rarity || "");
  const tP = normalize(primaryPlace(target));
  const tVariant = isVariantName(target.name);

  const lines = state.guesses.map((g: any) => {
    const gObj = findByName(g.name) || g;
    const gType = normalize(gObj.type || "");
    const gRarity = normalize(gObj.rarity || "");
    const gPlace = normalize(primaryPlace(gObj));
    const gVariant = isVariantName(gObj.name);

    const cells = [
      sameName(gObj.name, target.name) ? "🟩" : "⬛",
      gType === tType ? "🟩" : "⬛",
      gRarity === tR ? "🟩" : "⬛",
      gPlace === tP ? "🟩" : "⬛",
      (gVariant === tVariant ? "🟩" : "⬛"),
    ];
    return cells.join("");
  });

  const reveal = solved ? "" : `\nAnswer: ${target.name}`;
  return `${title}\n${lines.join("\n")}${reveal}`;
}

/* ===============================
   Dropdown
=============================== */

function renderDropdown(matches: any[]) {
  const dd = $("#mdDropdown");
  if (!dd) return;

  if (!matches.length) {
    dd.hidden = true;
    dd.innerHTML = "";
    return;
  }

  dd.hidden = false;
  dd.innerHTML = matches.map(m => `
    <button type="button" class="miscritpicker__item" data-name="${m.name}">
      <img class="miscritpicker__avatar" src="${avatarSrc(m)}" alt="">
      <div class="miscritpicker__name">${m.name}</div>
    </button>
  `).join("");

  dd.querySelectorAll(".miscritpicker__item").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-name") || "";
      const input = $("#md-guess") as HTMLInputElement | null;
      if (input) input.value = name;
      dd.hidden = true;
    });
  });
}

function bindMiscritDropdown() {
  const input = $("#md-guess") as HTMLInputElement | null;
  const dd = $("#mdDropdown");
  if (!input || !dd) return;

  const close = () => { dd.hidden = true; };

  const open = () => {
    const q = normalize(input?.value);
    const base = PLAYABLE.length ? PLAYABLE : MISCRITS;

    const matches = base
      .filter(m => !q || normalize(m.name).includes(q))
      .slice(0, 60);

    renderDropdown(matches);
  };

  input.addEventListener("focus", open);
  input.addEventListener("input", open);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();

    if (e.key === "Enter") {
      const exact = findByName(input?.value);
      if (exact) return;

      const first = dd.querySelector(".miscritpicker__item");
      if (first) {
        e.preventDefault();
        (first as HTMLElement).click();
      }
    }
  });

  document.addEventListener("click", (e) => {
    const host = input.closest(".miscritpicker");
    if (!host) return;
    if (!host.contains(e.target as Node | null)) close();
  });
}

/* ===============================
   Events
=============================== */

function initEvents() {
  const input = $("#md-guess") as HTMLInputElement | null;
  const submit = $("#md-submit");
  const share = $("#md-share");

  const doGuess = () => {
    const name = (input?.value ?? "").trim();
    if (!name) return;

    const state = loadState();
    if (state.finished) return;

    const gObj = findByName(name);
    if (!gObj) {
      setStatus("Miscrit not found. Choose one of the menu.");
      return;
    }

    if (PLAYABLE.length && !PLAYABLE.some(m => sameName(m.name, gObj.name))) {
      setStatus("This Miscrit is not available in Miscritdle pool.");
      return;
    }

    if (state.guesses.some((g: any) => sameName(g.name, gObj.name))) {
      setStatus("You already tried that Miscrit.");
      return;
    }

    state.guesses.push({ name: gObj.name });

    if (sameName(gObj.name, todayTarget.name)) {
      state.solved = true;
      state.finished = true;
    } else if (state.guesses.length >= MAX_TRIES) {
      state.finished = true;
    }

    saveState(state);
    if (input) input.value = "";
    renderBoard(state);
  };

  submit?.addEventListener("click", doGuess);
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doGuess();
  });

  share?.addEventListener("click", async () => {
    const state = loadState();
    const text = buildShareText(state, todayTarget);
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied. Paste it in Discord.");
    } catch {
      prompt("Copy this:", text);
    }
  });
}

/* ===============================
   Load
=============================== */

async function loadMiscrits() {
  const res = await fetch(MISCRITS_JSON_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${MISCRITS_JSON_URL}`);

  const json = await res.json();
  const list = Array.isArray(json?.miscrits) ? json.miscrits : [];

  MISCRITS = list
    .filter((m: any) => m?.name)
    .slice()
    .sort((a: any, b: any) => (a.name ?? "").localeCompare((b.name ?? ""), "en", { sensitivity: "base" }));

  if (!MISCRITS.length) throw new Error("miscrits.json empty or invalid structure.");

  await loadMiscritdlePool();
  PLAYABLE = buildMiscritdlePool(MISCRITS);

  todayTarget = pickTodayTarget(PLAYABLE);
}

(async function boot() {
  try {
    await loadMiscrits();
    renderHeader();
    bindMiscritDropdown();
    initEvents();
    renderBoard(loadState());
  } catch (e) {
    console.error(e);
    setStatus("Error loading Miscritdle. Check console and JSON paths.");
  }
})();
