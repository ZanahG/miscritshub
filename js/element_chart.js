(() => {
  const norm = (s) => (s ?? "").toString().trim().toLowerCase();

  const DUAL_MODE = "multiply";

  const STRONG = [
    ["fire", "nature"],
    ["nature", "water"],
    ["water", "fire"],
    ["earth", "lightning"],
    ["lightning", "wind"],
    ["wind", "earth"],
  ];

  const CHART = {};
  const set = (a, d, m) => {
    (CHART[a] ||= {});
    CHART[a][d] = m;
  };

  for (const [a, d] of STRONG) {
    set(a, d, 2);
    set(d, a, 0.5);
  }

  function singleMult(att, def) {
    const a = norm(att);
    const d = norm(def);
    if (!a || !d) return 1;
    if (a === "physical") return 1;

    const row = CHART[a];
    if (!row) return 1;

    const m = row[d];
    return Number.isFinite(m) ? m : 1;
  }

  function combinedMult(attElem, defElems) {
    const a = norm(attElem);
    const defs = Array.isArray(defElems) ? defElems : (defElems ? [defElems] : []);
    if (!a || a === "physical") return 1;
    if (!defs.length) return 1;

    const ms = defs.map((d) => singleMult(a, d)).filter((x) => Number.isFinite(x) && x > 0);
    if (!ms.length) return 1;

    if (DUAL_MODE === "max") return Math.max(...ms);
    return ms.reduce((acc, v) => acc * v, 1);
  }

  window.MISCRITS_ELEMENT_MULT = (attElem, defElems) => combinedMult(attElem, defElems);
})();
