function qs(sel: string): HTMLElement | null { return document.querySelector(sel); }

function getParam(name: string){
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function esc(str: any){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function isEmptyChange(v: any){
  const s = String(v ?? "").trim();
  return s === "" || s === "-" || s.toLowerCase() === "none" || s.toLowerCase() === "n/a";
}

function tokenizeStats(str: any){
  const s = String(str ?? "");
  const re = /(-?\d+\/\d+|-?\d+(?:\.\d+)?%|-?\d+(?:\.\d+)?)/g;
  const out: any[] = [];
  let m;
  while ((m = re.exec(s)) !== null){
    out.push({ token: m[0], index: m.index, length: m[0].length });
  }
  return out;
}

function statValue(token: any){
  if (!token) return null;
  const frac = token.match(/^(\d+)\/(\d+)$/);
  if (frac){
    const a = Number(frac[1]);
    const b = Number(frac[2]);
    if (!b) return null;
    return a / b;
  }
  const num = token.replace("%", "");
  const v = Number(num);
  return Number.isFinite(v) ? v : null;
}

function wrapChangedToken(token: any, cls: string){
  return `<span class="pnNum pnNum--${cls}">${token}</span>`;
}

function diffHighlight(from: any, to: any){
  const fromStr = String(from ?? "");
  const toStr   = String(to ?? "");
  const fromTokens = tokenizeStats(fromStr).map(t => t.token);

  if (isEmptyChange(fromStr) && !isEmptyChange(toStr)){
    const toHTML = esc(toStr).replace(/(-?\d+\/\d+|-?\d+(?:\.\d+)?%|-?\d+(?:\.\d+)?)/g, (m) => wrapChangedToken(m, "new"));
    return { fromHTML: "", toHTML, rowKind: "new" };
  }

  let out = "";
  let last = 0;
  const toSpans = tokenizeStats(toStr);
  let anyUp = false, anyDown = false;

  for (let i = 0; i < toSpans.length; i++){
    const span = toSpans[i];
    const tokTo = span.token;
    const tokFrom = fromTokens[i] ?? null;

    out += esc(toStr.slice(last, span.index));

    if (tokFrom === tokTo){
      out += esc(tokTo);
    } else {
      const a = statValue(tokFrom);
      const b = statValue(tokTo);

      let cls = "new";
      if (a != null && b != null){
        if (b > a) { cls = "up"; anyUp = true; }
        else if (b < a) { cls = "down"; anyDown = true; }
        else cls = "neutral";
      }
      out += wrapChangedToken(tokTo, cls);
    }

    last = span.index + span.length;
  }

  out += esc(toStr.slice(last));
  const rowKind = anyUp && !anyDown ? "up" : (!anyUp && anyDown ? "down" : "neutral");
  return { fromHTML: esc(fromStr), toHTML: out, rowKind };
}

function renderDiffRow(label: string, from: any, to: any){
  const { fromHTML, toHTML, rowKind } = diffHighlight(from, to);

  return `
    <div class="pnDiffRow pnDiffRow--${rowKind}">
      <div class="pnDot"></div>
      <div class="pnText">
        <span class="pnLabel">${esc(label)}</span>:
        ${fromHTML ? `<span class="pnFrom">${fromHTML}</span>` : ``}
        ${(fromHTML && toHTML) ? `<span class="pnArrow">⇒</span>` : ``}
        ${toHTML ? `<span class="pnTo">${toHTML}</span>` : ``}
      </div>
    </div>
  `;
}

/* ===== Paths ===== */
function slugifyMiscritName(name: any){
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
function getMiscritAvatarPath(name: any){
  const slug = slugifyMiscritName(name);
  return `../assets/images/miscrits_avatar/${slug}_avatar.png`;
}

function slugifyRelicName(name: any){
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
function getRelicIconPath(name: any){
  const slug = slugifyRelicName(name);
  return `../assets/images/relics/${slug}.png`;
}

function miniMD(text: any){
  const s = esc(text);
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}

/* ===== Section renders ===== */
function renderSystemSection(sec: any){
  const items = (sec.items ?? []).map((i: any) => renderDiffRow(i.label, i.from, i.to)).join("");
  return `
    <section class="card pnPanel">
      <h2 class="pnH2">${esc(sec.title)}</h2>
      <div class="pnDiffList">${items}</div>
    </section>
  `;
}

function renderMiscritSection(sec: any){
  const avatarSrc = sec.icon ? sec.icon : getMiscritAvatarPath(sec.name);

  const blocks = (sec.blocks ?? []).map((b: any) => {
    const changes = (b.changes ?? []).map((c: any) => renderDiffRow(c.label, c.from, c.to)).join("");
    return `
      <div class="pnBlock">
        <div class="pnBlockHead">
          ${b.icon
            ? `<img class="pnIcon" src="${esc(b.icon)}" alt="${esc(b.spell)}" />`
            : `<div class="pnIcon pnIcon--empty"></div>`
          }
          <div class="pnSpell">${esc(b.spell)}</div>
        </div>
        <div class="pnDiffList">${changes}</div>
      </div>
    `;
  }).join("");

  return `
    <section class="card pnChamp">
      <div class="pnChampHead">
        <img
          class="pnChampImg"
          src="${esc(avatarSrc)}"
          alt="${esc(sec.name)}"
          onerror="this.onerror=null;this.src='../assets/images/miscrits_avatar/_placeholder_avatar.png';"
        />
        <div>
          <div class="pnChampName">${esc(sec.name)}</div>
          ${sec.quote ? `<div class="pnChampQuote">“${miniMD(sec.quote)}”</div>` : ""}
        </div>
      </div>
      ${blocks}
    </section>
  `;
}

function renderRelicSection(sec: any){
  const blocks = (sec.blocks ?? []).map((b: any) => {
    const changes = (b.changes ?? []).map((c: any) => renderDiffRow(c.label, c.from, c.to)).join("");
    const iconSrc = b.icon ? b.icon : getRelicIconPath(b.spell ?? b.title ?? sec.name);

    return `
      <div class="pnBlock">
        <div class="pnBlockHead">
          <img
            class="pnIcon"
            src="${esc(iconSrc)}"
            alt="${esc(b.spell ?? b.title ?? sec.name)}"
            onerror="this.onerror=null;this.src='../assets/images/relics/_placeholder.png';"
          />
          <div class="pnSpell">${esc(b.spell ?? b.title ?? "Changes")}</div>
        </div>
        <div class="pnDiffList">${changes}</div>
      </div>
    `;
  }).join("");

  return `
    <section class="card pnChamp">
      <div class="pnChampHead">
        <img
          class="pnChampImg"
          src="${esc(getRelicIconPath(sec.name))}"
          alt="${esc(sec.name)}"
          onerror="this.onerror=null;this.src='../assets/images/relics/_placeholder.png';"
        />
        <div>
          <div class="pnChampName">${esc(sec.name)}</div>
          ${sec.quote ? `<div class="pnChampQuote">“${miniMD(sec.quote)}”</div>` : ""}
        </div>
      </div>
      ${blocks}
    </section>
  `;
}

/* ===== Visual Summary (canvas) ===== */
async function renderPatchVisual(patch: any){
  if (!patch.visual) return null;

  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 900;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  function triDown(x: number, y: number, s: number, c: string){
    ctx!.fillStyle = c;
    ctx!.beginPath();
    ctx!.moveTo(x, y); ctx!.lineTo(x + s, y); ctx!.lineTo(x + s/2, y + s);
    ctx!.closePath(); ctx!.fill();
  }
  function triUp(x: number, y: number, s: number, c: string){
    ctx!.fillStyle = c;
    ctx!.beginPath();
    ctx!.moveTo(x + s/2, y); ctx!.lineTo(x, y + s); ctx!.lineTo(x + s, y + s);
    ctx!.closePath(); ctx!.fill();
  }

  ctx.fillStyle = "#0b0f14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  try{
    const bg = new Image();
    bg.src = "../assets/images/ui/patch-template.png";
    await bg.decode();
    ctx.globalAlpha = 0.25;
    ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }catch{}

  ctx.fillStyle = "#fff";
  ctx.font = "bold 64px system-ui";
  ctx.fillText("PATCH NOTES", 80, 130);

  ctx.font = "bold 120px system-ui";
  ctx.fillText(patch.version, 550, 130);

  try{
    const logo = new Image();
    logo.src = "../assets/images/logo.png";
    await logo.decode();
    const logoH = 300;
    const logoW = (logo.width / logo.height) * logoH;
    ctx.drawImage(logo, 1180, -40, logoW, logoH);
  }catch{}

  ctx.font = "bold 40px system-ui";
  triDown(80, 305, 22, "#ff6b6b");
  ctx.fillStyle = "#fff";
  ctx.fillText("NERF", 110, 332);

  triUp(80, 573, 22, "#4ade80");
  ctx.fillStyle = "#fff";
  ctx.fillText("BUFF", 110, 600);

  ctx.fillText("RELICS", 1050, 340);

  async function drawIcons(list: any[], startX: number, startY: number, isMiscrit = true){
    const ICON = 72, GAP = 12, PER_ROW = 8;
    let x = startX, y = startY;

    for (let i = 0; i < (list?.length ?? 0); i++){
      const name = list[i];
      const img = new Image();
      img.src = isMiscrit ? getMiscritAvatarPath(name) : getRelicIconPath(name);
      try { await img.decode(); } catch {}
      ctx!.drawImage(img, x, y, ICON, ICON);

      if ((i + 1) % PER_ROW === 0){ x = startX; y += ICON + GAP; }
      else x += ICON + GAP;
    }
  }

  await drawIcons(patch.visual.nerf ?? [], 80, 380, true);
  await drawIcons(patch.visual.buff ?? [], 80, 650, true);
  await drawIcons(patch.visual.relics ?? [], 1050, 380, false);

  return canvas.toDataURL("image/png");
}

/* ===== Loader ===== */
async function loadPatch(){
  const version = getParam("v") || null;

  // Si abren /patch_notes.html sin ?v=, intenta cargar el último desde patches.json
  let targetVersion = version;
  if (!targetVersion){
    try{
      const idx = await fetch("../assets/data/patches.json", { cache:"no-store" });
      if (idx.ok){
        const list = await idx.json();
        if (Array.isArray(list) && list.length){
          list.sort((a,b) => (b.version || "").localeCompare((a.version || ""), undefined, { numeric:true }));
          targetVersion = list[0]?.version || null;
        }
      }
    }catch{}
  }
  if (!targetVersion) targetVersion = "2.1.0";

  const res = await fetch(`../assets/data/patchs/patch-${encodeURIComponent(targetVersion)}.json`, { cache:"no-store" });

  if (!res.ok){
    if (qs("#patchSections")) qs("#patchSections")!.innerHTML = `
      <section class="card pnPanel">
        <h2 class="pnH2">No se encontró el parche ${esc(targetVersion)}</h2>
        <div class="pnMuted">Revisa que exista: assets/data/patchs/patch-${esc(targetVersion)}.json</div>
      </section>
    `;
    if (qs("#patchVersion")) qs("#patchVersion")!.textContent = "Patch";
    if (qs("#patchTitle")) qs("#patchTitle")!.textContent = "";
    return;
  }

  const patch = await res.json();
  document.title = `Patch ${patch.version} | Miscrits HUB`;

  if (qs("#patchVersion")) qs("#patchVersion")!.textContent = `Patch ${patch.version}`;
  if (qs("#patchTitle")) qs("#patchTitle")!.textContent = patch.title ?? "";

  const visualDataURL = await renderPatchVisual(patch);

  if (qs("#patchIntro")) qs("#patchIntro")!.innerHTML = `
    <h2 class="pnH2">Summary</h2>
    ${
      visualDataURL
        ? `<img class="pnAutoVisual" src="${visualDataURL}" alt="Patch summary" />`
        : `<div class="pnMuted">No visual summary available.</div>`
    }
  `;

  const sectionsEl = qs("#patchSections");
  if (sectionsEl) {
    sectionsEl.innerHTML = (patch.sections ?? []).map((sec: any) => {
    const t = String(sec.type || "").toLowerCase();

    if (t === "system") return renderSystemSection(sec);
    if (t === "miscrit") return renderMiscritSection(sec);
    if (t === "relic" || t === "relics" || t === "reliquia" || t === "reliquias") return renderRelicSection(sec);

    return `
      <section class="card pnPanel">
        <h2 class="pnH2">${esc(sec.title ?? "Sección")}</h2>
        <div class="pnMuted">Tipo de sección no soportado: ${esc(sec.type)}</div>
      </section>
    `;
    }).join("");
  }
}

loadPatch();
