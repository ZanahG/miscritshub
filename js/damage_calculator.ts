import {
  normalize,
  toNum,
  clamp,
  elementMultiplier,
  pickAtkDefStats,
  computePerHit
} from "./damage_core.js";

import type {
  MiscritData,
  MiscritStats,
  MoveData,
  RelicData,
  MetaData,
  BaseStatsData
} from "./types";

const $ = <T extends HTMLElement = HTMLElement>(sel: string): T | null => document.querySelector<T>(sel);

/* =========================================================
   STATE
========================================================= */

let DB: MiscritData[] = [];
let RELICS: RelicData[] = [];
let MISCRITS_RELICS: any[] = [];
let RELIC_NAME_BY_KEY = new Map<string, string>();
let REC_BY_NAME = new Map<string, any>();
let RELIC_BY_NAME = new Map<string, RelicData>();

let MISCRITS_META: MetaData[] = [];
let AVATAR_BY_NAME = new Map<string, string>();

let BASE_STATS: BaseStatsData[] = [];
let BASE_BY_NAME = new Map<string, MiscritStats>();

let ATK_BASE: MiscritStats | null = null;
let DEF_BASE: MiscritStats | null = null;

let ATK_COLORS: Record<string, string> = { HP:"green", SPD:"green", EA:"green", PA:"green", ED:"green", PD:"green" };
let DEF_COLORS: Record<string, string> = { HP:"green", SPD:"green", EA:"green", PA:"green", ED:"green", PD:"green" };

const PVP_LEVEL = 35;
const BONUS_POOL_MAX = 136;
const SLOT_LEVELS = [10, 20, 30, 35];

let BONUS_ATK: MiscritStats = { HP:0, EA:0, PA:0, SPD:0, ED:0, PD:0 } as MiscritStats;
let BONUS_DEF: MiscritStats = { HP:0, EA:0, PA:0, SPD:0, ED:0, PD:0 } as MiscritStats;

let negateElement = false;
let atkId: string | null = null;
let defId: string | null = null;
let atkAttackIndex = 0;
let atkUseEnhanced = false;

/* =========================================================
   HELPERS
========================================================= */

function getSideColors(side: "atk" | "def") {
  return side === "atk" ? ATK_COLORS : DEF_COLORS;
}

function relicKey(str: string | number | null | undefined): string {
  return (str ?? "")
    .toString()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^\w_]/g, "")
    .trim();
}
(window as any).relicKey = relicKey;

function normalizeRelicValueToDisplayName(val: string | number | null | undefined): string {
  const raw = (val ?? "").toString().trim();
  if (!raw) return "";

  if (RELIC_NAME_BY_KEY.has(relicKey(raw))) {
    return RELIC_NAME_BY_KEY.get(relicKey(raw)) || raw;
  }

  return raw;
}


/* =========================================================
   BASE STATS CALCULATOR
========================================================= */

function colorFactor(color: string | null | undefined): number {
  const c = normalize(color);
  if (c === "red") return 1;
  if (c === "white") return 2;
  return 3;
}

function statAtLevel(baseStat15: number | string | null | undefined, level: number, color: string | null | undefined, isHp: boolean): number {
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

function getBase15ForName(name: string): MiscritStats | null {
  const raw = BASE_BY_NAME.get(normalize(name));
  if (!raw) return null;

  const hp  = raw.hp  ?? raw.HP  ?? raw.Hp  ?? raw.health ?? null;
  const spd = raw.spd ?? raw.SPD ?? raw.speed ?? null;
  const ea  = raw.ea  ?? raw.EA  ?? raw.elemAtk ?? raw.elementalAttack ?? null;
  const pa  = raw.pa  ?? raw.PA  ?? raw.physAtk ?? raw.physicalAttack ?? null;
  const ed  = raw.ed  ?? raw.ED  ?? raw.elemDef ?? raw.elementalDefense ?? null;
  const pd  = raw.pd  ?? raw.PD  ?? raw.physDef ?? raw.physicalDefense ?? null;

  if (hp == null || spd == null || ea == null || pa == null || ed == null || pd == null) return null;

  return { HP: toNum(hp), SPD: toNum(spd), EA: toNum(ea), PA: toNum(pa), ED: toNum(ed), PD: toNum(pd) };
}

function computeBaseStatsFromCalculator(name: string, side: "atk" | "def"): MiscritStats | null {
  const base15 = getBase15ForName(name);
  if (!base15) return null;

  const c = getSideColors(side);

  return {
    HP:  statAtLevel(base15.HP,  PVP_LEVEL, c.HP,  true),
    SPD: statAtLevel(base15.SPD, PVP_LEVEL, c.SPD, false),
    EA:  statAtLevel(base15.EA,  PVP_LEVEL, c.EA,  false),
    PA:  statAtLevel(base15.PA,  PVP_LEVEL, c.PA,  false),
    ED:  statAtLevel(base15.ED,  PVP_LEVEL, c.ED,  false),
    PD:  statAtLevel(base15.PD,  PVP_LEVEL, c.PD,  false),
  };
}

/* =========================================================
   MOVES
========================================================= */

function getAtkMoves(atk: MiscritData | null | undefined): MoveData[] {
  if (!atk) return [];
  if (atkUseEnhanced && Array.isArray(atk.enhancedAttacks) && atk.enhancedAttacks.length) {
    return atk.enhancedAttacks;
  }
  return atk.attacks ?? [];
}

function getAtkMovesSorted(atk: MiscritData | null | undefined): MoveData[] {
  const raw = getAtkMoves(atk).slice();
  raw.sort((a, b) => {
    const d = toNum(b?.ap) - toNum(a?.ap);
    if (d !== 0) return d;
    return (a?.name ?? "").localeCompare((b?.name ?? ""), "es");
  });
  return raw;
}

function moveKey(a: MoveData | null | undefined): string {
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

function findById(idOrName: string | number | null | undefined): MiscritData | null {
  if (idOrName == null) return null;
  const key = String(idOrName).trim();
  const byId = DB.find(m => m.id != null && String(m.id) === key);
  if (byId) return byId;
  const nk = normalize(key);
  return DB.find(m => normalize(m.name) === nk) ?? null;
}

function getMiscritPrimaryElement(m: MiscritData | null | undefined): string {
  const el = Array.isArray(m?.elements) ? m.elements[0] : "";
  return normalize(el);
}

function miscritElementIconSrc(m: MiscritData | null | undefined): string {
  const el = getMiscritPrimaryElement(m) || "physical";
  return `../assets/images/type/${el}.png`;
}

function renderMiscritDropdown(side: "atk" | "def", query: string) {
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
      const input = side === "atk" ? $<HTMLInputElement>("#atkMiscritSearch") : $<HTMLInputElement>("#defMiscritSearch");
      if (input && name) input.value = name;

      if (name) applyMiscritSelection(side, name);
      dd.hidden = true;
    });
  });
}

function bindMiscritPicker(side: "atk" | "def") {
  const input = side === "atk" ? $<HTMLInputElement>("#atkMiscritSearch") : $<HTMLInputElement>("#defMiscritSearch");
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
      const firstBtn = dd.querySelector<HTMLElement>(".miscritpicker__item");
      if (firstBtn) firstBtn.click();
    }
  });

  document.addEventListener("click", (e) => {
    const host = input.closest(".miscritpicker");
    if (!host) return;
    if (e.target instanceof Node && !host.contains(e.target)) close();
  });
}

/* =========================================================
   AVATAR
========================================================= */

function inferAvatarFromName(name: string): string {
  const slug = normalize(name)
    .replace(/\s+/g, "_")
    .replace(/[^\w_]/g, "");
  return `${slug}_avatar.png`;
}

function setAvatarFromMiscrit(side: "atk" | "def", m: MiscritData | null | undefined) {
  const imgEl = side === "atk" ? $<HTMLImageElement>("#atkAvatar") : $<HTMLImageElement>("#defAvatar");
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
  const sel = $<HTMLSelectElement>("#atkAttack");
  const picker = $<HTMLSelectElement>("#atkAttackPicker");
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

  const makeCol = (list: MoveData[], offset: number) => {
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

interface Preset {
  miscrit: string;
  relics: string[];
  bonus: MiscritStats;
  useEnhanced?: boolean;
}

interface PresetStore {
  atk: Record<string, Preset>;
  def: Record<string, Preset>;
}

const PRESET_STORE_KEY = "miscritsHub.damageCalc.presets.v1";

function readPresetStore(): PresetStore {
  try {
    const raw = localStorage.getItem(PRESET_STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return { atk: {}, def: {} };
    if (!parsed.atk) parsed.atk = {};
    if (!parsed.def) parsed.def = {};
    return parsed;
  } catch {
    return { atk: {}, def: {} };
  }
}

function writePresetStore(store: PresetStore) {
  localStorage.setItem(PRESET_STORE_KEY, JSON.stringify(store));
}

function getSideMiscritName(side: "atk" | "def"): string {
  const id = side === "atk" ? atkId : defId;
  return (id ?? "").toString().trim();
}

function getSideRelics(side: "atk" | "def"): string[] {
  const cls = side === "atk" ? ".atkRelic" : ".defRelic";
  const arr = [ "", "", "", "" ];
  document.querySelectorAll<HTMLSelectElement>(cls).forEach(sel => {
    const slot = toNum(sel.getAttribute("data-slot"));
    if (slot >= 0 && slot < 4) arr[slot] = (sel.value ?? "").toString();
  });
  return arr;
}

function setSideRelics(side: "atk" | "def", relicArr: string[]) {
  for (let i = 0; i < 4; i++) {
    const sel = getRelicSelect(side, i);
    if (!sel) continue;

    const v = normalizeRelicValueToDisplayName(relicArr?.[i]);
    sel.value = v;
  }
}

function buildPreset(side: "atk" | "def"): Preset | null {
  const miscrit = getSideMiscritName(side);
  if (!miscrit) return null;

  const preset: Preset = {
    miscrit,
    relics: getSideRelics(side),
    bonus: { ...getCommittedBonus(side) } as MiscritStats,
  };

  if (side === "atk") preset.useEnhanced = !!atkUseEnhanced;

  return preset;
}

function applyPreset(side: "atk" | "def", preset: Preset) {
  if (!preset?.miscrit) return;

  applyMiscritSelection(side, preset.miscrit);
  setSideRelics(side, preset.relics);
  refreshAllRelicSlots();
  refreshSideStatsFromRelics(side);

  const b = preset.bonus ?? { HP:0,EA:0,PA:0,SPD:0,ED:0,PD:0 };
  setCommittedBonus(side, b);
  writeBonusDraft(side, b);
  updateBonusUI(side);
  refreshSideStatsFromRelics(side);

  if (side === "atk" && typeof preset.useEnhanced === "boolean") {
    atkUseEnhanced = preset.useEnhanced;
    const t = $<HTMLInputElement>("#atkEnhancedToggle");
    if (t) t.checked = atkUseEnhanced;

    atkAttackIndex = 0;
    syncMoveListPicker();
    renderSelectedMoveButton();
  }

  renderResult();
}

function savePresetFlow(side: "atk" | "def") {
  const preset = buildPreset(side);
  if (!preset) return;

  const suggested = preset.miscrit;
  const name = window.prompt("Preset name:", suggested);
  if (!name) return;

  const key = name.trim();
  if (!key) return;

  const store = readPresetStore();
  store[side][key] = preset;
  writePresetStore(store);
}

function loadPresetFlow(side: "atk" | "def") {
  const store = readPresetStore();
  const presets = store?.[side] ?? {};
  const keys = Object.keys(presets);

  if (!keys.length) {
    window.alert("No presets saved yet.");
    return;
  }

  const list = keys
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((k, i) => `${i + 1}) ${k}`)
    .join("\n");

  const pick = window.prompt(
    `Choose a preset (type number or exact name):\n\n${list}`,
    keys[0]
  );
  if (!pick) return;

  const raw = pick.trim();

  let chosenKey = raw;
  const asNum = Number(raw);
  if (Number.isFinite(asNum) && asNum >= 1 && asNum <= keys.length) {
    chosenKey = keys.sort((a, b) => a.localeCompare(b, "es"))[asNum - 1] ?? raw;
  }

  const preset = presets[chosenKey];
  if (!preset) {
    window.alert("Preset not found.");
    return;
  }

  applyPreset(side, preset);
}

/* =========================================================
   PRESET MODAL UI (ATTACKER)
========================================================= */

const STAT_ICON_FOLDER = "../assets/images/icons/";
const STAT_ICON = {
  HP:  `${STAT_ICON_FOLDER}hp.png`,
  SPD: `${STAT_ICON_FOLDER}spd.png`,
  EA:  `${STAT_ICON_FOLDER}ea.png`,
  PA:  `${STAT_ICON_FOLDER}pa.png`,
  ED:  `${STAT_ICON_FOLDER}ed.png`,
  PD:  `${STAT_ICON_FOLDER}pd.png`,
};

function computeFinalStatsForPreset(preset: Preset): MiscritStats | null {
  // base
  const m = findById(preset?.miscrit);
  if (!m) return null;

  const base = chooseBaseStatsForSide(m, "atk");
  if (!base) return null;

  // relics by slot (respecting SLOT_LEVELS[slot] match)
  const selections = (preset.relics || []).map((name, slot) => {
    const n = (name ?? "").toString().trim();
    if (!n) return null;
    return { name: n, slot, level: getSlotLevel(slot) };
  }).filter(Boolean) as { name: string, slot: number, level: number }[];

  const withRelics = applyRelicStatsBySlot(
    { HP: base.HP, SPD: base.SPD, PA: base.PA, EA: base.EA, PD: base.PD, ED: base.ED },
    selections
  );

  const b = preset.bonus ?? {HP:0,EA:0,PA:0,SPD:0,ED:0,PD:0};

  return {
    HP:  toNum(withRelics.HP)  + toNum(b.HP),
    SPD: toNum(withRelics.SPD) + toNum(b.SPD),
    EA:  toNum(withRelics.EA)  + toNum(b.EA),
    PA:  toNum(withRelics.PA)  + toNum(b.PA),
    ED:  toNum(withRelics.ED)  + toNum(b.ED),
    PD:  toNum(withRelics.PD)  + toNum(b.PD),
  };
}

function avatarSrcForName(name: string): string {
  const metaAvatar = AVATAR_BY_NAME.get(normalize(name));
  const inferred = inferAvatarFromName(name);
  return `../assets/images/miscrits_avatar/${metaAvatar || inferred}`;
}

function openPresetModal(){
  const modal = $("#presetModal");
  const grid  = $("#presetGrid");
  const search = $<HTMLInputElement>("#presetSearch");
  if (!modal || !grid || !search) return;

  const store = readPresetStore();
  const presets = store?.atk ?? {};
  const keys = Object.keys(presets);

  const render = (q: string) => {
    const qq = normalize(q);
    const list = keys
      .filter(k => !qq || normalize(k).includes(qq) || normalize(presets[k]?.miscrit).includes(qq))
      .sort((a,b) => a.localeCompare(b, "es"));

    if (!list.length){
      grid.innerHTML = `<div style="padding:10px;color:rgba(255,255,255,.65)">No presets saved.</div>`;
      return;
    }

    grid.innerHTML = list.map((key) => {
      const p = presets[key];
      const mis = p?.miscrit ?? "—";
      const stats = (p ? computeFinalStatsForPreset(p) : null) || {HP:"—",SPD:"—",EA:"—",PA:"—",ED:"—",PD:"—"};
      const avatar = avatarSrcForName(mis);
      const relics = (p?.relics || ["","","",""]).slice(0,4);

      const relicImgs = relics.map((name) => {
        const n = (name ?? "").toString().trim();
        const r = n ? RELIC_BY_NAME.get(relicKey(n)) : null;
        const src = r ? relicIconSrc(r) : RELIC_PLACEHOLDER;
        const alt = n || "Empty";
        return `<img class="presetRelic" src="${src}" alt="${alt}" title="${alt}" onerror="this.src='${RELIC_PLACEHOLDER}'">`;
      }).join("");

      const statCell = (K: keyof MiscritStats) => `
        <div class="presetStat">
          <img class="presetStat__ico" src="${STAT_ICON[K as keyof typeof STAT_ICON]}" alt="">
          <div class="presetStat__k">${K}</div>
          <div class="presetStat__v">${(stats as any)[K]}</div>
        </div>
      `;

      return `
        <div class="presetCard" data-preset="${key}">
          <img class="presetCard__avatar" src="${avatar}" alt="${mis}" onerror="this.src='../assets/images/miscrits_avatar/preset_avatar.png'">

          <div class="presetCard__main">
            <div class="presetCard__titleRow">
              <div class="presetCard__name" title="${key}">${key}</div>
              <div class="presetCard__miscrit">${mis}</div>
            </div>

            <div class="presetStats">
              ${(statCell as (k: keyof MiscritStats) => string)("HP")}
              ${(statCell as (k: keyof MiscritStats) => string)("SPD")}
              ${(statCell as (k: keyof MiscritStats) => string)("EA")}
              ${(statCell as (k: keyof MiscritStats) => string)("PA")}
              ${(statCell as (k: keyof MiscritStats) => string)("ED")}
              ${(statCell as (k: keyof MiscritStats) => string)("PD")}
            </div>

            <div class="presetRelics">
              ${relicImgs}
            </div>

            <div class="presetActions">
              <button class="btn btn--accent" type="button" data-act="load">Load</button>
              <button class="btn" type="button" data-act="edit">Edit</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // bind buttons
    grid.querySelectorAll(".presetCard").forEach((card: Element) => {
      const key = card.getAttribute("data-preset");
      const preset = key ? presets[key] : null;
      if (!preset) return;

      card.querySelector('[data-act="load"]')?.addEventListener("click", () => {
        applyPreset("atk", preset);
        closePresetModal();
      });

      card.querySelector('[data-act="edit"]')?.addEventListener("click", () => {
        applyPreset("atk", preset);
        closePresetModal();
      });
    });
  };

  search.value = "";
  render("");
  search.oninput = () => render(search.value);

  modal.hidden = false;
}

function closePresetModal(){
  const modal = $("#presetModal");
  if (modal) modal.hidden = true;
}

/* =========================================================
   APPLY MISCRIT SELECTION
========================================================= */

function setStatsInputsObj(prefix: "atk" | "def", stats: MiscritStats | null) {
  if (!stats) return;
  const hpEl = $<HTMLInputElement>(`#${prefix}HP`);
  const spdEl = $<HTMLInputElement>(`#${prefix}SPD`);
  const eaEl = $<HTMLInputElement>(`#${prefix}EA`);
  const paEl = $<HTMLInputElement>(`#${prefix}PA`);
  const edEl = $<HTMLInputElement>(`#${prefix}ED`);
  const pdEl = $<HTMLInputElement>(`#${prefix}PD`);

  if(hpEl) hpEl.value  = String(toNum(stats.HP));
  if(spdEl) spdEl.value = String(toNum(stats.SPD));
  if(eaEl) eaEl.value  = String(toNum(stats.EA));
  if(paEl) paEl.value  = String(toNum(stats.PA));
  if(edEl) edEl.value  = String(toNum(stats.ED));
  if(pdEl) pdEl.value  = String(toNum(stats.PD));
}

function setMeta(id: string | null | undefined, metaEl: HTMLElement | null) {
  const m = findById(id);
  if (!metaEl) return;
  if (!m) { metaEl.textContent = "—"; return; }
  const elems = Array.isArray(m.elements) ? m.elements.join(", ") : "";
  metaEl.textContent = elems ? `Elements: ${elems}` : "—";
}

function chooseBaseStatsForSide(m: MiscritData, side: "atk" | "def"): MiscritStats | null {
  const computed = computeBaseStatsFromCalculator(m.name, side);
  if (computed) return computed;
  if (m?.stats) return { ...m.stats };
  return null;
}

function applyMiscritSelection(side: "atk" | "def", idOrName: string | null | undefined) {
  const m = findById(idOrName);
  if (!m?.name) return;

  if (side === "atk") {
    atkId = m.name;
    const atkMiscritEl = $<HTMLInputElement>("#atkMiscrit");
    if (atkMiscritEl) atkMiscritEl.value = atkId;

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
    const defMiscritEl = $<HTMLInputElement>("#defMiscrit");
    if (defMiscritEl) defMiscritEl.value = defId;

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

function slugFileName(name: any) {
  return (name ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w_]/g, "") + ".png";
}

function relicIconSrc(r: RelicData | null | undefined): string {
  if (!r) return RELIC_PLACEHOLDER;
  if (r.icon) return `../assets/images/relics/${r.icon}`;
  return `../assets/images/relics/${slugFileName(r.name)}`;
}

function relicBonusText(r: RelicData | null | undefined): string {
  const s = r?.stats || ({} as MiscritStats);
  const parts = [];
  if (toNum(s.HP))  parts.push(`+${toNum(s.HP)} HP`);
  if (toNum(s.SPD)) parts.push(`+${toNum(s.SPD)} SPD`);
  if (toNum(s.PA))  parts.push(`+${toNum(s.PA)} PA`);
  if (toNum(s.EA))  parts.push(`+${toNum(s.EA)} EA`);
  if (toNum(s.PD))  parts.push(`+${toNum(s.PD)} PD`);
  if (toNum(s.ED))  parts.push(`+${toNum(s.ED)} ED`);
  return parts.join(" • ");
}

function getSlotLevel(slot: string | number): number {
  const s = Math.max(0, Math.min(3, toNum(slot)));
  return SLOT_LEVELS[s] ?? 35;
}

function getRelicSelect(side: "atk" | "def", slot: number | string): HTMLSelectElement | null {
  const cls = side === "atk" ? ".atkRelic" : ".defRelic";
  return document.querySelector<HTMLSelectElement>(`${cls}[data-slot="${slot}"]`);
}

function getRelicSelectionsDetailed(sideCls: string): { name: string; slot: number; level: number }[] {
  return Array.from(document.querySelectorAll<HTMLSelectElement>(sideCls))
    .map(sel => {
      const slot = toNum(sel.getAttribute("data-slot"));
      const name = (sel.value ?? "").toString().trim();
      if (!name) return null;
      return { name, slot, level: getSlotLevel(slot) };
    })
    .filter(Boolean) as { name: string; slot: number; level: number }[];
}

function applyRelicStatsBySlot(
  stats: MiscritStats,
  selections: { name: string; slot: number; level: number }[]
): MiscritStats {
  const out = { ...stats } as MiscritStats;

  for (const { slot, name } of selections) {
    const r = name ? RELIC_BY_NAME.get(relicKey(name)) : null;
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

function sumBonus(b: MiscritStats): number {
  return toNum(b.HP)+toNum(b.EA)+toNum(b.PA)+toNum(b.SPD)+toNum(b.ED)+toNum(b.PD);
}

function readBonusDraft(side: "atk" | "def"): MiscritStats {
  const p = side === "atk" ? "atk" : "def";
  return {
    HP: toNum($<HTMLInputElement>(`#${p}BonusHP`)?.value),
    EA: toNum($<HTMLInputElement>(`#${p}BonusEA`)?.value),
    PA: toNum($<HTMLInputElement>(`#${p}BonusPA`)?.value),
    SPD: toNum($<HTMLInputElement>(`#${p}BonusSPD`)?.value),
    ED: toNum($<HTMLInputElement>(`#${p}BonusED`)?.value),
    PD: toNum($<HTMLInputElement>(`#${p}BonusPD`)?.value),
  };
}

function writeBonusDraft(side: "atk" | "def", b: MiscritStats) {
  const p = side === "atk" ? "atk" : "def";
  const hpEl = $<HTMLInputElement>(`#${p}BonusHP`);
  const eaEl = $<HTMLInputElement>(`#${p}BonusEA`);
  const paEl = $<HTMLInputElement>(`#${p}BonusPA`);
  const spdEl = $<HTMLInputElement>(`#${p}BonusSPD`);
  const edEl = $<HTMLInputElement>(`#${p}BonusED`);
  const pdEl = $<HTMLInputElement>(`#${p}BonusPD`);

  if(hpEl) hpEl.value  = String(toNum(b.HP));
  if(eaEl) eaEl.value  = String(toNum(b.EA));
  if(paEl) paEl.value  = String(toNum(b.PA));
  if(spdEl) spdEl.value = String(toNum(b.SPD));
  if(edEl) edEl.value  = String(toNum(b.ED));
  if(pdEl) pdEl.value  = String(toNum(b.PD));
}

function getCommittedBonus(side: "atk" | "def"): MiscritStats {
  return side === "atk" ? BONUS_ATK : BONUS_DEF;
}

function setCommittedBonus(side: "atk" | "def", b: MiscritStats) {
  if (side === "atk") BONUS_ATK = { ...b } as MiscritStats;
  else BONUS_DEF = { ...b } as MiscritStats;
}

function updateBonusUI(side: "atk" | "def") {
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

function calcSideWithRelics(side: "atk" | "def"): MiscritStats | null {
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

function refreshSideStatsFromRelics(side: "atk" | "def") {
  const total = calcSideWithRelics(side);
  if (!total) return;
  setStatsInputsObj(side, total);
}

function setSlotButtonUI(side: "atk" | "def", slot: number) {
  const host = document.querySelector<HTMLElement>(`.relic-slot[data-side="${side}"][data-slot="${slot}"]`);
  if (!host) return;

  const sel = getRelicSelect(side, slot);
  const name = (sel?.value ?? "").toString().trim();

  const r = name ? RELIC_BY_NAME.get(relicKey(name)) : null;
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

let RELIC_PICK: { side: "atk" | "def" | null; slot: number | null } = { side: null, slot: null };

function openRelicModal(side: "atk" | "def", slot: number) {
  RELIC_PICK = { side, slot };

  const modal = $("#relicModal");
  const title = $("#relicModalTitle");
  const grid = $("#relicGrid");
  const search = $<HTMLInputElement>("#relicSearch");

  if (!modal || !title || !grid || !search) return;

  const lvl = getSlotLevel(slot);
  title.textContent = `Relics lvl ${lvl} • ${side === "atk" ? "Attacker" : "Defender"}`;

  search.value = "";
  grid.innerHTML = "";

  const renderGrid = (q: string) => {
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
        if (sel) sel.value = r.name ?? "";
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

function applyStandardDefender() {
  if (!defId) return;

  const b = { HP:27, SPD:1, EA:27, PA:27, ED:27, PD:27 };
  setCommittedBonus("def", b);
  writeBonusDraft("def", b);
  updateBonusUI("def");

  const rec = REC_BY_NAME.get(normalize(defId));

  if (rec?.relics_by_level) {
    const by = rec.relics_by_level;

    const picks = [ "", "", "", "" ];
    for (let slot = 0; slot < 4; slot++) {
      const lvl = String(getSlotLevel(slot));
      const list = by[lvl] ?? by[toNum(lvl)];
      picks[slot] = (Array.isArray(list) && list[0]) ? String(list[0]) : "";
    }

    setSideRelics("def", picks);
  }

  refreshAllRelicSlots();
  refreshSideStatsFromRelics("def");
  renderResult();
}


/* =========================================================
   RESULT
========================================================= */

function getInputsRaw() {
  return {
    atkPA: toNum($<HTMLInputElement>("#atkPA")?.value),
    atkEA: toNum($<HTMLInputElement>("#atkEA")?.value),
    atkSPD: toNum($<HTMLInputElement>("#atkSPD")?.value),
    atkPD: toNum($<HTMLInputElement>("#atkPD")?.value),
    atkED: toNum($<HTMLInputElement>("#atkED")?.value),
    atkHP: toNum($<HTMLInputElement>("#atkHP")?.value),

    defPA: toNum($<HTMLInputElement>("#defPA")?.value),
    defEA: toNum($<HTMLInputElement>("#defEA")?.value),
    defSPD: toNum($<HTMLInputElement>("#defSPD")?.value),
    defPD: toNum($<HTMLInputElement>("#defPD")?.value),
    defED: toNum($<HTMLInputElement>("#defED")?.value),
    defHP: toNum($<HTMLInputElement>("#defHP")?.value),
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

  const setUI = (minTxt: string, maxTxt: string, avgTxt: string, koTxt: string) => {
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

  const mode = $<HTMLSelectElement>("#atkMode")?.value ?? "auto";
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

function swapInputValues(aId: string, bId: string) {
  const a = document.getElementById(aId) as HTMLInputElement;
  const b = document.getElementById(bId) as HTMLInputElement;
  if (!a || !b) return;
  const tmp = a.value;
  a.value = b.value;
  b.value = tmp;
}

function swapRelicSelectValues() {
  for (let i = 0; i < 4; i++) {
    const a = document.querySelector<HTMLSelectElement>(`.atkRelic[data-slot="${i}"]`);
    const b = document.querySelector<HTMLSelectElement>(`.defRelic[data-slot="${i}"]`);
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
  const [dbRes, relicRes, metaRes, baseStatsRes, miscritsRelicsRes] = await Promise.all([
    fetch("../assets/data/miscritsdb.json", { cache: "no-store" }),
    fetch("../assets/data/relics.json", { cache: "no-store" }),
    fetch("../assets/data/miscrits_meta.json", { cache: "no-store" }),
    fetch("../assets/data/base_stats.json", { cache: "no-store" }),
    fetch("../assets/data/miscrits_relics.json", { cache: "no-store" }),
  ]);

  if (!dbRes.ok) throw new Error(`HTTP ${dbRes.status} loading miscritsdb.json`);
  if (!relicRes.ok) throw new Error(`HTTP ${relicRes.status} loading relics.json`);
  if (!metaRes.ok) throw new Error(`HTTP ${metaRes.status} loading miscrits_meta.json`);
  if (!baseStatsRes.ok) throw new Error(`HTTP ${baseStatsRes.status} loading base_stats.json`);
  if (!miscritsRelicsRes.ok) throw new Error(`HTTP ${miscritsRelicsRes.status} loading miscrits_relics.json`);

  DB = await dbRes.json();
  RELICS = await relicRes.json();

  const miscritsRelicsJson = await miscritsRelicsRes.json();
  MISCRITS_RELICS = miscritsRelicsJson?.miscrits ?? miscritsRelicsJson ?? [];

  REC_BY_NAME = new Map(
    MISCRITS_RELICS
      .filter(x => x?.name)
      .map(x => [normalize(x.name), x])
  );

  const metaJson = await metaRes.json();
  MISCRITS_META = metaJson?.miscrits ?? metaJson ?? [];

  const baseStatsJson = await baseStatsRes.json();
  BASE_STATS = Array.isArray(baseStatsJson) ? baseStatsJson : (baseStatsJson?.miscrits ?? []);

  RELIC_BY_NAME = new Map(RELICS.map(r => [relicKey(r.name), r]));
  RELIC_NAME_BY_KEY = new Map(RELICS.map(r => [relicKey(r.name), r.name!]));

  (window as any).__RELIC_NAME_BY_KEY = RELIC_NAME_BY_KEY;  

  AVATAR_BY_NAME = new Map(
    MISCRITS_META
      .filter(x => x?.name && x?.avatar)
      .map(x => [normalize(x.name), x.avatar!])
  );

  BASE_BY_NAME = new Map(
    BASE_STATS
      .filter(x => x?.name && (x?.baseStats || x?.stats || x?.base || x?.base_stats))
      .map(x => {
        const bs = x.baseStats ?? x.stats ?? x.base ?? x.base_stats;
        return [normalize(x.name), bs as MiscritStats];
      })
  );
}

function bindAll() {
  bindMiscritPicker("atk");
  bindMiscritPicker("def");

  $("#defStandardStats")?.addEventListener("click", applyStandardDefender);

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

  $("#atkLoadPreset")?.addEventListener("click", openPresetModal);
  $("#atkSavePreset")?.addEventListener("click", () => savePresetFlow("atk"));

  document.addEventListener("click", (e: Event) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-action="close-presets"]')) closePresetModal();
    if (target?.closest('[data-action="close-moves"]')) {
      const modal = $("#moveModal");
      if (modal) modal.hidden = true;
    }
    if (target?.closest('[data-action="close-relic"]')) closeRelicModal();
  });

  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      closePresetModal();
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

  $("#atkEnhancedToggle")?.addEventListener("change", (e: Event) => {
    const target = e.target as HTMLInputElement;
    atkUseEnhanced = !!target.checked;
    atkAttackIndex = 0;
    syncMoveListPicker();
    renderSelectedMoveButton();
    renderResult();
  });

  document.querySelectorAll(".tab").forEach((btn: Element) => {
    btn.addEventListener("click", () => {
      const side = btn.getAttribute("data-side");
      const tab  = btn.getAttribute("data-tab");

      const host = btn.closest(".subpanel");
      if (!host) return;

      host.querySelectorAll(".tab").forEach(t => t.classList.remove("is-active"));
      btn.classList.add("is-active");

      host.querySelectorAll<HTMLElement>(".panel").forEach(p => {
        const isTarget = p.getAttribute("data-panel") === tab && p.getAttribute("data-side") === side;
        p.hidden = !isTarget;
      });

      if (tab === "bonus" && (side === "atk" || side === "def")) updateBonusUI(side);
    });
  });

  (["atk","def"] as const).forEach(side => {
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

  if ($<HTMLInputElement>("#atkMiscritSearch")) $<HTMLInputElement>("#atkMiscritSearch")!.value = atkId ?? "";
  if ($<HTMLInputElement>("#defMiscritSearch")) $<HTMLInputElement>("#defMiscritSearch")!.value = defId ?? "";
  if ($<HTMLSelectElement>("#atkMiscrit")) $<HTMLSelectElement>("#atkMiscrit")!.value = atkId ?? "";
  if ($<HTMLSelectElement>("#defMiscrit")) $<HTMLSelectElement>("#defMiscrit")!.value = defId ?? "";

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
