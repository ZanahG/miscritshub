(() => {
  /* =========================================================
    PATHS / CONFIG
  ========================================================= */
  const DATA_URL = "../assets/data/base_stats.json";

  const AVATAR_FOLDER = "../assets/images/backs/";
  const AVATAR_FALLBACK = `${AVATAR_FOLDER}preset_avatar.png`;

  const RELICS_URL = "../assets/data/relics.json";
  const RELIC_IMG_FOLDER = "../assets/images/relics/";
  const RELIC_PLACEHOLDER = `${RELIC_IMG_FOLDER}CRUZ.png`;
  const SLOT_LEVELS = [10, 20, 30, 35];

  const STAT_ICON_FOLDER = "../assets/images/icons/";
  const STAT_ICON = {
    hp: `${STAT_ICON_FOLDER}hp.png`,
    spd: `${STAT_ICON_FOLDER}spd.png`,
    ea: `${STAT_ICON_FOLDER}ea.png`,
    pa: `${STAT_ICON_FOLDER}pa.png`,
    ed: `${STAT_ICON_FOLDER}ed.png`,
    pd: `${STAT_ICON_FOLDER}pd.png`,
  };

  const EXPORT_TEMPLATE_URL = "../assets/images/places/stats_export_base.jpg";

  const EXPORT_STAT_COLOR = {
    red:   "#ff0000",
    white: "#fefefe",
    green: "#00ff00",
  };

  const BONUS_KEYS = ["hp", "spd", "ea", "pa", "ed", "pd"];
  const STAT_KEY_MAP = { hp: "HP", spd: "SPD", ea: "EA", pa: "PA", ed: "ED", pd: "PD" };

  /* =========================================================
    DOM
  ========================================================= */
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const byId = (id) => document.getElementById(id);

  const ui = {
    guess: byId("sc-guess"),
    dropdown: byId("scDropdown"),

    level: byId("levelInput"),

    presetRedSpeed: byId("presetRedSpeed"),
    presetAllGreen: byId("presetAllGreen"),
    reset: byId("resetBtn"),
    custom: byId("toggleCustomBtn"),

    title: byId("title"),
    subtitle: byId("subtitle"),
    avatar: byId("avatarImg"),
    err: byId("err"),

    out: {
      hp: byId("outHp"),
      spd: byId("outSpd"),
      ea: byId("outEa"),
      pa: byId("outPa"),
      ed: byId("outEd"),
      pd: byId("outPd"),
    },

    colors: {
      hp: byId("cHp"),
      spd: byId("cSpd"),
      ea: byId("cEa"),
      pa: byId("cPa"),
      ed: byId("cEd"),
      pd: byId("cPd"),
    },

    statsCard: $(".scStatsCard"),

    bonus: {
      title: byId("bonusTitle"),
      regen: byId("regenBonusBtn"),
      applyBtn: byId("applyBonusBtn_dup"),
      applyBtnDup: byId("applyBonusBtn_dup"),
      inputs: {
        hp: byId("bHp"),
        spd: byId("bSpd"),
        ea: byId("bEa"),
        pa: byId("bPa"),
        ed: byId("bEd"),
        pd: byId("bPd"),
      },
    },

    presets: {
      saveBtn: byId("scSavePreset"),
      loadBtn: byId("scLoadPreset"),

      modal: byId("scPresetModal"),
      search: byId("scPresetSearch"),
      grid: byId("scPresetGrid"),

      saveModal: byId("scSaveModal"),
      saveName: byId("scSaveName"),
      saveConfirm: byId("scSaveConfirm"),
      saveHint: byId("scSaveHint"),
    },

    relicTotals: byId("relicTotals"),
    relicModal: byId("relicModal"),
    relicTitle: byId("relicModalTitle"),
    relicGrid: byId("relicGrid"),
    relicSearch: byId("relicSearch"),

    applyRelicsBtn: byId("applyRelicsBtn"),
    relicSlotBtns: $$(".relicSlot"),
    relicSelects: $$(".scRelic"),

    export: {
      openBtn: byId("exportImgBtn"),
      modal: byId("exportModal"),
      canvas: byId("exportCanvas"),
      downloadBtn: byId("exportDownloadBtn"),
    }
  };

  /* =========================================================
    STATE
  ========================================================= */
  let MISCRITS = [];
  let selected = null;

  let RELICS = [];
  let RELIC_BY_NAME = new Map();

  let applyBonus = false;
  let applyRelics = true;

  let RELIC_PICK_SLOT = null;

  let colorMode = "none";

  let LAST_RENDER = null;

  /* =========================================================
    EXPORT LAYOUT
  ========================================================= */
  const EXPORT_LAYOUT = {
    // Título arriba
    title: { x: 0.50, y: 0.135, size: 24, dx: 0, dy: 0 },

    // Miscrit (centro)
    avatar: { cx: 0.53, cy: 0.40, maxW: 0.5, maxH: 0.5, dx: 0, dy: 0 },

    // Reliquias
    relics: { x: 0.1, y0: 0.11, gapY: 0.145, size: 0.115, dx: 0, dy: 0 },

    // Texto BONUS
    bonusTitle: { x: 0.45, y: 0.74, size: 36, textColor: "rgba(177, 253, 0, 0.99)", dx: 0, dy: 0 },

    // Bonus izquierdo
    bonusBlock: {
      col1IconX: 0.30,
      col1TextX: 0.35,

      col2IconX: 0.50,
      col2TextX: 0.55,

      y0: 0.80,
      gapY: 0.055,

      iconSize: 24,
      textSize: 28,

      dx: 0,
      dy: 0,
    },

    statsRight: { x: 0.86, y0: 0.71, gapX: 0.1, gapY: 0.040, iconDx: -50, iconSize: 30, textSize: 24, dx: 0, dy: 0 },
  };

  let EXPORT_TWEAK_MODE = false;
  let EXPORT_ACTIVE_KEY = "avatar";
  const EXPORT_KEYS = ["avatar","relics","bonusTitle","bonusBlock","statsRight","title"];

  /* =========================================================
    UTILS
  ========================================================= */
  function normalize(s) {
    return (s ?? "").toString().trim().toLowerCase();
  }

  function setError(msg) {
    if (ui.err) ui.err.textContent = msg || "";
  }

  function clampInt(n, min, max) {
    const x = Number(n);
    if (!Number.isFinite(x)) return min;
    return Math.min(max, Math.max(min, Math.trunc(x)));
  }

  function avatarSrcFromName(name) {
    if (!name) return AVATAR_FALLBACK;
    const file =
      name
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^\w_]/g, "") + "_back.png";
    return `${AVATAR_FOLDER}${file}`;
  }

  function setAvatar(name) {
    if (!ui.avatar) return;
    ui.avatar.src = avatarSrcFromName(name);
    ui.avatar.alt = name || "";
    ui.avatar.onerror = () => {
      ui.avatar.onerror = null;
      ui.avatar.src = AVATAR_FALLBACK;
    };
  }

  function clearOutputs() {
    if (ui.title) ui.title.textContent = "—";
    if (ui.subtitle) ui.subtitle.textContent = "—";
    Object.values(ui.out).forEach((el) => el && (el.textContent = "—"));
    setAvatar(null);
  }

  function colorFactor(color) {
    const c = normalize(color);
    if (c === "red") return 1;
    if (c === "white") return 2;
    return 3;
  }

  function getSelectedColors() {
    return {
      hp: ui.colors.hp?.value || "white",
      spd: ui.colors.spd?.value || "white",
      ea: ui.colors.ea?.value || "white",
      pa: ui.colors.pa?.value || "white",
      ed: ui.colors.ed?.value || "white",
      pd: ui.colors.pd?.value || "white",
    };
  }

  function statAtLevel(baseStat15, level, color, isHp) {
    const C = colorFactor(color);
    const L = level;

    if (isHp) {
      const perLevel = (12 + 2 * baseStat15 + 1.5 * C) / 5;
      return Math.floor(perLevel * L + 10);
    } else {
      const perLevel = (3 + 2 * baseStat15 + 1.5 * C) / 6;
      return Math.floor(perLevel * L + 5);
    }
  }

  function totalBonusPoints(level) {
    return Math.max(0, 4 * (level - 1));
  }

  function sumInputs(group) {
    const n = (el) => {
      const x = Number(el?.value);
      return Number.isFinite(x) ? Math.max(0, Math.trunc(x)) : 0;
    };
    return {
      hp: n(group.hp),
      spd: n(group.spd),
      ea: n(group.ea),
      pa: n(group.pa),
      ed: n(group.ed),
      pd: n(group.pd),
    };
  }

  function randInt(max) {
    return Math.floor(Math.random() * max);
  }

  function randomDistribution(totalPts) {
    const t = { hp: 0, spd: 0, ea: 0, pa: 0, ed: 0, pd: 0 };
    for (let i = 0; i < totalPts; i++) {
      const k = BONUS_KEYS[randInt(BONUS_KEYS.length)];
      t[k] += 1;
    }
    return t;
  }

  function writeInputs(group, totals) {
    if (!group) return;
    for (const k of BONUS_KEYS) {
      if (group[k]) group[k].value = String(totals[k] ?? 0);
    }
  }

  function updateBonusTitles(level) {
    const lvl = clampInt(level, 1, 35);
    const lvlPts = Math.max(0, 3 * (lvl - 1));
    const platPts = Math.max(0, (lvl - 1));
    const total = lvlPts + platPts;
    if (ui.bonus.title) ui.bonus.title.textContent = `BONUS TOTAL (${total} PTS) — ${lvlPts} LVL + ${platPts} PLAT`;
  }

  function syncChips() {
    const bonusText = applyBonus ? "BONUS: ON" : "BONUS: OFF";
    if (ui.bonus.applyBtn) {
      ui.bonus.applyBtn.textContent = bonusText;
      ui.bonus.applyBtn.classList.toggle("is-active", applyBonus);
      ui.bonus.applyBtn.setAttribute("aria-pressed", String(applyBonus));
    }
    if (ui.bonus.applyBtnDup) ui.bonus.applyBtnDup.textContent = bonusText;

    const relicText = applyRelics ? "RELICS: ON" : "RELICS: OFF";
    if (ui.applyRelicsBtn) {
      ui.applyRelicsBtn.textContent = relicText;
      ui.applyRelicsBtn.classList.toggle("is-active", applyRelics);
      ui.applyRelicsBtn.setAttribute("aria-pressed", String(applyRelics));
    }
    if (ui.relicTotals) ui.relicTotals.classList.toggle("is-off", !applyRelics);
  }

  /* =========================================================
  PRESETS
  ========================================================= */
  const SC_PRESET_KEY = "miscritsHub.statsCalc.presets.v1";

  function readScPresetStore(){
    try{
      const raw = localStorage.getItem(SC_PRESET_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object") return {};
      return parsed;
    }catch{
      return {};
    }
  }

  function writeScPresetStore(store){
    localStorage.setItem(SC_PRESET_KEY, JSON.stringify(store));
  }

  function slugKey(s){
    return (s ?? "").toString().trim();
  }

  function getSelectedRelicNames(){
    const out = ["","","",""];
    for (let slot=0; slot<4; slot++){
      const sel = getScRelicSelect(slot);
      out[slot] = (sel?.value ?? "").toString().trim();
    }
    return out;
  }

  function setSelectedRelicNames(arr){
    for (let slot=0; slot<4; slot++){
      const sel = getScRelicSelect(slot);
      if (!sel) continue;
      sel.value = (arr?.[slot] ?? "").toString();
    }
  }

  function buildScPreset(){
    if (!selected?.name) return null;

    return {
      name: selected.name,
      level: clampInt(ui.level?.value, 1, 35),
      colorMode,
      colors: getSelectedColors(),
      applyBonus: !!applyBonus,
      bonus: sumInputs(ui.bonus.inputs),
      applyRelics: !!applyRelics,
      relics: getSelectedRelicNames(),
    };
  }

  function applyScPreset(p){
    if (!p?.name) return;

    const m = MISCRITS.find(x => normalize(x.name) === normalize(p.name));
    if (!m) return;

    selected = m;
    if (ui.guess) ui.guess.value = m.name;
    setAvatar(m.name);

    if (ui.level) ui.level.value = String(clampInt(p.level ?? 35, 1, 35));

    applyBonus = !!p.applyBonus;
    applyRelics = !!p.applyRelics;

    colorMode = (p.colorMode ?? "none");
    if (colorMode === "custom") {
      const c = p.colors || {};
      for (const k of BONUS_KEYS){
        const sel = ui.colors?.[k];
        if (!sel) continue;
        sel.value = c[k] || "white";
        setRowColorFromSelect(sel);
      }
    } else {
      applyMode(colorMode);
    }

    const b = p.bonus || { hp:0, spd:0, ea:0, pa:0, ed:0, pd:0 };
    writeInputs(ui.bonus.inputs, b);

    setSelectedRelicNames(p.relics || ["","","",""]);
    refreshAllScRelicSlots();

    render();
  }

  function openScPresetModal(){
    if (!ui.presets.modal || !ui.presets.grid || !ui.presets.search) return;

    const store = readScPresetStore();
    const keys = Object.keys(store);

    const renderGrid = (q) => {
      const qq = normalize(q);
      const list = keys
        .filter(k => {
          const p = store[k];
          return !qq || normalize(k).includes(qq) || normalize(p?.name).includes(qq);
        })
        .sort((a,b) => a.localeCompare(b, "es"));

      if (!list.length){
        ui.presets.grid.innerHTML = `<div style="padding:10px;color:rgba(255,255,255,.65)">No presets saved.</div>`;
        return;
      }

      ui.presets.grid.innerHTML = list.map((key) => {
        const p = store[key];
        const avatar = avatarSrcFromName(p?.name);
        const relics = (p?.relics || ["","","",""]).slice(0,4);

        const statCell = (k, val) => `
          <div class="presetStat">
            <img class="presetStat__ico" src="${STAT_ICON[k]}" alt="">
            <div class="presetStat__k">${STAT_KEY_MAP[k]}</div>
            <div class="presetStat__v">${Number(val ?? 0)}</div>
          </div>
        `;

        const s = p?.applyBonus || p?.applyRelics ? (p?.lastStats || null) : null;
        const m = MISCRITS.find(x => normalize(x.name) === normalize(p?.name));
        const t = m?.baseStats;
        const lvl = clampInt(p?.level ?? 35, 1, 35);
        const c = p?.colorMode === "custom" ? (p.colors || {}) : (p.colorMode === "rs"
          ? { hp:"green", spd:"red", ea:"green", pa:"green", ed:"green", pd:"green" }
          : p.colorMode === "splus"
            ? { hp:"green", spd:"green", ea:"green", pa:"green", ed:"green", pd:"green" }
            : { hp:"white", spd:"white", ea:"white", pa:"white", ed:"white", pd:"white" }
        );

        let calc = { hp:0, spd:0, ea:0, pa:0, ed:0, pd:0 };
        if (t){
          calc.hp  = statAtLevel(t.hp,  lvl, c.hp,  true);
          calc.spd = statAtLevel(t.spd, lvl, c.spd, false);
          calc.ea  = statAtLevel(t.ea,  lvl, c.ea,  false);
          calc.pa  = statAtLevel(t.pa,  lvl, c.pa,  false);
          calc.ed  = statAtLevel(t.ed,  lvl, c.ed,  false);
          calc.pd  = statAtLevel(t.pd,  lvl, c.pd,  false);
        }

        if (p?.applyBonus){
          const b = p.bonus || {};
          for (const k of BONUS_KEYS) calc[k] += Number(b[k] || 0);
        }

        if (p?.applyRelics){
          for (let slot=0; slot<4; slot++){
            const name = (relics[slot] ?? "").toString().trim();
            if (!name) continue;
            const r = RELIC_BY_NAME.get(name);
            if (!r) continue;
            const lvlSlot = getSlotLevel(slot);
            if (Number(r.level) !== Number(lvlSlot)) continue;
            const st = r.stats || {};
            calc.hp += Number(st.HP || 0);
            calc.spd += Number(st.SPD || 0);
            calc.ea += Number(st.EA || 0);
            calc.pa += Number(st.PA || 0);
            calc.ed += Number(st.ED || 0);
            calc.pd += Number(st.PD || 0);
          }
        }

        const relicImgs = relics.map((nm, i) => {
          const n = (nm ?? "").toString().trim();
          const r = n ? RELIC_BY_NAME.get(n) : null;
          const src = r ? relicIconSrc(r) : RELIC_PLACEHOLDER;
          const alt = n || "Empty";
          return `<img class="presetRelic" src="${src}" alt="${alt}" title="${alt}" onerror="this.src='${RELIC_PLACEHOLDER}'">`;
        }).join("");

        return `
          <div class="presetCard" data-key="${key}">
            <img class="presetCard__avatar" src="${avatar}" alt="${p?.name || ""}" onerror="this.src='${AVATAR_FALLBACK}'">

            <div>
              <div class="presetCard__titleRow">
                <div class="presetCard__name" title="${key}">${key}</div>
                <div class="presetCard__meta">Lv ${lvl} • ${String(p?.colorMode || "none").toUpperCase()}</div>
              </div>

              <div class="presetStats">
                ${statCell("hp", calc.hp)}
                ${statCell("spd", calc.spd)}
                ${statCell("ea", calc.ea)}
                ${statCell("pa", calc.pa)}
                ${statCell("ed", calc.ed)}
                ${statCell("pd", calc.pd)}
              </div>

              <div class="presetRelics">${relicImgs}</div>

              <div class="presetActions">
                <button class="btn btn--accent" type="button" data-act="load">Load</button>
                <button class="btn" type="button" data-act="edit">Edit</button>
                <button class="btn btn--ghost" type="button" data-act="delete">Delete</button>
              </div>
            </div>
          </div>
        `;
      }).join("");

      ui.presets.grid.querySelectorAll(".presetCard").forEach(card => {
        const key = card.getAttribute("data-key");
        const p = store[key];
        if (!p) return;

        card.querySelector('[data-act="load"]')?.addEventListener("click", () => {
          applyScPreset(p);
          closeScPresetModal();
        });

        card.querySelector('[data-act="edit"]')?.addEventListener("click", () => {
          applyScPreset(p);
          closeScPresetModal();
        });

        card.querySelector('[data-act="delete"]')?.addEventListener("click", () => {
          const s = readScPresetStore();
          delete s[key];
          writeScPresetStore(s);
          openScPresetModal(); // re-render
        });
      });
    };

    ui.presets.search.value = "";
    renderGrid("");
    ui.presets.search.oninput = () => renderGrid(ui.presets.search.value);

    ui.presets.modal.hidden = false;
  }

  function closeScPresetModal(){
    if (ui.presets.modal) ui.presets.modal.hidden = true;
  }

  function openScSaveModal(){
    if (!ui.presets.saveModal || !ui.presets.saveName) return;
    const p = buildScPreset();
    if (!p) return;

    ui.presets.saveHint.textContent = "";
    ui.presets.saveName.value = `${p.name}`; // sugerido
    ui.presets.saveModal.hidden = false;
    ui.presets.saveName.focus();
    ui.presets.saveName.select();
  }

  function closeScSaveModal(){
    if (ui.presets.saveModal) ui.presets.saveModal.hidden = true;
  }

  function confirmSavePreset(){
    const p = buildScPreset();
    if (!p) return;

    const key = slugKey(ui.presets.saveName?.value);
    if (!key) return;

    const store = readScPresetStore();
    const exists = Object.prototype.hasOwnProperty.call(store, key);

    store[key] = p;
    writeScPresetStore(store);

    if (ui.presets.saveHint){
      ui.presets.saveHint.textContent = exists ? "Updated existing preset." : "Saved new preset.";
    }
    closeScSaveModal();
  }



  /* =========================================================
    COLOR ROW UI + MODES
  ========================================================= */
  function setRowColorFromSelect(selectEl) {
    const row = selectEl?.closest?.(".scRow");
    if (!row) return;
    row.dataset.color = normalize(selectEl.value || "white");
  }

  function syncColorRowsFromSelects() {
    Object.values(ui.colors).forEach((sel) => sel && setRowColorFromSelect(sel));
  }

  function setAllColors(val) {
    Object.values(ui.colors).forEach((sel) => {
      if (!sel) return;
      sel.value = val;
      setRowColorFromSelect(sel);
    });
  }

  function setPresetButtonsUI() {
    const splus = ui.presetAllGreen;
    const rs = ui.presetRedSpeed;

    [splus, rs].forEach((b) => {
      if (!b) return;
      b.classList.remove("is-green", "is-red", "is-active");
      b.setAttribute("aria-pressed", "false");
      b.disabled = false;
    });

    if (colorMode === "custom") {
      if (splus) splus.disabled = true;
      if (rs) rs.disabled = true;
      return;
    }

    if (colorMode === "splus" && splus) {
      splus.classList.add("is-green", "is-active");
      splus.setAttribute("aria-pressed", "true");
    }

    if (colorMode === "rs" && rs) {
      rs.classList.add("is-red", "is-active");
      rs.setAttribute("aria-pressed", "true");
    }
  }


  function setCustomVisibility() {
    const show = colorMode === "custom";

    document.body.classList.toggle("scCustomOn", show);

    Object.values(ui.colors).forEach((sel) => {
      if (!sel) return;
      sel.disabled = !show;
    });

    if (ui.custom) {
      ui.custom.classList.toggle("is-active", show);
      ui.custom.setAttribute("aria-pressed", String(show));
    }
  }

  function applyMode(mode) {
    colorMode = mode;

    if (mode === "none") {
      setAllColors("white");
    } else if (mode === "splus") {
      setAllColors("green");
    } else if (mode === "rs") {
      setAllColors("green");
      if (ui.colors.spd) {
        ui.colors.spd.value = "red";
        setRowColorFromSelect(ui.colors.spd);
      }
    } else if (mode === "custom") {
    }

    setPresetButtonsUI();
    setCustomVisibility();
    render();
  }

  /* =========================================================
    DROPDOWN PICKER
  ========================================================= */
  function renderDropdown(matches) {
    const dd = ui.dropdown;
    if (!dd) return;

    if (!matches.length) {
      dd.hidden = true;
      dd.innerHTML = "";
      return;
    }

    dd.hidden = false;
    dd.innerHTML = matches
      .map(
        (m) => `
        <button type="button" class="ddItem" data-id="${m.id}">
          <img class="ddItem__img" src="${avatarSrcFromName(m.name)}" alt="">
          <div class="ddItem__name">${m.name}</div>
        </button>
      `
      )
      .join("");

    $$(".ddItem", dd).forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const m = MISCRITS.find((x) => String(x.id) === String(id));
        if (!m) return;

        selected = m;
        if (ui.guess) ui.guess.value = m.name;
        dd.hidden = true;

        setAvatar(m.name);
        render();
      });
    });
  }

  function bindPicker() {
    const input = ui.guess;
    const dd = ui.dropdown;
    if (!input || !dd) return;

    const close = () => (dd.hidden = true);

    const open = () => {
      const q = normalize(input.value);
      const matches = MISCRITS.filter((m) => !q || normalize(m.name).includes(q)).slice(0, 60);
      renderDropdown(matches);
    };

    input.addEventListener("focus", open);
    input.addEventListener("input", open);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();

      if (e.key === "Enter") {
        const exact = MISCRITS.find((m) => normalize(m.name) === normalize(input.value));
        if (exact) {
          selected = exact;
          dd.hidden = true;
          setAvatar(exact.name);
          render();
          return;
        }

        const first = $(".ddItem", dd);
        if (first) {
          e.preventDefault();
          first.click();
        }
      }
    });

    document.addEventListener("click", (e) => {
      const host = input.closest(".miscritPicker");
      if (!host) return;
      if (!host.contains(e.target)) close();
    });
  }

  /* =========================================================
    RELICS
  ========================================================= */
  function normalizeRelicsForStatsCalc(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((r) => ({
        name: (r.name ?? "").toString().trim(),
        level: Number(r.level) || 0,
        icon: (r.icon ?? "").toString().trim(),
        stats: r.stats ?? {},
      }))
      .filter((r) => r.name && r.level);
  }

  function getSlotLevel(slot) {
    const s = Math.max(0, Math.min(3, Number(slot) || 0));
    return SLOT_LEVELS[s] ?? 35;
  }

  function relicIconSrc(r) {
    if (!r) return RELIC_PLACEHOLDER;
    const file = r.icon ? String(r.icon) : "";
    return file ? `${RELIC_IMG_FOLDER}${file}` : RELIC_PLACEHOLDER;
  }

  function relicBonusText(r) {
    const s = r?.stats || {};
    const parts = [];
    if (Number(s.HP)) parts.push(`+${Number(s.HP)} HP`);
    if (Number(s.SPD)) parts.push(`+${Number(s.SPD)} SPD`);
    if (Number(s.PA)) parts.push(`+${Number(s.PA)} PA`);
    if (Number(s.EA)) parts.push(`+${Number(s.EA)} EA`);
    if (Number(s.PD)) parts.push(`+${Number(s.PD)} PD`);
    if (Number(s.ED)) parts.push(`+${Number(s.ED)} ED`);
    return parts.join(" • ");
  }

  function getScRelicSelect(slot) {
    return document.querySelector(`.scRelic[data-slot="${slot}"]`);
  }

  function populateScRelicSelects() {
    const all = document.querySelectorAll(".scRelic");
    if (!all.length) return;

    const sorted = RELICS.slice().sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
    const html = [`<option value=""></option>`, ...sorted.map((r) => `<option value="${r.name}">${r.name}</option>`)].join("");

    all.forEach((sel) => {
      sel.innerHTML = html;
      if (!sel.value) sel.value = "";
    });
  }

  function setSlotButtonUI(slot) {
    const btn = document.querySelector(`.relicSlot[data-slot="${slot}"]`);
    if (!btn) return;

    const sel = getScRelicSelect(slot);
    const name = (sel?.value ?? "").toString().trim();
    const r = name ? RELIC_BY_NAME.get(name) : null;

    const img = r ? relicIconSrc(r) : RELIC_PLACEHOLDER;

    btn.dataset.relicName = name || "";
    btn.dataset.relicLevel = String(getSlotLevel(slot));

    btn.style.backgroundImage = `url("${img}")`;
    btn.style.backgroundRepeat = "no-repeat";
    btn.style.backgroundPosition = "center";
    btn.style.backgroundSize = "70% 70%";
    btn.title = name ? `${name} (lvl ${getSlotLevel(slot)})` : `Empty (lvl ${getSlotLevel(slot)})`;
    btn.setAttribute("aria-label", btn.title);
  }

  function refreshAllScRelicSlots() {
    for (let i = 0; i < 4; i++) setSlotButtonUI(i);
  }

  function closeRelicModal() {
    if (ui.relicModal) ui.relicModal.hidden = true;
    RELIC_PICK_SLOT = null;
  }

  function openRelicModalForStats(slot) {
    RELIC_PICK_SLOT = slot;

    const modal = ui.relicModal;
    const title = ui.relicTitle;
    const grid = ui.relicGrid;
    const search = ui.relicSearch;

    if (!modal || !title || !grid || !search) return;

    const lvl = getSlotLevel(slot);
    title.textContent = `Relics lvl ${lvl}`;
    search.value = "";

    const renderGrid = (q) => {
      const qq = normalize(q);
      grid.innerHTML = "";

      const items = RELICS
        .filter((r) => Number(r.level) === Number(lvl))
        .filter((r) => !qq || normalize(r.name).includes(qq))
        .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

      const empty = document.createElement("div");
      empty.className = "relicItem";
      empty.innerHTML = `
        <img class="relicItem__img" src="${RELIC_PLACEHOLDER}" alt="">
        <div>
          <div class="relicItem__name">Empty</div>
          <div class="relicItem__bonus">Sin bonus</div>
        </div>
      `;
      empty.addEventListener("click", () => {
        const sel = getScRelicSelect(slot);
        if (sel) sel.value = "";
        refreshAllScRelicSlots();
        closeRelicModal();
        render();
      });
      grid.appendChild(empty);

      for (const r of items) {
        const el = document.createElement("div");
        el.className = "relicItem";
        el.innerHTML = `
          <img class="relicItem__img" src="${relicIconSrc(r)}" alt="${r.name}" onerror="this.src='${RELIC_PLACEHOLDER}'">
          <div>
            <div class="relicItem__name">${r.name}</div>
            <div class="relicItem__bonus">${relicBonusText(r) || "—"}</div>
          </div>
        `;
        el.addEventListener("click", () => {
          const sel = getScRelicSelect(slot);
          if (sel) sel.value = r.name;
          refreshAllScRelicSlots();
          closeRelicModal();
          render();
        });
        grid.appendChild(el);
      }
    };

    renderGrid("");
    search.oninput = () => renderGrid(search.value);

    modal.hidden = false;
  }

  function sumRelicsStats() {
    const totals = { hp: 0, spd: 0, ea: 0, pa: 0, ed: 0, pd: 0 };

    for (let slot = 0; slot < 4; slot++) {
      const sel = getScRelicSelect(slot);
      const name = (sel?.value ?? "").toString().trim();
      if (!name) continue;

      const r = RELIC_BY_NAME.get(name);
      if (!r) continue;

      const lvl = getSlotLevel(slot);
      if (Number(r.level) !== Number(lvl)) continue;

      const st = r.stats || {};
      totals.hp += Number(st.HP || 0);
      totals.spd += Number(st.SPD || 0);
      totals.ea += Number(st.EA || 0);
      totals.pa += Number(st.PA || 0);
      totals.ed += Number(st.ED || 0);
      totals.pd += Number(st.PD || 0);
    }
    return totals;
  }

  function renderRelicTotalsUI(t) {
    const host = ui.relicTotals;
    if (!host) return;

    const pairs = [
      ["hp", t.hp],
      ["spd", t.spd],
      ["ea", t.ea],
      ["pa", t.pa],
      ["ed", t.ed],
      ["pd", t.pd],
    ].filter(([, v]) => Number(v) > 0);

    if (!pairs.length) {
      host.innerHTML = `<div class="muted">No relic bonuses selected</div>`;
      return;
    }

    host.innerHTML = pairs
      .map(([k, v]) => {
        const label = STAT_KEY_MAP[k] || k.toUpperCase();
        return `
          <div class="relicTotal">
            <div class="relicTotal__left">
              <img class="relicTotal__icon" src="${STAT_ICON[k]}" alt="${label}">
              <span class="relicTotal__key">${label}</span>
            </div>
            <span class="relicTotal__val">+${Number(v)}</span>
          </div>
        `;
      })
      .join("");
  }

  /* =========================================================
    RENDER (main)
  ========================================================= */
  function render() {
    setError("");

    const level = clampInt(ui.level?.value, 1, 35);
    if (ui.level) ui.level.value = String(level);

    updateBonusTitles(level);
    syncChips();
    setPresetButtonsUI();
    setCustomVisibility();

    if (!selected) {
      clearOutputs();
      LAST_RENDER = null;
      return;
    }

    const t = selected.baseStats;
    if (!t) {
      setError("Miscrit sin baseStats.");
      clearOutputs();
      LAST_RENDER = null;
      return;
    }

    const c = getSelectedColors();

    let s = {
      hp: statAtLevel(t.hp, level, c.hp, true),
      spd: statAtLevel(t.spd, level, c.spd, false),
      ea: statAtLevel(t.ea, level, c.ea, false),
      pa: statAtLevel(t.pa, level, c.pa, false),
      ed: statAtLevel(t.ed, level, c.ed, false),
      pd: statAtLevel(t.pd, level, c.pd, false),
    };

    const manualBonus = sumInputs(ui.bonus.inputs);
    if (applyBonus) {
      for (const k of BONUS_KEYS) s[k] += manualBonus[k];
    }

    const relicAdd = sumRelicsStats();
    renderRelicTotalsUI(relicAdd);
    if (applyRelics) {
      for (const k of BONUS_KEYS) s[k] += relicAdd[k];
    }

    if (ui.title) ui.title.textContent = `${selected.name} — Nivel ${level}`;
    if (ui.subtitle) {
      ui.subtitle.textContent =
        `${selected.rarity} • ${selected.type}` +
        ` • BONUS:${applyBonus ? "ON" : "OFF"}` +
        ` • RELICS:${applyRelics ? "ON" : "OFF"}`;
    }

    ui.out.hp.textContent = String(s.hp);
    ui.out.spd.textContent = String(s.spd);
    ui.out.ea.textContent = String(s.ea);
    ui.out.pa.textContent = String(s.pa);
    ui.out.ed.textContent = String(s.ed);
    ui.out.pd.textContent = String(s.pd);

    setAvatar(selected.name);
    syncColorRowsFromSelects();

    LAST_RENDER = {
      name: selected.name,
      level,
      stats: { ...s },
      colors: { ...c },
      bonusManual: applyBonus ? { ...manualBonus } : { hp:0, spd:0, ea:0, pa:0, ed:0, pd:0 },
      relics: getSelectedRelicsForExport(),
    };
  }

  function getSelectedRelicsForExport() {
    const out = [];
    for (let slot = 0; slot < 4; slot++) {
      const sel = getScRelicSelect(slot);
      const name = (sel?.value ?? "").toString().trim();
      const lvl = getSlotLevel(slot);
      const r = name ? RELIC_BY_NAME.get(name) : null;

      out.push({
        slot,
        level: lvl,
        name: r?.name || "",
        icon: r ? relicIconSrc(r) : RELIC_PLACEHOLDER,
      });
    }
    return out;
  }

  /* =========================================================
    EXPORT (canvas)
  ========================================================= */
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`No pude cargar imagen: ${src}`));
      img.src = src;
    });
  }

  function drawText(ctx, text, x, y, opts = {}) {
    const {
      size = 24,
      weight = 800,
      align = "center",
      baseline = "middle",
      color = "rgba(0,0,0,0.55)",
      shadow = true,
      shadowColor = "rgba(0,0,0,0.35)",
      shadowBlur = 6,
      shadowDx = 0,
      shadowDy = 2,
      font = "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    } = opts;

    ctx.save();
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillStyle = color;

    if (shadow) {
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetX = shadowDx;
      ctx.shadowOffsetY = shadowDy;
    } else {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    ctx.fillText(String(text ?? ""), x, y);
    ctx.restore();
  }

  function drawImageContain(ctx, img, x, y, w, h) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;

    const scale = Math.min(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function getActiveLayoutRef() {
    return EXPORT_LAYOUT[EXPORT_ACTIVE_KEY];
  }
  function nudgeActive(dx, dy) {
    const ref = getActiveLayoutRef();
    if (!ref) return;
    if (typeof ref.dx !== "number") ref.dx = 0;
    if (typeof ref.dy !== "number") ref.dy = 0;
    ref.dx += dx;
    ref.dy += dy;
  }
  function logLayout() {
    console.log("[EXPORT_LAYOUT]", EXPORT_ACTIVE_KEY, JSON.stringify(EXPORT_LAYOUT[EXPORT_ACTIVE_KEY], null, 2));
  }

  async function renderExportCanvas() {
    if (!ui.export?.canvas) return;
    if (!LAST_RENDER) return;

    const canvas = ui.export.canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tpl = await loadImage(EXPORT_TEMPLATE_URL);

    canvas.width = tpl.naturalWidth || tpl.width || 700;
    canvas.height = tpl.naturalHeight || tpl.height || 700;

    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(tpl, 0, 0, W, H);

    const LTitle = EXPORT_LAYOUT.title;
    drawText(
      ctx,
      `${LAST_RENDER.name}`,
      W * LTitle.x + (LTitle.dx || 0),
      H * LTitle.y + (LTitle.dy || 0),
      { size: LTitle.size, weight: 800, align: "center", baseline: "middle", color: "rgb(255, 255, 255)", shadow: false }
    );

    const avatarImg = await loadImage(avatarSrcFromName(LAST_RENDER.name)).catch(async () => loadImage(AVATAR_FALLBACK));
    const A = EXPORT_LAYOUT.avatar;

    const avMaxW = W * A.maxW;
    const avMaxH = H * A.maxH;
    const avX = W * A.cx - avMaxW / 2 + (A.dx || 0);
    const avY = H * A.cy - avMaxH / 2 + (A.dy || 0);

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 8;
    drawImageContain(ctx, avatarImg, avX, avY, avMaxW, avMaxH);
    ctx.restore();

    const R = EXPORT_LAYOUT.relics;
    for (let i = 0; i < 4; i++) {
      const rr = LAST_RENDER.relics[i];
      const img = await loadImage(rr?.icon || RELIC_PLACEHOLDER).catch(() => null);
      if (!img) continue;

      const size = W * R.size;
      const x = W * R.x - size / 2 + (R.dx || 0);
      const y = H * (R.y0 + i * R.gapY) - size / 2 + (R.dy || 0);

      ctx.save();
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, x, y, size, size);
      ctx.restore();
    }

    const BT = EXPORT_LAYOUT.bonusTitle;
    drawText(
      ctx,
      "BONUS",
      W * BT.x + (BT.dx || 0),
      H * BT.y + (BT.dy || 0),
      { size: BT.size, weight: 900, align: "center", baseline: "middle", color: "white", shadow: true, shadowColor: "rgba(0,0,0,0.45)", shadowBlur: 10, shadowDy: 4 }
    );

    const BB = EXPORT_LAYOUT.bonusBlock;
    const bonusGrid = [
      ["hp",  LAST_RENDER.bonusManual.hp],
      ["ea",  LAST_RENDER.bonusManual.ea],

      ["spd", LAST_RENDER.bonusManual.spd],
      ["pa",  LAST_RENDER.bonusManual.pa],

      ["ed",  LAST_RENDER.bonusManual.ed],
      ["pd",  LAST_RENDER.bonusManual.pd],
    ];

    for (let row = 0; row < 3; row++) {
      const y = H * (BB.y0 + row * BB.gapY) + (BB.dy || 0);

      const left  = bonusGrid[row * 2];
      const right = bonusGrid[row * 2 + 1];

      // ----- LEFT COLUMN -----
      {
        const [k, val] = left;
        const icon = await loadImage(STAT_ICON[k]).catch(() => null);

        if (icon) {
          ctx.drawImage(
            icon,
            W * BB.col1IconX + (BB.dx || 0),
            y - BB.iconSize / 2,
            BB.iconSize,
            BB.iconSize
          );
        }

        drawText(
          ctx,
          String(val ?? 0),
          W * BB.col1TextX + (BB.dx || 0),
          y,
          {
            size: BB.textSize,
            weight: 900,
            align: "left",
            baseline: "middle",
            color: "white",
            shadow: true,
            shadowColor: "rgba(0,0,0,0.45)",
            shadowBlur: 10,
            shadowDy: 4
          }
        );
      }

      // ----- RIGHT COLUMN -----
      {
        const [k, val] = right;
        const icon = await loadImage(STAT_ICON[k]).catch(() => null);

        if (icon) {
          ctx.drawImage(
            icon,
            W * BB.col2IconX + (BB.dx || 0),
            y - BB.iconSize / 2,
            BB.iconSize,
            BB.iconSize
          );
        }

        drawText(
          ctx,
          String(val ?? 0),
          W * BB.col2TextX + (BB.dx || 0),
          y,
          {
            size: BB.textSize,
            weight: 900,
            align: "left",
            baseline: "middle",
            color: "white",
            shadow: true,
            shadowColor: "rgba(0,0,0,0.45)",
            shadowBlur: 10,
            shadowDy: 4
          }
        );
      }
    }

    const SR = EXPORT_LAYOUT.statsRight;

    const statsToShow = [
      ["hp",  LAST_RENDER.stats.hp],
      ["spd", LAST_RENDER.stats.spd],
      ["ea",  LAST_RENDER.stats.ea],
      ["pa",  LAST_RENDER.stats.pa],
      ["ed",  LAST_RENDER.stats.ed],
      ["pd",  LAST_RENDER.stats.pd],
    ];

    for (let i = 0; i < statsToShow.length; i++) {
      const [k, val] = statsToShow[i];
      const y = H * (SR.y0 + i * SR.gapY) + (SR.dy || 0);

      const icon = await loadImage(STAT_ICON[k]).catch(() => null);
      if (icon) {
        const is = SR.iconSize;
        const xIcon = W * SR.x + (SR.dx || 0) + (SR.iconDx || -80);
        ctx.drawImage(icon, xIcon, y - is / 2, is, is);
      }
      const userColor = LAST_RENDER.colors[k] || "white";
      const textColor = EXPORT_STAT_COLOR[userColor] || "#ffffff";
      drawText(
        ctx,
        String(val ?? 0),
        W * SR.x + (SR.dx || 0),
        y,
        {
          size: SR.textSize,
          weight: 900,
          align: "left",
          baseline: "middle",
          color: textColor,
          shadow: true,
          shadowColor: "rgba(0,0,0,0.45)",
          shadowBlur: 10,
          shadowDy: 4
        }
      );
    }
  }

  async function openExportModal() {
    if (!ui.export?.modal || !ui.export?.canvas) return;
    ui.export.modal.hidden = false;
    EXPORT_TWEAK_MODE = false;
    await renderExportCanvas();
  }

  function closeExportModal() {
    if (!ui.export?.modal) return;
    ui.export.modal.hidden = true;
    EXPORT_TWEAK_MODE = false;
  }

  function downloadExport(e) {
    if (e) e.preventDefault();
    if (!ui.export?.canvas) return;

    try {
      const canvas = ui.export.canvas;
      const dataUrl = canvas.toDataURL("image/png");

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${(LAST_RENDER?.name || "miscrit").toLowerCase().replace(/\s+/g, "_")}_lv${LAST_RENDER?.level || 1}.png`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("Download failed:", err);
      alert("No se pudo descargar. Probable CORS/tainted canvas (revisa rutas/imágenes).");
    }
  }



  /* =========================================================
    INIT + EVENTS
  ========================================================= */
  function bindEvents() {
    Object.values(ui.colors).forEach((sel) => {
      if (!sel) return;
      setRowColorFromSelect(sel);
      sel.addEventListener("change", () => {
        setRowColorFromSelect(sel);
        render();
      });
    });

    ui.presetAllGreen?.addEventListener("click", () => applyMode("splus"));
    ui.presetRedSpeed?.addEventListener("click", () => applyMode("rs"));
    ui.reset?.addEventListener("click", () => applyMode("none"));
    ui.custom?.addEventListener("click", () => applyMode("custom"));

    ui.level?.addEventListener("input", () => {
      ui.level.value = String(clampInt(ui.level.value, 1, 35));
      render();
    });

    const toggleBonus = () => {
      applyBonus = !applyBonus;
      render();
    };
    ui.bonus.applyBtn?.addEventListener("click", toggleBonus);
    ui.bonus.applyBtnDup?.addEventListener("click", toggleBonus);

    ui.bonus.regen?.addEventListener("click", () => {
      const level = clampInt(ui.level.value, 1, 35);
      writeInputs(ui.bonus.inputs, randomDistribution(totalBonusPoints(level)));
      render();
    });

    Object.values(ui.bonus.inputs).forEach((inp) => inp?.addEventListener("input", render));

    ui.applyRelicsBtn?.addEventListener("click", () => {
      applyRelics = !applyRelics;
      render();
    });

    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".relicSlot");
      if (!btn) return;
      const slot = Number(btn.getAttribute("data-slot") || 0);
      openRelicModalForStats(slot);
    });

    document.addEventListener("click", (e) => {
      if (e.target.closest('[data-action="close-relic"]')) closeRelicModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeRelicModal();
    });

    $$(".scRelic").forEach((sel) => {
      sel.addEventListener("change", () => {
        refreshAllScRelicSlots();
        render();
      });
    });

    ui.presets?.loadBtn?.addEventListener("click", openScPresetModal);
    ui.presets?.saveBtn?.addEventListener("click", openScSaveModal);

    ui.presets?.saveConfirm?.addEventListener("click", confirmSavePreset);

    document.addEventListener("click", (e) => {
      if (e.target.closest('[data-action="close-presets"]')) closeScPresetModal();
      if (e.target.closest('[data-action="close-save"]')) closeScSaveModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape"){
        closeScPresetModal();
        closeScSaveModal();
      }
    });

    ui.export?.openBtn?.addEventListener("click", openExportModal);
    document.addEventListener("click", (e) => {
      if (e.target.closest('[data-action="close-export"]')) closeExportModal();
    });
    ui.export?.downloadBtn?.addEventListener("click", downloadExport);

    document.addEventListener("keydown", async (e) => {
      if (!ui.export?.modal || ui.export.modal.hidden) return;

      if (e.key.toLowerCase() === "e") {
        EXPORT_TWEAK_MODE = !EXPORT_TWEAK_MODE;
        console.log("EXPORT_TWEAK_MODE:", EXPORT_TWEAK_MODE ? "ON" : "OFF");
        return;
      }

      if (EXPORT_TWEAK_MODE && /^[1-6]$/.test(e.key)) {
        EXPORT_ACTIVE_KEY = EXPORT_KEYS[Number(e.key) - 1];
        console.log("Active:", EXPORT_ACTIVE_KEY);
        logLayout();
        return;
      }

      if (!EXPORT_TWEAK_MODE) return;

      const step = e.altKey ? 1 : (e.shiftKey ? 10 : 2);

      let dx = 0, dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      if (e.key === "ArrowRight") dx = step;
      if (e.key === "ArrowUp") dy = -step;
      if (e.key === "ArrowDown") dy = step;

      if (dx || dy) {
        e.preventDefault();
        nudgeActive(dx, dy);
        logLayout();
        await renderExportCanvas();
      }
    });
  }

  async function init() {
    try {
      setError("");

      applyMode("none");

      bindEvents();

      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`No pude cargar ${DATA_URL} (HTTP ${res.status}).`);
      const data = await res.json();
      if (!data || !Array.isArray(data.miscrits)) throw new Error("base_stats.json inválido: { miscrits: [...] }");

      MISCRITS = data.miscrits
        .filter((m) => m && m.name && m.baseStats)
        .slice()
        .sort((a, b) => (a.name ?? "").localeCompare((b.name ?? ""), "en", { sensitivity: "base" }));

      if (!MISCRITS.length) throw new Error("No hay miscrits válidos en base_stats.json");

      try {
        const relicRes = await fetch(RELICS_URL, { cache: "no-store" });
        if (!relicRes.ok) throw new Error(`No pude cargar ${RELICS_URL} (HTTP ${relicRes.status}).`);
        const relicRaw = await relicRes.json();
        RELICS = normalizeRelicsForStatsCalc(relicRaw);
        RELIC_BY_NAME = new Map(RELICS.map((r) => [r.name, r]));
        populateScRelicSelects();
        refreshAllScRelicSlots();
      } catch (e) {
        console.warn("Relics load failed:", e);
      }

      bindPicker();

      selected = MISCRITS.find((m) => normalize(m.name) === "flue") || MISCRITS[0];
      if (ui.guess) ui.guess.value = selected.name;
      setAvatar(selected.name);

      const lvl = clampInt(ui.level?.value, 1, 35);
      if (ui.bonus.inputs.hp) writeInputs(ui.bonus.inputs, randomDistribution(totalBonusPoints(lvl)));

      render();
    } catch (e) {
      console.error(e);
      clearOutputs();
      setError(e.message || String(e));
    }
  }

  init();
})();
