const $ = (s) => document.querySelector(s);

function getParam(name){
  const u = new URL(location.href);
  return u.searchParams.get(name);
}

function stageName(m, stageIdx=0){
  return m?.names?.[stageIdx] ?? m?.names?.[0] ?? "Unknown";
}

function escHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* =========================================================
   ICON HELPERS
========================================================= */

const ABILITY_ICON_ALIAS = {
  // normalizeKey => lower_snake, así que SOLO llaves en lower
  hot: "heal",
  bot: "buff_over_time",
  bot_buff: "bot_buff",

  healovertime: "heal",
  lifesteal: "heal",
  regen: "heal",

  accuracydebuff: "accuracy_debuff",
  accuracybuff: "accuracy_buff",

  attackdebuff: "debuff",
  defensedeuff: "debuff", // si tu data viene así
  defensedeBuff: "debuff", // (no se usará, pero por si copias)
};

function resolveAbilityIcon(key){
  return key ? (ABILITY_ICON_ALIAS[key] ?? key) : "";
}

function normalizeKey(s){
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function elementIconUrl(element){
  if (!element) return "";
  const key = normalizeKey(element);
  return `../assets/images/type/${key}.png`;
}

function abilityIconUrl(ab){
  const typeRaw = normalizeKey(ab?.type);
  const elRaw   = normalizeKey(ab?.element);

  const type = resolveAbilityIcon(typeRaw);
  const el   = resolveAbilityIcon(elRaw);

  if (typeRaw === "attack"){
    return el ? `../assets/images/type/${el}.png` : "";
  }
  if (el && el !== "misc"){
    return `../assets/images/type/${el}.png`;
  }
  return type ? `../assets/images/type/${type}.png` : "";
}

/* =========================================================
   SPRITES
========================================================= */

function backSpriteUrl(m) {
  const name = (m?.names?.[0] ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return `../assets/images/backs/${name}_back.png`;
}

function evoSpriteUrl(m, stageIdx){
  // si algún día tienes sprites por stage, aquí lo cambias
  return backSpriteUrl(m);
}

/* =========================================================
   TAGS / META
========================================================= */

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
  const prefer = ["Sleep","Poison","Negate"];
  const out = prefer.filter(x => set.has(x));
  return out.length ? out : Array.from(set).slice(0,3);
}

function firstLocation(m){
  const loc = m.locations ?? {};
  const zones = Object.keys(loc);
  return zones.length ? zones[0] : "Unknown";
}

/* =========================================================
   STATS
========================================================= */

function statToPips(label){
  switch(String(label)){
    case "Weak": return 1;
    case "Moderate": return 2;
    case "Strong": return 3;
    case "Max": return 4;
    case "Elite": return 5;
    default: return 0;
  }
}

function renderStats(m){
  const statsEl = $("#stats");
  if (!statsEl) return;

  const rows = [
    ["Health", m.hp, "hp"],
    ["Speed", m.spd, "spd"],
    ["Elemental Attack", m.ea, "ea"],
    ["Elemental Defense", m.ed, "ed"],
    ["Physical Attack", m.pa, "pa"],
    ["Physical Defense", m.pd, "pd"],
  ];

  statsEl.innerHTML = rows.map(([label,val,key]) => {
    const n = statToPips(val);
    return `
      <div class="statRow statRow--pips">
        <div class="statLabel">${escHtml(label)}</div>
        <div class="pips pips--${key}" aria-label="${escHtml(label)} ${n}/5">
          ${Array.from({length:5}, (_,i)=>`
            <span class="pip ${i < n ? "is-on" : ""}"></span>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

/* =========================================================
   ABILITIES
========================================================= */

function orderAbilities(m){
  const abs = m.abilities ?? [];
  const byId = new Map(abs.map(a => [a.id, a]));
  const ordered = [];

  for (const id of (m.ability_order ?? [])){
    const hit = byId.get(id);
    if (hit) ordered.push(hit);
  }
  for (const a of abs){
    if (!ordered.includes(a)) ordered.push(a);
  }
  return ordered;
}

function buildEnchantText(a){
  const ed = String(a.enchant_desc ?? "").trim();
  if (ed) return ed;

  const e = a.enchant ?? null;
  if (!e) return "";

  const parts = [];
  if (e.ap != null) parts.push(`${e.ap > 0 ? "+" : ""}${e.ap} Attack Power`);
  if (e.accuracy != null) parts.push(`${e.accuracy > 0 ? "+" : ""}${e.accuracy}% Accuracy`);

  const add = e.additional?.[0];
  if (add?.type){
    const ap = add.ap != null ? ` ${add.ap > 0 ? "+" : ""}${add.ap}` : "";
    parts.push(`${add.type}${ap}`.trim());
  }
  return parts.join(" • ");
}

/* ---------- Tooltip ---------- */

function positionTip(targetEl){
  const tip = $("#abTip");
  if (!tip || tip.hidden || !targetEl) return;

  const pad = 14;
  const rect = targetEl.getBoundingClientRect();

  const w = tip.offsetWidth || 260;
  const h = tip.offsetHeight || 140;

  let x = rect.right + pad;
  let y = rect.top;

  const maxX = window.innerWidth - w - 10;
  const maxY = window.innerHeight - h - 10;

  if (x > maxX) x = rect.left - w - pad;
  if (y > maxY) y = maxY;
  if (y < 10) y = 10;

  tip.style.left = `${x}px`;
  tip.style.top  = `${y}px`;
}

function hideAbTip(){
  const tip = $("#abTip");
  if (!tip) return;
  tip.hidden = true;
  tip.innerHTML = "";
  tip.removeAttribute("data-open");
}

function showAbTip(targetEl, a){
  const tip = $("#abTip");
  if (!tip) return;

  const name = a.name ?? "Ability";
  const el = a.element ?? "";
  const ap = (a.ap != null) ? `AP: ${a.ap}` : "";
  const acc = (a.accuracy != null) ? `Accuracy: ${a.accuracy}%` : "";
  const desc = String(a.desc ?? "").trim();
  const ench = buildEnchantText(a);

  tip.innerHTML = `
    <div class="abTip__top">
      <div>${escHtml(name)}</div>
      <div>${escHtml(el)}</div>
    </div>

    <div class="abTip__row">
      <div class="abTip__label">${escHtml(ap)}</div>
      <div class="abTip__label">${escHtml(acc)}</div>
    </div>

    ${desc ? `<div class="abTip__desc">${escHtml(desc)}</div>` : ""}

    ${ench ? `
      <div class="abTip__enchantTitle">Enchant</div>
      <div class="abTip__enchant">${escHtml(ench)}</div>
    ` : ""}
  `;

  tip.hidden = false;
  tip.setAttribute("data-open", "1");
  positionTip(targetEl);
}

function isTouchLike(){
  return window.matchMedia?.("(hover: none)").matches || ("ontouchstart" in window);
}

function renderAbilities(m){
  const box = $("#abilities");
  if (!box) return;

  const absOrdered = orderAbilities(m);
  const list = absOrdered.slice(0,12);

  // index por id => O(1) lookup
  const byId = new Map((m.abilities ?? []).map(a => [Number(a.id), a]));

  box.innerHTML = list.map(a => {
    const icon = abilityIconUrl(a);

    const elPart   = a.element ? String(a.element).trim() : "";
    const typePart = a.type ? String(a.type).trim() : "";
    const apPart   = (a.ap != null) ? `AP ${a.ap}` : "";
    const accPart  = (a.accuracy != null) ? `Acc ${a.accuracy}%` : "";

    const line2 = [elPart, typePart, apPart, accPart].filter(Boolean).join(" • ");

    return `
      <div class="ab" data-abid="${escHtml(a.id)}" tabindex="0" role="button" aria-label="Ability ${escHtml(a.name)}">
        <div class="abIco">
          ${icon ? `<img class="abIcon" src="${icon}" alt="" onerror="this.style.display='none'">` : ""}
        </div>
        <div>
          <div class="abName">${escHtml(a.name ?? "Ability")}</div>
          <div class="abMeta">${escHtml(line2)}</div>
        </div>
      </div>
    `;
  }).join("");

  const touch = isTouchLike();

  // Limpia handlers viejos por si re-render
  box.onmousemove = null;
  box.onmouseover = null;
  box.onmouseleave = null;
  box.onclick = null;
  box.onkeydown = null;
  box.onfocusin = null;
  box.onfocusout = null;

  if (!touch){
    // Desktop hover
    box.onmousemove = (e) => {
      const tip = $("#abTip");
      if (!tip || tip.hidden) return;
      // re-posicionar cerca del mouse si quieres:
      // (si prefieres anchor al card, borra esto)
      // positionTipFromMouse(e);
    };

    box.onmouseover = (e) => {
      const abEl = e.target.closest(".ab");
      if (!abEl) return;
      const id = Number(abEl.getAttribute("data-abid"));
      const a = byId.get(id);
      if (!a) return;
      showAbTip(abEl, a);
    };

    box.onmouseleave = () => hideAbTip();
  } else {
    // Mobile / touch: tap to toggle tooltip
    box.onclick = (e) => {
      const abEl = e.target.closest(".ab");
      if (!abEl) return;
      const id = Number(abEl.getAttribute("data-abid"));
      const a = byId.get(id);
      if (!a) return;

      const tip = $("#abTip");
      const isOpen = tip && !tip.hidden && tip.getAttribute("data-open") === "1";

      // si tocas el mismo, toggle
      if (isOpen && tip.__for === abEl){
        hideAbTip();
        return;
      }

      showAbTip(abEl, a);
      if (tip) tip.__for = abEl;
    };

    // cerrar tocando fuera
    document.addEventListener("click", (e) => {
      const tip = $("#abTip");
      if (!tip || tip.hidden) return;
      if (e.target.closest(".ab")) return;
      hideAbTip();
    }, { capture: true });
  }

  // Cierra si cambias tamaño / scrolleas (evita tooltip “perdido”)
  window.addEventListener("resize", hideAbTip, { passive: true });
  window.addEventListener("scroll", hideAbTip, { passive: true });
}

/* =========================================================
   EVOLUTIONS
========================================================= */

function renderEvolutions(m, stageIdx){
  const box = $("#evolutions");
  if (!box) return;

  box.innerHTML = "";

  const stages = m.names ?? [];
  for (let idx = 0; idx < stages.length; idx++){
    const nm = stages[idx];
    const d = document.createElement("div");
    d.className = "evo" + (idx === stageIdx ? " active" : "");
    d.innerHTML = `
      <img src="${evoSpriteUrl(m, idx)}" alt="${escHtml(nm)}" onerror="this.style.opacity=.25;"/>
      <div class="evoName">${escHtml(nm)}</div>
    `;
    d.onclick = () => {
      const u = new URL(location.href);
      u.searchParams.set("stage", String(idx));
      location.href = u.toString();
    };
    box.appendChild(d);
  }
}

/* =========================================================
   MAIN
========================================================= */

async function main(){
  const id = Number(getParam("id"));
  const stageIdx = Math.max(0, Math.min(3, Number(getParam("stage") ?? 0)));

  const res = await fetch("../assets/data/miscripedia.json", { cache: "force-cache" });
  const data = await res.json();
  const all = Array.isArray(data) ? data : (data.miscrits ?? []);
  const m = all.find(x => Number(x.id) === id);

  if (!m){
    const nameEl = $("#name");
    if (nameEl) nameEl.textContent = "Not found";
    return;
  }

  // badge
  const badge = $("#elemBadge");
  const icon = elementIconUrl(m.element);
  if (badge){
    badge.innerHTML = icon ? `<img src="${icon}" alt="${escHtml(m.element)}" />` : "";
  }

  const nameEl = $("#name");
  if (nameEl) nameEl.textContent = stageName(m, stageIdx);

  const rarityEl = $("#rarityText");
  if (rarityEl) rarityEl.textContent = m.rarity ?? "";

  const tagsEl = $("#tags");
  if (tagsEl){
    const tags = computeTags(m);
    tagsEl.innerHTML = tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join("");
  }

  const spriteEl = $("#sprite");
  if (spriteEl){
    spriteEl.src = backSpriteUrl(m);
    spriteEl.alt = stageName(m, stageIdx);
  }

  const loreEl = $("#lore");
  if (loreEl){
    loreEl.textContent = (m.descriptions?.[stageIdx] ?? m.descriptions?.[0] ?? "");
  }

  const typeEl = $("#type");
  if (typeEl) typeEl.textContent = m.element ?? "";

  const loc = firstLocation(m);
  const locTop = $("#location");
  const loc2 = $("#location2");
  if (locTop) locTop.textContent = loc;
  if (loc2) loc2.textContent = loc;

  renderEvolutions(m, stageIdx);
  renderStats(m);
  renderAbilities(m);
}

main().catch(console.error);
