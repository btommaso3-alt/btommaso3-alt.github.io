/* =========================================================================
   Tommaso Baldini · portfolio
   - Piramide di particelle (hero)
   - Progetti in 4 modalità: Timeline, Grafo, Indice, Mappa
   - Drawer off-canvas, tooltip, filtri, UI di contorno
   ========================================================================= */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const TODAY = new Date();
  d3.timeFormatDefaultLocale({
    dateTime: "%A %e %B %Y, %X", date: "%d/%m/%Y", time: "%H:%M:%S", periods: ["AM", "PM"],
    days: ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"],
    shortDays: ["dom", "lun", "mar", "mer", "gio", "ven", "sab"],
    months: ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"],
    shortMonths: ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"]
  });
  const toDate = s => { const [y, m] = s.split("-").map(Number); return new Date(y, m - 1, 1); };
  const endDate = p => p.end ? new Date(toDate(p.end).getFullYear(), toDate(p.end).getMonth() + 1, 0) : TODAY;
  const midDate = p => new Date((toDate(p.start).getTime() + endDate(p).getTime()) / 2);
  const color = p => THEMES[p.theme].color;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Ordine "editoriale": più recenti prima, tesi in corso in testa
  const ORDERED = [...PROJECTS].sort((a, b) => endDate(b) - endDate(a) || toDate(b.start) - toDate(a.start));
  const THEME_KEYS = Object.keys(THEMES);
  const active = new Set(THEME_KEYS);
  const isOn = p => active.has(p.theme);

  /* ---------------------------------------------------------------------
     UI di contorno
     --------------------------------------------------------------------- */
  $("#year").textContent = TODAY.getFullYear();

  // Tema chiaro/scuro
  const root = document.documentElement;
  const sysDark = window.matchMedia("(prefers-color-scheme: dark)");
  const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : sysDark.matches;
  $("#themeToggle").addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    root.dataset.theme = next; store.set("tb-theme", next);
    document.dispatchEvent(new Event("themechange"));
  });
  sysDark.addEventListener?.("change", () => document.dispatchEvent(new Event("themechange")));

  // Reveal allo scroll
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  $$(".reveal").forEach(el => io.observe(el));

  // Nav: nascondi scendendo, mostra salendo; progress bar; link attivo
  const nav = $("#nav"), bar = $("#progress");
  let lastY = scrollY;
  const sections = $$("main section[id]");
  const onScroll = () => {
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    nav.classList.toggle("hide", y > lastY && y > 300 && !document.getElementById("drawer").classList.contains("on"));
    lastY = y;
    let cur = "";
    sections.forEach(s => { if (s.getBoundingClientRect().top < innerHeight * 0.4) cur = s.id; });
    $$(".nav nav a").forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + cur));
  };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  // CTA: riempimento che parte dal punto del mouse + effetto magnetico
  const cta = $("#cta");
  cta.addEventListener("pointermove", e => {
    const r = cta.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    cta.style.setProperty("--mx", x + "px"); cta.style.setProperty("--my", y + "px");
    if (!reduced) cta.style.transform = `translate(${(x - r.width / 2) * 0.12}px, ${(y - r.height / 2) * 0.25}px)`;
  });
  cta.addEventListener("pointerleave", () => { cta.style.transform = ""; });

  /* ---------------------------------------------------------------------
     Tooltip
     --------------------------------------------------------------------- */
  const tip = $("#tooltip");
  function showTip(p, ev) {
    tip.innerHTML = `<b>${esc(p.title)}</b>
      <div class="tt-row"><span>Periodo</span><span>${esc(p.period)}</span></div>
      <div class="tt-row"><span>Corso</span><span>${esc(p.course)}</span></div>
      <div class="tt-row"><span>Contesto</span><span>${esc(DEGREES[p.degree])}</span></div>
      <div class="tt-cta">Clicca per aprire →</div>`;
    tip.hidden = false; moveTip(ev);
  }
  function moveTip(ev) {
    const w = tip.offsetWidth;
    const x = Math.min(Math.max(ev.clientX, w / 2 + 10), innerWidth - w / 2 - 10);
    let y = ev.clientY;
    tip.style.transform = y - tip.offsetHeight - 24 < 0 ? "translate(-50%, 18px)" : "";
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  const hideTip = () => { tip.hidden = true; };

  /* ---------------------------------------------------------------------
     Drawer
     --------------------------------------------------------------------- */
  const drawer = $("#drawer"), scrim = $("#scrim");
  let current = null, lastFocus = null;
  const ICON = { pdf: "PDF", doc: "DOCX", code: "R" };
  function openDrawer(p) {
    current = p; hideTip();
    drawer.style.setProperty("--c", color(p));
    $("#d-dot").style.background = color(p);
    $("#d-theme").textContent = THEMES[p.theme].label;
    $("#d-title").textContent = p.title;
    $("#d-kpi").textContent = p.kpi;
    $("#d-kpiLabel").textContent = p.kpiLabel;
    $("#d-period").textContent = p.period;
    $("#d-course").textContent = p.course;
    $("#d-degree").textContent = DEGREES[p.degree];
    $("#d-objective").textContent = p.objective;
    $("#d-kind").textContent = p.kind;
    $("#d-team").textContent = p.team;
    $("#d-data").textContent = p.data;
    $("#d-strategy").innerHTML = p.strategy.map(s => `<li><b>${esc(s.t)}</b><span>${esc(s.d)}</span></li>`).join("");
    $("#d-methods").innerHTML = p.methods.map(m => `<li>${esc(m)}</li>`).join("");
    $("#d-software").innerHTML = p.software.map(m => `<li>${esc(m)}</li>`).join("");
    $("#d-softwareWrap").hidden = !p.software.length;
    $("#d-results").innerHTML =
      `<div class="findings">${p.results.map(r => typeof r === "string" ? `<div class="finding wide"><p>${esc(r)}</p></div>`
        : `<div class="finding${r.n ? "" : " wide"}">${r.n ? `<span class="f-n">${esc(r.n)}</span>` : ""}<p>${esc(r.t)}</p></div>`).join("")}</div>` +
      (p.figures ? p.figures.map(f => `<figure class="d-fig"><img src="${esc(f.src)}" alt="${esc(f.cap)}" loading="lazy"><figcaption>${esc(f.cap)}</figcaption></figure>`).join("") : "") +
      (p.role ? `<div class="d-note d-role"><b>Il mio contributo</b><p>${esc(p.role)}</p></div>` : "") +
      (p.limits ? `<div class="d-note"><b>Limiti</b><p>${esc(p.limits)}</p></div>` : "");
    $("#d-links").innerHTML = p.links.length
      ? p.links.map(l => `<a class="btn-dl" href="${esc(l.href)}" ${l.kind === "code" ? "download" : 'target="_blank" rel="noopener"'}>
          <span>${esc(l.label)}</span><small>${ICON[l.kind] || ""} <span class="arr">↓</span></small></a>`).join("")
      : `<p class="d-pending">${p.end ? "Il materiale di questo progetto non è disponibile online." : "Lavoro in corso: report e codice arriveranno qui."}</p>`;
    // restart delle animazioni in ingresso
    const body = $("#drawerBody"); body.scrollTop = 0;
    if (drawer.classList.contains("on")) { drawer.classList.remove("on"); void drawer.offsetWidth; }
    if (!lastFocus) lastFocus = document.activeElement;
    drawer.classList.add("on"); scrim.classList.add("on");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => $("#d-close").focus({ preventScroll: true }), 50);
    highlight(p.id);
  }
  function closeDrawer() {
    drawer.classList.remove("on"); scrim.classList.remove("on");
    drawer.setAttribute("aria-hidden", "true"); document.body.style.overflow = "";
    current = null; highlight(null);
    if (lastFocus) { lastFocus.focus?.({ preventScroll: true }); lastFocus = null; }
  }
  function step(dir) {
    if (!current) return;
    const list = ORDERED.filter(isOn);
    const i = list.indexOf(current);
    openDrawer(list[(i + dir + list.length) % list.length]);
  }
  $("#d-close").addEventListener("click", closeDrawer);
  scrim.addEventListener("click", closeDrawer);
  $("#d-prev").addEventListener("click", () => step(-1));
  $("#d-next").addEventListener("click", () => step(1));
  addEventListener("keydown", e => {
    if (!drawer.classList.contains("on")) return;
    if (e.key === "Escape") closeDrawer();
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "Tab") { // focus trap
      const f = $$("button, a[href]", drawer); const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------------------------------------------------------------------
     Filtri
     --------------------------------------------------------------------- */
  const filtersEl = $("#filters");
  function renderFilters() {
    const count = k => PROJECTS.filter(p => p.theme === k).length;
    const allOn = active.size === THEME_KEYS.length;
    filtersEl.innerHTML =
      `<button class="chip ${allOn ? "" : "off"}" data-k="*" style="--c:var(--ink)" aria-pressed="${allOn}"><i></i>Tutti <span class="n">${PROJECTS.length}</span></button>` +
      THEME_KEYS.map(k => `<button class="chip ${active.has(k) ? "" : "off"}" data-k="${k}" style="--c:${THEMES[k].color}" aria-pressed="${active.has(k)}">
        <i></i>${THEMES[k].label} <span class="n">${count(k)}</span></button>`).join("");
  }
  filtersEl.addEventListener("click", e => {
    const b = e.target.closest(".chip"); if (!b) return;
    const k = b.dataset.k;
    if (k === "*") THEME_KEYS.forEach(t => active.add(t));
    else if (active.size === THEME_KEYS.length) { active.clear(); active.add(k); }   // primo click: isola il tema
    else if (active.has(k)) { active.delete(k); if (!active.size) THEME_KEYS.forEach(t => active.add(t)); }
    else active.add(k);
    renderFilters(); view?.filter();
  });
  renderFilters();

  /* ---------------------------------------------------------------------
     Modalità
     --------------------------------------------------------------------- */
  const viz = $("#viz"), stageNote = $("#stageNote");
  const MODES = {
    timeline: { render: renderTimeline, note: "Asse del tempo · una corsia per tema · trascina i punti, si rimettono al loro posto" },
    graph: { render: renderGraph, note: "Cluster per tema · archi = temi o metodi in comune · trascina i nodi" },
    index: { render: renderIndex, note: "Elenco dal più recente · passa sopra un titolo per il dato chiave" },
    map: { render: renderMap, note: "Dove si colloca ogni progetto: dal descrivere al prevedere, dalle persone ai sistemi" }
  };
  let mode = store.get("tb-mode");
  if (!MODES[mode]) mode = innerWidth < 640 ? "index" : "timeline";
  let view = null;

  const modeBtns = $$("#modes button"), ink = $("#modesInk");
  function moveInk() {
    const b = modeBtns.find(b => b.dataset.mode === mode);
    ink.style.width = b.offsetWidth + "px";
    ink.style.transform = `translateX(${b.offsetLeft}px)`;
  }
  function setMode(m, instant) {
    mode = m; store.set("tb-mode", m);
    modeBtns.forEach(b => b.setAttribute("aria-selected", b.dataset.mode === m));
    moveInk();
    stageNote.textContent = MODES[m].note;
    const go = () => { view?.destroy(); viz.innerHTML = ""; hideTip(); view = MODES[m].render(); viz.classList.remove("fading"); };
    if (instant || reduced) go(); else { viz.classList.add("fading"); setTimeout(go, 300); }
  }
  modeBtns.forEach(b => b.addEventListener("click", () => b.dataset.mode !== mode && setMode(b.dataset.mode)));
  $("#modes").addEventListener("keydown", e => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const i = modeBtns.findIndex(b => b.dataset.mode === mode);
    const n = modeBtns[(i + (e.key === "ArrowRight" ? 1 : -1) + 4) % 4];
    n.focus(); setMode(n.dataset.mode);
  });

  let lastW = viz.clientWidth, rz;
  addEventListener("resize", () => {
    clearTimeout(rz);
    rz = setTimeout(() => { moveInk(); if (Math.abs(viz.clientWidth - lastW) > 30) { lastW = viz.clientWidth; setMode(mode, true); } }, 200);
  });

  function highlight(id) { view?.highlight?.(id); }

  // Ferma la fisica quando la sezione non è visibile
  let stageVisible = false;
  new IntersectionObserver(([e]) => { stageVisible = e.isIntersecting; view?.visibility?.(stageVisible); }, { threshold: 0.25 }).observe($("#stage"));

  /* ----- helper comuni per le modalità SVG ----- */
  function makeSvg() {
    const W = viz.clientWidth, H = viz.clientHeight;
    const svg = d3.select(viz).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img");
    return { svg, W, H, small: W < 640 };
  }
  function bindNode(sel) {
    sel.attr("tabindex", 0).attr("role", "button").attr("aria-label", d => `${d.p.title}, ${d.p.period}`)
      .on("pointerenter", (e, d) => { if (e.pointerType !== "touch") showTip(d.p, e); })
      .on("pointermove", (e) => { if (!tip.hidden) moveTip(e); })
      .on("pointerleave", hideTip)
      .on("click", (e, d) => { if (!d.dragged) openDrawer(d.p); d.dragged = false; })
      .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDrawer(d.p); } });
  }
  function dragFor(sim) {
    return d3.drag()
      .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.25).restart(); d.fx = d.x; d.fy = d.y; d.dragged = false; hideTip(); })
      .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; d.dragged = true; })
      .on("end", (e, d) => { if (!e.active) sim.alphaTarget(sim._idle || 0); d.fx = null; d.fy = null; });
  }
  function nodeGroup(g, nodes, r) {
    const n = g.selectAll("g.node").data(nodes, d => d.id).join("g")
      .attr("class", d => "node" + (d.p.end ? "" : " ongoing"))
      .style("--c", d => color(d.p));
    n.append("circle").attr("class", "halo").attr("r", d => (d.r || r) + 9).attr("fill", d => color(d.p));
    n.append("circle").attr("class", "dot").attr("r", d => d.r || r).attr("fill", d => color(d.p));
    bindNode(n);
    return n;
  }
  function applyDim(nodeSel, extra) {
    nodeSel.classed("dim", d => !isOn(d.p)).style("pointer-events", d => isOn(d.p) ? null : "none");
    extra?.();
  }
  function wiggle(strength) { // piccola forza per far "fluttuare" i nodi
    let nodes = [], t = 0;
    const f = () => { t += 0.012; nodes.forEach((d, i) => { d.vx += Math.sin(t + i * 1.7) * strength; d.vy += Math.cos(t * 0.9 + i * 2.3) * strength; }); };
    f.initialize = n => { nodes = n; };
    return f;
  }

  /* ---------------------------------------------------------------------
     1) TIMELINE
     --------------------------------------------------------------------- */
  function renderTimeline() {
    const { svg, W, H, small } = makeSvg();
    const m = small ? { l: 14, r: 14, t: 40, b: 40 } : { l: 170, r: 40, t: 34, b: 46 };
    const x = d3.scaleTime().domain([new Date(2024, 8, 1), new Date(2026, 11, 31)]).range([m.l, W - m.r]);
    const laneH = (H - m.t - m.b) / THEME_KEYS.length;
    const laneY = k => m.t + THEME_KEYS.indexOf(k) * laneH + laneH / 2 + (small ? 8 : 0);
    const R = small ? 8 : 10;

    // corsie
    const lanes = svg.append("g");
    THEME_KEYS.forEach((k, i) => {
      if (i % 2 === 0) lanes.append("rect").attr("class", "lane-bg").attr("x", 0).attr("width", W).attr("y", m.t + i * laneH).attr("height", laneH);
      lanes.append("text").attr("class", "lane-label")
        .attr("x", small ? m.l : 24).attr("y", small ? m.t + i * laneH + 15 : laneY(k) + 4)
        .text(THEMES[k].label).attr("fill", THEMES[k].color);
      if (!small) lanes.append("circle").attr("cx", 14).attr("cy", laneY(k)).attr("r", 3.5).attr("fill", THEMES[k].color);
    });
    // griglia anni
    const ticks = x.ticks(d3.timeMonth.every(small ? 6 : 3));
    svg.append("g").selectAll("line").data(ticks).join("line").attr("class", "grid-line")
      .attr("x1", d => x(d)).attr("x2", d => x(d)).attr("y1", m.t).attr("y2", H - m.b);
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`)
      .call(d3.axisBottom(x).tickValues(ticks).tickSize(6).tickFormat(d => d.getMonth() === 0 ? d3.timeFormat("%Y")(d) : d3.timeFormat("%b")(d).replace(/^./, c => c.toUpperCase())))
      .call(g => g.select(".domain").remove());
    // oggi
    svg.append("line").attr("class", "today-line").attr("x1", x(TODAY)).attr("x2", x(TODAY)).attr("y1", m.t - 10).attr("y2", H - m.b);
    svg.append("text").attr("class", "today-label").attr("x", x(TODAY)).attr("y", m.t - 14).attr("text-anchor", "middle").text("oggi");

    const nodes = PROJECTS.map(p => ({
      id: p.id, p, tx: x(midDate(p)), ty: laneY(p.theme),
      x: x(midDate(p)) + (Math.random() - .5) * 40, y: -20 - Math.random() * 200
    }));
    const ranges = svg.append("g").selectAll("line").data(nodes).join("line")
      .attr("class", "range").attr("stroke", d => color(d.p)).attr("stroke-dasharray", d => d.p.end ? null : "3 4");
    const g = svg.append("g");
    const node = nodeGroup(g, nodes, R);
    const label = node.append("text").attr("x", R + 7).attr("y", 4).text(d => d.p.short).style("opacity", 0);

    const sim = d3.forceSimulation(nodes)
      .force("x", d3.forceX(d => d.tx).strength(0.6))
      .force("y", d3.forceY(d => d.ty).strength(0.18))
      .force("c", d3.forceCollide(R + 3).iterations(2))
      .alphaDecay(0.025)
      .on("tick", () => {
        nodes.forEach(d => { d.y = Math.max(m.t + R, Math.min(H - m.b - R, d.y)); });
        node.attr("transform", d => `translate(${d.x},${d.y})`);
        ranges.attr("x1", d => x(toDate(d.p.start))).attr("x2", d => x(endDate(d.p))).attr("y1", d => d.y).attr("y2", d => d.y);
      })
      .on("end", placeLabels);
    node.call(dragFor(sim));
    // i punti "cadono" al loro posto quando la sezione entra in vista
    let started = false;
    let lblT;
    const start = () => { started = true; sim.alpha(1).restart(); clearTimeout(lblT); lblT = setTimeout(placeLabels, 1600); };
    if (reduced) { sim.stop(); for (let i = 0; i < 300; i++) sim.tick(); sim.on("tick")(); placeLabels(); started = true; }
    else if (stageVisible) start(); else sim.stop();

    // etichette: a destra del punto, nascoste se si sovrappongono
    function placeLabels() {
      const boxes = [];
      const sorted = [...nodes].sort((a, b) => a.x - b.x);
      sorted.forEach(d => {
        const w = d.p.short.length * 6.7 + 10;
        let side = 1;
        let b = { x1: d.x + R + 4, x2: d.x + R + 4 + w, y1: d.y - 9, y2: d.y + 9 };
        const hit = bb => boxes.some(o => bb.x1 < o.x2 && bb.x2 > o.x1 && bb.y1 < o.y2 && bb.y2 > o.y1) ||
          nodes.some(n => n !== d && n.x + R > bb.x1 && n.x - R < bb.x2 && n.y + R > bb.y1 && n.y - R < bb.y2) || bb.x2 > W - 4 || bb.x1 < (small ? 2 : m.l - 10);
        if (hit(b)) { side = -1; b = { x1: d.x - R - 4 - w, x2: d.x - R - 4, y1: d.y - 9, y2: d.y + 9 }; }
        d.labelOn = !hit(b); d.side = side;
        if (d.labelOn) boxes.push(b);
      });
      label.attr("x", d => d.side > 0 ? R + 7 : -R - 7).attr("text-anchor", d => d.side > 0 ? "start" : "end")
        .transition().duration(500).style("opacity", d => d.labelOn && isOn(d.p) ? 1 : 0);
    }
    node.on("pointerenter.lbl", (e, d) => label.filter(n => n === d).style("opacity", 1))
      .on("pointerleave.lbl", (e, d) => label.filter(n => n === d).style("opacity", d.labelOn && isOn(d.p) ? 1 : 0));

    const filter = () => applyDim(node, () => {
      ranges.classed("dim", d => !isOn(d.p));
      label.style("opacity", d => d.labelOn && isOn(d.p) ? 1 : 0);
    });
    filter();
    return {
      filter, destroy: () => sim.stop(),
      highlight: id => node.classed("focus", d => d.id === id),
      visibility: v => { if (v && !started) start(); else if (!v && sim.alpha() < 0.05) sim.stop(); }
    };
  }

  /* ---------------------------------------------------------------------
     2) GRAFO
     --------------------------------------------------------------------- */
  function renderGraph() {
    const { svg, W, H, small } = makeSvg();
    const cx = W / 2, cy = H / 2 + 6;
    const ring = Math.min(W, H) * (small ? 0.3 : 0.31);
    const centers = {};
    THEME_KEYS.forEach((k, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / THEME_KEYS.length;
      centers[k] = { x: cx + Math.cos(a) * ring * (W > H ? 1.35 : 1), y: cy + Math.sin(a) * ring, a };
    });
    const deg = {}; LINKS.forEach(([a, b]) => { deg[a] = (deg[a] || 0) + 1; deg[b] = (deg[b] || 0) + 1; });
    const nodes = PROJECTS.map(p => ({ id: p.id, p, r: (small ? 6 : 8) + Math.min(deg[p.id] || 0, 5) * 1.6, x: centers[p.theme].x + (Math.random() - .5) * 60, y: centers[p.theme].y + (Math.random() - .5) * 60 }));
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    const links = LINKS.map(([s, t, why]) => ({ source: byId[s], target: byId[t], why }));

    const clabels = svg.append("g").selectAll("text").data(THEME_KEYS).join("text")
      .attr("class", "cluster-label").attr("text-anchor", "middle").attr("fill", k => THEMES[k].color).text(k => THEMES[k].label)
      .style("font-size", small ? "16px" : null);
    const edge = svg.append("g").selectAll("line").data(links).join("line").attr("class", "edge");
    const node = nodeGroup(svg.append("g"), nodes);
    node.append("text").attr("text-anchor", "middle").attr("y", d => d.r + 16).text(d => d.p.short).style("font-size", small ? "11px" : null);

    const pad = 30;
    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).distance(d => d.source.p.theme === d.target.p.theme ? 70 : 150).strength(0.12))
      .force("charge", d3.forceManyBody().strength(small ? -160 : -320))
      .force("x", d3.forceX(d => centers[d.p.theme].x).strength(0.11))
      .force("y", d3.forceY(d => centers[d.p.theme].y).strength(0.11))
      .force("collide", d3.forceCollide(d => d.r + (small ? 16 : 30)).iterations(2))
      .force("wiggle", reduced ? null : wiggle(0.03))
      .alphaTarget(reduced ? 0 : 0.012)
      .on("tick", () => {
        nodes.forEach(d => { d.x = Math.max(pad, Math.min(W - pad, d.x)); d.y = Math.max(pad + 20, Math.min(H - pad - 10, d.y)); });
        edge.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        node.attr("transform", d => `translate(${d.x},${d.y})`);
        clabels.each(function (k) {
          const ns = nodes.filter(n => n.p.theme === k); if (!ns.length) return;
          const mx = d3.mean(ns, n => n.x), minY = d3.min(ns, n => n.y - n.r), maxY = d3.max(ns, n => n.y + n.r);
          const above = centers[k].y <= cy;
          const y = above ? minY - 18 : maxY + 42;
          d3.select(this).attr("x", Math.max(70, Math.min(W - 70, mx))).attr("y", Math.max(22, Math.min(H - 8, y)));
        });
      });
    sim._idle = reduced ? 0 : 0.012;
    node.call(dragFor(sim));

    // hover: accende vicini e archi
    node.on("pointerenter.hl", (e, d) => {
      const nb = new Set([d.id]);
      links.forEach(l => { if (l.source === d) nb.add(l.target.id); if (l.target === d) nb.add(l.source.id); });
      node.classed("dim", n => !nb.has(n.id) || !isOn(n.p));
      edge.classed("hot", l => l.source === d || l.target === d).classed("dim", l => !(l.source === d || l.target === d));
      const rel = links.filter(l => l.source === d || l.target === d).map(l => l.why);
      if (rel.length) stageNote.textContent = "In comune: " + [...new Set(rel)].join(" · ");
    }).on("pointerleave.hl", () => { filter(); stageNote.textContent = MODES.graph.note; });

    const filter = () => applyDim(node, () => {
      edge.classed("hot", false).classed("dim", l => !isOn(l.source.p) || !isOn(l.target.p));
      clabels.style("opacity", k => active.has(k) ? null : 0.15);
    });
    filter();
    return {
      filter, destroy: () => sim.stop(),
      highlight: id => node.classed("focus", d => d.id === id),
      visibility: v => v ? sim.alphaTarget(sim._idle).restart() : sim.stop()
    };
  }

  /* ---------------------------------------------------------------------
     3) INDICE
     --------------------------------------------------------------------- */
  function renderIndex() {
    const ul = document.createElement("ul"); ul.className = "index-list";
    viz.appendChild(ul);
    const peek = $("#peek"); let px = 0, py = 0, tx = 0, ty = 0, raf = 0, on = false;
    const loop = () => { px += (tx - px) * 0.18; py += (ty - py) * 0.18; peek.style.left = px + 18 + "px"; peek.style.top = py - 60 + "px"; raf = on ? requestAnimationFrame(loop) : 0; };
    function draw() {
      const list = ORDERED.filter(isOn);
      if (!list.length) { ul.innerHTML = `<li class="empty">Nessun progetto per questo filtro</li>`; return; }
      ul.innerHTML = list.map((p, i) => `
        <li class="index-row ${p.end ? "" : "ongoing"}" tabindex="0" role="button" data-id="${p.id}" style="--c:${color(p)};animation-delay:${Math.min(i * 45, 600)}ms">
          <span class="ix-num">${String(i + 1).padStart(2, "0")}</span>
          <span class="ix-main"><span class="ix-title">${esc(p.title)}</span><span class="ix-course">${esc(p.course)} · ${p.degree === "lm" ? "LM Padova" : "LT Bicocca"}</span></span>
          <span class="ix-theme"><i></i>${THEMES[p.theme].label}</span>
          <span class="ix-year">${p.end ? toDate(p.start).getFullYear() === toDate(p.end).getFullYear() ? toDate(p.end).getFullYear() : toDate(p.start).getFullYear() + "–" + String(toDate(p.end).getFullYear()).slice(2) : "in corso"}</span>
          <span class="ix-arrow" aria-hidden="true">→</span>
        </li>`).join("");
    }
    const byId = id => PROJECTS.find(p => p.id === id);
    ul.addEventListener("pointerover", e => {
      const row = e.target.closest(".index-row"); if (!row || e.pointerType === "touch") return;
      const p = byId(row.dataset.id);
      peek.style.setProperty("--c", color(p));
      $("#peekKpi").textContent = p.kpi; $("#peekLabel").textContent = p.kpiLabel;
      if (!on) { px = tx = e.clientX; py = ty = e.clientY; on = true; peek.classList.add("on"); raf ||= requestAnimationFrame(loop); }
    });
    ul.addEventListener("pointermove", e => { tx = e.clientX; ty = e.clientY; });
    const off = () => { on = false; peek.classList.remove("on"); };
    ul.addEventListener("pointerleave", off);
    ul.addEventListener("scroll", off, { passive: true });
    ul.addEventListener("click", e => { const row = e.target.closest(".index-row"); if (row) { off(); openDrawer(byId(row.dataset.id)); } });
    ul.addEventListener("keydown", e => { const row = e.target.closest(".index-row"); if (row && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openDrawer(byId(row.dataset.id)); } });
    draw();
    return { filter: draw, destroy: off };
  }

  /* ---------------------------------------------------------------------
     4) MAPPA tema × metodo
     --------------------------------------------------------------------- */
  function renderMap() {
    const { svg, W, H, small } = makeSvg();
    const m = small ? { l: 30, r: 20, t: 30, b: 44 } : { l: 70, r: 60, t: 40, b: 60 };
    const x = d3.scaleLinear().domain([0, 1]).range([m.l + 20, W - m.r - 20]);
    const y = d3.scaleLinear().domain([0, 1]).range([H - m.b - 20, m.t + 20]);
    const R = small ? 8 : 10;
    const defs = svg.append("defs");
    defs.append("marker").attr("id", "arr").attr("viewBox", "0 0 10 10").attr("refX", 8).attr("refY", 5).attr("markerWidth", 8).attr("markerHeight", 8).attr("orient", "auto-start-reverse")
      .append("path").attr("d", "M0,0 L10,5 L0,10 z").attr("class", "map-arrow");
    // assi
    svg.append("line").attr("class", "map-axis").attr("x1", m.l).attr("x2", W - m.r).attr("y1", H - m.b).attr("y2", H - m.b).attr("marker-end", "url(#arr)");
    svg.append("line").attr("class", "map-axis").attr("x1", m.l).attr("x2", m.l).attr("y1", H - m.b).attr("y2", m.t).attr("marker-end", "url(#arr)");
    svg.append("line").attr("class", "grid-line").attr("x1", x(0.5)).attr("x2", x(0.5)).attr("y1", m.t).attr("y2", H - m.b);
    svg.append("line").attr("class", "grid-line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(0.5)).attr("y2", y(0.5));
    const ax = svg.append("g").attr("class", "axis");
    ax.append("text").attr("x", m.l).attr("y", H - m.b + 24).text("descrivere");
    ax.append("text").attr("x", (m.l + W - m.r) / 2).attr("y", H - m.b + 24).attr("text-anchor", "middle").text("spiegare");
    ax.append("text").attr("x", W - m.r).attr("y", H - m.b + 24).attr("text-anchor", "end").text("prevedere →");
    ax.append("text").attr("transform", `translate(${m.l - 14},${H - m.b}) rotate(-90)`).text("sistemi e mercati");
    ax.append("text").attr("transform", `translate(${m.l - 14},${m.t}) rotate(-90)`).attr("text-anchor", "end").text("persone e popolazioni →");
    if (!small) {
      const q = [[0.02, 0.98, "start", "RACCONTARE LE POPOLAZIONI"], [0.98, 0.98, "end", "PREVEDERE PER LE PERSONE"], [0.02, 0.02, "start", "MISURARE LE ISTITUZIONI"], [0.98, 0.02, "end", "PREVEDERE I MERCATI"]];
      svg.append("g").selectAll("text").data(q).join("text").attr("class", "quad-label")
        .attr("x", d => x(d[0])).attr("y", d => y(d[1]) + (d[1] > .5 ? -6 : 14)).attr("text-anchor", d => d[2]).text(d => d[3]);
    }
    const guides = svg.append("g").style("pointer-events", "none");
    const nodes = PROJECTS.map(p => ({ id: p.id, p, tx: x(p.map.x), ty: y(p.map.y), x: x(0.5), y: y(0.5) }));
    const node = nodeGroup(svg.append("g"), nodes, R);
    node.append("text").attr("x", d => d.p.map.x > 0.78 ? -R - 7 : R + 7).attr("y", 4)
      .attr("text-anchor", d => d.p.map.x > 0.78 ? "end" : "start").text(d => d.p.short).style("font-size", small ? "10.5px" : null);
    const sim = d3.forceSimulation(nodes)
      .force("x", d3.forceX(d => d.tx).strength(0.3))
      .force("y", d3.forceY(d => d.ty).strength(0.3))
      .force("c", d3.forceCollide(R + 6))
      .force("wiggle", reduced ? null : wiggle(0.012))
      .alphaTarget(reduced ? 0 : 0.01)
      .on("tick", () => node.attr("transform", d => `translate(${d.x},${d.y})`));
    sim._idle = reduced ? 0 : 0.01;
    node.call(dragFor(sim));
    node.on("pointerenter.g", (e, d) => {
      guides.selectAll("*").remove();
      guides.append("line").attr("class", "grid-line").attr("x1", d.x).attr("x2", d.x).attr("y1", d.y).attr("y2", H - m.b).style("stroke", color(d.p)).style("opacity", .7);
      guides.append("line").attr("class", "grid-line").attr("x1", m.l).attr("x2", d.x).attr("y1", d.y).attr("y2", d.y).style("stroke", color(d.p)).style("opacity", .7);
    }).on("pointerleave.g", () => guides.selectAll("*").remove());
    const filter = () => applyDim(node);
    filter();
    return {
      filter, destroy: () => sim.stop(),
      highlight: id => node.classed("focus", d => d.id === id),
      visibility: v => v ? sim.alphaTarget(sim._idle).restart() : sim.stop()
    };
  }

  // Avvio
  requestAnimationFrame(() => setMode(mode, true));
})();
