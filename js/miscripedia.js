const $ = (s) => document.querySelector(s);

const STATE = {
  all: [],
  q: "",
  rarities: new Set(),
  elements: new Set(),
  tags: new Set(),
  locationFilter: new Set(),
  attack: "",
  sort: "idAsc",
};

const MISC_TYPE_ICON = {
  Antiheal: "antiheal.png",
  Bleed: "bleed.png",
  Block: "block.png",
  Bot: "buff_over_time.png",
  Buff: "buff.png",
  CI: "ci.png",
  Cleanser: "cleanser.png",
  Confuse: "confuse.png",
  Debuff: "debuff.png",
  ForcesSwitch: "forces_switch.png",
  Heal: "heal.png",
  Negate: "negate.png",
  Paralyze: "paralyze.png",
  Poison: "poison.png",
  SI: "si.png",
  Sleep: "sleep.png",
  Special: "special.png",
};

const ELEMENTS_ORDER = ["Water","Fire","Nature","Wind","Earth","Lightning","Physical","Misc"];

function prettyElementLabel(el){
  const parts = String(el ?? "").match(/[A-Z][a-z]*/g) || [];
  return parts.length >= 2 ? parts.join("/") : (el ?? "");
}

function elementIconPath(el){
  const parts = String(el ?? "").match(/[A-Z][a-z]*/g) || [];
  const file = parts.length >= 2
    ? parts.map(p => p.toLowerCase()).join("")
    : String(el ?? "").toLowerCase();
  return `../assets/images/type/${file}.png`;
}

function stageName(m, stageIdx=0){
  return m?.names?.[stageIdx] ?? m?.names?.[0] ?? "Unknown";
}

/* =========================================================
   STATS FILTER
========================================================= */

const STAT_LABELS = ["Weak","Moderate","Strong","Max","Elite"];

const STATS_SELECTED = {
  hp: null, spd: null, ea: null, ed: null, pa: null, pd: null,
};

const STAT_META = [
  ["hp", "HP"],
  ["spd","Speed"],
  ["ea", "Elemental Attack"],
  ["ed", "Elemental Defense"],
  ["pa", "Physical Attack"],
  ["pd", "Physical Defense"],
];

function getStatValue(m, key){
  return String(m?.[key] ?? "").trim();
}

function passesStatsFilter(m){
  for (const [key] of STAT_META){
    const wanted = STATS_SELECTED[key];
    if (!wanted) continue;
    const actual = getStatValue(m, key);
    if (actual !== wanted) return false;
  }
  return true;
}

function initStatsFilterUI(){
  const btn = $("#statsBtn");
  const panel = $("#statsPanel");
  const grid = $("#statsGrid");
  const clearBtn = $("#statsClear");
  const root = $("#statsFilter");

  if (!btn || !panel || !grid || !root) return;

  grid.innerHTML = STAT_META.map(([key,label]) => `
    <div class="statGroup" data-key="${key}">
      <div class="statGroup__label">${label}</div>
      <div class="statOpts">
        ${STAT_LABELS.map(v => `
          <div class="statOpt" data-val="${v}">${v}</div>
        `).join("")}
      </div>
    </div>
  `).join("");

  function setOpen(open){
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(panel.hidden);
  });

  panel.addEventListener("click", (e) => e.stopPropagation());

  document.addEventListener("click", (e) => {
    if (panel.hidden) return;
    if (!root.contains(e.target)) setOpen(false);
  });

  grid.addEventListener("click", (e) => {
    const opt = e.target.closest(".statOpt");
    if (!opt) return;

    const group = opt.closest(".statGroup");
    const key = group?.dataset?.key;
    const val = opt.dataset.val;

    if (!key) return;

    STATS_SELECTED[key] = (STATS_SELECTED[key] === val) ? null : val;

    group.querySelectorAll(".statOpt").forEach(el => {
      el.classList.toggle("is-on", STATS_SELECTED[key] === el.dataset.val);
    });

    render();
  });

  clearBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    for (const k in STATS_SELECTED) STATS_SELECTED[k] = null;
    grid.querySelectorAll(".statOpt").forEach(el => el.classList.remove("is-on"));
    render();
  });
}

/* =========================================================
   ATTACK AUTOCOMPLETE
========================================================= */

let ATTACK_NAMES = [];
let ATTACK_ICON_BY_NAME = new Map();

function buildAttackIndex(){
  const set = new Set();
  const iconByName = new Map();

  for (const m of STATE.all){
    for (const a of (m.abilities ?? [])){
      const n = String(a?.name ?? "").trim();
      if (!n) continue;

      set.add(n);

      const icon = attackIconPathFromAbility(a);
      
      if (!iconByName.has(n)) {
        iconByName.set(n, icon);
      } else {
        const cur = iconByName.get(n);
        const curIsGenericMisc = String(cur).toLowerCase().includes("/misc.png");
        const newIsGenericMisc = String(icon).toLowerCase().includes("/misc.png");

        if (curIsGenericMisc && !newIsGenericMisc) {
          iconByName.set(n, icon);
        }
      }
    }
  }

  ATTACK_NAMES = [...set].sort((a,b)=>a.localeCompare(b));
  ATTACK_ICON_BY_NAME = iconByName;
}

function getAttackElement(a){
  const raw =
    a?.element ??
    a?.attackElement ??
    a?.attack_element ??
    a?.school ??
    a?.dmgElement ??
    a?.damageElement ??
    a?.typeElement ??
    "";

  const el = String(raw || "").trim();
  if (!el) return "Physical";

  const norm = el.charAt(0).toUpperCase() + el.slice(1).toLowerCase();

  const alias = {
    Electric: "Lightning",
    Elec: "Lightning",
  };

  return alias[norm] || norm;
}

function attackIconPathFromAbility(a){
  const el = String(a?.element ?? "").trim();
  const type = String(a?.type ?? "").trim();

  if (el && el.toLowerCase() !== "misc"){
    return elementIconPath(el);
  }

  const file = MISC_TYPE_ICON[type];
  if (file) return `../assets/images/type/${file}`;

  return elementIconPath("Misc");
}

function escapeAttr(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll('"',"&quot;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}
function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

function renderAttackDropdown(query){
  const dd = $("#attackDropdown");
  if (!dd) return;

  const q = String(query ?? "").trim().toLowerCase();

  if (!q){
    dd.hidden = true;
    dd.innerHTML = "";
    return;
  }

  const matches = ATTACK_NAMES
    .filter(n => n.toLowerCase().includes(q))
    .slice(0, 40);

  if (!matches.length){
    dd.hidden = true;
    dd.innerHTML = "";
    return;
  }

  dd.hidden = false;
  const icon = ATTACK_ICON_BY_NAME.get(name) || elementIconPath("Physical");
  dd.innerHTML = matches.map((name) => {
    const icon = ATTACK_ICON_BY_NAME.get(name) || elementIconPath("Physical");

    return `
      <div class="apItem" data-name="${escapeAttr(name)}">
        <div class="apIcon" style="background-image:url('${escapeAttr(icon)}')"></div>
        <div class="apName">${escapeHtml(name)}</div>
      </div>
    `;
  }).join("");
}

function closeAttackDropdown(){
  const dd = $("#attackDropdown");
  if (!dd) return;
  dd.hidden = true;
  dd.innerHTML = "";
}

function wireAttackAutocomplete(){
  const input = $("#attackFilter");
  const dd = $("#attackDropdown");
  if (!input || !dd) return;

  input.addEventListener("input", (e) => {
    STATE.attack = e.target.value.trim();
    renderAttackDropdown(STATE.attack);
    render();
  });

  dd.addEventListener("click", (e) => {
    const item = e.target.closest(".apItem");
    if (!item) return;

    const name = item.getAttribute("data-name") || "";
    input.value = name;
    STATE.attack = name;
    closeAttackDropdown();
    render();
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest(".miscritpicker")) return;
    closeAttackDropdown();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape"){
      closeAttackDropdown();
      input.blur();
    }
  });

  input.addEventListener("focus", () => {
    renderAttackDropdown(input.value);
  });
}

function rarityClass(rarity){
  switch ((rarity ?? "").toLowerCase()){
    case "common": return "rarity-common";
    case "rare": return "rarity-rare";
    case "epic": return "rarity-epic";
    case "exotic": return "rarity-exotic";
    case "legendary": return "rarity-legendary";
    default: return "";
  }
}

/* =========================================================
   SPRITES
========================================================= */

function spriteUrl(m) {
  const name = (m?.names?.[0] ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

  return `../assets/images/backs/${name}_back.png`;
}

/* =========================================================
   FILTER HELPERS
========================================================= */

function uniq(arr){ return Array.from(new Set(arr)); }

const RARITY_ORDER = [
  "Common",
  "Rare",
  "Epic",
  "Exotic",
  "Legendary"
];

function hasFixedDamage(m){
  const hay = (arr) => (arr ?? []).some(a =>
    String(a?.desc ?? "").toLowerCase().includes("fixed damage")
  );

  if (hay(m.abilities)) return true;

  for (const ab of (m.abilities ?? [])){
    if (hay(ab?.additional)) return true;
  }

  return false;
}

function hasChaos(m){
  const has = (arr) => (arr ?? []).some(a => {
    const desc = String(a?.desc ?? "").toLowerCase();
    const name = String(a?.name ?? "").toLowerCase();

    return desc.includes("chaos") || name.includes("chaos");
  });

  if (has(m.abilities)) return true;

  for (const ab of (m.abilities ?? [])){
    if (has(ab?.additional)) return true;
  }

  return false;
}


function computeTags(m){
  const set = new Set();

  for (const ab of (m.abilities ?? [])){
    if (ab?.type) set.add(String(ab.type));

    if (Array.isArray(ab.additional)){
      for (const ad of ab.additional){
        if (ad?.type) set.add(String(ad.type));
      }
    }
  }
  if (hasFixedDamage(m)) set.add("Fixed Damage");
  if (hasChaos(m)) set.add("Chaos");

  const deny = new Set(["Attack", "Buff"]);
  return [...set].filter(t => !deny.has(t));
}

function computeLocations(m){
  const locs = m?.locations;
  if (!locs) return [];

  const set = new Set();

  for (const key of Object.keys(locs)){
    if (key) set.add(String(key));
  }

  return [...set];
}

function rarityColor(rarity){
  switch ((rarity ?? "").toLowerCase()){
    case "common": return "#9ca3af";
    case "rare": return "#60a5fa";
    case "epic": return "#4ade80";
    case "exotic": return "#a78bfa";
    case "legendary": return "#facc15";
    default: return "rgba(255,255,255,.45)";
  }
}

function hasAttack(m, attackName){
  const q = String(attackName ?? "").toLowerCase().trim();
  if (!q) return true;

  return (m.abilities ?? []).some(a =>
    String(a?.name ?? "").toLowerCase().includes(q)
  );
}

/* =========================================================
   TAGS
========================================================= */

function ensureTagsUI(){
  const row = document.querySelector(".mpFilters");
  if (!row) return;
  if ($("#tagsBar")) return;

  const bar = document.createElement("div");
  bar.id = "tagsBar";
  bar.style.display = "flex";
  bar.style.gap = "8px";
  bar.style.flexWrap = "wrap";
  bar.style.justifyContent = "center";
  bar.style.margin = "10px 0 0";
  row.insertAdjacentElement("afterend", bar);

  bar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tag-remove]");
    if (!btn) return;
    const t = btn.getAttribute("data-tag-remove");
    STATE.tags.delete(t);
    renderSelectedTags();
    render();
  });
}

function renderSelectedTags(){
  const bar = $("#tagsBar");
  if (!bar) return;

  const tags = [...STATE.tags].sort((a,b)=>a.localeCompare(b));
  if (!tags.length){
    bar.innerHTML = "";
    return;
  }

  bar.innerHTML = tags.map(t => `
    <span class="tag tag--active" style="display:inline-flex;align-items:center;gap:8px;">
      ${escapeHtml(t)}
      <button type="button"
        data-tag-remove="${escapeAttr(t)}"
        aria-label="Remove ${escapeAttr(t)}"
        style="border:0;cursor:pointer;background:transparent;color:inherit;font-weight:900;opacity:.85;line-height:1;">
        ×
      </button>
    </span>
  `).join("");
}

function ensureLocationsUI(){
  const row = document.querySelector(".mpFilters");
  if (!row) return;
  if ($("#locationFilterBar")) return;

  const bar = document.createElement("div");
  bar.id = "locationFilterBar";
  bar.style.display = "flex";
  bar.style.gap = "8px";
  bar.style.flexWrap = "wrap";
  bar.style.justifyContent = "center";
  bar.style.margin = "10px 0 0";
  row.insertAdjacentElement("afterend", bar);

  bar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-location-remove]");
    if (!btn) return;
    const t = btn.getAttribute("data-location-remove");
    STATE.locationFilter.delete(t);
    renderSelectedLocations();
    render();
  });
}

function renderSelectedLocations(){
  const bar = $("#locationFilterBar");
  if (!bar) return;

  const locs = [...STATE.locationFilter].sort((a,b)=>a.localeCompare(b));
  if (!locs.length){
    bar.innerHTML = "";
    return;
  }

  bar.innerHTML = locs.map(l => `
    <span class="tag tag--active" style="display:inline-flex;align-items:center;gap:8px;">
      ${escapeHtml(l)}
      <button type="button"
        data-location-remove="${escapeAttr(l)}"
        aria-label="Remove ${escapeAttr(l)}"
        style="border:0;cursor:pointer;background:transparent;color:inherit;font-weight:900;opacity:.85;line-height:1;">
        ×
      </button>
    </span>
  `).join("");
}

function ensureRaritiesUI(){
  const row = $(".filtersRow");
  if (!row) return;
  if ($("#raritiesBar")) return;

  const bar = document.createElement("div");
  bar.id = "raritiesBar";
  bar.style.display = "flex";
  bar.style.gap = "8px";
  bar.style.flexWrap = "wrap";
  bar.style.justifyContent = "center";
  bar.style.margin = "10px 0 0";
  row.insertAdjacentElement("afterend", bar);

  bar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-rarity-remove]");
    if (!btn) return;
    const r = btn.getAttribute("data-rarity-remove");
    STATE.rarities.delete(r);
    renderSelectedRarities();
    render();
  });
}

function renderSelectedRarities(){
  const bar = $("#raritiesBar");
  if (!bar) return;

  const list = [...STATE.rarities].sort(
    (a,b)=>RARITY_ORDER.indexOf(a)-RARITY_ORDER.indexOf(b)
  );

  if (!list.length){
    bar.innerHTML = "";
    return;
  }

  bar.innerHTML = list.map(r => `
    <span class="tag tag--active" style="display:inline-flex;align-items:center;gap:8px;">
      ${escapeHtml(r)}
      <button type="button"
        data-rarity-remove="${escapeAttr(r)}"
        aria-label="Remove ${escapeAttr(r)}"
        style="border:0;cursor:pointer;background:transparent;color:inherit;font-weight:900;opacity:.85;line-height:1;">
        ×
      </button>
    </span>
  `).join("");
}

/* =========================================================
   APPLY FILTERS + RENDER
========================================================= */

function applyFilters(){
  let out = STATE.all.slice();

  if (STATE.attack) out = out.filter(m => hasAttack(m, STATE.attack));

  const q = STATE.q.trim().toLowerCase();
  if (q){
    out = out.filter(m => (
      stageName(m,0).toLowerCase().includes(q) ||
      String(m.id).includes(q)
    ));
  }

  if (STATE.rarities.size){
    out = out.filter(m => STATE.rarities.has(m.rarity));
  }

  if (STATE.elements.size){
    out = out.filter(m => STATE.elements.has(m.element ?? ""));
  }

  if (STATE.tags.size){
    const need = [...STATE.tags];
    out = out.filter(m => {
      const mtags = computeTags(m);
      return need.every(t => mtags.includes(t));
    });
  }

  if(STATE.locationFilter.size){
    let need = [...STATE.locationFilter];
    out = out.filter(m => {
      const locs = computeLocations(m);
      if (!locs || Object.keys(locs).length === 0) return need.includes("Miscrit Shop");
      return locs.some(loc => need.includes(loc));
    });
  }

  out = out.filter(m => passesStatsFilter(m));

  out.sort((a,b) => {
    const an = stageName(a,0).toLowerCase();
    const bn = stageName(b,0).toLowerCase();
    switch(STATE.sort){
      case "nameAsc": return an.localeCompare(bn);
      case "nameDesc": return bn.localeCompare(an);
      case "idAsc": return (a.id??0) - (b.id??0);
      case "idDesc": return (b.id??0) - (a.id??0);
      default: return 0;
    }
  });

  return out;
}

function render(){
  const grid = $("#grid");
  const empty = $("#empty");
  if (!grid || !empty) return;

  renderSelectedRarities();
  renderSelectedTags();
  renderSelectedLocations();

  const list = applyFilters();

  grid.innerHTML = "";
  empty.classList.toggle("hidden", list.length !== 0);

  for (const m of list){
    const tags = computeTags(m).slice(0,3);

    const card = document.createElement("div");
    card.className = "mcard card";
    card.addEventListener("click", () => {
      window.location.href = `../pages/miscripedia_data.html?id=${encodeURIComponent(m.id)}&stage=0`;
    });

    card.innerHTML = `
			<div class="mcardTop">
				<div class="mdot" style="background:${rarityColor(m.rarity)}"></div>
				<div class="mname">${escapeHtml(stageName(m,0))}</div>
			</div>

			<div class="mbox">
				<img src="${spriteUrl(m)}" alt="${escapeAttr(stageName(m,0))}" onerror="this.style.opacity=.25;"/>
			</div>

			<div class="mfoot">
				<div class="mtags">
					${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
				</div>
				<div class="mrar ${rarityClass(m.rarity)}">
					${escapeHtml(m.rarity ?? "")}
				</div>
			</div>
    `;
    grid.appendChild(card);
  }
}

/* =========================================================
   UI BUILDERS
========================================================= */

function renderElementPills() {
  const box = $("#elementsPills");
  if (!box) return;

  const elems = uniq(STATE.all.map(m => m.element).filter(Boolean))
    .sort((a,b)=>ELEMENTS_ORDER.indexOf(a)-ELEMENTS_ORDER.indexOf(b));

  box.innerHTML = "";

  const allBtn = document.createElement("div");
  allBtn.className = "pill";
  allBtn.innerHTML = `<span>All Elements</span>`;
  allBtn.onclick = () => {
    STATE.elements.clear();
    sync();
    render();
  };
  box.appendChild(allBtn);

  const pillByEl = new Map();

  for (const el of elems){
    const p = document.createElement("div");
    p.className = "pill";

    const label = prettyElementLabel(el);
    const icon = elementIconPath(el);

    p.innerHTML = `
      <img class="pill__icon" src="${icon}" alt="${label}"
           onerror="this.style.display='none'">
      <span>${label}</span>
    `;

    p.onclick = () => {
      if (STATE.elements.has(el)) STATE.elements.delete(el);
      else STATE.elements.add(el);
      sync();
      render();
    };

    pillByEl.set(el, p);
    box.appendChild(p);
  }

  function sync(){
    const noneSelected = STATE.elements.size === 0;
    allBtn.classList.toggle("active", noneSelected);

    for (const [el, pill] of pillByEl){
      pill.classList.toggle("active", STATE.elements.has(el));
    }
  }

  sync();
}


function fillSelects(){
  const raritySel = $("#rarity");
  const tagSel = $("#tag");
  const locationFilterSel = $("#locationFilter");

  if (!raritySel || !tagSel || !locationFilterSel) return;

  raritySel.innerHTML = `<option value="">All Rarities</option>`;
  tagSel.innerHTML = `<option value="">Filter by Tags</option>`;
  locationFilterSel.innerHTML = `<option value="">Filter by Location</option>`;

  const rarities = uniq(STATE.all.map(m => m.rarity).filter(Boolean))
    .sort((a, b) =>
      RARITY_ORDER.indexOf(a) - RARITY_ORDER.indexOf(b)
    );
  for (const r of rarities){
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = r;
    raritySel.appendChild(opt);
  }

  const tags = uniq(STATE.all.flatMap(computeTags)).sort((a,b)=>a.localeCompare(b));
  for (const t of tags){
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    tagSel.appendChild(opt);
  }

  const locations = uniq([...STATE.all.flatMap(computeLocations), "Miscrit Shop"]).sort((a,b)=>a.localeCompare(b));
  for (const l of locations){
    const opt = document.createElement("option");
    opt.value = l;
    opt.textContent = l;
    locationFilterSel.appendChild(opt);
  }
}

/* =========================================================
   MAIN
========================================================= */

async function main(){
  const res = await fetch("../assets/data/miscripedia.json");
  const data = await res.json();

  STATE.all = Array.isArray(data) ? data : (data.miscrits ?? []);

  buildAttackIndex();
  wireAttackAutocomplete();

  fillSelects();
  renderElementPills();
  initStatsFilterUI();

  ensureTagsUI();
  ensureLocationsUI();
  ensureRaritiesUI();
  renderSelectedRarities();
  renderSelectedTags();
  renderSelectedLocations();

  const qEl = $("#q");
  const rarityEl = $("#rarity");
  const tagEl = $("#tag");
  const locationFilterEl = $("#locationFilter");
  const sortEl = $("#sort");

  if (qEl) qEl.addEventListener("input", (e)=>{ STATE.q = e.target.value; render(); });

  if (rarityEl) rarityEl.addEventListener("change", (e)=> {
    const v = String(e.target.value || "").trim();
    if (!v) return;
    STATE.rarities.add(v);
    e.target.value = "";
    renderSelectedRarities();
    render();
  });

  if (tagEl) tagEl.addEventListener("change", (e)=>{
    const v = String(e.target.value || "").trim();
    if (!v) return;
    STATE.tags.add(v);
    e.target.value = "";
    renderSelectedTags();
    render();
  });

  if (locationFilterEl) locationFilterEl.addEventListener("change", (e)=>{
    const v = String(e.target.value || "").trim();
    if (!v) return;
    STATE.locationFilter.add(v);
    e.target.value = "";
    renderSelectedLocations();
    render();
  });

  if (sortEl) sortEl.addEventListener("change", (e)=>{ STATE.sort = e.target.value; render(); });

  render();
}

main().catch(console.error);
