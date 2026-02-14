/* =========================================================
   SMALL UTILS
========================================================= */
export function normalize(str) {
  return (str ?? "").toString().trim().toLowerCase();
}
export function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
export function clamp(n, a, b) {
  n = toNum(n);
  return Math.max(a, Math.min(b, n));
}

export function normalizeElements(elements) {
  if (Array.isArray(elements)) {
    return elements
      .map(e => (e ?? "").toString().trim().toLowerCase())
      .filter(Boolean);
  }

  const raw = (elements ?? "").toString().trim();
  if (!raw) return [];

  if (raw.includes(" ")) {
    return raw
      .split(/\s+/g)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
  }

  const tokens = raw.match(/[A-Z][a-z]*/g) || [];
  return tokens.map(t => t.toLowerCase());
}

/* =========================================================
   ELEMENT MULTIPLIER
========================================================= */
export const STRONG = {
  water: ["fire"],
  fire: ["nature"],
  nature: ["water"],
  earth: ["lightning"],
  wind: ["earth"],
  lightning: ["wind"],
};

export const WEAK = {
  water: ["nature"],
  fire: ["water"],
  nature: ["fire"],
  earth: ["wind"],
  wind: ["lightning"],
  lightning: ["earth"],
};

export function elementMultiplier(atkElem, defElems) {
  const a = normalize(atkElem);
  const defs = (defElems ?? []).map(normalize);

  let mul = 1;
  for (const d of defs) {
    if (STRONG[a]?.includes(d)) mul *= 2.0;
    if (WEAK[a]?.includes(d)) mul *= 0.5;
  }
  return mul;
}

export function isElementalAttack(elem) {
  const e = normalize(elem);
  return ["water", "fire", "nature", "earth", "wind", "lightning"].includes(e);
}

/* =========================================================
   PICK ATK/DEF STAT
========================================================= */
export function pickAtkDefStats(mode, attackElem, inputs) {
  if (mode === "physical") {
    return { atk: inputs.atkPA, def: inputs.defPD, label: "PA vs PD" };
  }
  if (mode === "elemental") {
    return { atk: inputs.atkEA, def: inputs.defED, label: "EA vs ED" };
  }
  const elemental = isElementalAttack(attackElem);
  if (elemental) return { atk: inputs.atkEA, def: inputs.defED, label: "EA vs ED" };
  return { atk: inputs.atkPA, def: inputs.defPD, label: "PA vs PD" };
}

/* =========================================================
   DAMAGE MATH
========================================================= */
export function computePerHit(ap, atkStat, defStat, elemMul) {
  const a = toNum(ap);
  const atk = Math.max(1, toNum(atkStat));
  const def = Math.max(1, toNum(defStat));
  const m = toNum(elemMul);

  const base = (a * (atk / def)) * m;
  const min = Math.floor(base * 0.9);
  const max = Math.floor(base * 1.1);
  return { min, max, base };
}

export function calcDamageRange({
  attackerTotals,
  defenderTotals,
  move,
  defenderElements,
  negateElement = false,
  mode = "auto"
}) {
  if (!attackerTotals || !defenderTotals || !move) return null;

  const picked = pickAtkDefStats(mode, move.element, {
    atkPA: attackerTotals.PA,
    atkEA: attackerTotals.EA,
    defPD: defenderTotals.PD,
    defED: defenderTotals.ED,
  });

  const mul = negateElement ? 1.0 : elementMultiplier(move.element, defenderElements);
  const per = computePerHit(move.ap, picked.atk, picked.def, mul);
  const hits = Math.max(1, toNum(move.hits ?? 1));

  const totalMin = per.min * hits;
  const totalMax = per.max * hits;
  const totalAvg = Math.floor((totalMin + totalMax) / 2);

  const defHP = Math.max(0, toNum(defenderTotals.HP));
  const htk = totalAvg > 0 ? Math.ceil(defHP / totalAvg) : Infinity;

  return { min: totalMin, max: totalMax, avg: totalAvg, htk, label: picked.label, multiplier: mul };
}

/* =========================================================
   MOVES
========================================================= */
export function getMovesPvp(m) {
  if (!m) return [];
  if (Array.isArray(m.enhancedAttacks) && m.enhancedAttacks.length) return m.enhancedAttacks;
  return Array.isArray(m.attacks) ? m.attacks : [];
}

export function pickBestMove(attackerMiscrit, attackerTotals, defenderMiscrit, defenderTotals, mode = "auto") {
  const moves = getMovesPvp(attackerMiscrit);
  if (!moves.length) return null;

  let best = null;

  for (const mv of moves) {
    const dmg = calcDamageRange({
      attackerTotals,
      defenderTotals,
      move: mv,
      defenderElements: defenderMiscrit?.elements ?? [],
      negateElement: false,
      mode,
    });
    if (!dmg) continue;

    const score = (1000 - Math.min(999, dmg.htk * 100)) + (dmg.avg / 10);

    if (!best || score > best.score) best = { move: mv, dmg, score };
  }

  return best;
}
