/* =========================================================================
   HERO · "Popolazioni in transizione"
   Piramide delle età che evolve dal 1950 al 2100 (particelle) + curve di
   natalità e mortalità sincronizzate. Dati: modello per componenti in
   demosim.js (traiettorie plausibili ispirate alle stime ONU).
   ========================================================================= */
(() => {
  "use strict";
  const cv = document.getElementById("heroCanvas");
  if (!cv || !window.DEMOSIM) return;
  const ctx = cv.getContext("2d");
  const D = window.DEMOSIM;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const BLUE = "#2F6FDB";
  const C = {};
  const readColors = () => {
    const cs = getComputedStyle(root);
    ["ink", "accent", "muted", "line", "bg", "card"].forEach(k => C[k] = cs.getPropertyValue("--" + k).trim());
  };
  readColors();
  document.addEventListener("themechange", () => setTimeout(readColors, 30));

  const NOTES = {
    italia: "Baby boom negli anni '60, poi una delle fecondità più basse al mondo: la piramide si rovescia e dagli anni '90 i morti superano i nati. Senza immigrazione la popolazione calerebbe già da tempo.",
    nigeria: "La fecondità è ancora intorno a 4,6 figli per donna: la base resta larghissima e la popolazione continua a crescere per tutto il secolo, verso i 600 milioni.",
    giappone: "Il primo Paese a invecchiare: dalla metà degli anni 2000 i morti superano i nati e la popolazione si riduce, con un terzo degli abitanti oltre i 65 anni.",
    corea: "La transizione più rapida della storia: da 6 figli per donna nel 1960 a meno di 1 oggi. Le generazioni numerose degli anni '60–'80 salgono e la base quasi scompare.",
    india: "Il gigante a metà strada: la fecondità è appena scesa sotto 2,1, la piramide si trasforma in una colonna e la popolazione si stabilizza intorno a 1,5 miliardi.",
    brasile: "In due generazioni da 6 a 1,6 figli per donna: la base si stringe e le generazioni nate negli anni '80 salgono come un'onda verso l'alto."
  };
  const ORDER = ["italia", "nigeria", "giappone", "corea", "india", "brasile"];
  const SIMS = {};
  const sim = k => SIMS[k] || (SIMS[k] = D.simulate(k));

  const AG = D.AG, SUB = 2, ROWS = AG * SUB;
  let W = 0, H = 0, dpr = 1, geo = {};
  let RATES = {}, key = "italia", S = null, year = D.Y0, playing = !reduced, hold = 0, slots = [], maxShare = 1;
  const TODAY = 2025;
  const P = { x: -999, y: -999, inside: false, scrub: false };
  try { const k = localStorage.getItem("tb-country"); if (ORDER.includes(k)) key = k; } catch (e) {}

  const fmt = (v, d = 1) => v.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const alpha = (hex, a) => { if (!hex || hex[0] !== "#") return hex; const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  function text(str, x, y, o = {}) {
    ctx.font = `${o.weight || 400} ${o.size || 11}px ${o.serif ? "'Instrument Serif', serif" : o.sans ? "'Inter Tight', sans-serif" : "'JetBrains Mono', monospace"}`;
    ctx.fillStyle = o.color || C.muted; ctx.textAlign = o.align || "left"; ctx.textBaseline = o.base || "alphabetic";
    ctx.fillText(str, x, y);
  }

  /* ---------- stato al tempo (anno frazionario) ---------- */
  function at(y) {
    const s = S.series, i = clamp(Math.floor((y - D.Y0) / D.STEP), 0, s.length - 2), f = clamp((y - s[i].year) / D.STEP, 0, 1);
    const a = s[i], b = s[i + 1], mix = (u, v) => u + (v - u) * f;
    return {
      m: a.m.map((v, j) => mix(v, b.m[j])), f: a.f.map((v, j) => mix(v, b.f[j])),
      total: mix(a.total, b.total), median: mix(a.median, b.median), old: mix(a.old, b.old), young: mix(a.young, b.young),
      tfr: mix(a.tfr, b.tfr), e0: mix(a.e0, b.e0), cbr: mix(a.cbr, b.cbr), cdr: mix(a.cdr, b.cdr)
    };
  }
  function phase(st) {
    if (st.cdr > st.cbr + 0.3) return "V · più morti che nascite, la popolazione cala";
    if (st.cbr >= 30 && st.cdr >= 15) return "II · cala la mortalità, la popolazione esplode";
    if (st.cbr >= 30) return "II–III · mortalità bassa, natalità ancora alta";
    if (st.cbr >= 18) return "III · inizia a calare la natalità";
    return "IV · nascite e morti basse, la popolazione invecchia";
  }

  /* ---------- geometria ---------- */
  function layout() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const small = W < 480, pTop = small ? 60 : 64, pBot = H * (small ? .56 : .6), gap = 26;
    const sy = (pBot - pTop) / ROWS;
    geo = { pTop, pBot, gap, sy, half: W / 2 - gap / 2 - 6, cTop: Math.max(H * .74, pBot + 70), cBot: H - 22, cL: 26, cR: W - 8 };
    geo.maxN = Math.floor(geo.half / sy);
    buildSlots();
  }
  function buildSlots() {
    S = sim(key);
    // quota massima per riga su tutto il periodo → larghezza costante e confrontabile nel tempo
    maxShare = 0;
    S.series.forEach(r => { for (let a = 0; a < AG; a++) maxShare = Math.max(maxShare, r.m[a] / r.total, r.f[a] / r.total); });
    const need = { m: new Array(AG).fill(0), f: new Array(AG).fill(0) };
    S.series.forEach(r => { for (let a = 0; a < AG; a++) { need.m[a] = Math.max(need.m[a], r.m[a] / r.total); need.f[a] = Math.max(need.f[a], r.f[a] / r.total); } });
    RATES = {};
    for (let y = D.Y0; y <= D.Y1; y++) { const r = at(y); RATES[y] = { cbr: r.cbr, cdr: r.cdr }; }
    const old = slots; slots = [];
    for (const [sex, dir] of [["m", -1], ["f", 1]]) for (let a = 0; a < AG; a++) for (let s = 0; s < SUB; s++) {
      const n = Math.ceil(need[sex][a] / maxShare * geo.maxN);
      const y = geo.pBot - (a * SUB + s) * geo.sy - geo.sy / 2;
      for (let k = 0; k < n; k++) {
        const prev = old[slots.length];
        const tx = W / 2 + dir * (geo.gap / 2 + k * geo.sy + geo.sy / 2);
        slots.push({ sex, a, k, tx, ty: y, x: prev ? prev.x : tx, y: prev ? prev.y : geo.pBot + 40 + Math.random() * 60, vx: 0, vy: 0, al: 0, seed: Math.random() * 6.28 });
      }
    }
  }

  /* ---------- disegno ---------- */
  const X = y => geo.cL + (y - D.Y0) / (D.Y1 - D.Y0) * (geo.cR - geo.cL);
  const Yr = (v, top) => geo.cBot - v / top * (geo.cBot - geo.cTop);
  let t = 0, hoverRow = -1;
  function draw(dt) {
    t++;
    const st = at(year);
    const counts = { m: st.m.map(v => v / st.total / maxShare * geo.maxN), f: st.f.map(v => v / st.total / maxShare * geo.maxN) };

    // intestazione: anno e indicatori
    text(String(Math.floor(year)), 0, 34, { serif: true, size: 40, color: C.ink });
    const proj = year > TODAY;
    text(proj ? "PROIEZIONE" : "STIMA", 0, 52, { color: proj ? C.accent : C.muted, size: 10 });
    const pop = st.total >= 1000 ? fmt(st.total / 1000, 2) + " mld" : fmt(st.total, st.total < 100 ? 1 : 0) + " mln";
    text(S.name.toUpperCase(), W, 14, { align: "right", color: C.ink, weight: 500 });
    text(`popolazione ${pop}`, W, 30, { align: "right" });
    text(`figli per donna ${fmt(st.tfr)} · e₀ ${fmt(st.e0, 0)} anni`, W, 44, { align: "right" });
    text(`età mediana ${fmt(st.median, 0)} · over 65 ${fmt(st.old, 0)}%`, W, 58, { align: "right" });

    // piramide
    text("Uomini", W * .25, geo.pBot + 16, { align: "center" }); text("Donne", W * .75, geo.pBot + 16, { align: "center" });
    [0, 50, 100].forEach(age => text(String(age), W / 2, geo.pBot - age / 5 * SUB * geo.sy + (age ? 3 : 12), { align: "center", size: 10 }));
    const R = Math.max(1.1, geo.sy * .32);
    hoverRow = -1;
    if (P.inside && P.y > geo.pTop && P.y < geo.pBot) hoverRow = clamp(Math.floor((geo.pBot - P.y) / geo.sy / SUB), 0, AG - 1);
    for (const p of slots) {
      const on = p.k < counts[p.sex][p.a] - .35;
      const ta = on ? 1 : 0;
      const br = reduced ? 0 : Math.sin(t * .02 + p.seed) * .3;
      let ax = (p.tx - p.x) * .05, ay = (p.ty + br - p.y) * .05;
      if (!P.scrub) {
        const dx = p.x - P.x, dy = p.y - P.y, d2 = dx * dx + dy * dy;
        if (d2 < 3600) { const f = (1 - d2 / 3600) * 2.2, d = Math.sqrt(d2) || 1; ax += dx / d * f; ay += dy / d * f; }
      }
      p.vx = (p.vx + ax) * .8; p.vy = (p.vy + ay) * .8; p.x += p.vx; p.y += p.vy;
      p.al += (ta - p.al) * .12;
      if (p.al < .03) continue;
      ctx.globalAlpha = p.al * (hoverRow >= 0 && hoverRow !== p.a ? .35 : 1);
      ctx.fillStyle = p.sex === "f" ? C.accent : C.ink;
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (hoverRow >= 0) {
      const lab = hoverRow === AG - 1 ? "100+" : `${hoverRow * 5}–${hoverRow * 5 + 4}`;
      const y = geo.pBot - hoverRow * SUB * geo.sy - geo.sy;
      const sm = st.m[hoverRow] / st.total * 100, sf = st.f[hoverRow] / st.total * 100;
      text(`${lab} anni`, W / 2, y - 6, { align: "center", color: C.ink, weight: 600 });
      text(`${fmt(sm)}%`, 4, y, { color: C.ink, weight: 500 }); text(`${fmt(sf)}%`, W - 4, y, { align: "right", color: C.accent, weight: 500 });
    }

    // grafico della transizione
    const s = S.series, top = 52;
    ctx.fillStyle = alpha(C.ink, .035); ctx.fillRect(X(TODAY), geo.cTop - 6, geo.cR - X(TODAY), geo.cBot - geo.cTop + 6);
    text("proiezione", geo.cR - 2, geo.cTop + 4, { align: "right", size: 9.5 });
    // area tra le curve (crescita naturale) — fino all'anno corrente
    const pts = []; for (let y = D.Y0; y <= D.Y1; y += 1) pts.push(y);
    const val = (y, k) => RATES[y][k];
    const lim = year;
    ctx.beginPath();
    pts.filter(y => y <= lim).forEach((y, i) => i ? ctx.lineTo(X(y), Yr(val(y, "cbr"), top)) : ctx.moveTo(X(y), Yr(val(y, "cbr"), top)));
    pts.filter(y => y <= lim).reverse().forEach(y => ctx.lineTo(X(y), Yr(val(y, "cdr"), top)));
    ctx.fillStyle = alpha(C.accent, .14); ctx.fill();
    // curve complete (tenui) + punti fino all'anno corrente
    for (const [k, col] of [["cbr", C.accent], ["cdr", BLUE]]) {
      ctx.strokeStyle = alpha(col, .25); ctx.lineWidth = 1; ctx.beginPath();
      pts.forEach((y, i) => i ? ctx.lineTo(X(y), Yr(val(y, k), top)) : ctx.moveTo(X(y), Yr(val(y, k), top)));
      ctx.stroke();
      ctx.fillStyle = col;
      for (let y = D.Y0; y <= lim; y += 2) { ctx.beginPath(); ctx.arc(X(y), Yr(val(y, k), top), 1.9, 0, 6.2832); ctx.fill(); }
    }
    // assi
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(geo.cL, geo.cTop - 6); ctx.lineTo(geo.cL, geo.cBot); ctx.lineTo(geo.cR, geo.cBot); ctx.stroke();
    [1950, 2000, 2050, 2100].forEach(y => text(String(y), X(y), geo.cBot + 14, { align: y === 2100 ? "right" : y === 1950 ? "left" : "center", size: 10 }));
    [0, 25, 50].forEach(v => text(String(v), geo.cL - 5, Yr(v, top) + 3, { align: "right", size: 9.5 }));
    text("‰", geo.cL - 5, geo.cTop - 8, { align: "right", size: 9.5 });
    // cursore
    const cx = X(year);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, geo.cTop - 10); ctx.lineTo(cx, geo.cBot); ctx.stroke();
    [["cbr", C.accent], ["cdr", BLUE]].forEach(([k, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, Yr(st[k], top), 4, 0, 6.2832); ctx.fill(); });
    text(`● natalità ${fmt(st.cbr, 0)}‰`, 0, geo.cTop - 22, { color: C.accent, weight: 500 });
    text(`● mortalità ${fmt(st.cdr, 0)}‰`, geo.cL + 132, geo.cTop - 22, { color: BLUE, weight: 500 });
    text("Fase " + phase(st), 0, geo.cTop - 40, { color: C.ink, size: W < 480 ? 9.5 : 11, weight: 500 });

    // avanzamento
    if (playing && !P.scrub) {
      if (year >= D.Y1) { hold += dt; if (hold > 2200) { hold = 0; year = D.Y0; } }
      else year = Math.min(D.Y1, year + dt / 1000 * 11);
    }
    updateBtn();
  }

  /* ---------- UI: Paesi, play, scrub ---------- */
  const tabs = document.getElementById("figTabs"), playBtn = document.getElementById("figPlay");
  tabs.innerHTML = ORDER.map(k => `<button role="tab" data-k="${k}">${D.COUNTRIES[k].name}</button>`).join("");
  const btns = [...tabs.querySelectorAll("button")];
  function refreshText() {
    document.getElementById("figDesc").textContent = NOTES[key];
    btns.forEach(b => b.setAttribute("aria-selected", b.dataset.k === key));
    cv.setAttribute("aria-label", `Piramide delle età e transizione demografica: ${D.COUNTRIES[key].name}, 1950–2100. ${NOTES[key]}`);
  }
  function setCountry(k) {
    if (k === key) return;
    key = k; try { localStorage.setItem("tb-country", k); } catch (e) {}
    slots.forEach(p => { p.vy -= Math.random() * 6; });
    buildSlots(); refreshText();
    if (!P.scrub) { year = D.Y0; playing = true; hold = 0; }
  }
  btns.forEach(b => b.addEventListener("click", () => setCountry(b.dataset.k)));
  tabs.addEventListener("keydown", e => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const i = (ORDER.indexOf(key) + (e.key === "ArrowRight" ? 1 : -1) + ORDER.length) % ORDER.length;
    btns[i].focus(); setCountry(ORDER[i]);
  });
  let lastPlaying = null;
  function updateBtn() {
    if (lastPlaying === playing) return; lastPlaying = playing;
    playBtn.setAttribute("aria-label", playing ? "Pausa" : "Riproduci");
    playBtn.innerHTML = playing
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>Pausa'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>Riproduci';
  }
  playBtn.addEventListener("click", () => { if (!playing && year >= D.Y1) year = D.Y0; playing = !playing; hold = 0; });

  const pos = e => { const r = cv.getBoundingClientRect(); P.x = e.clientX - r.left; P.y = e.clientY - r.top; };
  const inChart = () => P.y > geo.cTop - 30 && P.x >= geo.cL - 10;
  const scrubTo = () => { year = clamp(D.Y0 + (P.x - geo.cL) / (geo.cR - geo.cL) * (D.Y1 - D.Y0), D.Y0, D.Y1); };
  cv.addEventListener("pointermove", e => {
    pos(e); P.inside = true;
    if (P.scrub) scrubTo();
    cv.style.cursor = inChart() ? "ew-resize" : "pointer";
  });
  cv.addEventListener("pointerleave", () => { P.inside = false; P.x = P.y = -999; });
  cv.addEventListener("pointerdown", e => {
    pos(e);
    if (inChart()) { P.scrub = true; playing = false; scrubTo(); cv.setPointerCapture(e.pointerId); }
  });
  cv.addEventListener("pointerup", e => {
    pos(e);
    if (P.scrub) { P.scrub = false; return; }
    if (!playing && year >= D.Y1) year = D.Y0;
    playing = !playing; hold = 0;
  });

  /* ---------- ciclo ---------- */
  let running = true, last = performance.now();
  function frame(now) {
    if (!running) return;
    const dt = Math.min(50, now - last); last = now;
    ctx.clearRect(0, 0, W, H);
    draw(dt);
    requestAnimationFrame(frame);
  }
  new IntersectionObserver(([e]) => {
    const was = running; running = e.isIntersecting;
    if (running && !was) { last = performance.now(); requestAnimationFrame(frame); }
  }).observe(cv);
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(layout, 150); });

  layout(); refreshText();
  if (reduced) year = TODAY;
  requestAnimationFrame(frame);
})();
