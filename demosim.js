/* =========================================================================
   DEMOSIM · proiezione per componenti (coorti quinquennali, per sesso)
   1950 → 2100 per sei Paesi. Traiettorie di fecondità (TFT), speranza di
   vita (e0) e saldo migratorio plausibili, ispirate alle stime ONU (WPP):
   le piramidi sono SIMULATE con un modello demografico, non dati ufficiali.
   ========================================================================= */
(function (global) {
  "use strict";
  const AG = 21;            // 0-4, 5-9, …, 95-99, 100+
  const Y0 = 1950, Y1 = 2100, STEP = 5;

  // [anno, valore] — punti chiave interpolati linearmente
  const COUNTRIES = {
    italia: {
      name: "Italia", pop0: 47.1, init: { tfr: 3.1, e0: 56 },
      tfr: [[1950, 2.4], [1964, 2.7], [1977, 1.9], [1985, 1.4], [1995, 1.2], [2008, 1.45], [2023, 1.2], [2050, 1.35], [2100, 1.5]],
      e0: [[1950, 65], [1970, 72], [1990, 77], [2010, 82], [2023, 83.5], [2050, 87], [2100, 92]],
      mig: [[1950, -4], [1965, -2], [1975, -0.5], [1985, 0], [1995, 1.5], [2003, 6], [2010, 4], [2016, 1.5], [2023, 2.5], [2050, 2.5], [2100, 2]]
    },
    nigeria: {
      name: "Nigeria", pop0: 37.8,
      tfr: [[1950, 6.3], [1975, 6.6], [1990, 6.2], [2005, 5.8], [2015, 5.3], [2023, 4.6], [2050, 3.2], [2075, 2.4], [2100, 2.0]],
      e0: [[1950, 33], [1980, 45], [2000, 46], [2023, 54], [2050, 62], [2100, 74]],
      mig: [[1950, -0.2], [2023, -0.3], [2100, -0.2]]
    },
    giappone: {
      name: "Giappone", pop0: 83.6, init: { tfr: 4.7, e0: 50 },
      tfr: [[1950, 3.65], [1955, 2.4], [1960, 2.0], [1972, 2.14], [1980, 1.75], [1990, 1.5], [2005, 1.26], [2015, 1.45], [2023, 1.2], [2050, 1.35], [2100, 1.5]],
      e0: [[1950, 61], [1955, 66], [1965, 71], [1980, 76], [1990, 79], [2023, 84.5], [2050, 87.5], [2100, 92]],
      mig: [[1950, 0], [2000, 0.3], [2023, 1], [2100, 1]]
    },
    corea: {
      name: "Corea del Sud", pop0: 19.2,
      tfr: [[1950, 5.9], [1960, 6.0], [1975, 3.4], [1985, 1.7], [2000, 1.45], [2010, 1.23], [2018, 0.98], [2023, 0.72], [2040, 1.0], [2100, 1.35]],
      e0: [[1950, 42], [1970, 62], [1990, 72], [2010, 80.5], [2023, 84], [2100, 92]],
      mig: [[1950, -1], [1985, -0.5], [2000, 0], [2023, 1], [2100, 1.2]]
    },
    india: {
      name: "India", pop0: 357,
      tfr: [[1950, 5.9], [1970, 5.6], [1990, 4.0], [2010, 2.6], [2023, 2.0], [2050, 1.75], [2100, 1.7]],
      e0: [[1950, 37], [1980, 52], [2000, 63], [2019, 70.5], [2023, 72], [2050, 77], [2100, 85]],
      mig: [[1950, 0], [2023, -0.4], [2100, -0.3]]
    },
    brasile: {
      name: "Brasile", pop0: 54,
      tfr: [[1950, 6.1], [1965, 5.9], [1985, 3.2], [2000, 2.3], [2015, 1.75], [2023, 1.6], [2100, 1.6]],
      e0: [[1950, 48], [1980, 62], [2000, 70], [2019, 75.5], [2023, 76], [2050, 81], [2100, 88]],
      mig: [[1950, 0.5], [1980, 0], [2023, 0.1], [2100, 0]]
    }
  };

  const interp = (pts, y) => {
    if (y <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (y <= pts[i][0]) {
      const [a, va] = pts[i - 1], [b, vb] = pts[i];
      return va + (vb - va) * (y - a) / (b - a);
    }
    return pts[pts.length - 1][1];
  };

  /* ---- mortalità: Siler (infantile + costante + senescente) ---- */
  function hazards(L, sex) {
    const k1 = Math.exp(-6 * L), k2 = Math.exp(-2.3 * L), f = sex === "f" ? 0.82 : 1;
    return x => (0.28 * k1 * Math.exp(-1.6 * x) + 0.0055 * k1 + 6.5e-5 * k2 * Math.exp(0.098 * x)) * f;
  }
  function lifeTable(L, sex) {
    const mu = hazards(L, sex), dx = 0.25;
    const l = [1]; let x = 0, cur = 1;
    const nL = new Array(AG).fill(0);
    while (x < 130) {
      const next = cur * Math.exp(-mu(x + dx / 2) * dx);
      const g = Math.min(Math.floor(x / 5), AG - 1);
      nL[g] += (cur + next) / 2 * dx;
      cur = next; x += dx;
    }
    const e0 = nL.reduce((s, v) => s + v, 0);
    return { nL, e0 };
  }
  const ltCache = new Map();
  function lifeTableE0(e0, sex) {
    const key = sex + Math.round(e0 * 10);
    if (ltCache.has(key)) return ltCache.get(key);
    let lo = -1, hi = 2.2;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; (lifeTable(m, sex).e0 < e0 ? lo = m : hi = m); }
    const lt = lifeTable((lo + hi) / 2, sex); ltCache.set(key, lt); return lt;
  }

  /* ---- fecondità: schema per età che invecchia al calare del TFT ---- */
  const HIGH = [0.11, 0.22, 0.22, 0.19, 0.14, 0.09, 0.03];
  const LOW = [0.02, 0.08, 0.22, 0.33, 0.24, 0.09, 0.02];
  function asfr(tfr) {
    const w = Math.max(0, Math.min(1, (tfr - 1.3) / (5 - 1.3)));
    return HIGH.map((h, i) => tfr / 5 * (w * h + (1 - w) * LOW[i]));
  }
  const MIG_AGE = [0.06, 0.04, 0.05, 0.12, 0.17, 0.16, 0.13, 0.09, 0.06, 0.04, 0.03, 0.02, 0.015, 0.01, 0.005, 0.003, 0.002, 0, 0, 0, 0];

  function step(pop, year, c) {
    const tfr = interp(c.tfr, year + 2.5), e0 = interp(c.e0, year + 2.5), mig = interp(c.mig, year + 2.5);
    const ltM = lifeTableE0(e0 - 2.6, "m"), ltF = lifeTableE0(e0 + 2.6, "f");
    const total = pop.m.reduce((s, v) => s + v, 0) + pop.f.reduce((s, v) => s + v, 0);
    const next = { m: new Array(AG).fill(0), f: new Array(AG).fill(0) };
    let deaths = 0;
    for (const [sex, lt] of [["m", ltM], ["f", ltF]]) {
      const P = pop[sex], N = next[sex], nL = lt.nL;
      for (let a = 0; a < AG - 2; a++) { const s = nL[a + 1] / nL[a]; N[a + 1] = P[a] * s; deaths += P[a] * (1 - s); }
      const sOpen = (nL[AG - 2 + 1]) / (nL[AG - 2] + nL[AG - 1]);
      const tail = (P[AG - 2] + P[AG - 1]) * Math.max(0, Math.min(1, sOpen));
      deaths += P[AG - 2] + P[AG - 1] - tail; N[AG - 1] = tail;
    }
    const F = asfr(tfr); let births = 0;
    for (let i = 0; i < 7; i++) births += 5 * F[i] * (pop.f[3 + i] + next.f[3 + i]) / 2;
    const bm = births * 1.05 / 2.05, bf = births / 2.05;
    next.m[0] = bm * ltM.nL[0] / 5; next.f[0] = bf * ltF.nL[0] / 5;
    deaths += bm - next.m[0] + bf - next.f[0];
    const mtot = mig / 1000 * 5 * total;
    for (let a = 0; a < AG; a++) { next.m[a] = Math.max(0, next.m[a] + mtot * MIG_AGE[a] * 0.52); next.f[a] = Math.max(0, next.f[a] + mtot * MIG_AGE[a] * 0.48); }
    const total2 = next.m.reduce((s, v) => s + v, 0) + next.f.reduce((s, v) => s + v, 0);
    const mid = (total + total2) / 2;
    return { next, cbr: births / 5 / mid * 1000, cdr: deaths / 5 / mid * 1000, tfr, e0 };
  }

  function indicators(pop) {
    const all = pop.m.map((v, i) => v + pop.f[i]);
    const tot = all.reduce((s, v) => s + v, 0);
    let cum = 0, med = 0;
    for (let i = 0; i < AG; i++) { if (cum + all[i] >= tot / 2) { med = i * 5 + 5 * (tot / 2 - cum) / all[i]; break; } cum += all[i]; }
    const young = all.slice(0, 3).reduce((s, v) => s + v, 0), old = all.slice(13).reduce((s, v) => s + v, 0);
    return { total: tot, median: med, old: old / tot * 100, young: young / tot * 100, dep: (young + old) / (tot - young - old) * 100 };
  }

  function simulate(key) {
    const c = COUNTRIES[key];
    // popolazione iniziale: stabile con i tassi del 1950
    let pop = { m: new Array(AG).fill(1), f: new Array(AG).fill(1) };
    const c0 = { tfr: [[0, (c.init || {}).tfr || c.tfr[0][1]]], e0: [[0, (c.init || {}).e0 || c.e0[0][1]]], mig: [[0, 0]] };
    for (let i = 0; i < 60; i++) pop = step(pop, 0, c0).next;
    const t0 = indicators(pop).total, k = c.pop0 / t0;
    pop.m = pop.m.map(v => v * k); pop.f = pop.f.map(v => v * k);
    const out = [];
    for (let y = Y0; y <= Y1; y += STEP) {
      const r = y < Y1 ? step(pop, y, c) : null;
      out.push({ year: y, m: pop.m.slice(), f: pop.f.slice(), ...indicators(pop), tfr: interp(c.tfr, y), e0: interp(c.e0, y), cbr: r ? r.cbr : null, cdr: r ? r.cdr : null });
      if (r) pop = r.next;
    }
    // tassi all'ultimo punto: ripeti il penultimo
    out[out.length - 1].cbr = out[out.length - 2].cbr; out[out.length - 1].cdr = out[out.length - 2].cdr;
    return { key, name: c.name, series: out };
  }

  global.DEMOSIM = { COUNTRIES, simulate, AG, Y0, Y1, STEP };
  if (typeof module !== "undefined") module.exports = global.DEMOSIM;
})(typeof window !== "undefined" ? window : globalThis);
