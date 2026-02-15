async function loadPatches(){
  const listEl = document.getElementById("patchList");
  const emptyEl = document.getElementById("patchEmpty");

  try{
    const res = await fetch("../assets/data/patches.json", { cache: "no-store" });
    if(!res.ok) throw new Error("patches.json not found");

    const patches = await res.json();
    if(!Array.isArray(patches) || patches.length === 0){
      emptyEl.style.display = "block";
      return;
    }

    patches.sort((a,b) =>
      (b.version || "").localeCompare((a.version || ""), undefined, { numeric:true })
    );

    listEl.innerHTML = patches.map(p => `
      <a class="pnItem" href="./patch_notes.html?v=${encodeURIComponent(p.version)}">
        <div class="pnItem__ver">${p.version || ""}</div>
        <div class="pnItem__date">${p.date || ""}</div>
        <div class="pnItem__title">${p.title || ""}</div>
      </a>
    `).join("");

  }catch(err){
    emptyEl.style.display = "block";
    emptyEl.textContent = "Could not load patches.json (check path).";
    console.error(err);
  }
}

loadPatches();