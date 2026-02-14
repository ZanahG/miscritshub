import { normalize, toNum, pickBestMove } from "./damage_core.js";

const $ = (sel) => document.querySelector(sel);

const PATH = {
  BASE_STATS: "../assets/data/base_stats.json",
  DB: "../assets/data/miscritsdb.json",
  META: "../assets/data/miscrits_meta.json",
  RELICS: "../assets/data/relics.json",
  AVATAR_FOLDER: "../assets/images/miscrits_avatar/",
  AVATAR_FALLBACK: "../assets/images/miscrits_avatar/preset_avatar.png",
  TYPE_ICON_FOLDER: "../assets/images/type/",
  STAT_ICON_DIR: "../assets/images/icons/",
  RELIC_ICON_FOLDER: "../assets/images/relics/",
  PATCH_TEMPLATE: "../assets/images/ui/arena.png",
};

const TB_BACKGROUNDS = [
  { key: "arena", file: "arena.png", label: "Arena" },
  { key: "cave", file: "cave.png", label: "Cave" },
  { key: "forest", file: "forest.png", label: "Forest" },
  { key: "mansion", file: "mansion.png", label: "Mansion" },
  { key: "mansion-outside", file: "mansion2.png", label: "Mansion Outside" },
  { key: "moon-cave", file: "mooncave.png", label: "Moon Cave" },
  { key: "moon-of-miscria", file: "moonofmiscria.png", label: "Moon Of Miscria" },
  { key: "mount-gemma", file: "mountgemma.png", label: "Mount Gemma" },
  { key: "the-shac", file: "theshac.png", label: "The Shac" },
  { key: "volcano-island", file: "volcanoisland.png", label: "Volcano Island" },
];

PATH.TEAMBUILDER_BG_FOLDER = "../assets/images/teambuilder/";
const RELIC_PLACEHOLDER = "../assets/images/relics/CRUZ.png";

let BR_RELIC_PICK_SLOT = null;
let BR_RELIC_LAST_LEVEL = null;
const BR_RELIC_LEVELS = [10, 20, 30, 35];

const STAT_ICON = {
  HP: "hp.png",
  SPD: "spd.png",
  EA: "ea.png",
  PA: "pa.png",
  ED: "ed.png",
  PD: "pd.png",
};

const COST_BY_RARITY = {
  Legendary: 5,
  Exotic: 4,
  Epic: 3,
  Rare: 2,
  Common: 1,
};

const TEAM_SIZE = 4;
const POINT_CAP = 12;
const PVP_LEVEL = 35;

const DEFAULT_COLORS = {
  hp: "green",
  spd: "green",
  ea: "green",
  pa: "green",
  ed: "green",
  pd: "green",
};

const DEFAULT_BONUS = { HP: 0, SPD: 0, EA: 0, PA: 0, ED: 0, PD: 0 };
const META_ENEMY_COLORS_ALLGREEN = {
  hp: "green",
  spd: "green",
  ea: "green",
  pa: "green",
  ed: "green",
  pd: "green",
};

const META_ENEMY_BONUS_26 = {
  HP: 26,
  SPD: 26,
  EA: 26,
  PA: 26,
  ED: 26,
  PD: 26,
};

let DB = [];
let BASE = [];
let META = [];

let RELICS_BY_KEY = {};
let RELICS_BY_LEVEL = { 10: [], 20: [], 30: [], 35: [] };
let RELIC_STATS_BY_LEVEL_KEY = { 10: {}, 20: {}, 30: {}, 35: {} };

let DB_BY_NAME = new Map();
let BASE_BY_NAME = new Map();
let META_BY_NAME = new Map();

let PICK_SLOT_INDEX = null;
let BR_SLOT_INDEX = null;
let SELECTED_THREAT = null;

let BR_TMP_COLORS = null;

const state = {
  slots: Array.from({ length: TEAM_SIZE }, () => null),
};

function stripHash() {
  return (location.hash || "").replace(/^#/, "");
}

function nowISO() {
  return new Date().toISOString();
}

function showToast(msg, ms = 1400) {
  const el = $("#tbToast");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;

  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    el.hidden = true;
    el.textContent = "";
  }, ms);
}

function getMetaRelicsFirstByLevel(name) {
  const meta = META_BY_NAME.get(normalize(name));
  const byLevel = meta?.relics_by_level;
  if (!byLevel || typeof byLevel !== "object") return [];

  const levels = [10, 20, 30, 35];
  const out = [];

  for (const lvl of levels) {
    const arr = byLevel[String(lvl)];
    const first = Array.isArray(arr) ? arr[0] : null;
    const key = relicNameToKey(first);
    if (key) out.push({ level: lvl, key });
  }
  return out;
}

async function loadJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
  return res.json();
}

function setTmpColorsPreset(preset) {
  if (preset === "allgreen") {
    BR_TMP_COLORS = { hp: "green", spd: "green", ea: "green", pa: "green", ed: "green", pd: "green" };
  } else if (preset === "rs") {
    BR_TMP_COLORS = { hp: "green", spd: "red", ea: "green", pa: "green", ed: "green", pd: "green" };
  }
}

function getActiveBRColors() {
  const slot = BR_SLOT_INDEX != null ? state.slots[BR_SLOT_INDEX] : null;
  return BR_TMP_COLORS || slot?.colors || DEFAULT_COLORS;
}

function statIconHTML(statKey) {
  const file = STAT_ICON[statKey];
  if (!file) return "";
  const src = PATH.STAT_ICON_DIR + file;
  return `<img class="tbBRStatIcon" src="${src}" alt="" draggable="false" onerror="this.style.display='none'">`;
}

function updatePresetButtonsUI() {
  const btnG = $("#tbBRAllGreen");
  const btnR = $("#tbBRRS");
  if (!btnG || !btnR) return;

  const colors = getActiveBRColors();
  const isRS = normalize(colors?.spd) === "red";

  btnG.classList.remove("is-active", "is-green", "is-red");
  btnR.classList.remove("is-active", "is-green", "is-red");

  if (isRS) btnR.classList.add("is-active", "is-red");
  else btnG.classList.add("is-active", "is-green");
}

function rowColorClass(statKey) {
  const map = { HP: "hp", SPD: "spd", EA: "ea", PA: "pa", ED: "ed", PD: "pd" };
  const colors = getActiveBRColors();
  const c = normalize(colors?.[map[statKey]] || "green");
  return c === "red" ? "is-red" : "is-green";
}

function avatarSrcFromMetaOrInfer(name) {
  const meta = META_BY_NAME.get(normalize(name));
  const metaAvatar = meta?.avatar;

  const inferred = normalize(name).replace(/\s+/g, "_").replace(/[^\w_]/g, "") + "_avatar.png";
  const file = metaAvatar || inferred;
  return `${PATH.AVATAR_FOLDER}${file}`;
}

function getMetaForName(name) {
  return META_BY_NAME.get(normalize(name)) || null;
}

function getRarityForName(name) {
  const meta = getMetaForName(name);
  if (meta?.rarity) return meta.rarity;

  const baseItem = BASE.find((x) => normalize(x?.name) === normalize(name));
  if (baseItem?.rarity) return baseItem.rarity;

  return "Common";
}

function getTierForName(name) {
  const meta = getMetaForName(name);
  return meta?.tierlist ?? meta?.tier ?? meta?.Tier ?? null;
}

function getTier(name) {
  const meta = META_BY_NAME.get(normalize(name));
  return (meta?.tierlist ?? meta?.tier ?? "").toString().toUpperCase();
}

function getDbMiscrit(name) {
  return DB_BY_NAME.get(normalize(name)) || null;
}

function getBase15(name) {
  return BASE_BY_NAME.get(normalize(name)) || null;
}

function getElementsForName(name) {
  const m = DB_BY_NAME.get(normalize(name));
  return Array.isArray(m?.elements) ? m.elements : [];
}

function colorFactor(color) {
  const c = normalize(color);
  if (c === "red") return 1;
  if (c === "white") return 2;
  return 3;
}

function statAtLevel(baseStat15, level, color, isHp) {
  const C = colorFactor(color);
  const L = Math.max(1, Math.min(35, Number(level) || 35));

  if (isHp) {
    const perLevel = (12 + 2 * toNum(baseStat15) + 1.5 * C) / 5;
    return Math.floor(perLevel * L + 10);
  } else {
    const perLevel = (3 + 2 * toNum(baseStat15) + 1.5 * C) / 6;
    return Math.floor(perLevel * L + 5);
  }
}

function computeTotalsLevel35(base15, colors = DEFAULT_COLORS, bonus = DEFAULT_BONUS, relic = null) {
  if (!base15) return null;
  const c = colors || DEFAULT_COLORS;

  const totals = {
    HP: statAtLevel(base15.hp, PVP_LEVEL, c.hp, true),
    SPD: statAtLevel(base15.spd, PVP_LEVEL, c.spd, false),
    EA: statAtLevel(base15.ea, PVP_LEVEL, c.ea, false),
    PA: statAtLevel(base15.pa, PVP_LEVEL, c.pa, false),
    ED: statAtLevel(base15.ed, PVP_LEVEL, c.ed, false),
    PD: statAtLevel(base15.pd, PVP_LEVEL, c.pd, false),
  };

  totals.HP += toNum(bonus?.HP);
  totals.SPD += toNum(bonus?.SPD);
  totals.EA += toNum(bonus?.EA);
  totals.PA += toNum(bonus?.PA);
  totals.ED += toNum(bonus?.ED);
  totals.PD += toNum(bonus?.PD);

  if (relic) {
    totals.HP += toNum(relic.HP);
    totals.SPD += toNum(relic.SPD);
    totals.EA += toNum(relic.EA);
    totals.PA += toNum(relic.PA);
    totals.ED += toNum(relic.ED);
    totals.PD += toNum(relic.PD);
  }

  return totals;
}

function recalcSlotTotals(slot) {
  if (!slot?.name) return;

  const base15 = getBase15(slot.name);
  const relicBonus = sumRelicBonuses(slot.relics || []);

  slot.relicBonus = relicBonus;
  slot.totals =
    computeTotalsLevel35(base15, slot.colors || DEFAULT_COLORS, slot.bonus || DEFAULT_BONUS, relicBonus) || {
      HP: 0,
      SPD: 0,
      EA: 0,
      PA: 0,
      ED: 0,
      PD: 0,
    };
}

function getSlotCost(slot) {
  if (!slot?.rarity) return 0;
  return COST_BY_RARITY[slot.rarity] ?? 0;
}

function pointsUsed() {
  return state.slots.reduce((sum, s) => sum + (s ? getSlotCost(s) : 0), 0);
}

function pointsLeft() {
  return POINT_CAP - pointsUsed();
}

function relicNameToKey(name) {
  const s = (name ?? "").toString().trim();
  if (!s) return "";
  if (/^[A-Z0-9_]+$/.test(s)) return s;

  return s
    .toUpperCase()
    .replace(/['’]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeRelicStats(stats) {
  const s = stats || {};
  const get = (k) => {
    const v =
      s[k] ??
      s[k.toLowerCase()] ??
      s[k.toUpperCase()] ??
      s[k.charAt(0).toUpperCase() + k.slice(1).toLowerCase()];
    return toNum(v);
  };

  return {
    HP: get("HP"),
    SPD: get("SPD"),
    EA: get("EA"),
    PA: get("PA"),
    ED: get("ED"),
    PD: get("PD"),
  };
}

function syncAnalyzeGate() {
  const sec = document.getElementById("tbAnalyzeSection");
  const body = document.getElementById("tbAnalyzeBody");
  const hint = document.getElementById("tbAnalyzeHint");
  if (!sec || !body || !hint) return;

  const ready = teamIsComplete();

  body.hidden = !ready;
  sec.classList.toggle("is-locked", !ready);
  hint.textContent = ready ? "Team ready. Open to review analysis." : "Complete 4 slots to unlock analysis.";

  // opcional: si no está listo, que quede cerrado
  if (!ready) sec.open = false;
}

function getRelicStatsByLevel(level, keyOrName) {
  const lvl = toNum(level);
  const key = relicNameToKey(keyOrName);
  if (!lvl || !key) return null;

  const stats = RELIC_STATS_BY_LEVEL_KEY?.[lvl]?.[key];
  return stats ? normalizeRelicStats(stats) : null;
}

function sumRelicBonuses(relicEntries) {
  const totals = { HP: 0, SPD: 0, EA: 0, PA: 0, ED: 0, PD: 0 };

  for (const ent of relicEntries || []) {
    const level = typeof ent === "object" ? ent.level : null;
    const key = typeof ent === "object" ? ent.key : ent;

    const st = level ? getRelicStatsByLevel(level, key) : null;
    if (!st) continue;

    totals.HP += toNum(st.HP);
    totals.SPD += toNum(st.SPD);
    totals.EA += toNum(st.EA);
    totals.PA += toNum(st.PA);
    totals.ED += toNum(st.ED);
    totals.PD += toNum(st.PD);
  }

  return totals;
}

async function loadAll() {
  const [dbJson, baseJson, metaJson, relicsJson] = await Promise.all([
    loadJSON(PATH.DB),
    loadJSON(PATH.BASE_STATS),
    loadJSON(PATH.META),
    loadJSON(PATH.RELICS).catch(() => null),
  ]);

  DB = Array.isArray(dbJson) ? dbJson : dbJson?.miscrits ?? [];
  BASE = Array.isArray(baseJson) ? baseJson : baseJson?.miscrits ?? [];
  META = metaJson?.miscrits ?? metaJson?.data ?? metaJson ?? [];

  DB_BY_NAME = new Map(DB.filter((m) => m?.name).map((m) => [normalize(m.name), m]));
  BASE_BY_NAME = new Map(BASE.filter((x) => x?.name && x?.baseStats).map((x) => [normalize(x.name), x.baseStats]));
  META_BY_NAME = new Map((Array.isArray(META) ? META : []).filter((x) => x?.name).map((x) => [normalize(x.name), x]));

  RELICS_BY_KEY = {};
  RELICS_BY_LEVEL = { 10: [], 20: [], 30: [], 35: [] };
  RELIC_STATS_BY_LEVEL_KEY = { 10: {}, 20: {}, 30: {}, 35: {} };

  const allowedLevels = new Set([10, 20, 30, 35]);

  const arr = Array.isArray(relicsJson)
    ? relicsJson
    : Array.isArray(relicsJson?.relics)
    ? relicsJson.relics
    : Array.isArray(relicsJson?.data)
    ? relicsJson.data
    : [];

  for (const r of arr) {
    const name = (r?.name ?? "").toString().trim();
    if (!name) continue;

    const level = toNum(r?.level);
    if (!allowedLevels.has(level)) continue;

    const statsRaw = r?.stats ?? r?.Stats ?? r?.STATS ?? {};
    const stats = normalizeRelicStats(statsRaw);
    const key = relicNameToKey(r?.key ?? r?.Key ?? name);

    RELIC_STATS_BY_LEVEL_KEY[level][key] = stats;
    RELICS_BY_LEVEL[level].push({ key, name });

    RELICS_BY_KEY[key] = { key, name, level, stats };
    RELICS_BY_KEY[normalize(name)] = { key, name, level, stats };
  }

  for (const lvl of [10, 20, 30, 35]) {
    const seen = new Set();
    RELICS_BY_LEVEL[lvl] = RELICS_BY_LEVEL[lvl]
      .filter((x) => x?.key && x?.name)
      .filter((x) => {
        const id = x.key;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  }
}

/* =========================
   Elements / Coverage
========================= */

const TYPE_ICON_ALIAS = {};

function typeKey(t) {
  const k = normalize(t);
  return TYPE_ICON_ALIAS[k] || k;
}

function typeIconSrc(t) {
  return `${PATH.TYPE_ICON_FOLDER}${typeKey(t)}.png`;
}

const TYPE_CHART = {
  fire: ["nature"],
  nature: ["water"],
  water: ["fire"],
  earth: ["lightning"],
  lightning: ["wind"],
  wind: ["earth"],
};

const ALL_TYPES = Object.keys(TYPE_CHART);

function defendersWeakTo(attElem) {
  const a = typeKey(attElem);
  return new Set((TYPE_CHART[a] || []).map(typeKey));
}

function attackersStrongVs(defElems) {
  const defs = (defElems || []).map(typeKey);
  const out = new Set();

  for (const atk of ALL_TYPES) {
    const strongList = (TYPE_CHART[atk] || []).map(typeKey);
    if (defs.some((d) => strongList.includes(d))) out.add(atk);
  }
  return out;
}

function chipHTML(t, count = null) {
  const src = typeIconSrc(t);
  const label = t.toUpperCase();

  return `
    <span class="tb-elchip" title="${label}">
      <img src="${src}" alt="${label}" onerror="this.style.display='none'">
      <span>${label}</span>
      ${count != null ? `<span class="tb-elchip__count">${count}</span>` : ""}
    </span>
  `;
}

function renderTypeList(hostSelector, types, { withCounts = false, countsMap = null } = {}) {
  const host = $(hostSelector);
  if (!host) return;

  if (!types || !types.length) {
    host.innerHTML = `<div class="tb-small" style="opacity:.8;">—</div>`;
    return;
  }

  if (!withCounts) {
    host.innerHTML = types.map((t) => chipHTML(t)).join("");
    return;
  }

  host.innerHTML = types.map((t) => chipHTML(t, countsMap?.get(t) || 0)).join("");
}

function getCoverageForSlot(slotName) {
  const dbMis = getDbMiscrit(slotName);
  const moves = Array.isArray(dbMis?.moves) ? dbMis.moves : [];
  const covered = new Set();

  for (const mv of moves) {
    const e = mv?.element;
    if (!e) continue;
    for (const def of defendersWeakTo(e)) covered.add(typeKey(def));
  }

  if (covered.size === 0) {
    const elems = Array.isArray(dbMis?.elements) ? dbMis.elements : [];
    for (const e of elems) for (const def of defendersWeakTo(e)) covered.add(typeKey(def));
  }

  return ALL_TYPES.filter((t) => covered.has(t));
}

function computeElementCheckV2() {
  const filled = state.slots.filter((s) => s?.name);
  if (filled.length !== TEAM_SIZE) {
    return {
      ready: false,
      weakCounts: new Map(),
      weakTypes: [],
      teamCovered: new Set(),
      notCovered: [],
      coveredBySlot: [],
    };
  }

  const weakCounts = new Map();
  for (const s of filled) {
    const elems = (s.elements || []).map(typeKey);
    const weakToSet = attackersStrongVs(elems);
    for (const atk of weakToSet) weakCounts.set(atk, (weakCounts.get(atk) || 0) + 1);
  }

  const weakTypes = ALL_TYPES
    .filter((t) => weakCounts.has(t))
    .sort((a, b) => weakCounts.get(b) - weakCounts.get(a) || a.localeCompare(b));

  const coveredBySlot = filled.map((s, idx) => {
    const coveredTypes = getCoverageForSlot(s.name);
    return { idx, name: s.name, coveredTypes };
  });

  const teamCovered = new Set();
  for (const row of coveredBySlot) for (const t of row.coveredTypes) teamCovered.add(t);

  const notCovered = ALL_TYPES.filter((t) => !teamCovered.has(t));
  return { ready: true, weakCounts, weakTypes, teamCovered, notCovered, coveredBySlot };
}

function renderCoveredBySlot(coveredBySlot) {
  const host = $("#tbCoveredBySlot");
  if (!host) return;

  host.innerHTML = coveredBySlot
    .map((row) => {
      const slotIndex = row.idx;
      const slot = state.slots[slotIndex];
      const avatar = slot?.name ? avatarSrcFromMetaOrInfer(slot.name) : PATH.AVATAR_FALLBACK;

      return `
        <div class="tb-coverSlot">
          <div class="tb-coverSlot__top">
            <img class="tb-coverSlot__ava" src="${avatar}" alt="" onerror="this.src='${PATH.AVATAR_FALLBACK}'">
            <div>
              <div class="tb-coverSlot__name">${slot?.name || `Slot ${slotIndex + 1}`}</div>
              <div class="tb-coverSlot__sub">${slot?.elements?.length ? slot.elements.join(", ") : "—"}</div>
            </div>
          </div>
          <div class="tb-els">
            ${
              row.coveredTypes.length
                ? row.coveredTypes.map((t) => chipHTML(t)).join("")
                : `<div class="tb-small" style="opacity:.8;">—</div>`
            }
          </div>
        </div>
      `;
    })
    .join("");
}

function renderElementCheck() {
  const data = computeElementCheckV2();

  if (!data.ready) {
    renderTypeList("#tbWeakBox", [], {});
    renderTypeList("#tbNotCoveredBox", [], {});
    const host = $("#tbCoveredBySlot");
    if (host) host.innerHTML = `<div class="tb-small" style="opacity:.8;">Fill all 4 slots to see this panel.</div>`;
    return;
  }

  const weakNotCovered = data.weakTypes.filter((t) => !data.teamCovered.has(t));
  renderTypeList("#tbWeakBox", weakNotCovered, { withCounts: true, countsMap: data.weakCounts });
  renderTypeList("#tbNotCoveredBox", data.notCovered, { withCounts: false });
  renderCoveredBySlot(data.coveredBySlot);
}

/* =========================
   Relics (FIXED)
========================= */

function relicBonusTextFromStats(st) {
  if (!st) return "No bonus";
  const parts = [];
  if (toNum(st.HP)) parts.push(`+${toNum(st.HP)} HP`);
  if (toNum(st.SPD)) parts.push(`+${toNum(st.SPD)} SPD`);
  if (toNum(st.EA)) parts.push(`+${toNum(st.EA)} EA`);
  if (toNum(st.PA)) parts.push(`+${toNum(st.PA)} PA`);
  if (toNum(st.ED)) parts.push(`+${toNum(st.ED)} ED`);
  if (toNum(st.PD)) parts.push(`+${toNum(st.PD)} PD`);
  return parts.join(" • ") || "—";
}

function brRelicKeyBySlot(rslot) {
  const id = ["tbBR_R1", "tbBR_R2", "tbBR_R3", "tbBR_R4"][rslot] || "tbBR_R1";
  return relicNameToKey((document.getElementById(id)?.value || "").trim());
}

function setBrRelicKeyBySlot(rslot, key) {
  const id = ["tbBR_R1", "tbBR_R2", "tbBR_R3", "tbBR_R4"][rslot] || "tbBR_R1";
  const el = document.getElementById(id);
  if (el) el.value = key ? relicNameToKey(key) : "";
}

function relicIconSrc(entry) {
  const raw = entry && typeof entry === "object" ? entry.key : entry;
  const k = relicNameToKey(raw);
  const file = k.toLowerCase();
  return `${PATH.RELIC_ICON_FOLDER}${encodeURIComponent(file)}.png`;
}


function refreshBRRelicSlotsUI() {
  document.querySelectorAll(".tbRelicSlot").forEach((btn) => {
    const rslot = Number(btn.getAttribute("data-rslot") || 0);
    const lvl = BR_RELIC_LEVELS[rslot] || 10;

    const key = brRelicKeyBySlot(rslot);
    const imgEl = btn.querySelector(".tbRelicSlot__img");

    let src = RELIC_PLACEHOLDER;
    let title = `Empty (lvl ${lvl})`;

    if (key && RELIC_STATS_BY_LEVEL_KEY?.[lvl]?.[key]) {
      src = relicIconSrc({ key });
      const prettyName = RELICS_BY_KEY?.[key]?.name || key;
      title = `${prettyName} (lvl ${lvl})`;
    }

    btn.title = title;
    btn.setAttribute("aria-label", title);

    if (imgEl) {
      imgEl.src = src;
      imgEl.onerror = () => {
        imgEl.onerror = null;
        imgEl.src = RELIC_PLACEHOLDER;
      };
    }
  });
}

function openTBRelicModalFor(rslot) {
  BR_RELIC_PICK_SLOT = rslot;

  const lvl = BR_RELIC_LEVELS[rslot] || 10;
  BR_RELIC_LAST_LEVEL = lvl;

  const modal = document.getElementById("tbRelicModal");
  const title = document.getElementById("tbRelicModalTitle");
  const grid = document.getElementById("tbRelicGrid");
  const search = document.getElementById("tbRelicSearch");

  if (!modal || !title || !grid || !search) {
    showToast("Relic modal not found (#tbRelicModal).");
    return;
  }

  title.textContent = `Relics lvl ${lvl}`;
  search.value = "";

  const renderGrid = (q) => {
    const qq = normalize(q);
    grid.innerHTML = "";

    const empty = document.createElement("div");
    empty.className = "tbRelicItem";
    empty.innerHTML = `
      <img class="tbRelicItem__img" src="${RELIC_PLACEHOLDER}" alt="">
      <div>
        <div class="tbRelicItem__name">Empty</div>
        <div class="tbRelicItem__bonus">No bonus</div>
      </div>
    `;
    empty.addEventListener("click", () => {
      setBrRelicKeyBySlot(rslot, "");
      refreshBRRelicSlotsUI();
      closeTBRelicModal();
      renderBRRelicPreview();
    });
    grid.appendChild(empty);

    const list = (RELICS_BY_LEVEL?.[lvl] || [])
      .filter((r) => r?.key && r?.name)
      .filter((r) => !qq || normalize(r.name).includes(qq))
      .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

    for (const r of list) {
      const st = RELIC_STATS_BY_LEVEL_KEY?.[lvl]?.[r.key];
      const item = document.createElement("div");
      item.className = "tbRelicItem";

      const icon = relicIconSrc({ key: r.key });

      item.innerHTML = `
        <img class="tbRelicItem__img" src="${icon}" alt="${r.name}">
        <div>
          <div class="tbRelicItem__name">${r.name}</div>
          <div class="tbRelicItem__bonus">${relicBonusTextFromStats(st) || "—"}</div>
        </div>
      `;

      const img = item.querySelector("img");
      if (img) {
        img.onerror = () => {
          img.onerror = null;
          img.src = RELIC_PLACEHOLDER;
        };
      }

      item.addEventListener("click", () => {
        setBrRelicKeyBySlot(rslot, r.key);
        refreshBRRelicSlotsUI();
        closeTBRelicModal();
        renderBRRelicPreview();
      });

      grid.appendChild(item);
    }
  };

  renderGrid("");
  search.oninput = () => renderGrid(search.value);

  modal.hidden = false;
  search.focus?.();
}

function closeTBRelicModal() {
  const modal = document.getElementById("tbRelicModal");
  if (modal) modal.hidden = true;
  BR_RELIC_PICK_SLOT = null;
}

function normalizeRelicStatsSafe(level, key) {
  const st = RELIC_STATS_BY_LEVEL_KEY?.[level]?.[key];
  return st ? normalizeRelicStats(st) : null;
}

/* =========================
   Slots UI
========================= */

function slotLabel(i) {
  return `Slot ${i + 1}`;
}

function slotSubline(slot) {
  if (!slot) return "Empty";
  const elems = slot.elements?.length ? slot.elements.join(", ") : "—";
  return `${slot.rarity} • ${slot.cost} pts • ${elems}`;
}

function renderPointsBar() {
  const used = pointsUsed();
  const left = pointsLeft();

  const usedEl = $("#tbUsed");
  const leftEl = $("#tbLeft");
  if (usedEl) usedEl.textContent = String(used);
  if (leftEl) leftEl.textContent = String(left);

  const pill = $("#tbPointsPill");
  if (pill) pill.classList.toggle("is-over", used > POINT_CAP);
}

function renderSlots() {
  const host = $("#tbSlots");
  if (!host) return;

  host.innerHTML = "";

  for (let i = 0; i < TEAM_SIZE; i++) {
    const slot = state.slots[i];

    const row = document.createElement("div");
    row.className = "tb-slot";

    const img = document.createElement("img");
    img.className = "tb-ava";
    img.alt = slot?.name || "";
    img.src = slot?.name ? avatarSrcFromMetaOrInfer(slot.name) : PATH.AVATAR_FALLBACK;
    img.onerror = () => (img.src = PATH.AVATAR_FALLBACK);

    const meta = document.createElement("div");
    meta.className = "tb-slot__meta";
    meta.innerHTML = `
      <div class="tb-slot__name">${slot?.name ?? slotLabel(i)}</div>
      <div class="tb-slot__sub">${slotSubline(slot)}</div>
    `;

    const actions = document.createElement("div");
    actions.className = "tb-slot__actions";

    const btnPick = document.createElement("button");
    btnPick.type = "button";
    btnPick.className = "tb-btn";
    btnPick.textContent = slot ? "Edit" : "Pick";
    btnPick.addEventListener("click", () => openPicker(i));

    const btnBR = document.createElement("button");
    btnBR.type = "button";
    btnBR.className = "tb-btn";
    btnBR.textContent = "Bonus & Relics";
    btnBR.disabled = !slot;
    btnBR.addEventListener("click", () => openBRModal(i));

    const btnClear = document.createElement("button");
    btnClear.type = "button";
    btnClear.className = "tb-btn";
    btnClear.textContent = "Clear";
    btnClear.disabled = !slot;
    btnClear.addEventListener("click", () => {
      state.slots[i] = null;
      refreshAll();
    });

    actions.appendChild(btnPick);
    actions.appendChild(btnBR);
    actions.appendChild(btnClear);

    row.appendChild(img);
    row.appendChild(meta);
    row.appendChild(actions);

    host.appendChild(row);
  }
}

function buildSlotFromName(name) {
  const rarity = getRarityForName(name);
  const cost = COST_BY_RARITY[rarity] ?? 0;

  const slot = {
    name,
    rarity,
    cost,
    tier: getTierForName(name),
    elements: getElementsForName(name),
    colors: { ...DEFAULT_COLORS },
    bonus: { ...DEFAULT_BONUS },
    relics: [],
    relicBonus: { HP: 0, SPD: 0, EA: 0, PA: 0, ED: 0, PD: 0 },
    totals: { HP: 0, SPD: 0, EA: 0, PA: 0, ED: 0, PD: 0 },
  };

  recalcSlotTotals(slot);
  return slot;
}

/* =========================
   Picker
========================= */

function openPicker(slotIndex) {
  PICK_SLOT_INDEX = slotIndex;

  const modal = $("#tbPickerModal");
  const title = $("#tbPickerTitle");
  const search = $("#tbPickerSearch");

  if (title) title.textContent = `Pick Miscrit • ${slotLabel(slotIndex)}`;
  if (search) search.value = "";

  renderPickerGrid("");
  if (modal) modal.hidden = false;

  search?.focus?.();
}

function closePicker() {
  const modal = $("#tbPickerModal");
  if (modal) modal.hidden = true;
  PICK_SLOT_INDEX = null;
}

function renderPickerGrid(query) {
  const grid = $("#tbPickerGrid");
  if (!grid) return;

  const onlyAffordable = !!$("#tbOnlyAffordable")?.checked;
  const q = normalize(query);

  const list = BASE.filter((x) => x?.name && x?.baseStats)
    .map((x) => x.name)
    .filter((n) => !q || normalize(n).includes(q))
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
    .slice(0, 200);

  grid.innerHTML = "";

  const usedBefore = pointsUsed();
  const currentSlot = PICK_SLOT_INDEX != null ? state.slots[PICK_SLOT_INDEX] : null;
  const currentCost = currentSlot ? currentSlot.cost : 0;
  const effectiveLeft = POINT_CAP - (usedBefore - currentCost);

  for (const name of list) {
    const rarity = getRarityForName(name);
    const cost = COST_BY_RARITY[rarity] ?? 0;

    const canPick = cost <= effectiveLeft;
    if (onlyAffordable && !canPick) continue;

    const tier = getTierForName(name);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "miscritpicker__item";
    if (!canPick) btn.disabled = true;

    const avatar = document.createElement("img");
    avatar.className = "miscritpicker__avatar";
    avatar.alt = "";
    avatar.src = avatarSrcFromMetaOrInfer(name);
    avatar.onerror = () => (avatar.src = PATH.AVATAR_FALLBACK);

    const left = document.createElement("div");
    left.className = "miscritpicker__left";
    left.appendChild(avatar);

    const nm = document.createElement("div");
    nm.className = "miscritpicker__name";
    nm.textContent = name;
    left.appendChild(nm);

    const right = document.createElement("div");
    right.className = "miscritpicker__right";
    const remAfter = effectiveLeft - cost;

    right.innerHTML = `
      <div><span class="miscritpicker__cost">${cost} pts</span> • ${rarity}</div>
      <div>${tier ? `Tier ${String(tier).toUpperCase()} • ` : ""}After pick: ${remAfter} left</div>
    `;

    btn.appendChild(left);
    btn.appendChild(right);

    btn.addEventListener("click", () => {
      if (PICK_SLOT_INDEX == null) return;
      state.slots[PICK_SLOT_INDEX] = buildSlotFromName(name);
      closePicker();
      refreshAll();
    });

    grid.appendChild(btn);
  }
}

/* =========================
   Bonus & Relics Modal
========================= */

function openBRModal(slotIndex) {
  const slot = state.slots[slotIndex];
  if (!slot?.name) return;

  BR_SLOT_INDEX = slotIndex;
  BR_TMP_COLORS = { ...(slot.colors || DEFAULT_COLORS) };

  const title = $("#tbBRTitle");
  const sub = $("#tbBRSub");
  if (title) title.textContent = `Bonus & Relics • ${slot.name}`;
  if (sub) sub.textContent = `Slot ${slotIndex + 1} • ${slot.elements?.join(", ") || "—"}`;

  const hp = $("#tbBR_HP");
  const spd = $("#tbBR_SPD");
  const ea = $("#tbBR_EA");
  const pa = $("#tbBR_PA");
  const ed = $("#tbBR_ED");
  const pd = $("#tbBR_PD");

  if (hp) hp.value = String(slot.bonus?.HP ?? 0);
  if (spd) spd.value = String(slot.bonus?.SPD ?? 0);
  if (ea) ea.value = String(slot.bonus?.EA ?? 0);
  if (pa) pa.value = String(slot.bonus?.PA ?? 0);
  if (ed) ed.value = String(slot.bonus?.ED ?? 0);
  if (pd) pd.value = String(slot.bonus?.PD ?? 0);

  const r = Array.isArray(slot.relics) ? slot.relics : [];
  const r1 = $("#tbBR_R1");
  const r2 = $("#tbBR_R2");
  const r3 = $("#tbBR_R3");
  const r4 = $("#tbBR_R4");
  if (r1) r1.value = r[0]?.key || "";
  if (r2) r2.value = r[1]?.key || "";
  if (r3) r3.value = r[2]?.key || "";
  if (r4) r4.value = r[3]?.key || "";

  refreshBRRelicSlotsUI();
  renderBRRelicPreview();
  renderBRFinalStats();
  updatePresetButtonsUI();

  const modal = $("#tbBRModal");
  if (modal) modal.hidden = false;
}

function closeBRModal() {
  const modal = $("#tbBRModal");
  if (modal) modal.hidden = true;
  BR_SLOT_INDEX = null;
  BR_TMP_COLORS = null;
}

function readBRRelicsWithLevels() {
  const pairs = [
    { level: 10, raw: $("#tbBR_R1")?.value },
    { level: 20, raw: $("#tbBR_R2")?.value },
    { level: 30, raw: $("#tbBR_R3")?.value },
    { level: 35, raw: $("#tbBR_R4")?.value },
  ];

  return pairs
    .map((p) => ({ level: p.level, key: relicNameToKey((p.raw || "").trim()) }))
    .filter((p) => p.key);
}

function renderBRRelicPreview() {
  const host = $("#tbBRRelicPreview");
  if (!host) return;

  const relics = readBRRelicsWithLevels();
  const bonus = sumRelicBonuses(relics);

  host.innerHTML = `
    <div class="tbBRKV__row"><b>${statIconHTML("HP")}HP</b><span>${bonus.HP}</span></div>
    <div class="tbBRKV__row"><b>${statIconHTML("SPD")}SPD</b><span>${bonus.SPD}</span></div>
    <div class="tbBRKV__row"><b>${statIconHTML("EA")}EA</b><span>${bonus.EA}</span></div>
    <div class="tbBRKV__row"><b>${statIconHTML("PA")}PA</b><span>${bonus.PA}</span></div>
    <div class="tbBRKV__row"><b>${statIconHTML("ED")}ED</b><span>${bonus.ED}</span></div>
    <div class="tbBRKV__row"><b>${statIconHTML("PD")}PD</b><span>${bonus.PD}</span></div>
  `;

  renderBRFinalStats();
}

function renderBRFinalStats() {
  const host = $("#tbBRFinalStats");
  if (!host) return;
  if (BR_SLOT_INDEX == null) return;

  const slot = state.slots[BR_SLOT_INDEX];
  if (!slot?.name) return;

  const bonus = {
    HP: toNum($("#tbBR_HP")?.value),
    SPD: toNum($("#tbBR_SPD")?.value),
    EA: toNum($("#tbBR_EA")?.value),
    PA: toNum($("#tbBR_PA")?.value),
    ED: toNum($("#tbBR_ED")?.value),
    PD: toNum($("#tbBR_PD")?.value),
  };

  const relics = readBRRelicsWithLevels();
  const relicBonus = sumRelicBonuses(relics);

  const base15 = getBase15(slot.name);
  const colors = getActiveBRColors();

  const totals =
    computeTotalsLevel35(base15, colors, bonus, relicBonus) || { HP: 0, SPD: 0, EA: 0, PA: 0, ED: 0, PD: 0 };

  const rows = [
    ["HP", totals.HP],
    ["SPD", totals.SPD],
    ["EA", totals.EA],
    ["PA", totals.PA],
    ["ED", totals.ED],
    ["PD", totals.PD],
  ];

  host.innerHTML = rows
    .map(([k, v]) => {
      const cls = rowColorClass(k);
      return `<div class="tbBRKV__row ${cls}"><b>${statIconHTML(k)}${k}</b><span>${v}</span></div>`;
    })
    .join("");

  updatePresetButtonsUI();
}

function applyBRModal() {
  if (BR_SLOT_INDEX == null) return;
  const slot = state.slots[BR_SLOT_INDEX];
  if (!slot?.name) return;

  slot.colors = { ...(BR_TMP_COLORS || slot.colors || DEFAULT_COLORS) };

  slot.bonus = {
    HP: toNum($("#tbBR_HP")?.value),
    SPD: toNum($("#tbBR_SPD")?.value),
    EA: toNum($("#tbBR_EA")?.value),
    PA: toNum($("#tbBR_PA")?.value),
    ED: toNum($("#tbBR_ED")?.value),
    PD: toNum($("#tbBR_PD")?.value),
  };

  slot.relics = readBRRelicsWithLevels();
  recalcSlotTotals(slot);

  closeBRModal();
  refreshAll();
  showToast("Bonus & relics applied.");
}

function validateRelicInput(inputEl, level) {
  if (!inputEl) return;

  const key = relicNameToKey((inputEl.value || "").trim());
  if (!key) return;

  const ok = !!RELIC_STATS_BY_LEVEL_KEY?.[level]?.[key];
  if (!ok) {
    inputEl.value = "";
    showToast(`That relic is not available for level ${level}.`);
    renderBRRelicPreview();
    refreshBRRelicSlotsUI();
  } else {
    refreshBRRelicSlotsUI();
  }
}

function resetBRModal() {
  if (BR_SLOT_INDEX == null) return;
  const slot = state.slots[BR_SLOT_INDEX];
  if (!slot?.name) return;

  BR_TMP_COLORS = { ...DEFAULT_COLORS };

  ["HP", "SPD", "EA", "PA", "ED", "PD"].forEach((k) => {
    const el = document.getElementById("tbBR_" + k);
    if (el) el.value = "0";
  });

  ["tbBR_R1", "tbBR_R2", "tbBR_R3", "tbBR_R4"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  refreshBRRelicSlotsUI();
  renderBRRelicPreview();
  renderBRFinalStats();
  showToast("Modal reset (preview).");
}

/* =========================
   Threats
========================= */

function classifyOutcome(htkYou, htkThem) {
  if (!Number.isFinite(htkYou) || !Number.isFinite(htkThem)) return "even";
  if (htkYou <= htkThem - 1) return "win";
  if (htkYou >= htkThem + 1) return "lose";
  return "even";
}

function getThreatTotalsMetaEnemy(threatName) {
  const base15 = getBase15(threatName);
  if (!base15) return null;

  const relicBonus = sumRelicBonuses(getMetaRelicsFirstByLevel(threatName));

  return computeTotalsLevel35(base15, META_ENEMY_COLORS_ALLGREEN, META_ENEMY_BONUS_26, relicBonus);
}

function bestAttackResult(attackerName, attackerTotals, defenderName, defenderTotals, mode = "auto") {
  const atkMis = getDbMiscrit(attackerName);
  const defMis = getDbMiscrit(defenderName);
  if (!atkMis || !defMis) return null;

  const best = pickBestMove(atkMis, attackerTotals, defMis, defenderTotals, mode);
  if (!best?.move || !best?.dmg) return null;

  return {
    moveName: best.move.name ?? "—",
    moveElem: best.move.element ?? "—",
    avg: best.dmg.avg,
    min: best.dmg.min,
    max: best.dmg.max,
    htk: best.dmg.htk,
    multiplier: best.dmg.multiplier,
    label: best.dmg.label,
  };
}

function getMetaThreatNames(limit = 80) {
  const order = { S: 0, A: 1, B: 2, C: 3, D: 4, F: 5 };

  return (Array.isArray(META) ? META : [])
    .filter((x) => x?.name)
    .map((x) => {
      const tier = (x.tierlist ?? x.tier ?? "").toString().toUpperCase().trim();
      return { name: x.name, tier };
    })
    .filter((x) => ["S", "A", "B", "C", "D"].includes(x.tier))
    .sort((a, b) => {
      const oa = order[a.tier] ?? 999;
      const ob = order[b.tier] ?? 999;
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    })
    .slice(0, limit)
    .map((x) => x.name);
}

function clearThreatAnalysis() {
  const box = $("#tbThreatsBox");
  if (box) box.innerHTML = "";
  const cb = $("#tbShowOnlyLoses");
  if (cb) cb.checked = false;
}

function analyzeThreats() {
  const box = $("#tbThreatsBox");
  if (!box) return;

  const mode = $("#tbMode")?.value ?? "auto";
  const onlyLoses = !!$("#tbShowOnlyLoses")?.checked;

  const teamSlots = state.slots.map((s, i) => ({ slot: s, idx: i })).filter((x) => x.slot?.name);

  if (teamSlots.length !== TEAM_SIZE) {
    box.innerHTML = `<div class="tb-warn">Fill all 4 slots to analyze threats.</div>`;
    return;
  }

  const threats = getMetaThreatNames(25);
  const rows = [];

  for (const threatName of threats) {
    const threatTotals = getThreatTotalsMetaEnemy(threatName);
    const threatDb = getDbMiscrit(threatName);
    if (!threatTotals || !threatDb) continue;

    let bestCounter = null;

    for (const { slot, idx } of teamSlots) {
      const atkName = slot.name;
      const atkTotals = slot.totals;
      if (!atkTotals) continue;

      const forward = bestAttackResult(atkName, atkTotals, threatName, threatTotals, mode);
      if (!forward || !Number.isFinite(forward.htk)) continue;

      const back = bestAttackResult(threatName, threatTotals, atkName, atkTotals, mode);
      const htkThem = back?.htk;

      const outcome = classifyOutcome(forward.htk, htkThem);
      const score = 1000 - Math.min(999, forward.htk * 100) + forward.avg / 10;

      const candidate = {
        threatName,
        threatTier: getTier(threatName) || "—",
        slotIdx: idx,
        slotName: atkName,
        yourMove: `${forward.moveName} (${forward.moveElem})`,
        yourAvg: forward.avg,
        yourRange: `${forward.min}–${forward.max}`,
        htkYou: forward.htk,
        htkThem: Number.isFinite(htkThem) ? htkThem : Infinity,
        outcome,
        score,
      };

      if (!bestCounter || candidate.score > bestCounter.score) bestCounter = candidate;
    }

    if (!bestCounter) continue;
    if (onlyLoses && bestCounter.outcome !== "lose") continue;
    rows.push(bestCounter);
  }

  if (!rows.length) {
    box.innerHTML = `<div class="tb-warn">No results (check data / slots / tiers).</div>`;
    return;
  }

  const rank = { lose: 0, even: 1, win: 2 };
  rows.sort(
    (a, b) =>
      rank[a.outcome] - rank[b.outcome] ||
      a.threatTier.localeCompare(b.threatTier) ||
      a.threatName.localeCompare(b.threatName)
  );

  box.innerHTML = rows
    .map((r) => {
      const cls = r.outcome === "win" ? "win" : r.outcome === "lose" ? "lose" : "even";
      const htkThemTxt = r.htkThem === Infinity ? "—" : String(r.htkThem);
      const avatar = avatarSrcFromMetaOrInfer(r.threatName);

      return `
        <div class="tb-threatRow">
          <div class="tb-col">
            <div class="tb-label">Miscrit Name</div>
            <div class="tb-value tb-miscrit">
              <img class="tb-mini-avatar" src="${avatar}" alt="" onerror="this.src='${PATH.AVATAR_FALLBACK}'">
              ${r.threatName}
            </div>
          </div>

          <div class="tb-col">
            <div class="tb-label">Best Option</div>
            <div class="tb-value">${r.slotName}</div>
          </div>

          <div class="tb-col">
            <div class="tb-label">Move</div>
            <div class="tb-value">${r.yourMove}</div>
          </div>

          <div class="tb-col">
            <div class="tb-label">HTK (You/Them)</div>
            <div class="tb-value tb-mono">${r.htkYou} / ${htkThemTxt}</div>
          </div>

          <div class="tb-col">
            <div class="tb-label">Damage</div>
            <div class="tb-value tb-mono">${r.yourRange}</div>
            <div class="tb-label" style="margin-top:6px;">Average</div>
            <div class="tb-value tb-mono">${r.yourAvg}</div>
          </div>

          <div class="tb-outcome">
            <span class="tb-badge ${cls}">${r.outcome.toUpperCase()}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function setQuickOut({ atkName = "—", defName = "—", move = "—", avg = "—", range = "—", htk = "—", mul = "—" }) {
  $("#tbOutAtk").textContent = atkName;
  $("#tbOutDef").textContent = defName;
  $("#tbOutMove").textContent = move;
  $("#tbOutAvg").textContent = avg;
  $("#tbOutRange").textContent = range;
  $("#tbOutHtk").textContent = htk;
  $("#tbOutMul").textContent = mul;
}

function runQuickCheck() {
  const atkSlotIdx = Number($("#tbAtkSlot")?.value ?? 0);
  const atkSlot = state.slots[atkSlotIdx];

  const threatName = SELECTED_THREAT || $("#tbThreatSearch")?.value?.trim();
  if (!atkSlot || !atkSlot.name || !threatName) {
    setQuickOut({});
    return;
  }

  const atkMis = DB_BY_NAME.get(normalize(atkSlot.name));
  const defMis = DB_BY_NAME.get(normalize(threatName));

  const atkTotals = atkSlot.totals;
  const defTotals = getThreatTotalsMetaEnemy(threatName);

  if (!atkMis || !defMis || !atkTotals || !defTotals) {
    setQuickOut({ atkName: atkSlot.name, defName: threatName });
    return;
  }

  const mode = $("#tbMode")?.value ?? "auto";

  const best = pickBestMove(atkMis, atkTotals, defMis, defTotals, mode);
  if (!best?.move || !best?.dmg) {
    setQuickOut({ atkName: atkSlot.name, defName: threatName });
    return;
  }

  const d = best.dmg;

  setQuickOut({
    atkName: atkSlot.name,
    defName: threatName,
    move: `${best.move.name} (${best.move.element ?? "—"})`,
    avg: String(d.avg),
    range: `${d.min}–${d.max}`,
    htk: d.htk === Infinity ? "—" : String(d.htk),
    mul: "x" + String(d.multiplier),
  });
}

function closeThreatDropdown() {
  const dd = $("#tbThreatDropdown");
  if (!dd) return;
  dd.hidden = true;
  dd.innerHTML = "";
}

function renderThreatDropdown(query = "") {
  const input = $("#tbThreatSearch");
  const dropdown = $("#tbThreatDropdown");
  if (!input || !dropdown) return;

  const q = normalize(query);
  dropdown.innerHTML = "";

  const matches = DB.filter((m) => m?.name).filter((m) => !q || normalize(m.name).includes(q)).slice(0, 40);

  if (!matches.length) {
    dropdown.hidden = true;
    return;
  }

  dropdown.hidden = false;

  for (const m of matches) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "miscritpicker__item";

    const avatar = document.createElement("img");
    avatar.className = "miscritpicker__avatar";
    avatar.src = avatarSrcFromMetaOrInfer(m.name);
    avatar.alt = m.name;
    avatar.onerror = () => (avatar.src = PATH.AVATAR_FALLBACK);

    const left = document.createElement("div");
    left.className = "miscritpicker__left";
    left.appendChild(avatar);

    const nm = document.createElement("div");
    nm.className = "miscritpicker__name";
    nm.textContent = m.name;
    left.appendChild(nm);

    btn.appendChild(left);

    btn.addEventListener("click", () => {
      SELECTED_THREAT = m.name;
      input.value = m.name;
      closeThreatDropdown();
      runQuickCheck();
    });

    dropdown.appendChild(btn);
  }
}

/* =========================
   Health
========================= */

function computeHealthWarnings() {
  const filled = state.slots.filter(Boolean);
  if (filled.length < TEAM_SIZE) return ["Add 4 Miscrits to see warnings."];

  const avgSpd = Math.floor(filled.reduce((s, x) => s + toNum(x.totals?.SPD), 0) / TEAM_SIZE);
  const avgHp = Math.floor(filled.reduce((s, x) => s + toNum(x.totals?.HP), 0) / TEAM_SIZE);

  const primary = filled
    .map((s) => (Array.isArray(s.elements) && s.elements.length ? normalize(s.elements[0]) : "none"))
    .filter(Boolean);

  const counts = new Map();
  for (const e of primary) counts.set(e, (counts.get(e) || 0) + 1);
  const maxSame = Math.max(...Array.from(counts.values()));

  const warnings = [];
  if (avgSpd < 120) warnings.push(`Low speed average (${avgSpd}). You may struggle vs fast teams.`);
  if (avgHp < 450) warnings.push(`Low HP average (${avgHp}). Team may be too fragile.`);
  if (maxSame >= 3) warnings.push(`3+ Miscrits share the same primary element. Consider more diversity.`);

  const high = filled.filter((s) => ["S", "A"].includes(String(s.tier ?? "").toUpperCase())).length;
  if (high <= 1) warnings.push(`Only ${high} high-tier pick(s). You may rely on a single carry.`);

  const used = pointsUsed();
  if (used <= 10) warnings.push(`You are using only ${used}/12 pts. You may be leaving value on the table.`);

  return warnings.length ? warnings : ["Looks solid. Use Quick Check to test vs S/A threats."];
}

function renderHealth() {
  const box = $("#tbHealth");
  if (!box) return;
  const list = computeHealthWarnings();
  box.innerHTML = list.map((x) => `• ${x}`).join("<br>");
}

/* =========================
   Export / Import / Save
========================= */

function exportPayload() {
  return { v: 1, cap: POINT_CAP, slots: state.slots };
}

function isSlotRS(slot) {
  const spd = normalize(slot?.colors?.spd);
  return spd === "red";
}

function slotBadge(slot) {
  return isSlotRS(slot) ? "RS" : "S+";
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawCenteredText(ctx, text, x, y) {
  const m = ctx.measureText(text);
  ctx.fillText(text, x - m.width / 2, y);
}

async function exportTeam() {
  const txt = JSON.stringify(exportPayload(), null, 2);

  try {
    await navigator.clipboard.writeText(txt);
    showToast("Export copied to clipboard.");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = txt;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showToast("Export copied to clipboard.");
    } catch {
      showToast("Could not copy. Check permissions.");
    }
    document.body.removeChild(ta);
  }
}

function openImportModal(prefill = "") {
  const modal = $("#tbImportModal");
  const ta = $("#tbImportText");
  if (ta) ta.value = prefill || "";
  if (modal) modal.hidden = false;
  ta?.focus?.();
}

function closeImportModal() {
  const modal = $("#tbImportModal");
  if (modal) modal.hidden = true;
}

function applyImportFromText(txt) {
  const raw = (txt || "").trim();
  if (!raw) {
    showToast("Paste a JSON first.");
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    showToast("Invalid JSON.");
    return;
  }

  const slots = Array.isArray(parsed?.slots) ? parsed.slots : null;
  if (!slots || slots.length !== TEAM_SIZE) {
    showToast("JSON format not valid for Team Builder.");
    return;
  }

  state.slots = slots.map((s) => {
    if (!s?.name) return null;

    const slot = buildSlotFromName(s.name);

    if (s.colors) slot.colors = { ...slot.colors, ...s.colors };
    if (s.bonus) slot.bonus = { ...slot.bonus, ...s.bonus };
    if (Array.isArray(s.relics)) {
      slot.relics = s.relics.slice(0, 4).map((ent, idx) => {
        if (ent && typeof ent === "object") {
          return { level: toNum(ent.level) || [10, 20, 30, 35][idx], key: relicNameToKey(ent.key) };
        }
        return { level: [10, 20, 30, 35][idx], key: relicNameToKey(ent) };
      });
    }

    recalcSlotTotals(slot);
    return slot;
  });

  closeImportModal();
  refreshAll();
  showToast("Team imported.");
}

function encodeShare() {
  const payload = { v: 1, slots: state.slots.map((s) => (s?.name ? s.name : null)) };
  const raw = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(raw)));
  location.hash = b64;
}

function decodeShare() {
  const h = stripHash();
  if (!h) return false;

  try {
    const raw = decodeURIComponent(escape(atob(h)));
    const payload = JSON.parse(raw);

    const names = Array.isArray(payload?.slots) ? payload.slots : null;
    if (!names || names.length !== TEAM_SIZE) return false;

    state.slots = names.map((n) => (n ? buildSlotFromName(n) : null));
    return true;
  } catch {
    return false;
  }
}

const STORAGE_KEY = "miscrits_teambuilder_saved_v1";

function loadSavedTeams() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveSavedTeams(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function teamIsComplete() {
  return state.slots.filter((s) => s?.name).length === TEAM_SIZE;
}

function teamSignature() {
  const parts = state.slots.map((s) => {
    if (!s?.name) return "";
    const b = s.bonus || DEFAULT_BONUS;
    const r = Array.isArray(s.relics) ? s.relics : [];
    return [s.name, `B:${b.HP},${b.SPD},${b.EA},${b.PA},${b.ED},${b.PD}`, `R:${r.map((x) => (x?.key ? x.key : x)).join(",")}`].join("|");
  });
  return parts.join("||");
}

function refreshSavedSelect() {
  const sel = $("#tbSavedSelect");
  if (!sel) return;

  const list = loadSavedTeams().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  sel.innerHTML =
    `<option value="">Saved Teams…</option>` +
    list
      .map((t) => {
        const label = t.label || "Untitled";
        const meta = t.updatedAt ? new Date(t.updatedAt).toLocaleString() : "";
        return `<option value="${t.id}">${label}${meta ? " • " + meta : ""}</option>`;
      })
      .join("");
}

function promptTeamName(defaultName = "") {
  const name = prompt("Name this team:", defaultName);
  return (name || "").trim();
}

function saveCurrentTeam() {
  if (!teamIsComplete()) {
    showToast("Fill all 4 slots before saving.");
    return;
  }

  const list = loadSavedTeams();
  const sig = teamSignature();

  const existing = list.find((x) => x.signature === sig);
  const suggested = existing?.label || `Team ${list.length + 1}`;

  const label = promptTeamName(suggested);
  if (!label) return;

  const entry = {
    id: existing?.id || (crypto?.randomUUID?.() ?? String(Date.now())),
    label,
    signature: sig,
    payload: exportPayload(),
    updatedAt: nowISO(),
  };

  const next = existing ? list.map((x) => (x.id === entry.id ? entry : x)) : [entry, ...list].slice(0, 40);

  saveSavedTeams(next);
  refreshSavedSelect();
  showToast(existing ? "Team updated." : "Team saved.");
}

function loadTeamById(id) {
  const list = loadSavedTeams();
  const t = list.find((x) => x.id === id);
  const payload = t?.payload;
  const slots = Array.isArray(payload?.slots) ? payload.slots : null;

  if (!slots || slots.length !== TEAM_SIZE) {
    showToast("Saved team not found.");
    return;
  }

  state.slots = slots.map((s) => {
    if (!s?.name) return null;
    const slot = buildSlotFromName(s.name);

    if (s.colors) slot.colors = { ...slot.colors, ...s.colors };
    if (s.bonus) slot.bonus = { ...slot.bonus, ...s.bonus };
    if (Array.isArray(s.relics)) {
      slot.relics = s.relics.slice(0, 4).map((ent, idx) => {
        if (ent && typeof ent === "object") {
          return { level: toNum(ent.level) || [10, 20, 30, 35][idx], key: relicNameToKey(ent.key) };
        }
        return { level: [10, 20, 30, 35][idx], key: relicNameToKey(ent) };
      });
    }

    recalcSlotTotals(slot);
    return slot;
  });

  refreshAll();
  showToast("Team loaded.");
}

function deleteTeamById(id) {
  const list = loadSavedTeams();
  const t = list.find((x) => x.id === id);
  if (!t) {
    showToast("Pick a saved team first.");
    return;
  }

  const ok = confirm(`Delete "${t.label}"?`);
  if (!ok) return;

  const next = list.filter((x) => x.id !== id);
  saveSavedTeams(next);
  refreshSavedSelect();

  const sel = $("#tbSavedSelect");
  if (sel) sel.value = "";
  showToast("Deleted.");
}

function syncError(msg) {
  const box = $("#tbError");
  if (!box) return;
  if (!msg) {
    box.hidden = true;
    box.textContent = "";
    return;
  }
  box.hidden = false;
  box.textContent = msg;
}

function refreshAll() {
  renderPointsBar();
  renderSlots();
  if (teamIsComplete()) {
    renderHealth();
    renderElementCheck();
  } else {
    const hb = document.getElementById("tbHealth");
    const wb = document.getElementById("tbWeakBox");
    const nb = document.getElementById("tbNotCoveredBox");
    const cbs = document.getElementById("tbCoveredBySlot");
    if (hb) hb.innerHTML = "—";
    if (wb) wb.innerHTML = "—";
    if (nb) nb.innerHTML = "—";
    if (cbs) cbs.innerHTML = "";
  }
  syncAnalyzeGate();
  runQuickCheck();
  syncError(null);
}

/* =========================
   IMG Preview + Export (FIXED + DEFINED)
========================= */

const IMG_LAYOUT_KEY = "miscrits_tb_img_layout_v1";

const IMG_DEFAULT = {
  titleY: 145,
  titleSize: 118,

  avatarY: 240,
  avatarSize: 140,
  avatarGap: 120,

  badgeY: 210,
  badgeSize: 56,

  weakY: 690,
  covY: 890,
  typeX: 62,
  typeRowGap: 22,

  typeIconR: 18,
  typeIconStep: 34,
  coverageOffsetY: 0,

  iconR: 32,
  iconStep: 64,
};

let IMG_CFG = { ...IMG_DEFAULT };
let IMG_TEAMNAME = "TEAM NAME";

function loadImgCfg() {
  try {
    const raw = localStorage.getItem(IMG_LAYOUT_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    IMG_CFG = { ...IMG_DEFAULT, ...parsed };
  } catch {}
}

function saveImgCfg() {
  localStorage.setItem(IMG_LAYOUT_KEY, JSON.stringify(IMG_CFG));
}

function setRangeValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = String(value);
}

function bindRange(id, key) {
  const el = document.getElementById(id);
  if (!el) return;

  el.value = String(IMG_CFG[key]);

  el.oninput = () => {
    IMG_CFG[key] = Number(el.value);
    saveImgCfg();
    renderImgPreview();
  };
}

async function renderImgPreview() {
  const canvas = document.getElementById("tbImgCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const W = 1536,
    H = 1024;
  ctx.clearRect(0, 0, W, H);

  const bgEntry = TB_BACKGROUNDS.find(x => x.key === IMG_CFG.bgKey) || TB_BACKGROUNDS[0];
  const bgSrc = bgEntry ? (PATH.TEAMBUILDER_BG_FOLDER + bgEntry.file) : PATH.PATCH_TEMPLATE;

  const bg = await loadImage(bgSrc);
  if (bg) ctx.drawImage(bg, 0, 0, W, H);

  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  ctx.font = `900 ${IMG_CFG.titleSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  drawCenteredText(ctx, (IMG_TEAMNAME || "TEAM NAME").toUpperCase(), 768, IMG_CFG.titleY);

  const slots = state.slots;
  const avatarSize = IMG_CFG.avatarSize;
  const gap = IMG_CFG.avatarGap;

  const totalWidth = avatarSize * 4 + gap * 3;
  const startX = Math.round((W - totalWidth) / 2);

  ctx.font = `800 ${IMG_CFG.badgeSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.fillStyle = "#fff";

  const avatarImgs = await Promise.all(
    slots.map((s) => loadImage(s?.name ? avatarSrcFromMetaOrInfer(s.name) : PATH.AVATAR_FALLBACK))
  );

  for (let i = 0; i < 4; i++) {
    const slot = slots[i];
    const x = startX + i * (avatarSize + gap);

    drawCenteredText(ctx, slotBadge(slot), x + avatarSize / 2, IMG_CFG.badgeY);

    const img = avatarImgs[i] || (await loadImage(PATH.AVATAR_FALLBACK));
    if (img) ctx.drawImage(img, x, IMG_CFG.avatarY, avatarSize, avatarSize);
  }

  const el = computeElementCheckV2();
  const weaknessList = el.ready ? el.weakTypes.filter((t) => !el.teamCovered.has(t)) : [];
  const coverageList = el.ready ? Array.from(el.teamCovered) : [];

  const labelX = IMG_CFG.typeX ?? 62;
  const labelFontPx = 34;

  const iconRowGap = IMG_CFG.typeRowGap ?? 22;

  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  ctx.font = `900 ${labelFontPx}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;

  const weakLabelY = IMG_CFG.weakY;
  const covLabelY = IMG_CFG.covY;

  const weakText = "WEAKNESS";
  const covText = "COVERAGE";

  ctx.fillText(weakText, labelX, weakLabelY);
  ctx.fillText(covText, labelX, covLabelY);

  const weakM = ctx.measureText(weakText);
  const covM = ctx.measureText(covText);

  const weakDescent = weakM.actualBoundingBoxDescent || labelFontPx * 0.25;
  const covDescent = covM.actualBoundingBoxDescent || labelFontPx * 0.25;

  const weakBottomY = weakLabelY + weakDescent;
  const covBottomY = covLabelY + covDescent;

  const weakIconsCenterY = weakBottomY + iconRowGap;
  const covIconsCenterY = covBottomY + iconRowGap - (IMG_CFG.coverageOffsetY || 0);

  function drawCircleIcon(img, cx, cy, r) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (img) ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  async function drawTypeRowBelow(types, startX, centerY) {
    const list = (types || []).slice(0, 12);
    const imgs = await Promise.all(list.map((t) => loadImage(typeIconSrc(t))));
    for (let i = 0; i < list.length; i++) {
      const cx = startX + i * (IMG_CFG.typeIconStep || 55);
      drawCircleIcon(imgs[i], cx, centerY, IMG_CFG.typeIconR);
    }
  }

  const iconsOffsetX = 18;

  await drawTypeRowBelow(weaknessList, labelX + iconsOffsetX, weakIconsCenterY);
  await drawTypeRowBelow(coverageList, labelX + iconsOffsetX, covIconsCenterY);

  const relicR = Math.max(16, Math.floor(IMG_CFG.iconR * 1.3));
  const relicStep = Math.max(40, Math.floor(IMG_CFG.iconStep * 1.5));
  const relicStartY = IMG_CFG.avatarY + IMG_CFG.avatarSize + 40;

  for (let i = 0; i < 4; i++) {
    const slot = slots[i];
    const x = startX + i * (avatarSize + gap);

    const relicEntries = Array.isArray(slot?.relics) ? slot.relics.slice(0, 4) : [];
    const relicImgs = await Promise.all(relicEntries.map((ent) => loadImage(relicIconSrc(ent))));

    for (let r = 0; r < relicEntries.length; r++) {
      const cy = relicStartY + r * relicStep;
      const cx = x + avatarSize / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, relicR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      const im = relicImgs[r];
      if (im) ctx.drawImage(im, cx - relicR, cy - relicR, relicR * 2, relicR * 2);
      ctx.restore();
    }
  }
}

function openImgModal() {
  if (!teamIsComplete()) {
    showToast("Fill all 4 slots before exporting IMG.");
    return;
  }

  const modal = document.getElementById("tbImgModal");
  if (!modal) {
    showToast("IMG Preview modal not found. Did you add the #tbImgModal HTML?");
    return;
  }

  loadImgCfg();
  const bgSel = document.getElementById("tbImgBg");
  if (bgSel) {
    bgSel.innerHTML = TB_BACKGROUNDS
      .map(b => `<option value="${b.key}">${b.label}</option>`)
      .join("");

    bgSel.value = IMG_CFG.bgKey || (TB_BACKGROUNDS[0]?.key || "arena");

    bgSel.onchange = () => {
      IMG_CFG.bgKey = bgSel.value;
      saveImgCfg();
      renderImgPreview();
    };
  }

  const nameInput = document.getElementById("tbImgTeamName");
  if (nameInput) {
    nameInput.value = IMG_TEAMNAME || "TEAM NAME";
    nameInput.oninput = () => {
      IMG_TEAMNAME = nameInput.value || "TEAM NAME";
      renderImgPreview();
    };
  }

  bindRange("tbImg_typeX", "typeX");
  bindRange("tbImg_titleY", "titleY");
  bindRange("tbImg_titleSize", "titleSize");
  bindRange("tbImg_avatarY", "avatarY");
  bindRange("tbImg_avatarSize", "avatarSize");
  bindRange("tbImg_avatarGap", "avatarGap");
  bindRange("tbImg_badgeY", "badgeY");
  bindRange("tbImg_badgeSize", "badgeSize");
  bindRange("tbImg_weakY", "weakY");
  bindRange("tbImg_covY", "covY");
  bindRange("tbImg_typeIconR", "typeIconR");
  bindRange("tbImg_typeIconStep", "typeIconStep");
  bindRange("tbImg_covOffsetY", "coverageOffsetY");
  bindRange("tbImg_iconR", "iconR");
  bindRange("tbImg_iconStep", "iconStep");

  const btnReset = document.getElementById("tbImgReset");
  if (btnReset) {
    btnReset.onclick = () => {
      IMG_CFG = { ...IMG_DEFAULT };
      saveImgCfg();

      Object.keys(IMG_DEFAULT).forEach((k) => {
        const idMap = {
          typeX: "tbImg_typeX",
          titleY: "tbImg_titleY",
          titleSize: "tbImg_titleSize",
          avatarY: "tbImg_avatarY",
          avatarSize: "tbImg_avatarSize",
          avatarGap: "tbImg_avatarGap",
          badgeY: "tbImg_badgeY",
          badgeSize: "tbImg_badgeSize",
          weakY: "tbImg_weakY",
          covY: "tbImg_covY",
          typeIconR: "tbImg_typeIconR",
          typeIconStep: "tbImg_typeIconStep",
          coverageOffsetY: "tbImg_covOffsetY",
          iconR: "tbImg_iconR",
          iconStep: "tbImg_iconStep",
        };
        const id = idMap[k];
        if (id) setRangeValue(id, IMG_CFG[k]);
      });

      renderImgPreview();
      showToast("Layout reset.");
    };
  }

  const btnClose = document.getElementById("tbImgClose");
  if (btnClose) btnClose.onclick = () => (modal.hidden = true);

  const btnDownload = document.getElementById("tbImgDownload");
  if (btnDownload) {
    btnDownload.onclick = () => {
      const canvas = document.getElementById("tbImgCanvas");
      if (!canvas) return;
      const a = document.createElement("a");
      a.download = `${(IMG_TEAMNAME || "TEAM_NAME").replace(/[^\w\-]+/g, "_")}_team.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
  }

  modal.hidden = false;
  renderImgPreview();
}

function fillRelicDatalists() {
  const map = {
    10: document.getElementById("tbRelicsLvl10"),
    20: document.getElementById("tbRelicsLvl20"),
    30: document.getElementById("tbRelicsLvl30"),
    35: document.getElementById("tbRelicsLvl35"),
  };

  for (const lvl of [10, 20, 30, 35]) {
    const dl = map[lvl];
    if (!dl) continue;
    dl.innerHTML = RELICS_BY_LEVEL[lvl].map((r) => `<option value="${r.key}">${r.name}</option>`).join("");
  }
}

/* =========================
   UI bindings
========================= */

function bindUI() {
  $("#tbClearAll")?.addEventListener("click", () => {
    state.slots = Array.from({ length: TEAM_SIZE }, () => null);
    SELECTED_THREAT = null;

    const input = $("#tbThreatSearch");
    if (input) input.value = "";
    closeThreatDropdown();

    clearThreatAnalysis();
    refreshAll();
  });

  $("#tbPickerClose")?.addEventListener("click", closePicker);
  $("#tbPickerSearch")?.addEventListener("input", (e) => renderPickerGrid(e.target.value));
  $("#tbOnlyAffordable")?.addEventListener("change", () => renderPickerGrid($("#tbPickerSearch")?.value || ""));

  $("#tbPickerModal")?.addEventListener("click", (e) => {
    if (e.target.id === "tbPickerModal") closePicker();
  });

  $("#tbBRClose")?.addEventListener("click", closeBRModal);
  $("#tbBRApply")?.addEventListener("click", applyBRModal);
  $("#tbBRReset")?.addEventListener("click", resetBRModal);

  const brLiveIds = ["tbBR_HP", "tbBR_SPD", "tbBR_EA", "tbBR_PA", "tbBR_ED", "tbBR_PD", "tbBR_R1", "tbBR_R2", "tbBR_R3", "tbBR_R4"];
  brLiveIds.forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
      renderBRRelicPreview();
      refreshBRRelicSlotsUI();
    });
  });

  $("#tbBRAllGreen")?.addEventListener("click", () => {
    setTmpColorsPreset("allgreen");
    renderBRFinalStats();
  });

  $("#tbBRRS")?.addEventListener("click", () => {
    setTmpColorsPreset("rs");
    renderBRFinalStats();
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".tbRelicSlot");
    if (!btn) return;

    const brModal = document.getElementById("tbBRModal");
    if (brModal && brModal.hidden) return;

    const rslot = Number(btn.getAttribute("data-rslot") || 0);
    openTBRelicModalFor(rslot);
  });

  document.addEventListener("click", (e) => {
    if (e.target?.id === "tbRelicModal") {
      closeTBRelicModal();
      return;
    }
    if (e.target.closest('[data-action="tbRelicClose"]')) {
      closeTBRelicModal();
      return;
    }
    if (e.target?.id === "tbRelicClose") {
      closeTBRelicModal();
      return;
    }
  });

  document.getElementById("tbBR_R1")?.addEventListener("change", () => validateRelicInput(document.getElementById("tbBR_R1"), 10));
  document.getElementById("tbBR_R2")?.addEventListener("change", () => validateRelicInput(document.getElementById("tbBR_R2"), 20));
  document.getElementById("tbBR_R3")?.addEventListener("change", () => validateRelicInput(document.getElementById("tbBR_R3"), 30));
  document.getElementById("tbBR_R4")?.addEventListener("change", () => validateRelicInput(document.getElementById("tbBR_R4"), 35));
  document.getElementById("tbRelicClose")?.addEventListener("click", closeTBRelicModal);

  $("#tbAnalyzeThreats")?.addEventListener("click", analyzeThreats);
  $("#tbClearThreats")?.addEventListener("click", clearThreatAnalysis);
  $("#tbShowOnlyLoses")?.addEventListener("change", analyzeThreats);
  $("#tbMode")?.addEventListener("change", () => {
    runQuickCheck();
    analyzeThreats();
  });

  $("#tbThreatSearch")?.addEventListener("focus", (e) => renderThreatDropdown(e.target.value));
  $("#tbThreatSearch")?.addEventListener("input", (e) => {
    SELECTED_THREAT = null;
    renderThreatDropdown(e.target.value);
  });
  $("#tbThreatSearch")?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeThreatDropdown();
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();
    const first = $("#tbThreatDropdown")?.querySelector(".miscritpicker__item");
    if (first) first.click();
  });

  document.addEventListener("click", (e) => {
    const input = $("#tbThreatSearch");
    const dd = $("#tbThreatDropdown");
    if (!input || !dd) return;

    const wrap = input.closest(".miscritpicker");
    if (wrap && !wrap.contains(e.target)) closeThreatDropdown();
  });

  $("#tbAtkSlot")?.addEventListener("change", runQuickCheck);

  $("#tbExportBtn")?.addEventListener("click", exportTeam);
  $("#tbExportImgBtn")?.addEventListener("click", openImgModal);
  $("#tbImportBtn")?.addEventListener("click", () => openImportModal(""));

  $("#tbImportClose")?.addEventListener("click", closeImportModal);
  $("#tbImportCancel")?.addEventListener("click", closeImportModal);
  $("#tbImportApply")?.addEventListener("click", () => applyImportFromText($("#tbImportText")?.value || ""));

  $("#tbCopyLinkBtn")?.addEventListener("click", async () => {
    encodeShare();
    try {
      await navigator.clipboard.writeText(location.href);
      showToast("Share link copied.");
    } catch {
      showToast("Could not copy link.");
    }
  });

  $("#tbSaveTeamBtn")?.addEventListener("click", saveCurrentTeam);

  $("#tbLoadSavedBtn")?.addEventListener("click", () => {
    const id = $("#tbSavedSelect")?.value || "";
    if (!id) {
      showToast("Select a saved team.");
      return;
    }
    loadTeamById(id);
  });

  $("#tbDeleteSavedBtn")?.addEventListener("click", () => {
    const id = $("#tbSavedSelect")?.value || "";
    if (!id) {
      showToast("Select a saved team.");
      return;
    }
    deleteTeamById(id);
  });

    // =========================
  // IMG MODAL: close bindings (SIEMPRE)
  // =========================
  const imgModal = document.getElementById("tbImgModal");
  const imgClose = document.getElementById("tbImgClose");

  imgClose?.addEventListener("click", () => {
    imgModal.hidden = true;
  });

  imgModal?.addEventListener("click", (e) => {
    // click fuera del panel
    if (e.target === imgModal) imgModal.hidden = true;
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    if ($("#tbPickerModal") && !$("#tbPickerModal").hidden) closePicker();
    if ($("#tbBRModal") && !$("#tbBRModal").hidden) closeBRModal();
    if ($("#tbImportModal") && !$("#tbImportModal").hidden) closeImportModal();
    if (document.getElementById("tbRelicModal") && !document.getElementById("tbRelicModal").hidden) closeTBRelicModal();
  });
}

/* =========================
   Init
========================= */

async function init() {
  try {
    await loadAll();
    fillRelicDatalists();

    const loaded = decodeShare();
    if (!loaded) state.slots = Array.from({ length: TEAM_SIZE }, () => null);

    bindUI();
    refreshSavedSelect();
    refreshAll();
  } catch (e) {
    console.error(e);
    syncError(e?.message || "Error loading data. Check console and JSON paths.");
  }
}

init();
