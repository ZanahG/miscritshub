import { normalize, toNum } from "./damage_core.js";

const $ = (sel) => document.querySelector(sel);

const PATH = {
  DB: "../assets/data/miscritsdb.json",
  BASE_STATS: "../assets/data/base_stats.json",
  META: "../assets/data/miscrits_meta.json",
  RELICS: "../assets/data/relics.json",

  AVATAR_FOLDER: "../assets/images/miscrits_avatar/",
  AVATAR_FALLBACK: "../assets/images/relics/cruz.png",

  RELIC_ICON_FOLDER: "../assets/images/relics/",
  STAT_ICON_DIR: "../assets/images/icons/",
};

const TEAM_SIZE = 4;
const POINT_CAP = 12;
const PVP_LEVEL = 35;

PATH.TEAMBUILDER_BG_FOLDER = "../assets/images/teambuilder/";

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

const COST_BY_RARITY = {
  Legendary: 5,
  Exotic: 4,
  Epic: 3,
  Rare: 2,
  Common: 1,
};

const DEFAULT_COLORS = { hp: "green", spd: "green", ea: "green", pa: "green", ed: "green", pd: "green" };
const DEFAULT_BONUS = { HP: 0, SPD: 0, EA: 0, PA: 0, ED: 0, PD: 0 };
const BR_RELIC_LEVELS = [10, 20, 30, 35];

const STAT_ICON = {
  HP: "hp.png",
  SPD: "spd.png",
  EA: "ea.png",
  PA: "pa.png",
  ED: "ed.png",
  PD: "pd.png",
};

const RELIC_PLACEHOLDER = `${PATH.RELIC_ICON_FOLDER}CRUZ.png`;

let DB = [];
let BASE = [];
let META = [];
let RELICS_RAW = null;
let RELIC_PICK_LEVEL = null;
let RELIC_PICK_QUERY = "";

let DB_BY_NAME = new Map();
let BASE_BY_NAME = new Map();
let META_BY_NAME = new Map();

let RELICS_BY_LEVEL = { 10: [], 20: [], 30: [], 35: [] };
let RELIC_STATS_BY_LEVEL_KEY = { 10: {}, 20: {}, 30: {}, 35: {} };
let RELICS_BY_KEY = {};

const state = {
  slots: Array.from({ length: TEAM_SIZE }, () => null),
};

let PICK_SLOT_INDEX = null;
let BR_SLOT_INDEX = null;
let BR_DRAFT_COLORS = null;
let BR_DRAFT_RELICS = null;

// -------------------------
// Utils
// -------------------------
function showToast(msg, ms = 1400) {
  const el = $("#tbToast");
  if (!el) { alert(msg); return; }
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    el.hidden = true;
    el.textContent = "";
  }, ms);
}

async function loadJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
  return res.json();
}

const IMG_LAYOUT_KEY = "miscrits_tb_img_export_v1";

const IMG_DEFAULT = {
  bgKey: "arena",
  bgUrl: "",
  showTags: true,
  showRelics: true,
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

function relicIconSrc(ent) {
  const key = typeof ent === "object" ? ent.key : ent;
  const k = relicNameToKey(key);
  if (!k) return RELIC_PLACEHOLDER;

  return `${PATH.RELIC_ICON_FOLDER}${k}.png`;
}

function formatRelicStatsLine(stats) {
  if (!stats) return "No bonus";
  const order = ["HP", "SPD", "EA", "PA", "ED", "PD"];
  const parts = [];
  for (const k of order) {
    const v = toNum(stats[k]);
    if (!v) continue;
    parts.push(`${v > 0 ? "+" : ""}${v} ${k}`);
  }
  return parts.length ? parts.join(" • ") : "No bonus";
}

function openRelicPicker(level) {
  const lvl = toNum(level);
  if (!lvl) return;

  RELIC_PICK_LEVEL = lvl;
  RELIC_PICK_QUERY = "";

  const modal = document.getElementById("brRelicModal");
  if (!modal) return;

  const title = document.getElementById("brRelicTitle");
  if (title) title.textContent = `Relics lvl ${lvl}`;

  const search = document.getElementById("brRelicSearch");
  if (search) {
    search.value = "";
    search.oninput = () => {
      RELIC_PICK_QUERY = normalize(search.value || "");
      renderRelicPicker();
    };
  }

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");

  renderRelicPicker();
  search?.focus?.();
}

function closeRelicPicker() {
  const modal = document.getElementById("brRelicModal");
  if (!modal) return;

  modal.setAttribute("aria-hidden", "true");
  modal.hidden = true;

  RELIC_PICK_LEVEL = null;
  RELIC_PICK_QUERY = "";
}

function renderBRRelicButtons() {
  const lvlToKey = new Map((BR_DRAFT_RELICS || []).map(r => [toNum(r.level), relicNameToKey(r.key)]));

  document.querySelectorAll(".brRelic").forEach(btn => {
    const lvl = toNum(btn.getAttribute("data-relic"));
    const key = lvlToKey.get(lvl) || "";

    const img = btn.querySelector(".brRelicImg");
    if (!img) return;

    if (!key) {
      img.hidden = true;
      img.src = "";
      btn.classList.remove("has-img");
      return;
    }
    img.hidden = false;
    img.src = relicIconSrc(key);
    img.onerror = () => {
      img.hidden = true;
      btn.classList.remove("has-img");
    };
    btn.classList.add("has-img");
  });
}


function renderRelicPicker() {
  const host = document.getElementById("brRelicList");
  if (!host) return;
  if (!RELIC_PICK_LEVEL) return;

  const lvl = RELIC_PICK_LEVEL;
  const list = Array.isArray(RELICS_BY_LEVEL?.[lvl]) ? RELICS_BY_LEVEL[lvl] : [];

  let filtered = list.slice();
  if (RELIC_PICK_QUERY) {
    filtered = filtered.filter(r => normalize(r.name).includes(RELIC_PICK_QUERY));
  }

  filtered.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

  host.innerHTML = "";

  const empty = document.createElement("div");
  empty.className = "brRelicCard";
  empty.innerHTML = `
    <div class="brRelicEmptyIcon">+</div>
    <div class="brRelicMain">
      <div class="brRelicName">Empty</div>
      <div class="brRelicStats">No bonus</div>
    </div>
  `;
  empty.onclick = () => {
    const idx = BR_RELIC_LEVELS.indexOf(lvl);
    if (idx >= 0 && BR_DRAFT_RELICS) BR_DRAFT_RELICS[idx] = { level: lvl, key: "" };
    renderBRRelicButtons();
    renderBRRelicPreview();
    renderBRFinalStats();
    closeRelicPicker();
  };
  host.appendChild(empty);

  for (const r of filtered) {
    const stats = RELIC_STATS_BY_LEVEL_KEY?.[lvl]?.[r.key] || null;

    const card = document.createElement("div");
    card.className = "brRelicCard";

    const img = document.createElement("img");
    img.className = "brRelicIcon";
    img.alt = r.name;
    img.src = relicIconSrc(r.key);
    img.onerror = () => { img.style.display = "none"; };

    const main = document.createElement("div");
    main.className = "brRelicMain";
    main.innerHTML = `
      <div class="brRelicName">${r.name}</div>
      <div class="brRelicStats">${formatRelicStatsLine(stats)}</div>
    `;

    card.appendChild(img);
    card.appendChild(main);

    card.onclick = () => {
      const idx = BR_RELIC_LEVELS.indexOf(lvl);
      if (idx >= 0 && BR_DRAFT_RELICS) BR_DRAFT_RELICS[idx] = { level: lvl, key: r.key };
      renderBRRelicButtons();
      renderBRRelicPreview();
      renderBRFinalStats();
      closeRelicPicker();
    };

    host.appendChild(card);
  }
}

function slotBadge(slot) {
  const spd = normalize(slot?.colors?.spd);
  return spd === "red" ? "RS" : "S+";
}

function setAllGreen() {
  if (!BR_DRAFT_COLORS) return;

  BR_DRAFT_COLORS = {
    hp: "green",
    spd: "green",
    ea: "green",
    pa: "green",
    ed: "green",
    pd: "green",
  };

  $("#brAllGreenBtn")?.classList.add("brPill--green");
  $("#brAllGreenBtn")?.classList.remove("brPill--red");

  $("#brRSBtn")?.classList.remove("brPill--red");
  $("#brRSBtn")?.classList.remove("brPill--green");

  renderBRFinalStats();
}

function setRS() {
  if (!BR_DRAFT_COLORS) return;

  BR_DRAFT_COLORS = {
    hp: "green",
    spd: "red",
    ea: "green",
    pa: "green",
    ed: "green",
    pd: "green",
  };

  $("#brRSBtn")?.classList.add("brPill--red");
  $("#brRSBtn")?.classList.remove("brPill--green");

  $("#brAllGreenBtn")?.classList.remove("brPill--green");
  $("#brAllGreenBtn")?.classList.remove("brPill--red");

  renderBRFinalStats();
}

async function renderImgPreview() {
  const canvas = document.getElementById("tbImgCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  let bgSrc = "";
  if ((IMG_CFG.bgUrl || "").trim()) {
    bgSrc = IMG_CFG.bgUrl.trim();
  } else {
    const bgEntry = TB_BACKGROUNDS.find((x) => x.key === IMG_CFG.bgKey) || TB_BACKGROUNDS[0];
    bgSrc = PATH.TEAMBUILDER_BG_FOLDER + (bgEntry?.file || "");
  }

  const bg = await loadImage(bgSrc);
  if (bg) ctx.drawImage(bg, 0, 0, W, H);

  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  ctx.font = `900 92px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  drawCenteredText(ctx, (IMG_TEAMNAME || "TEAM NAME").toUpperCase(), W / 2, 140);

  const avatarSize = 150;
  const gap = 120;
  const totalWidth = avatarSize * 4 + gap * 3;
  const startX = Math.round((W - totalWidth) / 2);
  const avatarY = 240;

  const slots = state.slots;
  const avatarImgs = await Promise.all(
    slots.map((s) => loadImage(s?.name ? avatarSrcFromMetaOrInfer(s.name) : PATH.AVATAR_FALLBACK))
  );

  ctx.font = `900 52px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.fillStyle = "#fff";

  for (let i = 0; i < 4; i++) {
    const slot = slots[i];
    const x = startX + i * (avatarSize + gap);

    const badge = slotBadge(slot);
    if (badge) drawCenteredText(ctx, badge, x + avatarSize / 2, 215);

    const img = avatarImgs[i] || (await loadImage(PATH.AVATAR_FALLBACK));
    if (img) ctx.drawImage(img, x, avatarY, avatarSize, avatarSize);

    if (IMG_CFG.showRelics) {
      const relicEntries = Array.isArray(slot?.relics) ? slot.relics.slice(0, 4) : [];
      const relicImgs = await Promise.all(relicEntries.map((ent) => loadImage(relicIconSrc(ent))));

      const r = 45;
      const step = 140;
      const startY = avatarY + avatarSize + 85;

      for (let k = 0; k < relicEntries.length; k++) {
        const cx = x + avatarSize / 2;
        const cy = startY + k * step;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        const rim = relicImgs[k];
        if (rim) ctx.drawImage(rim, cx - r, cy - r, r * 2, r * 2);
        ctx.restore();
      }
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
    showToast("IMG modal not found (#tbImgModal).");
    return;
  }

  loadImgCfg();

  const bgSel = document.getElementById("tbImgBg");
  if (bgSel) {
    bgSel.innerHTML = TB_BACKGROUNDS.map((b) => `<option value="${b.key}">${b.label}</option>`).join("");
    bgSel.value = IMG_CFG.bgKey || (TB_BACKGROUNDS[0]?.key || "arena");
    bgSel.onchange = () => {
      IMG_CFG.bgKey = bgSel.value;
      IMG_CFG.bgUrl = "";
      saveImgCfg();
      const url = document.getElementById("tbImgBgUrl");
      if (url) url.value = "";
      renderImgPreview();
    };
  }

  const bgUrl = document.getElementById("tbImgBgUrl");
  const bgApply = document.getElementById("tbImgBgApply");
  if (bgUrl) bgUrl.value = IMG_CFG.bgUrl || "";
  if (bgApply) {
    bgApply.onclick = () => {
      IMG_CFG.bgUrl = (bgUrl?.value || "").trim();
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

  const tTags = document.getElementById("tbImgShowTags");
  const tRelics = document.getElementById("tbImgShowRelics");
  if (tTags) {
    tTags.checked = !!IMG_CFG.showTags;
    tTags.onchange = () => {
      IMG_CFG.showTags = !!tTags.checked;
      saveImgCfg();
      renderImgPreview();
    };
  }
  if (tRelics) {
    tRelics.checked = !!IMG_CFG.showRelics;
    tRelics.onchange = () => {
      IMG_CFG.showRelics = !!tRelics.checked;
      saveImgCfg();
      renderImgPreview();
    };
  }

  const btnClose = document.getElementById("tbImgClose");
  if (btnClose) btnClose.onclick = () => {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  };

  $("#tbImgClose")?.addEventListener("click", () => {
    const m = document.getElementById("tbImgModal");
    if (!m) return;
    m.hidden = true;
    m.setAttribute("aria-hidden", "true");
  });

  const btnReset = document.getElementById("tbImgReset");
  if (btnReset) btnReset.onclick = () => {
    IMG_CFG = { ...IMG_DEFAULT };
    saveImgCfg();
    const url = document.getElementById("tbImgBgUrl");
    if (url) url.value = "";
    const sel = document.getElementById("tbImgBg");
    if (sel) sel.value = IMG_CFG.bgKey;
    const tags = document.getElementById("tbImgShowTags");
    if (tags) tags.checked = true;
    const rel = document.getElementById("tbImgShowRelics");
    if (rel) rel.checked = true;
    renderImgPreview();
    showToast("Export settings reset.");
  };

  const btnDownload = document.getElementById("tbImgDownload");
  if (btnDownload) btnDownload.onclick = () => {
    const canvas = document.getElementById("tbImgCanvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `${(IMG_TEAMNAME || "TEAM_NAME").replace(/[^\w\-]+/g, "_")}_team.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  renderImgPreview();
}

function avatarSrcFromMetaOrInfer(name) {
  const meta = META_BY_NAME.get(normalize(name));
  const metaAvatar = meta?.avatar;

  const inferred =
    normalize(name).replace(/\s+/g, "_").replace(/[^\w_]/g, "") + "_avatar.png";

  const file = metaAvatar || inferred;
  return `${PATH.AVATAR_FOLDER}${file}`;
}

function getMetaForName(name) {
  return META_BY_NAME.get(normalize(name)) || null;
}

function teamIsComplete() {
  return state.slots.filter((s) => s?.name).length === TEAM_SIZE;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawCenteredText(ctx, text, x, y) {
  const m = ctx.measureText(text);
  ctx.fillText(text, x - m.width / 2, y);
}

function getRarityForName(name) {
  const meta = getMetaForName(name);
  if (meta?.rarity) return meta.rarity;

  const baseItem = BASE.find((x) => normalize(x?.name) === normalize(name));
  if (baseItem?.rarity) return baseItem.rarity;
  if (baseItem?.baseStats?.rarity) return baseItem.baseStats.rarity;

  return "Common";
}

function getTierForName(name) {
  const meta = getMetaForName(name);
  return meta?.tierlist ?? meta?.tier ?? meta?.Tier ?? null;
}

function getElementsForName(name) {
  const m = DB_BY_NAME.get(normalize(name));
  return Array.isArray(m?.elements) ? m.elements : [];
}

function getBase15(name) {
  return BASE_BY_NAME.get(normalize(name)) || null;
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

function computeTotalsLevel35(base15, colors = DEFAULT_COLORS, bonus = DEFAULT_BONUS, relicBonus = null) {
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

  if (relicBonus) {
    totals.HP += toNum(relicBonus.HP);
    totals.SPD += toNum(relicBonus.SPD);
    totals.EA += toNum(relicBonus.EA);
    totals.PA += toNum(relicBonus.PA);
    totals.ED += toNum(relicBonus.ED);
    totals.PD += toNum(relicBonus.PD);
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
      HP: 0, SPD: 0, EA: 0, PA: 0, ED: 0, PD: 0,
    };
}

// -------------------------
// Points
// -------------------------
function getSlotCost(slot) {
  if (!slot?.rarity) return 0;
  return COST_BY_RARITY[slot.rarity] ?? 0;
}

function pointsUsed() {
  return state.slots.reduce((sum, s) => sum + (s ? getSlotCost(s) : 0), 0);
}

function pointsLeftConsidering(slotIndex) {
  const usedBefore = pointsUsed();
  const currentSlot = slotIndex != null ? state.slots[slotIndex] : null;
  const currentCost = currentSlot?.cost ?? 0;
  return POINT_CAP - (usedBefore - currentCost);
}

// -------------------------
// Slot model
// -------------------------
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

// -------------------------
// Render slots
// -------------------------
function slotLabel(i) {
  return `Slot ${i + 1}`;
}

function slotSubline(slot) {
  if (!slot) return "Empty";
  const elems = slot.elements?.length ? slot.elements.join(", ") : "—";
  return `${slot.rarity} • ${slot.cost} pts • ${elems}`;
}

function updateTopBadge() {
  const used = pointsUsed();
  const left = POINT_CAP - used;

  const badge = $("#tbCountBadge");
  if (badge) badge.textContent = `${used}/${POINT_CAP} pts`;

  const hint = $("#tbHint");
  if (hint) {
    hint.textContent = ``;
  }
}

function renderSlots() {
  const host = $("#tbSlots");
  if (!host) return;

  host.innerHTML = "";

  for (let i = 0; i < TEAM_SIZE; i++) {
    const slot = state.slots[i];

    const card = document.createElement("div");
    card.className = "tbSlot";
    card.setAttribute("data-slot", String(i));
    card.addEventListener("click", (e) => {
      if (e.target.closest(".tbSlot__x")) return;
      if (e.target.closest("button")) return;
      openPicker(i);
    });

    const img = document.createElement("img");
    img.className = "tbSlot__ava";
    img.alt = slot?.name || "";
    img.src = slot?.name ? avatarSrcFromMetaOrInfer(slot.name) : PATH.AVATAR_FALLBACK;
    img.onerror = () => (img.src = PATH.AVATAR_FALLBACK);

    const meta = document.createElement("div");
    meta.className = "tbSlot__meta";
    meta.innerHTML = `
      <div class="tbSlot__name">${slot?.name ?? slotLabel(i)}</div>
      <div class="tbSlot__sub">${slotSubline(slot)}</div>
    `;

    const x = document.createElement("button");
    x.type = "button";
    x.className = "tbSlot__x";
    x.setAttribute("aria-label", "Clear slot");
    x.textContent = "✕";
    x.style.display = slot ? "" : "none";
    x.addEventListener("click", (e) => {
      e.stopPropagation();
      state.slots[i] = null;
      renderSlots();
      updateTopBadge();
    });

    const actions = document.createElement("div");
    actions.className = "tbSlot__actions";

    const btnBR = document.createElement("button");
    btnBR.type = "button";
    btnBR.className = "tbBtn";
    btnBR.textContent = "Bonus & Relics";
    btnBR.disabled = !slot;
    btnBR.addEventListener("click", (e) => {
      e.stopPropagation();
      openBRModal(i);
    });

    actions.appendChild(btnBR);

    card.appendChild(img);
    card.appendChild(meta);
    card.appendChild(actions);
    card.appendChild(x);

    host.appendChild(card);
  }

  updateTopBadge();
}

// -------------------------
// Picker modal
// -------------------------
function openPicker(slotIndex) {
  PICK_SLOT_INDEX = slotIndex;

  const modal = $("#tbModal");
  if (!modal) return;

  modal.setAttribute("aria-hidden", "false");

  const search = $("#tbSearch");
  if (search) search.value = "";

  const elSel = $("#tbFilterElement");
  if (elSel) elSel.value = "";

  const raritySel = $("#tbFilterRarity");
  if (raritySel) raritySel.value = "";

  renderPickerList();

  modal.hidden = false;
  search?.focus?.();
}

function closePicker() {
  const modal = $("#tbModal");
  if (!modal) return;
  modal.setAttribute("aria-hidden", "true");
  modal.hidden = true;
  PICK_SLOT_INDEX = null;
}

function getPickerFilters() {
  const q = normalize($("#tbSearch")?.value || "");
  const element = ($("#tbFilterElement")?.value || "").trim();
  const rarity = normalize($("#tbFilterRarity")?.value || "");
  const onlyAffordable = false;
  return { q, element, rarity, onlyAffordable };
}

function renderPickerList() {
  const listHost = $("#tbList");
  if (!listHost) return;

  const { q, element, rarity, onlyAffordable } = getPickerFilters();
  const slotIdx = PICK_SLOT_INDEX;
  const effectiveLeft = pointsLeftConsidering(slotIdx);

  let list = BASE
    .filter((x) => x?.name && x?.baseStats)
    .map((x) => x.name);

  if (q) list = list.filter((n) => normalize(n).includes(q));

  if (element) {
    list = list.filter((n) => {
      const els = getElementsForName(n).map((e) => String(e));
      return els.includes(element);
    });
  }

  if (rarity) {
    list = list.filter((n) => normalize(getRarityForName(n)) === rarity);
  }

  list.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));

  listHost.innerHTML = "";

  for (const name of list) {
    const r = getRarityForName(name);
    const cost = COST_BY_RARITY[r] ?? 0;
    const canPick = cost <= effectiveLeft;
    if (onlyAffordable && !canPick) continue;

    const tier = getTierForName(name);
    const after = effectiveLeft - cost;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tbPickItem";
    btn.style.width = "100%";
    btn.style.textAlign = "left";
    btn.style.padding = "10px";
    btn.style.borderRadius = "12px";

    if (!canPick) btn.disabled = true;

    btn.innerHTML = `
      <div style="display:flex; gap:10px; align-items:center;">
        <img src="${avatarSrcFromMetaOrInfer(name)}" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover;" />
        <div style="flex:1; min-width:0;">
          <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${name}</div>
          <div style="opacity:.8; font-size:12px;">
            ${r} • ${cost} pts ${tier ? `• Tier ${String(tier).toUpperCase()}` : ""}
          </div>
        </div>
        <div style="opacity:.8; font-size:12px; text-align:right; white-space:nowrap;">
          after: ${after}
        </div>
      </div>
    `;

    const img = btn.querySelector("img");
    if (img) img.onerror = () => (img.src = PATH.AVATAR_FALLBACK);

    btn.addEventListener("click", () => {
      if (PICK_SLOT_INDEX == null) return;
      state.slots[PICK_SLOT_INDEX] = buildSlotFromName(name);
      closePicker();
      renderSlots();
    });

    listHost.appendChild(btn);
  }

  const countEl = $("#tbResultsCount");
  if (countEl) countEl.textContent = `${list.length} results`;
}

// -------------------------
// Bonus & Relics modal
// -------------------------
function statIconHTML(statKey) {
  const file = STAT_ICON[statKey];
  if (!file) return "";
  const src = PATH.STAT_ICON_DIR + file;
  return `<img class="brStatIcon" src="${src}" alt="" draggable="false" onerror="this.style.display='none'">`;
}

function openBRModal(slotIndex) {
  const slot = state.slots[slotIndex];
  if (!slot?.name) return;

  BR_SLOT_INDEX = slotIndex;

  BR_DRAFT_COLORS = { ...(slot.colors || DEFAULT_COLORS) };

  const ensured = [];
  for (const lvl of BR_RELIC_LEVELS) {
    const existing = (slot.relics || []).find((r) => toNum(r.level) === lvl);
    ensured.push({ level: lvl, key: existing?.key ? relicNameToKey(existing.key) : "" });
  }
  BR_DRAFT_RELICS = ensured;
  renderBRRelicButtons();

  const modal = $("#brModal");
  if (!modal) return;

  $("#brAllGreenBtn")?.classList.remove("brPill--green");
  $("#brAllGreenBtn")?.classList.remove("brPill--red");
  $("#brRSBtn")?.classList.remove("brPill--green");
  $("#brRSBtn")?.classList.remove("brPill--red");

  $("#brTitle") && ($("#brTitle").textContent = `Bonus & Relics • ${slot.name}`);
  $("#brSub") && ($("#brSub").textContent = `Slot ${slotIndex + 1} • ${slot.elements?.join(", ") || "—"} • ${slot.rarity}`);

  $("#brHP") && ($("#brHP").value = String(slot.bonus?.HP ?? 0));
  $("#brSPD") && ($("#brSPD").value = String(slot.bonus?.SPD ?? 0));
  $("#brEA") && ($("#brEA").value = String(slot.bonus?.EA ?? 0));
  $("#brPA") && ($("#brPA").value = String(slot.bonus?.PA ?? 0));
  $("#brED") && ($("#brED").value = String(slot.bonus?.ED ?? 0));
  $("#brPD") && ($("#brPD").value = String(slot.bonus?.PD ?? 0));

  renderBRRelicPreview();
  renderBRFinalStats();

  modal.setAttribute("aria-hidden", "false");
  modal.hidden = false;
}

function closeBRModal() {
  const modal = $("#brModal");
  if (!modal) return;
  modal.setAttribute("aria-hidden", "true");
  modal.hidden = true;

  BR_SLOT_INDEX = null;
  BR_DRAFT_COLORS = null;
  BR_DRAFT_RELICS = null;
}

function readBonusFromInputs() {
  return {
    HP: toNum($("#brHP")?.value),
    SPD: toNum($("#brSPD")?.value),
    EA: toNum($("#brEA")?.value),
    PA: toNum($("#brPA")?.value),
    ED: toNum($("#brED")?.value),
    PD: toNum($("#brPD")?.value),
  };
}

function readDraftRelics() {
  return (BR_DRAFT_RELICS || [])
    .map((r) => ({ level: toNum(r.level), key: relicNameToKey(r?.key || "") }))
    .filter((x) => x.level && x.key);
}

function renderBRRelicPreview() {
  const host = $("#brRelicStats");
  if (!host) return;

  const relics = readDraftRelics();
  const bonus = sumRelicBonuses(relics);

  host.innerHTML = `
    <div class="brRow"><b>${statIconHTML("HP")}HP</b><span>${bonus.HP}</span></div>
    <div class="brRow"><b>${statIconHTML("SPD")}SPD</b><span>${bonus.SPD}</span></div>
    <div class="brRow"><b>${statIconHTML("EA")}EA</b><span>${bonus.EA}</span></div>
    <div class="brRow"><b>${statIconHTML("PA")}PA</b><span>${bonus.PA}</span></div>
    <div class="brRow"><b>${statIconHTML("ED")}ED</b><span>${bonus.ED}</span></div>
    <div class="brRow"><b>${statIconHTML("PD")}PD</b><span>${bonus.PD}</span></div>
  `;
}

function renderBRFinalStats() {
  const host = $("#brFinalStats");
  if (!host) return;
  if (BR_SLOT_INDEX == null) return;

  const slot = state.slots[BR_SLOT_INDEX];
  if (!slot?.name) return;

  const bonus = readBonusFromInputs();
  const relics = readDraftRelics();
  const relicBonus = sumRelicBonuses(relics);

  const base15 = getBase15(slot.name);
  const colors = BR_DRAFT_COLORS || slot.colors || DEFAULT_COLORS;

  const totals =
    computeTotalsLevel35(base15, colors, bonus, relicBonus) ||
    { HP: 0, SPD: 0, EA: 0, PA: 0, ED: 0, PD: 0 };

  host.innerHTML = `
    <div class="brRow"><b>${statIconHTML("HP")}HP</b><span>${totals.HP}</span></div>
    <div class="brRow"><b>${statIconHTML("SPD")}SPD</b><span>${totals.SPD}</span></div>
    <div class="brRow"><b>${statIconHTML("EA")}EA</b><span>${totals.EA}</span></div>
    <div class="brRow"><b>${statIconHTML("PA")}PA</b><span>${totals.PA}</span></div>
    <div class="brRow"><b>${statIconHTML("ED")}ED</b><span>${totals.ED}</span></div>
    <div class="brRow"><b>${statIconHTML("PD")}PD</b><span>${totals.PD}</span></div>
  `;
}

function applyBRModal() {
  if (BR_SLOT_INDEX == null) return;
  const slot = state.slots[BR_SLOT_INDEX];
  if (!slot?.name) return;

  slot.colors = { ...(BR_DRAFT_COLORS || slot.colors || DEFAULT_COLORS) };
  slot.bonus = readBonusFromInputs();

  const ensured = [];
  for (const r of BR_DRAFT_RELICS || []) {
    const lvl = toNum(r.level);
    const key = relicNameToKey(r.key);
    if (lvl && key) ensured.push({ level: lvl, key });
  }
  slot.relics = ensured;

  recalcSlotTotals(slot);
  closeBRModal();
  renderSlots();
}

function resetBRModal() {
  if (BR_SLOT_INDEX == null) return;

  BR_DRAFT_COLORS = { ...DEFAULT_COLORS };

  ["HP", "SPD", "EA", "PA", "ED", "PD"].forEach((k) => {
    const el = document.getElementById("br" + k);
    if (el) el.value = "0";
  });

  BR_DRAFT_RELICS = BR_RELIC_LEVELS.map((lvl) => ({ level: lvl, key: "" }));

  renderBRRelicPreview();
  renderBRFinalStats();
  renderBRRelicButtons();
  showToast("Reset.");
}

// -------------------------
// Relics
// -------------------------
function setRelicForLevel(level) {
  const lvl = toNum(level);
  if (!lvl) return;

  const relics = RELICS_BY_LEVEL[lvl] || [];
  if (!relics.length) {
    showToast(`No relics found for lvl ${lvl}`);
    return;
  }

  const names = relics.map(r => r.name).join("\n");

  const input = prompt(
    `Select relic for level ${lvl}:\n\n${names}\n\n(Type exact name)`
  );

  if (!input) return;

  const found = relics.find(r =>
    normalize(r.name) === normalize(input)
  );

  if (!found) {
    showToast("Relic not found.");
    return;
  }

  const idx = BR_RELIC_LEVELS.indexOf(lvl);
  if (idx < 0) return;

  BR_DRAFT_RELICS[idx] = {
    level: lvl,
    key: found.key
  };

  renderBRRelicPreview();
  renderBRFinalStats();
}

const TEAM_EXPORT_VERSION = 1;

function teamToExportPayload() {
  return {
    version: TEAM_EXPORT_VERSION,
    teamSize: TEAM_SIZE,
    exportedAt: new Date().toISOString(),
    team: (state.slots || []).map((s) => {
      if (!s?.name) return null;
      return {
        name: s.name,
        rarity: s.rarity,
        colors: s.colors || { ...DEFAULT_COLORS },
        bonus: s.bonus || { ...DEFAULT_BONUS },
        relics: Array.isArray(s.relics) ? s.relics.map(r => ({ level: toNum(r.level), key: relicNameToKey(r.key) })) : [],
      };
    }),
  };
}

async function exportTeamToClipboard() {
  const payload = teamToExportPayload();
  const json = JSON.stringify(payload, null, 2);

  try {
    await navigator.clipboard.writeText(json);
    showToast("Team JSON copied to clipboard.");
  } catch {
    // fallback por si clipboard falla (http, permisos, etc.)
    const ta = document.createElement("textarea");
    ta.value = json;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    showToast("Team JSON copied.");
  }
}

function sanitizeImportedSlot(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.name) return null;

  const slot = buildSlotFromName(raw.name);

  // colors
  const c = raw.colors || {};
  slot.colors = {
    hp: normalize(c.hp) || "green",
    spd: normalize(c.spd) || "green",
    ea: normalize(c.ea) || "green",
    pa: normalize(c.pa) || "green",
    ed: normalize(c.ed) || "green",
    pd: normalize(c.pd) || "green",
  };

  // bonus
  const b = raw.bonus || {};
  slot.bonus = {
    HP: toNum(b.HP),
    SPD: toNum(b.SPD),
    EA: toNum(b.EA),
    PA: toNum(b.PA),
    ED: toNum(b.ED),
    PD: toNum(b.PD),
  };

  // relics (validar niveles)
  const allowedLevels = new Set(BR_RELIC_LEVELS);
  const relics = Array.isArray(raw.relics) ? raw.relics : [];
  slot.relics = relics
    .map(r => ({ level: toNum(r.level), key: relicNameToKey(r.key) }))
    .filter(r => allowedLevels.has(r.level) && r.key);

  recalcSlotTotals(slot);
  return slot;
}

function importTeamFromJSON(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON.");
  }

  // soporta 2 formatos:
  // A) {version:1, team:[...]}
  // B) directamente un array [slot, slot, ...]
  const arr = Array.isArray(data) ? data : Array.isArray(data?.team) ? data.team : null;
  if (!arr) throw new Error("JSON must contain a team array.");

  const nextSlots = Array.from({ length: TEAM_SIZE }, (_, i) => sanitizeImportedSlot(arr[i]) || null);

  state.slots = nextSlots;
  renderSlots();
}

function openImportModal() {
  const modal = document.getElementById("tbImportModal");
  if (!modal) return;

  const ta = document.getElementById("tbImportText");
  const hint = document.getElementById("tbImportHint");
  if (ta) ta.value = "";
  if (hint) hint.textContent = "";

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  ta?.focus?.();
}

function closeImportModal() {
  const modal = document.getElementById("tbImportModal");
  if (!modal) return;
  modal.setAttribute("aria-hidden", "true");
  modal.hidden = true;
}


// -------------------------
// Bind UI
// -------------------------
function bindUI() {
  $("#tbClearBtn")?.addEventListener("click", () => {
    state.slots = Array.from({ length: TEAM_SIZE }, () => null);
    renderSlots();
  });

  document.addEventListener("click", (e) => {
    const modal = $("#tbModal");
    if (!modal || modal.hidden) return;

    if (e.target?.matches("[data-close]")) closePicker();
    if (e.target?.closest?.("[data-close]")) closePicker();
  });

  $("#tbSearch")?.addEventListener("input", renderPickerList);
  $("#tbFilterElement")?.addEventListener("change", renderPickerList);
  $("#tbFilterRarity")?.addEventListener("change", renderPickerList);
  $("#brAllGreenBtn")?.addEventListener("click", setAllGreen);
  $("#brRSBtn")?.addEventListener("click", setRS);
  $("#tbExportTeamBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    exportTeamToClipboard();
  });

  $("#tbImportBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    openImportModal();
  });

  document.addEventListener("click", (e) => {
    const m = document.getElementById("tbImportModal");
    if (!m || m.hidden) return;

    if (e.target?.matches?.("[data-import-close]") || e.target?.closest?.("[data-import-close]")) {
      closeImportModal();
    }
  });

  $("#tbImportApplyBtn")?.addEventListener("click", () => {
    const ta = document.getElementById("tbImportText");
    const hint = document.getElementById("tbImportHint");
    try {
      importTeamFromJSON(ta?.value || "");
      closeImportModal();
    } catch (err) {
      if (hint) hint.textContent = err?.message || "Import failed.";
    }
  });

  $("#tbImportPasteBtn")?.addEventListener("click", async () => {
    const ta = document.getElementById("tbImportText");
    const hint = document.getElementById("tbImportHint");
    try {
      const txt = await navigator.clipboard.readText();
      if (ta) ta.value = txt;
      if (hint) hint.textContent = "Pasted from clipboard.";
    } catch {
      if (hint) hint.textContent = "Clipboard paste blocked by browser permissions.";
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const m = document.getElementById("tbImportModal");
    if (m && !m.hidden) closeImportModal();
  });


  document.addEventListener("click", (e) => {
    const m = document.getElementById("brRelicModal");
    if (!m || m.hidden) return;
    if (e.target?.matches?.("[data-relic-close]") || e.target?.closest?.("[data-relic-close]")) {
      closeRelicPicker();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const m = document.getElementById("brRelicModal");
    if (m && !m.hidden) closeRelicPicker();
  });

  document.addEventListener("click", (e) => {
    const modal = $("#brModal");
    if (!modal || modal.hidden) return;

    if (e.target?.matches("[data-br-close]")) closeBRModal();
    if (e.target?.closest?.("[data-br-close]")) closeBRModal();
  });

  $("#brApplyBtn")?.addEventListener("click", applyBRModal);
  $("#brResetBtn")?.addEventListener("click", resetBRModal);

  ["brHP", "brSPD", "brEA", "brPA", "brED", "brPD"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
      renderBRRelicPreview();
      renderBRFinalStats();
    });
  });

  document.querySelectorAll(".brRelic").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lvl = btn.getAttribute("data-relic");
      openRelicPicker(lvl);
    });
  });

  $("#tbExportBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    openImgModal();
  });
  
  document.addEventListener("click", (e) => {
    const m = document.getElementById("tbImgModal");
    if (!m || m.hidden) return;

    if (e.target?.matches?.("[data-img-close]")) {
      m.hidden = true;
      m.setAttribute("aria-hidden", "true");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const m = document.getElementById("tbImgModal");
    if (m && !m.hidden) {
      m.hidden = true;
      m.setAttribute("aria-hidden", "true");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    const br = $("#brModal");
    if (br && !br.hidden) return closeBRModal();

    const pk = $("#tbModal");
    if (pk && !pk.hidden) return closePicker();
  });
}

// -------------------------
// Load all data
// -------------------------
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
  RELICS_RAW = relicsJson;

  DB_BY_NAME = new Map(DB.filter((m) => m?.name).map((m) => [normalize(m.name), m]));
  BASE_BY_NAME = new Map(
    BASE
      .filter((x) => x?.name && x?.baseStats)
      .map((x) => [normalize(x.name), x.baseStats])
  );
  META_BY_NAME = new Map(
    (Array.isArray(META) ? META : [])
      .filter((x) => x?.name)
      .map((x) => [normalize(x.name), x])
  );

  RELICS_BY_LEVEL = { 10: [], 20: [], 30: [], 35: [] };
  RELIC_STATS_BY_LEVEL_KEY = { 10: {}, 20: {}, 30: {}, 35: {} };
  RELICS_BY_KEY = {};

  if (!relicsJson) return;

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
        if (seen.has(x.key)) return false;
        seen.add(x.key);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  }
}

// -------------------------
// Init
// -------------------------
async function init() {
  try {
    await loadAll();
    bindUI();
    renderSlots();
  } catch (e) {
    console.error(e);
    showToast(e?.message || "Error loading Team Builder data.");
  }
}

init();
