(() => {
  const $ = (s) => document.querySelector(s);

  const PATH = {
    TYPE_ICON_DIR: "../assets/images/type/",
    SPAWNS: "../assets/data/spawns.json",
    AVATAR_DIR: "../assets/images/miscrits_avatar/",
    PLACES_DIR: "../assets/images/places/",
  };

  let PAGE = 1;
  let PER_PAGE = 36;

  const TYPE_BASE_ORDER = ["fire","nature","water","earth","lightning","wind"];
  const RARITY_ORDER = {common: 1,rare: 2,epic: 3,exotic: 4,legendary: 5,};

  const PLACE_ORDER = {
    "forest": 1,
    "mount gemma": 2,
    "cave": 3,
    "the shack": 4,
    "mansion": 5,
    "shores": 6,
    "moon of miscria": 7,
    "volcano island": 8,
    "shop": 9,
  };

  function stripDiacritics(str) {
    return (str ?? "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function normalize(str) {
    return stripDiacritics(str ?? "").trim().toLowerCase();
  }

  const DAY_ES_TO_EN = {
    domingo: "Sun",
    lunes: "Mon",
    martes: "Tue",
    miercoles: "Wed",
    miércoles: "Wed",
    jueves: "Thu",
    viernes: "Fri",
    sabado: "Sat",
    sábado: "Sat",
  };

  function dayToEnShort(dayEs) {
    const key = normalize(dayEs);
    return DAY_ES_TO_EN[key] ?? dayEs;
  }

  function getServerDayEs() {
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Santiago" })
    );
    const resetHour = 21;
    if (now.getHours() >= resetHour) now.setDate(now.getDate() + 1);

    const daysEs = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    return daysEs[now.getDay()];
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  const el = {
    q: $("#q"),
    day: $("#day"),
    place: $("#place"),
    zone: $("#zone"),
    rarity: $("#rarity"),
    element: $("#element"),
    type: $("#type"),
    typeIcon: $("#typeIcon"),
    sort: $("#sort"),
    onlyTodayNoAll: $("#onlyTodayNoAll"),
    pageSize: $("#pageSize"),

    chips: $("#activeChips"),
    grid: $("#grid"),
    count: $("#count"),

    btnClear: $("#btnClear"),
    btnFavorites: $("#btnFavorites"),

    modal: $("#modal"),
    mKicker: $("#mKicker"),
    mTitle: $("#mTitle"),
    mMiscrit: $("#mMiscrit"),
    mType: $("#mType"),
    mRarity: $("#mRarity"),
    mZones: $("#mZones"),
    mDays: $("#mDays"),
    mMapImg: $("#mMapImg"),
    mFav: $("#mFav"),
  };

  const elPager = {
    info: $("#pageInfo"),
    prev: $("#btnPrev"),
    next: $("#btnNext"),
  };

  const STATE = {
    raw: null,
    entries: [],
    entriesByKey: new Map(),

    q: "",
    day: "",
    place: "",
    zone: "",
    rarity: "",
    element: "",
    type: "",
    onlyTodayNoAll: false,
    favoritesOnly: false,
    sort: "placeRarityName",
    favorites: new Set(JSON.parse(localStorage.getItem("mh_spawn_favs") || "[]")),
  };

  let currentKey = null;
  let DAY_PRESETS = {};

  function resolveDays(daysRaw) {
    if (typeof daysRaw === "string") return DAY_PRESETS[daysRaw] ?? [];
    return Array.isArray(daysRaw) ? daysRaw : [];
  }

  function isAllDaysPreset(daysRaw) {
    if (typeof daysRaw === "string" && normalize(daysRaw) === "all_days") return true;
    const resolved = resolveDays(daysRaw);
    return Array.isArray(resolved) && resolved.length >= 7;
  }

  function includesDay(daysArray, selectedDayEs) {
    return (daysArray ?? []).some((d) => normalize(d) === normalize(selectedDayEs));
  }

  function fixPath(p) {
    const s = String(p ?? "");
    if (!s) return "";
    if (s.startsWith("../assets/")) return s;
    if (s.startsWith("./assets/")) return "../" + s.slice(2);
    if (s.startsWith("assets/")) return "../" + s;
    return s;
  }

  function placeToImageFilename(place) {
    if (!place) return "default.webp";
    return (
      place
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^\w_]/g, "") + ".webp"
    );
  }


  function placeBg(place) {
    return `${PATH.PLACES_DIR}${placeToImageFilename(place)}`;
  }

  function placeRank(place) {
    return PLACE_ORDER[normalize(place)] ?? 999;
  }

  function rarityRank(r) {
    return RARITY_ORDER[normalize(r)] ?? 999;
  }

  const ELEMENTS = ["fire", "water", "nature", "earth", "wind", "lightning"];

  function typeRank(typeRaw){
    const elems = parseElements(typeRaw);
    if (!elems.length) return 999999;

    const isCombo = elems.length > 1 ? 1 : 0;
    const primary = TYPE_BASE_ORDER.indexOf(elems[0]);
    const primaryRank = primary === -1 ? 99 : primary;
    const secondary = elems[1] ? TYPE_BASE_ORDER.indexOf(elems[1]) : -1;
    const secondaryRank = secondary === -1 ? 99 : secondary;

    return isCombo * 10000 + primaryRank * 100 + secondaryRank;
  }


  function primaryElement(entry){
    const elems = parseElements(entry?.type ?? "");
    const priority = ["fire","water","nature","earth","wind","lightning"];
    return priority.find(p => elems.includes(p)) || elems[0] || "misc";
  }

  function elementIconSrc(elKey){
    const key = normalize(elKey || "misc");
    return `${PATH.TYPE_ICON_DIR}${key}.png`;
  }

  function updateTypeSelectIcon(){
    if (!el.typeIcon) return;

    const val = el.type?.value || "";
    if (!val){
      el.typeIcon.style.display = "none";
      return;
    }

    el.typeIcon.style.display = "";

    const comboKey = normalize(val).replace(/[^a-z]/g, "");
    const elem = primaryElement({ type: val });
    const fallback = elementIconSrc(elem);

    el.typeIcon.onerror = () => {
      el.typeIcon.onerror = null;
      el.typeIcon.src = fallback;
    };

    el.typeIcon.src = `${PATH.TYPE_ICON_DIR}${comboKey}.png`;
    el.typeIcon.alt = val;
  }

  function parseElements(typeRaw) {
    const s = normalize(typeRaw).replace(/[^a-z]/g, "");
    const found = ELEMENTS.filter((el) => s.includes(el));
    return [...new Set(found)];
  }

  function hasElement(entry, elKey) {
    if (!elKey) return true;
    const elems = parseElements(entry?.type ?? "");
    return elems.includes(normalize(elKey));
  }

  function flatten(data) {
    DAY_PRESETS = data?.presets ?? {};
    const miscrits = Array.isArray(data?.miscrits) ? data.miscrits : [];
    const out = [];

    for (const m of miscrits) {
      const spawns = Array.isArray(m.spawns) ? m.spawns : [];
      for (const sp of spawns) {
        const daysResolved = resolveDays(sp.days);
        const daysEN = Array.isArray(daysResolved) ? daysResolved.map(dayToEnShort) : [];

        const key = `${m.id}|${sp.place}|${sp.view || ""}|${sp.objectImage || ""}`;

        out.push({
          key,
          miscritId: m.id,
          name: m.name,
          type: m.type,
          rarity: m.rarity,
          avatar: PATH.AVATAR_DIR + (m.avatar || "preset_avatar.png"),
          place: sp.place || "",
          zones: Array.isArray(sp.zone) ? sp.zone : [],
          map: fixPath(sp.objectImage),
          daysRaw: sp.days,
          daysEN,
        });
      }
    }
    return out;
  }

  function uniqSorted(arr) {
    return [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function fillSelect(selectEl, values, allLabel) {
    if (!selectEl) return;
    const curr = selectEl.value;
    selectEl.innerHTML =
      `<option value="">${escapeHtml(allLabel)}</option>` +
      values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
    selectEl.value = curr || "";
  }

  function saveFavs() {
    localStorage.setItem("mh_spawn_favs", JSON.stringify([...STATE.favorites]));
  }

  function renderChips() {
    if (!el.chips) return;
    el.chips.innerHTML = "";

    const chips = [];

    const pushChip = (k, v, fn) => chips.push([k, v, fn]);

    if (STATE.q) pushChip("Search", STATE.q, () => { STATE.q = ""; if (el.q) el.q.value = ""; PAGE = 1; sync(); });
    if (STATE.day) pushChip("Day", STATE.day, () => { STATE.day = ""; if (el.day) el.day.value = ""; PAGE = 1; sync(); });
    if (STATE.place) pushChip("Place", STATE.place, () => { STATE.place = ""; if (el.place) el.place.value = ""; PAGE = 1; sync(); });
    if (STATE.zone) pushChip("Zone", STATE.zone, () => { STATE.zone = ""; if (el.zone) el.zone.value = ""; PAGE = 1; sync(); });
    if (STATE.rarity) pushChip("Rarity", STATE.rarity, () => { STATE.rarity = ""; if (el.rarity) el.rarity.value = ""; PAGE = 1; sync(); });
    if (STATE.element) pushChip("Element", STATE.element, () => { STATE.element = ""; if (el.element) el.element.value = ""; PAGE = 1; sync(); });
    if (STATE.type) pushChip("Type", STATE.type, () => { STATE.type = ""; if (el.type) el.type.value = ""; PAGE = 1; sync(); });
    if (STATE.onlyTodayNoAll) pushChip("Today only", "Exclude all-days", () => { STATE.onlyTodayNoAll = false; if (el.onlyTodayNoAll) el.onlyTodayNoAll.checked = false; PAGE = 1; sync(); });
    if (STATE.favoritesOnly) pushChip("Favorites", "On", () => { STATE.favoritesOnly = false; PAGE = 1; sync(); });

    for (const [k, v, fn] of chips) {
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.innerHTML = `<span>${escapeHtml(k)}: <strong>${escapeHtml(v)}</strong></span>`;
      const x = document.createElement("button");
      x.type = "button";
      x.textContent = "×";
      x.addEventListener("click", fn);
      chip.appendChild(x);
      el.chips.appendChild(chip);
    }
  }

  function applyFilters() {
    const q = normalize(STATE.q);

    const todayEs = getServerDayEs();
    const dayRaw = STATE.day;
    const dayEs = dayRaw === "__today__" ? todayEs : dayRaw;

    return STATE.entries.filter((e) => {
      if (q && !normalize(e.name).includes(q)) return false;
      if (STATE.place && e.place !== STATE.place) return false;
      if (STATE.zone && !(e.zones ?? []).includes(STATE.zone)) return false;
      if (STATE.rarity && normalize(e.rarity) !== normalize(STATE.rarity)) return false;
      if (STATE.type && normalize(e.type) !== normalize(STATE.type)) return false;
      if (STATE.element && !hasElement(e, STATE.element)) return false;
      if (STATE.favoritesOnly && !STATE.favorites.has(e.key)) return false;

      if (STATE.onlyTodayNoAll) {
        const appearsToday = includesDay(resolveDays(e.daysRaw), todayEs);
        if (!appearsToday) return false;
        if (isAllDaysPreset(e.daysRaw)) return false;
      } else if (dayEs) {
        if (!includesDay(resolveDays(e.daysRaw), dayEs)) return false;
      }

      return true;
    });
  }

  function sortItems(arr) {
    const copy = [...arr];

    const mode = STATE.sort || "placeRarityName";
    if (mode === "placeRarityName" || mode === "nameAsc") {
      copy.sort((a, b) => {
        const pa = placeRank(a.place);
        const pb = placeRank(b.place);
        if (pa !== pb) return pa - pb;

        const ra = rarityRank(a.rarity);
        const rb = rarityRank(b.rarity);
        if (ra !== rb) return ra - rb;

        return normalize(a.name).localeCompare(normalize(b.name));
      });
      return copy;
    }

    if (mode === "rarityDesc") {
      copy.sort((a, b) =>
        rarityRank(b.rarity) - rarityRank(a.rarity) ||
        normalize(a.name).localeCompare(normalize(b.name))
      );
      return copy;
    }

    if (mode === "placeAsc") {
      copy.sort((a, b) =>
        normalize(a.place).localeCompare(normalize(b.place)) ||
        normalize(a.name).localeCompare(normalize(b.name))
      );
      return copy;
    }

    copy.sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));
    return copy;
  }

  function getPaged(list) {
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    PAGE = clamp(PAGE, 1, totalPages);

    const startIdx = (PAGE - 1) * PER_PAGE;
    const endIdx = Math.min(startIdx + PER_PAGE, total);
    return { slice: list.slice(startIdx, endIdx), total, totalPages, startIdx, endIdx };
  }

  function updatePagerUI(total, totalPages, startIdx, endIdx) {
    if (elPager.info) {
      elPager.info.textContent =
        total === 0 ? "No results" : `Showing ${startIdx + 1}-${endIdx} of ${total} • Page ${PAGE}/${totalPages}`;
    }
    if (elPager.prev) elPager.prev.disabled = PAGE <= 1;
    if (elPager.next) elPager.next.disabled = PAGE >= totalPages;
  }

  function dayLabelShortToFull(d) {
    const map = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
    return map[d] || d;
  }

  function cardHTML(e) {
    const days = (e.daysEN?.length ? e.daysEN : ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]);
    const bgUrl = placeBg(e.place);

    const daysHtml = days
      .map((d) => `<span class="dayChip">${escapeHtml(dayLabelShortToFull(d))}</span>`)
      .join("");

    return `
      <article class="spawnCardV2 card" data-key="${escapeHtml(e.key)}" tabindex="0" role="button"
        aria-label="Open ${escapeHtml(e.name)} spawn details">

        <div class="spawnTop">
          <div class="spawnTop__left">
            <img class="spawnAvatar" src="${escapeHtml(e.avatar)}" alt="${escapeHtml(e.name)}" loading="lazy"
              onerror="this.src='${escapeHtml(PATH.AVATAR_DIR)}preset_avatar.png'"/>
            <img class="spawnElemIcon"
              src="${escapeHtml(PATH.TYPE_ICON_DIR + normalize(e.type).replace(/[^a-z]/g,'') + '.png')}"
              onerror="this.onerror=null; this.src='${escapeHtml(elementIconSrc(primaryElement(e)))}'"
              alt="${escapeHtml(primaryElement(e))}"
              loading="lazy"
              onerror="this.style.display='none'"/>
            <div class="spawnTitle">
              <div class="spawnName">${escapeHtml(e.name)}</div>
            </div>
          </div>

          <div class="spawnTop__right">
            <span class="rarityPill rarityPill--${escapeHtml(normalize(e.rarity || "common"))}">
              ${escapeHtml(e.rarity || "-")}
            </span>
          </div>
        </div>

        <div class="spawnBody">
          <div class="spawnPlace">${escapeHtml(e.place || "Unknown")}</div>

          <div class="spawnPanel" data-bg="${escapeHtml(bgUrl)}">
            <div class="spawnDays">
              ${daysHtml}
            </div>
          </div>
        </div>
      </article>
    `;
  }

  let bgObserver;
  function observeBackgrounds() {
    if (bgObserver) bgObserver.disconnect();

    bgObserver = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const panel = en.target;
        const url = panel.getAttribute("data-bg");
        if (url) panel.style.setProperty("--panel-bg", `url('${url}')`);
        bgObserver.unobserve(panel);
      }
    }, { rootMargin: "350px" });

    document.querySelectorAll(".spawnPanel[data-bg]").forEach(p => bgObserver.observe(p));
  }

  function render(paged, total, totalPages, startIdx, endIdx) {
    if (el.count) el.count.textContent = `${total} result${total === 1 ? "" : "s"}`;
    if (!el.grid) return;

    updatePagerUI(total, totalPages, startIdx, endIdx);

    el.grid.innerHTML = total === 0
      ? `<div class="muted">No results. Try removing filters.</div>`
      : paged.map(cardHTML).join("");

    observeBackgrounds();
  }

  function updateFavButton() {
    if (!el.mFav) return;
    const isFav = currentKey && STATE.favorites.has(currentKey);
    el.mFav.textContent = isFav ? "★ Favorited" : "☆ Favorite";
  }

  function openModal(key) {
    const e = STATE.entriesByKey.get(key);
    if (!e || !el.modal) return;

    currentKey = key;

    if (el.mKicker) el.mKicker.textContent = e.place || "";
    if (el.mTitle) el.mTitle.textContent = e.name || "";
    if (el.mMiscrit) el.mMiscrit.textContent = e.name || "";
    if (el.mType) el.mType.textContent = e.type || "—";
    if (el.mRarity) el.mRarity.textContent = e.rarity || "—";
    if (el.mZones) el.mZones.textContent = (e.zones?.length ? e.zones.join(", ") : "—");

    const daysArr = (e.daysEN?.length ? e.daysEN : ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]);
    if (el.mDays){
      el.mDays.innerHTML = daysArr
        .map(d => `<span class="mDayPill">${escapeHtml(dayLabelShortToFull(d))}</span>`)
        .join("");
    }

    if (el.mMapImg) {
      if (e.map) {
        el.mMapImg.loading = "lazy";
        el.mMapImg.decoding = "async";
        el.mMapImg.src = e.map;
        el.mMapImg.alt = `${e.name} location`;
        el.mMapImg.style.display = "";
      } else {
        el.mMapImg.src = "";
        el.mMapImg.style.display = "none";
      }
    }

    updateFavButton();
    el.modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    if (!el.modal) return;
    el.modal.hidden = true;
    document.body.style.overflow = "";
    currentKey = null;
  }

  function readUIToState() {
    if (el.q) STATE.q = el.q.value ?? "";
    if (el.day) STATE.day = el.day.value ?? "";
    if (el.place) STATE.place = el.place.value ?? "";
    if (el.zone) STATE.zone = el.zone.value ?? "";
    if (el.rarity) STATE.rarity = el.rarity.value ?? "";
    if (el.element) STATE.element = el.element.value ?? "";
    if (el.type) STATE.type = el.type.value ?? "";
    if (el.onlyTodayNoAll) STATE.onlyTodayNoAll = !!el.onlyTodayNoAll.checked;
    if (el.sort) STATE.sort = el.sort.value ?? "placeRarityName";

    if (el.pageSize) {
      const v = parseInt(el.pageSize.value || String(PER_PAGE), 10);
      if (Number.isFinite(v) && v > 0) PER_PAGE = v;
    }
  }

  let rafPending = false;
  function requestSync(resetPage = false) {
    if (resetPage) PAGE = 1;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      sync();
    });
  }

  function sync() {
    readUIToState();
    const filtered = sortItems(applyFilters());
    renderChips();

    const { slice, total, totalPages, startIdx, endIdx } = getPaged(filtered);
    render(slice, total, totalPages, startIdx, endIdx);

    if (el.btnFavorites) el.btnFavorites.textContent = STATE.favoritesOnly ? "Show all" : "Show favorites";
  }

  function clearFilters() {
    STATE.q = "";
    STATE.day = "";
    STATE.place = "";
    STATE.zone = "";
    STATE.rarity = "";
    STATE.element = "";
    STATE.type = "";
    STATE.onlyTodayNoAll = false;
    STATE.favoritesOnly = false;
    STATE.sort = "placeRarityName";
    PAGE = 1;

    if (el.q) el.q.value = "";
    if (el.day) el.day.value = "";
    if (el.place) el.place.value = "";
    if (el.zone) el.zone.value = "";
    if (el.rarity) el.rarity.value = "";
    if (el.element) el.element.value = "";
    if (el.type) el.type.value = "";
    if (el.onlyTodayNoAll) el.onlyTodayNoAll.checked = false;
    if (el.sort) el.sort.value = "placeRarityName";

    sync();
  }

  async function main() {
    const res = await fetch(PATH.SPAWNS, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load spawns.json (${res.status})`);

    const data = await res.json();
    STATE.raw = data;
    STATE.entries = flatten(data);
    STATE.entriesByKey = new Map(STATE.entries.map(e => [e.key, e]));

    fillSelect(el.place, uniqSorted(STATE.entries.map(e => e.place)), "All places");
    fillSelect(el.zone, uniqSorted(STATE.entries.flatMap(e => e.zones ?? [])), "All zones");
    const rarityVals = [...new Set(STATE.entries.map(e => e.rarity).filter(Boolean))]
      .sort((a, b) => rarityRank(a) - rarityRank(b) || a.localeCompare(b));
    fillSelect(el.rarity, rarityVals, "All rarities");
    const typeVals = [...new Set(STATE.entries.map(e => e.type).filter(Boolean))]
      .sort((a, b) => typeRank(a) - typeRank(b) || normalize(a).localeCompare(normalize(b)));

    fillSelect(el.type, typeVals, "All types");
    updateTypeSelectIcon();

    if (el.element) fillSelect(el.element, ["fire","water","nature","earth","wind","lightning"], "All elements");

    el.q?.addEventListener("input", () => requestSync(true));
    el.day?.addEventListener("change", () => requestSync(true));
    el.place?.addEventListener("change", () => requestSync(true));
    el.zone?.addEventListener("change", () => requestSync(true));
    el.rarity?.addEventListener("change", () => requestSync(true));
    el.element?.addEventListener("change", () => requestSync(true));
    el.type?.addEventListener("change", () => {
      updateTypeSelectIcon();
      requestSync(true);
    });
    el.sort?.addEventListener("change", () => requestSync(true));
    el.onlyTodayNoAll?.addEventListener("change", () => requestSync(true));
    el.pageSize?.addEventListener("change", () => requestSync(true));

    el.btnClear?.addEventListener("click", clearFilters);

    el.btnFavorites?.addEventListener("click", () => {
      STATE.favoritesOnly = !STATE.favoritesOnly;
      requestSync(true);
    });

    elPager.prev?.addEventListener("click", () => { PAGE = Math.max(1, PAGE - 1); requestSync(false); });
    elPager.next?.addEventListener("click", () => { PAGE = PAGE + 1; requestSync(false); });

    el.modal?.addEventListener("click", (ev) => {
      const t = ev.target;
      if (!(t instanceof Element)) return;
      if (t.matches("[data-close]")) closeModal();
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && el.modal && !el.modal.hidden) closeModal();
    });

    el.mFav?.addEventListener("click", () => {
      if (!currentKey) return;
      if (STATE.favorites.has(currentKey)) STATE.favorites.delete(currentKey);
      else STATE.favorites.add(currentKey);
      saveFavs();
      updateFavButton();
      requestSync(false);
    });

    el.grid?.addEventListener("click", (ev) => {
      const card = ev.target.closest("[data-key]");
      if (!card) return;
      openModal(String(card.getAttribute("data-key")));
    });

    el.grid?.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      const card = ev.target.closest("[data-key]");
      if (!card) return;
      ev.preventDefault();
      openModal(String(card.getAttribute("data-key")));
    });

    sync();
  }

  main().catch((err) => {
    console.error(err);
    if (el.count) el.count.textContent = "Failed to load spawns data.";
    if (el.grid) el.grid.innerHTML = `<div class="muted">Failed to load spawns.</div>`;
  });
})();
