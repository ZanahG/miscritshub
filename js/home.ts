(() => {
  const INDEX_PATH = "./assets/data/patches.json";
  const DETAIL_DIR = "./assets/data/patchs"; // tu carpeta se llama patchs
  const $ = (s: string) => document.querySelector(s);

  function escapeHtml(s: any){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }
  function escapeAttr(s: any){
    return escapeHtml(s).replaceAll('"',"&quot;");
  }

  function toDateValue(d: any){
    const t = Date.parse(String(d ?? ""));
    return Number.isFinite(t) ? t : -Infinity;
  }

  function pickLatestIndex(items: any[]){
    const hasDate = items.some(p => p?.date);
    if (hasDate){
      return items.slice().sort((a,b)=> toDateValue(b.date) - toDateValue(a.date))[0];
    }
    return items[items.length - 1];
  }

  function getMiscritSections(patchDetail: any){
    return (patchDetail?.sections ?? []).filter((s: any) =>
      String(s?.type ?? "").trim().toLowerCase() === "miscrit"
    );
  }

  function miscritAvatarUrl(name: any){
    const file = String(name ?? "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    // tu archivo real es casanova_avatar.png
    return `./assets/images/miscrits_avatar/${file}_avatar.png`;
  }

  async function fetchJson(path: string){
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${path}`);
    return res.json();
  }

  async function loadMiscritIndex(){
    const res = await fetch("./assets/data/miscripedia.json", { cache: "no-store" });
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.miscrits ?? []);

    const idx = new Map();
    for (const m of list){
      const n = String(m?.names?.[0] ?? "").toLowerCase().trim();
      if (!n) continue;
      idx.set(n, { id: m.id, stage: 0 });
    }
    return idx;
  }

  function miscritLinkFromName(name: any, index: Map<string, any>){
    const key = String(name ?? "").toLowerCase().trim();
    const hit = index.get(key);
    if (!hit) return `./pages/miscripedia.html?q=${encodeURIComponent(name)}`; // fallback
    return `./pages/miscripedia_data.html?id=${encodeURIComponent(hit.id)}&stage=${encodeURIComponent(hit.stage)}`;
  }

  async function renderLatestPatch() {
    const box = $("#latestPatch");
    if (!box) return;

    try{
      const miscritIndex = await loadMiscritIndex();

      const index = await fetchJson(INDEX_PATH);
      const list = Array.isArray(index) ? index : (index?.patches ?? []);
      if (!list.length){
        box.innerHTML = `<div style="opacity:.75;">No patches found.</div>`;
        return;
      }

      const latestIdx = pickLatestIndex(list);
      const ver = String(latestIdx.version ?? "").trim();
      if (!ver){
        box.innerHTML = `<div style="opacity:.75;">Latest patch has no version.</div>`;
        return;
      }

      // OJO: no encodeURIComponent aquí, es nombre de archivo local
      const detailPath = `${DETAIL_DIR}/patch-${ver}.json`;
      const detail = await fetchJson(detailPath);

      const miscrits = getMiscritSections(detail).slice(0, 4);
      const introLine = (detail?.intro?.[1] ?? detail?.intro?.[0] ?? "").trim();

      box.innerHTML = `
        <div class="latestPatchCard card">
          <div class="latestPatchTop">
            <div>
              <div class="latestPatchKicker">LATEST PATCH • ${escapeHtml(detail.version ?? ver)}</div>
              <div class="latestPatchTitle">${escapeHtml(latestIdx.title ?? detail.title ?? "Untitled patch")}</div>
              ${latestIdx.date ? `<div class="latestPatchDate">${escapeHtml(latestIdx.date)}</div>` : ``}
              ${introLine ? `<div class="latestPatchDesc">${escapeHtml(introLine)}</div>` : ``}
            </div>

            <a class="btn btn--ghost" href="./pages/patch_list.html">View all</a>
          </div>

          ${miscrits.length ? `
            <div class="latestMiscrits">
              ${miscrits.map((m: any) => {
                const href = miscritLinkFromName(m.name, miscritIndex);
                return `
                  <a class="latestMiscrit" href="${href}">
                    <img src="${miscritAvatarUrl(m.name)}" alt="${escapeAttr(m.name)}"
                      onerror="this.style.opacity=.25;this.style.filter='grayscale(1)';">
                    <div class="latestMiscritName">${escapeHtml(m.name)}</div>
                    ${m.quote ? `<div class="latestMiscritQuote">“${escapeHtml(String(m.quote).slice(0, 80))}…”</div>` : ``}
                  </a>
                `;
              }).join("")}
            </div>
          ` : `
            <div class="latestEmpty">No Miscrit highlights in this patch.</div>
          `}
        </div>
      `;
    } catch(err) {
      console.error(err);
      box.innerHTML = `
        <div style="opacity:.75;">Couldn't load latest patch.</div>
        <div style="opacity:.6;font-size:12px;margin-top:6px;">
          Check INDEX_PATH (${escapeHtml(INDEX_PATH)}) and DETAIL_DIR (${escapeHtml(DETAIL_DIR)}).
        </div>
      `;
    }
  }

  renderLatestPatch();
})();
