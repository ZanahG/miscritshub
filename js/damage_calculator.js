import {
  normalize,
  toNum,
  clamp,
  elementMultiplier,
  pickAtkDefStats,
  computePerHit
} from "./damage_core.js";

const $ = (sel) => document.querySelector(sel);

/* =========================================================
   STATE
========================================================= */

let DB = [];
let RELICS = [];
let RELIC_BY_NAME = new Map();

let MISCRITS_META = [];
let AVATAR_BY_NAME = new Map();

let BASE_STATS = [];
let BASE_BY_NAME = new Map();

let ATK_BASE = null;
let DEF_BASE = null;

let ATK_COLORS = { HP:"green", SPD:"green", EA:"green", PA:"green", ED:"green", PD:"green" };
let DEF_COLORS = { HP:"green", SPD:"green", EA:"green", PA:"green", ED:"green", PD:"green" };

const PVP_LEVEL = 35;
const BONUS_POOL_MAX = 136;
const SLOT_LEVELS = [10, 20, 30, 35];

let BONUS_ATK = { HP:0, EA:0, PA:0, SPD:0, ED:0, PD:0 };
let BONUS_DEF = { HP:0, EA:0, PA:0, SPD:0, ED:0, PD:0 };

let negateElement = false;
let atkId = null;
let defId = null;
let atkAttackIndex = 0;
let atkUseEnhanced = false;

/* =========================================================
   HELPERS
========================================================= */

function getSideColors(side) {
  return side === "atk" ? ATK_COLORS : DEF_COLORS;
}

/* =========================================================
   BASE STATS CALCULATOR
========================================================= */

function colorFactor(color) {
  const c = normalize(color);
  if (c === "red") return 1;
  if (c === "white") return 2;
  return 3;
}

function statAtLevel(baseStat15, level, color, isHp) {
  const C = colorFactor(color);
  const L = clamp(level, 1, 35);

  if (isHp) {
    const perLevel = (12 + 2 * toNum(baseStat15) + 1.5 * C) / 5;
    return Math.floor(perLevel * L + 10);
  } else {
    const perLevel = (3 + 2 * toNum(baseStat15) + 1.5 * C) / 6;
    return Math.floor(perLevel * L + 5);
  }
}

function getBase15ForName(name) {
  const raw = BASE_BY_NAME.get(normalize(name));
  if (!raw) return null;

  const hp  = raw.hp  ?? raw.HP  ?? raw.Hp  ?? raw.health ?? null;
  const spd = raw.spd ?? raw.SPD ?? raw.speed ?? null;
  const ea  = raw.ea  ?? raw.EA  ?? raw.elemAtk ?? raw.elementalAttack ?? null;
  const pa  = raw.pa  ?? raw.PA  ?? raw.physAtk ?? raw.physicalAttack ?? null;
  const ed  = raw.ed  ?? raw.ED  ?? raw.elemDef ?? raw.elementalDefense ?? null;
  const pd  = raw.pd  ?? raw.PD  ?? raw.physDef ?? raw.physicalDefense ?? null;

  if (hp == null || spd == null || ea == null || pa == null || ed == null || pd == null) return null;

  return { hp: toNum(hp), spd: toNum(spd), ea: toNum(ea), pa: toNum(pa), ed: toNum(ed), pd: toNum(pd) };
}

function computeBaseStatsFromCalculator(name, side) {
  const base15 = getBase15ForName(name);
  if (!base15) return null;

  const c = getSideColors(side);

  return {
    HP:  statAtLevel(base15.hp,  PVP_LEVEL, c.HP,  true),
    SPD: statAtLevel(base15.spd, PVP_LEVEL, c.SPD, false),
    EA:  statAtLevel(base15.ea,  PVP_LEVEL, c.EA,  false),
    PA:  statAtLevel(base15.pa,  PVP_LEVEL, c.PA,  false),
    ED:  statAtLevel(base15.ed,  PVP_LEVEL, c.ED,  false),
    PD:  statAtLevel(base15.pd,  PVP_LEVEL, c.PD,  false),
  };
}

/* =========================================================
   MOVES
========================================================= */

function getAtkMoves(atk) {
  if (!atk) return [];
  if (atkUseEnhanced && Array.isArray(atk.enhancedAttacks) && atk.enhancedAttacks.length) {
    return atk.enhancedAttacks;
  }
  return atk.attacks ?? [];
}

function getAtkMovesSorted(atk) {
  const raw = getAtkMoves(atk).slice();
  raw.sort((a, b) => {
    const d = toNum(b?.ap) - toNum(a?.ap);
    if (d !== 0) return d;
    return (a?.name ?? "").localeCompare((b?.name ?? ""), "es");
  });
  return raw;
}

function moveKey(a) {
  return [
    normalize(a?.name),
    normalize(a?.element),
    toNum(a?.ap),
    toNum(a?.hits ?? 1)
  ].join("|");
}

/* =========================================================
   MISCRITS PICKER
========================================================= */

function findById(idOrName) {
  if (idOrName == null) return null;
  const key = String(idOrName).trim();
  const byId = DB.find(m => m.id != null && String(m.id) === key);
  if (byId) return byId;
  const nk = normalize(key);
  return DB.find(m => normalize(m.name) === nk) ?? null;
}

function getMiscritPrimaryElement(m) {
  const el = Array.isArray(m?.elements) ? m.elements[0] : "";
  return normalize(el);
}

function miscritElementIconSrc(m) {
  const el = getMiscritPrimaryElement(m) || "physical";
  return `../assets/images/type/${el}.png`;
}

function renderMiscritDropdown(side, query) {
  const dd = side === "atk" ? $("#atkMiscritDropdown") : $("#defMiscritDropdown");
  if (!dd) return;

  const q = normalize(query);
  const matches = DB
    .filter(m => !q || normalize(m.name).includes(q))
    .slice(0, 60);

  if (!matches.length) {
    dd.hidden = true;
    dd.innerHTML = "";
    return;
  }

  dd.hidden = false;
  dd.innerHTML = matches.map(m => {
    const el = getMiscritPrimaryElement(m);
    const icon = miscritElementIconSrc(m);

    return `
      <button type="button" class="miscritpicker__item" data-name="${m.name}">
        <div class="miscritpicker__left">
          <img class="miscritpicker__elem" src="${icon}" alt="${el}">
          <div class="miscritpicker__name">${m.name}</div>
        </div>
      </button>
    `;
  }).join("");

  dd.querySelectorAll(".miscritpicker__item").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-name");
      const input = side === "atk" ? $("#atkMiscritSearch") : $("#defMiscritSearch");
      if (input) input.value = name;

      applyMiscritSelection(side, name);
      dd.hidden = true;
    });
  });
}

function bindMiscritPicker(side) {
  const input = side === "atk" ? $("#atkMiscritSearch") : $("#defMiscritSearch");
  const dd = side === "atk" ? $("#atkMiscritDropdown") : $("#defMiscritDropdown");
  if (!input || !dd) return;

  const close = () => { dd.hidden = true; };
  const open = () => renderMiscritDropdown(side, input.value);

  input.addEventListener("focus", open);
  input.addEventListener("input", open);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();

    if (e.key === "Enter") {
      e.preventDefault();
      const v = normalize(input.value);
      const exact = DB.find(m => normalize(m.name) === v);
      if (exact) {
        applyMiscritSelection(side, exact.name);
        close();
        return;
      }
      const firstBtn = dd.querySelector(".miscritpicker__item");
      if (firstBtn) firstBtn.click();
    }
  });

  document.addEventListener("click", (e) => {
    const host = input.closest(".miscritpicker");
    if (!host) return;
    if (!host.contains(e.target)) close();
  });
}

/* =========================================================
   AVATAR
========================================================= */

function inferAvatarFromName(name) {
  const slug = normalize(name)
    .replace(/\s+/g, "_")
    .replace(/[^\w_]/g, "");
  return `${slug}_avatar.png`;
}

function setAvatarFromMiscrit(side, m) {
  const imgEl = side === "atk" ? $("#atkAvatar") : $("#defAvatar");
  if (!imgEl || !m?.name) return;

  const metaAvatar = AVATAR_BY_NAME.get(normalize(m.name));
  const inferred = inferAvatarFromName(m.name);

  const src = `../assets/images/miscrits_avatar/${metaAvatar || inferred}`;
  imgEl.src = src;
  imgEl.onerror = () => {
    imgEl.src = `../assets/images/miscrits_avatar/preset_avatar.png`;
  };
}

/* =========================================================
   UI: SELECTED MOVE BUTTON (simple)
========================================================= */

function renderSelectedMoveButton() {
  const btn = $("#openMoveList");
  if (!btn) return;

  const atk = findById(atkId);
  const moves = getAtkMovesSorted(atk);
  const a = moves[atkAttackIndex];

  if (!a) {
    btn.innerHTML = "Move list";
    return;
  }

  btn.innerHTML = `${a.name ?? "Move"} • AP ${toNum(a.ap)}`;
}

function syncMoveListPicker() {
  const atk = findById(atkId);
  const sel = $("#atkAttack");
  const picker = $("#atkAttackPicker");
  const grid = $("#moveListGrid");
  if (!sel) return;

  const attacks = getAtkMovesSorted(atk);
  const prevKey = attacks[atkAttackIndex] ? moveKey(attacks[atkAttackIndex]) : null;
  if (prevKey) {
    const idx = attacks.findIndex(a => moveKey(a) === prevKey);
    if (idx >= 0) atkAttackIndex = idx;
  } else {
    atkAttackIndex = 0;
  }

  sel.innerHTML = attacks.map((a, i) => `<option value="${i}">${a.name}</option>`).join("");
  sel.value = String(atkAttackIndex);

  if (picker) {
    picker.innerHTML = attacks.map((a, i) => `<option value="${i}">${a.name}</option>`).join("");
    picker.value = String(atkAttackIndex);
  }

  if (!grid) return;
  grid.innerHTML = "";

  const left = attacks.slice(0, 5);
  const right = attacks.slice(5);

  const makeCol = (list, offset) => {
    const col = document.createElement("div");
    col.className = "movegrid__col";

    list.forEach((a, i) => {
      const idx = offset + i;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "move-card" +
        (atkUseEnhanced ? " is-enhanced" : "") +
        (idx === atkAttackIndex ? " is-selected" : "");

      const icon = normalize(a.element || "physical");
      const iconSrc = `../assets/images/type/${icon}.png`;

			btn.innerHTML = `
				<div class="move-card__bg"></div>
				<img class="move-card__icon" src="${iconSrc}" alt="">
				<div class="move-card__name">${a.name ?? ""}</div>
				<div class="move-card__ap">${toNum(a.ap)}</div>
			`;


      btn.addEventListener("click", () => {
        atkAttackIndex = idx;
        sel.value = String(idx);
        if (picker) picker.value = String(idx);

        syncMoveListPicker();
        renderSelectedMoveButton();
        renderResult();
      });

      col.appendChild(btn);
    });

    return col;
  };

  grid.appendChild(makeCol(left, 0));
  if (right.length) grid.appendChild(makeCol(right, 5));
}

/* =========================================================
   APPLY MISCRIT SELECTION
========================================================= */

function setStatsInputsObj(prefix, stats) {
  if (!stats) return;
  $(`#${prefix}HP`).value  = toNum(stats.HP);
  $(`#${prefix}SPD`).value = toNum(stats.SPD);
  $(`#${prefix}EA`).value  = toNum(stats.EA);
  $(`#${prefix}PA`).value  = toNum(stats.PA);
  $(`#${prefix}ED`).value  = toNum(stats.ED);
  $(`#${prefix}PD`).value  = toNum(stats.PD);
}

function setMeta(id, metaEl) {
  const m = findById(id);
  if (!metaEl) return;
  if (!m) { metaEl.textContent = "—"; return; }
  const elems = Array.isArray(m.elements) ? m.elements.join(", ") : "";
  metaEl.textContent = elems ? `Elements: ${elems}` : "—";
}

function chooseBaseStatsForSide(m, side) {
  const computed = computeBaseStatsFromCalculator(m.name, side);
  if (computed) return computed;
  if (m?.stats) return { ...m.stats };
  return null;
}

function applyMiscritSelection(side, idOrName) {
  const m = findById(idOrName);
  if (!m?.name) return;

  if (side === "atk") {
    atkId = m.name;
    $("#atkMiscrit") && ($("#atkMiscrit").value = atkId);

    ATK_BASE = chooseBaseStatsForSide(m, "atk");
    refreshSideStatsFromRelics("atk");

    setMeta(atkId, $("#atkMeta"));
    setAvatarFromMiscrit("atk", m);

    atkAttackIndex = 0;
    syncMoveListPicker();
    renderSelectedMoveButton();
    renderResult();
    return;
  }

  if (side === "def") {
    defId = m.name;
    $("#defMiscrit") && ($("#defMiscrit").value = defId);

    DEF_BASE = chooseBaseStatsForSide(m, "def");
    refreshSideStatsFromRelics("def");

    setMeta(defId, $("#defMeta"));
    setAvatarFromMiscrit("def", m);

    renderResult();
    return;
  }
}

/* =========================================================
   RELICS
========================================================= */

const RELIC_PLACEHOLDER = "../assets/images/relics/CRUZ.png";

function slugFileName(name) {
  return (name ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w_]/g, "") + ".png";
}

function relicIconSrc(r) {
  if (!r) return RELIC_PLACEHOLDER;
  if (r.icon) return `../assets/images/relics/${r.icon}`;
  return `../assets/images/relics/${slugFileName(r.name)}`;
}

function relicBonusText(r) {
  const s = r?.stats || {};
  const parts = [];
  if (toNum(s.HP))  parts.push(`+${toNum(s.HP)} HP`);
  if (toNum(s.SPD)) parts.push(`+${toNum(s.SPD)} SPD`);
  if (toNum(s.PA))  parts.push(`+${toNum(s.PA)} PA`);
  if (toNum(s.EA))  parts.push(`+${toNum(s.EA)} EA`);
  if (toNum(s.PD))  parts.push(`+${toNum(s.PD)} PD`);
  if (toNum(s.ED))  parts.push(`+${toNum(s.ED)} ED`);
  return parts.join(" • ");
}

function getSlotLevel(slot) {
  const s = Math.max(0, Math.min(3, toNum(slot)));
  return SLOT_LEVELS[s] ?? 35;
}

function getRelicSelect(side, slot) {
  const cls = side === "atk" ? ".atkRelic" : ".defRelic";
  return document.querySelector(`${cls}[data-slot="${slot}"]`);
}

function getRelicSelectionsDetailed(sideCls) {
  return Array.from(document.querySelectorAll(sideCls))
    .map(sel => {
      const slot = toNum(sel.getAttribute("data-slot"));
      const name = (sel.value ?? "").toString().trim();
      if (!name) return null;
      return { name, slot, level: getSlotLevel(slot) };
    })
    .filter(Boolean);
}

function applyRelicStatsBySlot(stats, selections) {
  const out = { ...stats };

  for (const { slot, name } of selections) {
    const r = RELIC_BY_NAME.get(name);
    if (!r) continue;

    const lvl = SLOT_LEVELS[slot] ?? 35;
    if (toNum(r.level) !== toNum(lvl)) continue;

    const b = r.stats || {};
    out.HP  = toNum(out.HP)  + toNum(b.HP);
    out.SPD = toNum(out.SPD) + toNum(b.SPD);
    out.PA  = toNum(out.PA)  + toNum(b.PA);
    out.EA  = toNum(out.EA)  + toNum(b.EA);
    out.PD  = toNum(out.PD)  + toNum(b.PD);
    out.ED  = toNum(out.ED)  + toNum(b.ED);
  }

  return out;
}

function sumBonus(b){
  return toNum(b.HP)+toNum(b.EA)+toNum(b.PA)+toNum(b.SPD)+toNum(b.ED)+toNum(b.PD);
}

function readBonusDraft(side){
  const p = side === "atk" ? "atk" : "def";
  return {
    HP: toNum($(`#${p}BonusHP`)?.value),
    EA: toNum($(`#${p}BonusEA`)?.value),
    PA: toNum($(`#${p}BonusPA`)?.value),
    SPD: toNum($(`#${p}BonusSPD`)?.value),
    ED: toNum($(`#${p}BonusED`)?.value),
    PD: toNum($(`#${p}BonusPD`)?.value),
  };
}

function writeBonusDraft(side, b){
  const p = side === "atk" ? "atk" : "def";
  $(`#${p}BonusHP`).value  = toNum(b.HP);
  $(`#${p}BonusEA`).value  = toNum(b.EA);
  $(`#${p}BonusPA`).value  = toNum(b.PA);
  $(`#${p}BonusSPD`).value = toNum(b.SPD);
  $(`#${p}BonusED`).value  = toNum(b.ED);
  $(`#${p}BonusPD`).value  = toNum(b.PD);
}

function getCommittedBonus(side){
  return side === "atk" ? BONUS_ATK : BONUS_DEF;
}

function setCommittedBonus(side, b){
  if (side === "atk") BONUS_ATK = { ...b };
  else BONUS_DEF = { ...b };
}

function updateBonusUI(side){
  const p = side === "atk" ? "atk" : "def";
  const draft = readBonusDraft(side);
  const used = sumBonus(draft);
  const left = Math.max(0, BONUS_POOL_MAX - used);

  const poolEl = $(`#${p}BonusPool`);
  const appliedEl = $(`#${p}BonusApplied`);
  if (poolEl) poolEl.textContent = String(left);
  if (appliedEl) appliedEl.textContent = String(used);

  const over = used > BONUS_POOL_MAX;
  [ "HP","EA","PA","SPD","ED","PD" ].forEach(k => {
    const el = $(`#${p}Bonus${k}`);
    if (!el) return;
    el.style.outline = over ? "2px solid rgba(251,113,133,.35)" : "";
  });
}

function calcSideWithRelics(side) {
  const base = side === "atk" ? ATK_BASE : DEF_BASE;
  if (!base) return null;

  const picks = getRelicSelectionsDetailed(side === "atk" ? ".atkRelic" : ".defRelic");
  const withRelics = applyRelicStatsBySlot(
    { HP: base.HP, SPD: base.SPD, PA: base.PA, EA: base.EA, PD: base.PD, ED: base.ED },
    picks
  );

  const b = getCommittedBonus(side);
  return {
    HP:  toNum(withRelics.HP)  + toNum(b.HP),
    SPD: toNum(withRelics.SPD) + toNum(b.SPD),
    PA:  toNum(withRelics.PA)  + toNum(b.PA),
    EA:  toNum(withRelics.EA)  + toNum(b.EA),
    PD:  toNum(withRelics.PD)  + toNum(b.PD),
    ED:  toNum(withRelics.ED)  + toNum(b.ED),
  };
}

function refreshSideStatsFromRelics(side) {
  const total = calcSideWithRelics(side);
  if (!total) return;
  setStatsInputsObj(side, total);
}

function setSlotButtonUI(side, slot) {
  const host = document.querySelector(`.relic-slot[data-side="${side}"][data-slot="${slot}"]`);
  if (!host) return;

  const sel = getRelicSelect(side, slot);
  const name = (sel?.value ?? "").toString().trim();

  const r = name ? RELIC_BY_NAME.get(name) : null;
  const img = r ? relicIconSrc(r) : RELIC_PLACEHOLDER;

  host.dataset.relicName = name || "";
  host.dataset.relicLevel = String(getSlotLevel(slot));

  host.style.backgroundImage = `url("${img}")`;
  host.style.backgroundRepeat = "no-repeat";
  host.style.backgroundPosition = "center";
  host.style.backgroundSize = "70% 70%";

  host.title = name ? `${name} (lvl ${getSlotLevel(slot)})` : `Empty (lvl ${getSlotLevel(slot)})`;
  host.setAttribute("aria-label", host.title);
}

function refreshAllRelicSlots() {
  for (let i = 0; i < 4; i++) {
    setSlotButtonUI("atk", i);
    setSlotButtonUI("def", i);
  }
}

let RELIC_PICK = { side: null, slot: null };

function openRelicModal(side, slot) {
  RELIC_PICK = { side, slot };

  const modal = $("#relicModal");
  const title = $("#relicModalTitle");
  const grid = $("#relicGrid");
  const search = $("#relicSearch");

  if (!modal || !title || !grid || !search) return;

  const lvl = getSlotLevel(slot);
  title.textContent = `Relics lvl ${lvl} • ${side === "atk" ? "Attacker" : "Defender"}`;

  search.value = "";
  grid.innerHTML = "";

  const renderGrid = (q) => {
    const qq = normalize(q);
    grid.innerHTML = "";

    const items = RELICS
      .filter(r => toNum(r.level) === toNum(lvl))
      .filter(r => !qq || normalize(r.name).includes(qq))
      .sort((a, b) => (a.name ?? "").localeCompare((b.name ?? ""), "es"));

    const empty = document.createElement("div");
    empty.className = "relic-item";
    empty.innerHTML = `
      <img class="relic-item__img" src="${RELIC_PLACEHOLDER}" alt="">
      <div class="relic-item__text">
        <div class="relic-item__name">Empty</div>
        <div class="relic-item__bonus">No bonus</div>
      </div>
    `;
    empty.addEventListener("click", () => {
      const sel = getRelicSelect(side, slot);
      if (sel) sel.value = "";

      refreshAllRelicSlots();
      refreshSideStatsFromRelics(side);
      closeRelicModal();
      renderResult();
    });
    grid.appendChild(empty);

    for (const r of items) {
      const el = document.createElement("div");
      el.className = "relic-item";
      el.innerHTML = `
        <img class="relic-item__img" src="${relicIconSrc(r)}" alt="${r.name}" onerror="this.src='${RELIC_PLACEHOLDER}'">
        <div class="relic-item__text">
          <div class="relic-item__name">${r.name}</div>
          <div class="relic-item__bonus">${relicBonusText(r) || "—"}</div>
        </div>
      `;
      el.addEventListener("click", () => {
        const sel = getRelicSelect(side, slot);
        if (sel) sel.value = r.name;
        refreshAllRelicSlots();
        refreshSideStatsFromRelics(side);
        closeRelicModal();
        renderResult();
      });
      grid.appendChild(el);
    }
  };

  renderGrid("");
  search.oninput = () => renderGrid(search.value);

  modal.hidden = false;
}

function closeRelicModal() {
  const modal = $("#relicModal");
  if (modal) modal.hidden = true;
  RELIC_PICK = { side: null, slot: null };
}

function populateRelicSelects() {
  const allSelects = document.querySelectorAll(".atkRelic, .defRelic");
  if (!allSelects.length) return;

  const sorted = RELICS.slice().sort((a, b) => (a.name ?? "").localeCompare((b.name ?? ""), "es"));

  const html = [
    `<option value=""></option>`,
    ...sorted.map(r => `<option value="${r.name}">${r.name}</option>`)
  ].join("");

  allSelects.forEach(sel => {
    sel.innerHTML = html;
  });
}

/* =========================================================
   RESULT
========================================================= */

function getInputsRaw() {
  return {
    atkPA: toNum($("#atkPA")?.value),
    atkEA: toNum($("#atkEA")?.value),
    atkSPD: toNum($("#atkSPD")?.value),
    atkPD: toNum($("#atkPD")?.value),
    atkED: toNum($("#atkED")?.value),
    atkHP: toNum($("#atkHP")?.value),

    defPA: toNum($("#defPA")?.value),
    defEA: toNum($("#defEA")?.value),
    defSPD: toNum($("#defSPD")?.value),
    defPD: toNum($("#defPD")?.value),
    defED: toNum($("#defED")?.value),
    defHP: toNum($("#defHP")?.value),
  };
}

function readTotalStatsForCalc() {
  const raw = getInputsRaw();
  return {
    atk: { HP: raw.atkHP, SPD: raw.atkSPD, PA: raw.atkPA, EA: raw.atkEA, PD: raw.atkPD, ED: raw.atkED },
    def: { HP: raw.defHP, SPD: raw.defSPD, PA: raw.defPA, EA: raw.defEA, PD: raw.defPD, ED: raw.defED },
  };
}

function renderResult() {
  const outMin = $("#outMin");
  const outMax = $("#outMax");
  const outAvg = $("#outAvg");
  const outKO  = $("#outKO");

  const setUI = (minTxt, maxTxt, avgTxt, koTxt) => {
    if (outMin) outMin.textContent = minTxt;
    if (outMax) outMax.textContent = maxTxt;
    if (outAvg) outAvg.textContent = avgTxt;
    if (outKO)  outKO.textContent  = koTxt;
  };

  const atk = findById(atkId);
  const def = findById(defId);

  if (!atk || !def) {
    setUI("—", "—", "—", "—");
    return;
  }

  const attacks = getAtkMovesSorted(atk);
  const a = attacks[atkAttackIndex] ?? null;

  if (!a) {
    setUI("—", "—", "—", "—");
    return;
  }

  const totals = readTotalStatsForCalc();

  const mode = $("#atkMode")?.value ?? "auto";
  const picked = pickAtkDefStats(mode, a.element, {
    atkPA: totals.atk.PA,
    atkEA: totals.atk.EA,
    defPD: totals.def.PD,
    defED: totals.def.ED
  });

  const mul = negateElement ? 1.0 : elementMultiplier(a.element, def.elements);
  const per = computePerHit(a.ap, picked.atk, picked.def, mul);

  const hits = Math.max(1, toNum(a.hits ?? 1));

  const totalMin = per.min * hits;
  const totalMax = per.max * hits;
  const totalAvg = Math.floor((totalMin + totalMax) / 2);

  const defHP = Math.max(0, toNum(totals.def.HP));
  const usesToKO = totalAvg > 0 ? Math.ceil(defHP / totalAvg) : "—";

  setUI(String(totalMin), String(totalMax), String(totalAvg), String(usesToKO));
}

/* =========================================================
   SWAP SIDES
========================================================= */

function swapInputValues(aId, bId) {
  const a = document.getElementById(aId);
  const b = document.getElementById(bId);
  if (!a || !b) return;
  const tmp = a.value;
  a.value = b.value;
  b.value = tmp;
}

function swapRelicSelectValues() {
  for (let i = 0; i < 4; i++) {
    const a = document.querySelector(`.atkRelic[data-slot="${i}"]`);
    const b = document.querySelector(`.defRelic[data-slot="${i}"]`);
    if (!a || !b) continue;
    const tmp = a.value;
    a.value = b.value;
    b.value = tmp;
  }
}

function swapColors() {
  const tmp = ATK_COLORS;
  ATK_COLORS = DEF_COLORS;
  DEF_COLORS = tmp;
}

function swapSides() {
  const oldAtkId = atkId;
  atkId = defId;
  defId = oldAtkId;

  const oldAtkBase = ATK_BASE;
  ATK_BASE = DEF_BASE;
  DEF_BASE = oldAtkBase;

  const oldBonus = BONUS_ATK;
  BONUS_ATK = BONUS_DEF;
  BONUS_DEF = oldBonus;

  swapColors();

  swapInputValues("atkMiscritSearch", "defMiscritSearch");
  swapInputValues("atkMiscrit", "defMiscrit");

  ["HP","SPD","EA","PA","ED","PD"].forEach(k => {
    swapInputValues(`atk${k}`, `def${k}`);
  });

  swapRelicSelectValues();
  refreshAllRelicSlots();

  const atkM = findById(atkId);
  const defM = findById(defId);
  if (atkM) setAvatarFromMiscrit("atk", atkM);
  if (defM) setAvatarFromMiscrit("def", defM);

  setMeta(atkId, $("#atkMeta"));
  setMeta(defId, $("#defMeta"));

  writeBonusDraft("atk", BONUS_ATK);
  writeBonusDraft("def", BONUS_DEF);
  updateBonusUI("atk");
  updateBonusUI("def");

  atkAttackIndex = 0;
  syncMoveListPicker();
  renderSelectedMoveButton();
  renderResult();
}

/* =========================================================
   LOAD + INIT + BIND
========================================================= */

async function loadAll() {
  const [dbRes, relicRes, metaRes, baseStatsRes] = await Promise.all([
    fetch("../assets/data/miscritsdb.json", { cache: "no-store" }),
    fetch("../assets/data/relics.json", { cache: "no-store" }),
    fetch("../assets/data/miscrits_meta.json", { cache: "no-store" }),
    fetch("../assets/data/base_stats.json", { cache: "no-store" }),
  ]);

  if (!dbRes.ok) throw new Error(`HTTP ${dbRes.status} loading miscritsdb.json`);
  if (!relicRes.ok) throw new Error(`HTTP ${relicRes.status} loading relics.json`);
  if (!metaRes.ok) throw new Error(`HTTP ${metaRes.status} loading miscrits_meta.json`);
  if (!baseStatsRes.ok) throw new Error(`HTTP ${baseStatsRes.status} loading base_stats.json`);

  DB = await dbRes.json();
  RELICS = await relicRes.json();

  const metaJson = await metaRes.json();
  MISCRITS_META = metaJson?.miscrits ?? metaJson ?? [];

  const baseStatsJson = await baseStatsRes.json();
  BASE_STATS = Array.isArray(baseStatsJson) ? baseStatsJson : (baseStatsJson?.miscrits ?? []);

  RELIC_BY_NAME = new Map(RELICS.map(r => [r.name, r]));

  AVATAR_BY_NAME = new Map(
    MISCRITS_META
      .filter(x => x?.name && x?.avatar)
      .map(x => [normalize(x.name), x.avatar])
  );

  BASE_BY_NAME = new Map(
    BASE_STATS
      .filter(x => x?.name && (x?.baseStats || x?.stats || x?.base || x?.base_stats))
      .map(x => {
        const bs = x.baseStats ?? x.stats ?? x.base ?? x.base_stats;
        return [normalize(x.name), bs];
      })
  );
}

function bindAll() {
  bindMiscritPicker("atk");
  bindMiscritPicker("def");

  $("#openMoveList")?.addEventListener("click", () => {
    const modal = $("#moveModal");
    if (!modal) return;
    syncMoveListPicker();
    modal.hidden = false;
  });

  $("#btnSwapSides")?.addEventListener("click", swapSides);

  $("#btnNegateElement")?.addEventListener("click", () => {
    negateElement = !negateElement;

    const b = $("#btnNegateElement");
    if (b) {
      b.classList.toggle("is-active", negateElement);
      b.setAttribute("aria-pressed", negateElement ? "true" : "false");
    }
    renderResult();
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest('[data-action="close-moves"]')) {
      const modal = $("#moveModal");
      if (modal) modal.hidden = true;
    }
    if (e.target.closest('[data-action="close-relic"]')) closeRelicModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeRelicModal();
      const modal = $("#moveModal");
      if (modal) modal.hidden = true;
    }
  });

  $("#atkMode")?.addEventListener("change", renderResult);

  ["atkPA","atkEA","atkSPD","atkPD","atkED","atkHP","defPA","defEA","defSPD","defPD","defED","defHP"]
    .forEach(id => $(`#${id}`)?.addEventListener("input", renderResult));

  document.querySelectorAll(".atkRelic, .defRelic").forEach(sel => {
    sel.addEventListener("change", () => {
      refreshAllRelicSlots();
      refreshSideStatsFromRelics("atk");
      refreshSideStatsFromRelics("def");
      renderResult();
    });
  });

  document.querySelectorAll(".relic-slot").forEach(btn => {
    btn.addEventListener("click", () => {
      const side = btn.getAttribute("data-side");
      const slot = toNum(btn.getAttribute("data-slot"));
      if (side !== "atk" && side !== "def") return;
      openRelicModal(side, slot);
    });
  });

  $("#atkEnhancedToggle")?.addEventListener("change", (e) => {
    atkUseEnhanced = !!e.target.checked;
    atkAttackIndex = 0;
    syncMoveListPicker();
    renderSelectedMoveButton();
    renderResult();
  });

  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const side = btn.getAttribute("data-side");
      const tab  = btn.getAttribute("data-tab");

      const host = btn.closest(".subpanel");
      if (!host) return;

      host.querySelectorAll(".tab").forEach(t => t.classList.remove("is-active"));
      btn.classList.add("is-active");

      host.querySelectorAll(".panel").forEach(p => {
        const isTarget = p.getAttribute("data-panel") === tab && p.getAttribute("data-side") === side;
        p.hidden = !isTarget;
      });

      if (tab === "bonus") updateBonusUI(side);
    });
  });

  ["atk","def"].forEach(side => {
    const ids = ["HP","EA","PA","SPD","ED","PD"].map(k => `#${side}Bonus${k}`);
    ids.forEach(sel => $(sel)?.addEventListener("input", () => updateBonusUI(side)));

    $(`#${side}BonusClean`)?.addEventListener("click", () => {
      writeBonusDraft(side, {HP:0,EA:0,PA:0,SPD:0,ED:0,PD:0});
      updateBonusUI(side);
    });

    $(`#${side}BonusApply`)?.addEventListener("click", () => {
      const draft = readBonusDraft(side);
      const used = sumBonus(draft);
      if (used > BONUS_POOL_MAX) return;

      setCommittedBonus(side, draft);
      refreshSideStatsFromRelics(side);
      renderResult();
    });
  });
}

async function init() {
  await loadAll();
  populateRelicSelects();
  refreshAllRelicSlots();

  const first = DB[0]?.name ?? null;
  atkId = first ? String(first) : null;
  defId = first ? String(first) : null;

  if ($("#atkMiscritSearch")) $("#atkMiscritSearch").value = atkId ?? "";
  if ($("#defMiscritSearch")) $("#defMiscritSearch").value = defId ?? "";
  if ($("#atkMiscrit")) $("#atkMiscrit").value = atkId ?? "";
  if ($("#defMiscrit")) $("#defMiscrit").value = defId ?? "";

  setMeta(atkId, $("#atkMeta"));
  setMeta(defId, $("#defMeta"));

  const atkM = findById(atkId);
  const defM = findById(defId);

  if (atkM) ATK_BASE = chooseBaseStatsForSide(atkM, "atk");
  if (defM) DEF_BASE = chooseBaseStatsForSide(defM, "def");

  refreshSideStatsFromRelics("atk");
  refreshSideStatsFromRelics("def");

  if (atkM) setAvatarFromMiscrit("atk", atkM);
  if (defM) setAvatarFromMiscrit("def", defM);

  atkAttackIndex = 0;
  syncMoveListPicker();
  renderSelectedMoveButton();

  bindAll();

  writeBonusDraft("atk", BONUS_ATK);
  writeBonusDraft("def", BONUS_DEF);
  updateBonusUI("atk");
  updateBonusUI("def");
  renderResult();
}

init().catch((e) => {
  console.error(e);
  const box = $("#resultBox");
  if (box) box.textContent = "Error loading data. Check console and ../assets/data/*.json paths.";
});
