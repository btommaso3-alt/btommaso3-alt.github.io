/* ==========================================================
   1. DATI  (qui modifichi i tuoi progetti)
   ========================================================== */
const GROUPS = {
  sociale:    { label: "Statistica Sociale", color: "#2E6FBA" },
  demografia: { label: "Demografia",         color: "#A23B5A" },
  datamining: { label: "Data Mining",        color: "#2F8F6B" },
  ml:         { label: "Machine Learning",   color: "#C77D12" }
};

const PROJECTS = [
  {
    id: "ipog", label: "Indice IPOG", group: "sociale",
    date: "Gen 2025 – Mar 2025", place: "Università di Milano-Bicocca",
    abstract: "Placeholder: costruzione di un indice composito e analisi della sua distribuzione sul territorio. Sostituisci con 3-4 righe su obiettivo, dati e risultati principali.",
    tags: ["R", "Indici compositi", "Statistica sociale"],
    pdf: "assets/reports/ipog.pdf", repo: "https://github.com/TUO-USERNAME/indice-ipog"
  },
  {
    id: "oltre-lo-specchio", label: "Oltre lo Specchio", group: "datamining",
    date: "Ott 2025 – Dic 2025", place: "Università di Padova",
    abstract: "Placeholder: progetto di data mining su dati reali, dal preprocessing alla selezione del modello. Descrivi il problema, le variabili chiave e il risultato.",
    tags: ["R", "Preprocessing", "Data mining"],
    pdf: "assets/reports/oltre-lo-specchio.pdf", repo: "https://github.com/TUO-USERNAME/oltre-lo-specchio"
  },
  {
    id: "car-claims", label: "Car Claims", group: "ml",
    date: "Nov 2025 – Gen 2026", place: "Università di Padova",
    abstract: "Placeholder: modelli predittivi sui sinistri auto, con confronto tra metodi di classificazione e valutazione out-of-sample.",
    tags: ["Python", "Classificazione", "Valutazione modelli"],
    pdf: "assets/reports/car-claims.pdf", repo: "https://github.com/TUO-USERNAME/car-claims"
  },
  {
    id: "nigeria", label: "Transizione Demografica Nigeria", group: "demografia",
    date: "Mag 2025 – Lug 2025", place: "Progetto personale",
    abstract: "Placeholder: analisi della transizione demografica della Nigeria tra fecondità, mortalità e struttura per età.",
    tags: ["Demografia", "Python", "Data viz"],
    pdf: "assets/reports/nigeria.pdf", repo: "https://github.com/TUO-USERNAME/transizione-nigeria"
  },
  {
    id: "atlas", label: "Atlas of Decline", group: "demografia",
    date: "In corso", place: "Progetto personale",
    abstract: "Placeholder: mappa interattiva dello spopolamento delle aree interne italiane, con un indice di declino demografico.",
    tags: ["Aree interne", "Mappe", "JavaScript"],
    pdf: "", repo: "https://github.com/TUO-USERNAME/atlas-of-decline"
  }
];

// Collegamenti tra progetti affini (linee tratteggiate)
const RELATED = [
  ["ipog", "nigeria"], ["ipog", "atlas"], ["nigeria", "atlas"], ["oltre-lo-specchio", "car-claims"]
];

/* ==========================================================
   2. GRAFO (D3 force simulation)
   ========================================================== */
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const host = document.getElementById("graph");
const tip = document.getElementById("tooltip");
const svg = d3.select(host).append("svg").attr("role", "group").attr("aria-label", "Grafo dei progetti per tema");
const gLinks = svg.append("g");
const gNodes = svg.append("g");

const hubs = Object.keys(GROUPS).map(k => ({ id: "hub:" + k, hub: true, group: k, label: GROUPS[k].label }));
const projects = PROJECTS.map(p => ({ ...p }));
const nodes = [...hubs, ...projects];
const links = [
  ...projects.map(p => ({ source: p.id, target: "hub:" + p.group, kind: "hub" })),
  ...RELATED.map(([a, b]) => ({ source: a, target: b, kind: "rel" }))
];

const R = 15;
let W = 0, H = 0, activeGroup = null, hoverId = null, pointer = null;

const linkSel = gLinks.selectAll("line").data(links).join("line")
  .attr("class", d => "link " + d.kind);

const nodeSel = gNodes.selectAll("g").data(nodes).join("g")
  .attr("class", d => "node" + (d.hub ? " hub" : ""))
  .attr("tabindex", 0)
  .attr("role", "button")
  .attr("aria-label", d => d.hub ? "Filtra per " + d.label : "Apri progetto " + d.label);

nodeSel.append("circle").attr("class", "halo")
  .attr("r", d => d.hub ? 14 : R + 9).attr("fill", d => GROUPS[d.group].color);
nodeSel.append("circle").attr("class", "core")
  .attr("r", d => d.hub ? 5 : R).attr("fill", d => GROUPS[d.group].color)
  .attr("stroke", "var(--surface)").attr("stroke-width", 3);
nodeSel.append("text")
  .attr("text-anchor", "middle")
  .attr("y", d => d.hub ? -18 : R + 20)
  .style("fill", d => d.hub ? GROUPS[d.group].color : null)
  .text(d => d.label);

/* Posizione dei 4 "poli" tematici */
function groupCenter(group) {
  const i = Object.keys(GROUPS).indexOf(group);
  if (W < 640) return { x: W / 2, y: H * (i + 0.5) / 4 };
  return { x: W * (i % 2 ? 0.7 : 0.3), y: H * (i < 2 ? 0.3 : 0.7) };
}

/* Forze personalizzate: deriva leggera + repulsione dal mouse */
function drift() {
  if (reduceMotion) return;
  const t = performance.now() / 1500;
  nodes.forEach((n, i) => {
    n.vx += Math.sin(t + i * 1.7) * 0.03;
    n.vy += Math.cos(t * 0.9 + i * 2.3) * 0.03;
  });
}
function repel() {
  if (!pointer) return;
  for (const n of nodes) {
    const dx = n.x - pointer[0], dy = n.y - pointer[1], d = Math.hypot(dx, dy) || 1;
    if (d < 120) { const k = (120 - d) / 120 * 1.2; n.vx += dx / d * k; n.vy += dy / d * k; }
  }
}

const sim = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(links).id(d => d.id)
    .distance(l => l.kind === "hub" ? 95 : 150)
    .strength(l => l.kind === "hub" ? 0.7 : 0.05))
  .force("charge", d3.forceManyBody().strength(-280))
  .force("collide", d3.forceCollide(d => d.hub ? 26 : 38))
  .force("drift", drift)
  .force("repel", repel)
  .alphaTarget(reduceMotion ? 0 : 0.03)
  .on("tick", () => {
    nodes.forEach(n => {
      const pad = n.hub ? 40 : R + 34;
      n.x = Math.max(pad, Math.min(W - pad, n.x));
      n.y = Math.max(pad, Math.min(H - pad, n.y));
    });
    linkSel.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
           .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
    nodeSel.attr("transform", d => `translate(${d.x},${d.y})`);
  });

function layout() {
  W = host.clientWidth; H = host.clientHeight;
  svg.attr("viewBox", `0 0 ${W} ${H}`);
  sim.force("x", d3.forceX(d => groupCenter(d.group).x).strength(0.09))
     .force("y", d3.forceY(d => groupCenter(d.group).y).strength(0.09))
     .alpha(0.6).restart();
}
layout();
new ResizeObserver(layout).observe(host);

/* Trascinamento */
nodeSel.call(d3.drag()
  .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
  .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
  .on("end",   (e, d) => { if (!e.active) sim.alphaTarget(reduceMotion ? 0 : 0.03); d.fx = d.fy = null; }));

/* Repulsione solo con mouse (non su touch) */
svg.on("pointermove", e => { if (e.pointerType === "mouse") pointer = d3.pointer(e, svg.node()); })
   .on("pointerleave", () => { pointer = null; });

/* Evidenziazione: filtro per tema + hover */
function neighbors(id) {
  const s = new Set([id]);
  links.forEach(l => {
    if (l.source.id === id) s.add(l.target.id);
    if (l.target.id === id) s.add(l.source.id);
  });
  return s;
}
function refresh() {
  const nb = hoverId ? neighbors(hoverId) : null;
  const dim = d => (activeGroup && d.group !== activeGroup) || (nb && !nb.has(d.id));
  nodeSel.style("opacity", d => dim(d) ? 0.15 : 1);
  linkSel.style("opacity", d => (dim(d.source) || dim(d.target)) ? 0.08 : null);
}

/* Tooltip */
function showTip(e, d) {
  tip.innerHTML = `<strong>${d.label}</strong><span>${d.date}</span><span>${d.place}</span>`;
  tip.hidden = false; moveTip(e);
}
function moveTip(e) {
  tip.style.left = Math.min(e.clientX + 16, innerWidth - tip.offsetWidth - 12) + "px";
  tip.style.top = (e.clientY + 18) + "px";
}

nodeSel
  .on("pointerenter", (e, d) => { hoverId = d.id; refresh(); if (!d.hub && e.pointerType === "mouse") showTip(e, d); })
  .on("pointermove", e => { if (!tip.hidden) moveTip(e); })
  .on("pointerleave", () => { hoverId = null; tip.hidden = true; refresh(); })
  .on("click", (e, d) => { d.hub ? setFilter(d.group) : openDrawer(d); })
  .on("keydown", (e, d) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); d.hub ? setFilter(d.group) : openDrawer(d); }
  });

/* Filtri (chip sopra il grafo) */
const filtersEl = document.getElementById("filters");
Object.entries(GROUPS).forEach(([key, g]) => {
  const b = document.createElement("button");
  b.className = "filter"; b.type = "button"; b.dataset.group = key;
  b.style.setProperty("--c", g.color);
  b.setAttribute("aria-pressed", "false");
  b.innerHTML = `<i></i>${g.label}`;
  b.addEventListener("click", () => setFilter(key));
  filtersEl.appendChild(b);
});
function setFilter(key) {
  activeGroup = activeGroup === key ? null : key;
  filtersEl.querySelectorAll(".filter").forEach(b =>
    b.setAttribute("aria-pressed", String(b.dataset.group === activeGroup)));
  refresh();
}

/* ==========================================================
   3. DRAWER (modal off-canvas)
   ========================================================== */
const $ = id => document.getElementById(id);
const drawer = $("drawer"), scrim = $("scrim");
let lastFocus = null;

function setLink(el, url) {
  if (url) { el.href = url; el.hidden = false; } else { el.removeAttribute("href"); el.hidden = true; }
}
function openDrawer(p) {
  const g = GROUPS[p.group];
  lastFocus = document.activeElement;
  $("d-dot").style.background = g.color;
  $("d-group").textContent = g.label;
  $("d-title").textContent = p.label;
  $("d-date").textContent = p.date;
  $("d-place").textContent = p.place;
  $("d-abstract").textContent = p.abstract;
  $("d-tags").innerHTML = (p.tags || []).map(t => `<li>${t}</li>`).join("");
  setLink($("d-pdf"), p.pdf);
  setLink($("d-repo"), p.repo);
  tip.hidden = true;
  drawer.classList.add("open"); scrim.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  $("d-close").focus();
}
function closeDrawer() {
  drawer.classList.remove("open"); scrim.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  if (lastFocus) lastFocus.focus();
}
$("d-close").addEventListener("click", closeDrawer);
scrim.addEventListener("click", closeDrawer);
document.addEventListener("keydown", e => { if (e.key === "Escape" && drawer.classList.contains("open")) closeDrawer(); });

/* ==========================================================
   4. SCROLL REVEAL + ANNO FOOTER
   ========================================================== */
const io = new IntersectionObserver(entries => {
  entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
}, { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach(el => io.observe(el));
$("year").textContent = new Date().getFullYear();
