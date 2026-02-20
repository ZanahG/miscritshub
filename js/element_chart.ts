declare global {
  interface Window {
    MISCRITS_ELEMENT_MULT: (attElem: string, defElems: string | string[]) => number;
  }
}

(() => {
  const norm = (s: any) => (s ?? "").toString().trim().toLowerCase();

  const DUAL_MODE = "multiply";

  const STRONG = [
    ["fire", "nature"],
    ["nature", "water"],
    ["water", "fire"],
    ["earth", "lightning"],
    ["lightning", "wind"],
    ["wind", "earth"],
  ];

  const CHART: Record<string, Record<string, number>> = {};
  const set = (a: string, d: string, m: number) => {
    (CHART[a] ||= {});
    CHART[a][d] = m;
  };

  for (const [a, d] of STRONG) {
    if (a && d) {
      set(a, d, 2);
      set(d, a, 0.5);
    }
  }

  function singleMult(att: string | undefined, def: string | undefined): number {
    const a = norm(att || "");
    const d = norm(def || "");
    if (!a || !d) return 1;
    if (a === "physical") return 1;

    const row = CHART[a];
    if (!row) return 1;

    const m = row[d];
    return typeof m === "number" && Number.isFinite(m) ? m : 1;
  }

  function combinedMult(attElem: string | undefined, defElems: string | string[]): number {
    const a = norm(attElem);
    const defs = Array.isArray(defElems) ? defElems : (defElems ? [defElems] : []);
    if (!a || a === "physical") return 1;
    if (!defs.length) return 1;

    const ms = defs.map((d) => singleMult(a, d)).filter((x): x is number => Number.isFinite(x) && x > 0);
    if (!ms.length) return 1;

    if (DUAL_MODE === ("max" as string)) return Math.max(...ms);
    return ms.reduce((acc, v) => acc * v, 1);
  }

  window.MISCRITS_ELEMENT_MULT = (attElem: string | undefined, defElems: string | string[]) => combinedMult(attElem, defElems);
})();
