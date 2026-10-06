/* ============================================================
   InstrumenPoche Web — logique applicative
   Manipulation des instruments, enregistrement du script,
   lecteur d'animation pas à pas.
   ============================================================ */
"use strict";

/* ---------------- DOM ---------------- */
const canvas = document.getElementById("paper");
const ctx = canvas.getContext("2d");
const ctxInfo = document.getElementById("ctxInfo");
const ctxActions = document.getElementById("ctxActions");
const scriptArea = document.getElementById("scriptArea");
const scriptMsg = document.getElementById("scriptMsg");
const playSlider = document.getElementById("playSlider");
const stepCounter = document.getElementById("stepCounter");
const playOverlay = document.getElementById("playOverlay");
const stepCaption = document.getElementById("stepCaption");
function showCaption(txt) {
  if (txt) { stepCaption.textContent = txt; stepCaption.classList.remove("hidden"); }
  else stepCaption.classList.add("hidden");
}

/* ---------------- État ---------------- */
const defaultInstruments = () => ({
  crayon:       { kind: "crayon",        visible: false, x: 160, y: 220, angle: -0.9 },
  compas:       { kind: "compas",        visible: false, x: 340, y: 320, r: 110, tip: -1.1, headH: 60 },
  regle:        { kind: "regle",         visible: false, x: 470, y: 520, angle: 0, L: 500, W: 40 },
  equerre:      { kind: "equerre",       visible: false, x: 210, y: 210, angle: 0, a: 190, flip: 1 },
  rapporteur:   { kind: "rapporteur",    visible: false, x: 640, y: 220, angle: 0, R: 110 },
  regleEquerre: { kind: "regleEquerre",  visible: false, x: 470, y: 320, angle: 0, L: 430, W: 26, s: -60, side: -1, eqFlip: 1 },
});
const DRAW_ORDER = ["regleEquerre", "regle", "equerre", "rapporteur", "compas", "crayon"];

let S = {
  grid: "carreaux",
  objects: [],            // objets tracés (dérivés du script)
  inst: defaultInstruments(),
  script: [],             // étapes enregistrées
  tool: "move",
  snap: false,
  selected: null,         // instrument sélectionné (poignées visibles)
  hoverEdge: null,        // bord d'instrument survolé (surligné)
  compasMode: "open",     // 'open' | 'draw'
  ink: "#20355e",         // couleur du trait
  fill: "#4a90d9",        // remplissage des polygones
  textSize: 16,           // taille du texte
  labelN: 0,              // prochaine lettre pour les points
};

let drag = null;          // état du glisser en cours
let bgImg = null;         // image d'exercice en fond
let bgAlpha = 0.65;
let bgX = 0, bgY = 0, bgS = 1;   // position et zoom de l'image de fond
let play = { active: false, idx: 0, playing: false, paused: false,
             t0: 0, elapsed: 0, speed: 1, loop: false, partial: null, poseFrom: null };

/* ---------------- Canvas / rendu ---------------- */
function resizeCanvas() {
  const r = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}
window.addEventListener("resize", resizeCanvas);

function render() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  drawGrid(ctx, w, h, S.grid);

  // image d'exercice en fond (centrée, ajustée à la feuille)
  if (bgImg) {
    const r = imgRect(w, h);
    ctx.save();
    ctx.globalAlpha = (play.partial && play.partial.bgA != null) ? play.partial.bgA : bgAlpha;
    ctx.drawImage(bgImg, r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  drawObjects(ctx, S.objects);

  // objet en cours d'animation (lecture) ou d'aperçu (glisser)
  if (play.partial && play.partial.obj) drawObject(ctx, play.partial.obj, play.partial.frac);
  if (drag && drag.preview) drawObject(ctx, drag.preview, 1);

  // instruments visibles (le sélectionné en dernier → au-dessus)
  const order = DRAW_ORDER.filter(k => k !== S.selected).concat(S.selected ? [S.selected] : []);
  for (const k of order) {
    const p = S.inst[k];
    if (!p.visible) continue;
    ctx.save();
    if (play.partial && play.partial.instAlpha === k) ctx.globalAlpha = play.partial.frac;
    INSTRUMENTS[k].draw(ctx, p, k === S.selected && !play.active);
    ctx.restore();
  }

  // bord « traçable » survolé : surlignage orange
  if (S.hoverEdge && !drag && !play.active) {
    const p = S.inst[S.hoverEdge.inst], e = S.hoverEdge.edge;
    const a = toWorld(p, e.x1, e.y1), b = toWorld(p, e.x2, e.y2);
    ctx.save();
    ctx.strokeStyle = "rgba(230,126,34,.6)"; ctx.lineWidth = 7; ctx.lineCap = "round";
    line(ctx, a.x, a.y, b.x, b.y);
    ctx.restore();
  }

  // curseur-mesure du rapporteur
  if (S.selected === "rapporteur" && S.inst.rapporteur.visible && rappAngle != null && !play.active) {
    const p = S.inst.rapporteur;
    const a = -rappAngle * Math.PI / 180 + p.angle;
    ctx.save();
    ctx.strokeStyle = "rgba(192,57,43,.8)"; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]);
    line(ctx, p.x, p.y, p.x + (p.R + 40) * Math.cos(a), p.y + (p.R + 40) * Math.sin(a));
    ctx.restore();
  }

  // crayon fantôme pendant la lecture d'un tracé
  if (play.active && play.ghost) {
    const g = { kind: "crayon", x: play.ghost.x, y: play.ghost.y, angle: play.ghost.angle };
    INSTRUMENTS.crayon.draw(ctx, g, false);
  }
}

/* ---------------- Utilitaires ---------------- */
function serialProps(p) {
  const o = {};
  for (const k in p) if (k !== "kind" && k !== "visible") o[k] = p[k];
  return o;
}
function record(step) {
  S.script.push(step);
  syncScriptUI();
}
function translateObject(o, dx, dy) {
  switch (o.type) {
    case "segment": case "line": case "fleche":
      o.x1 += dx; o.y1 += dy; o.x2 += dx; o.y2 += dy; break;
    case "arc": case "circle":
      o.cx += dx; o.cy += dy; break;
    case "stroke": case "polygone":
      for (const p of o.pts) { p[0] += dx; p[1] += dy; } break;
    default:                                   // point, croix, text
      o.x += dx; o.y += dy;
  }
}
function snapPt(x, y) {
  if (!S.snap) return { x, y };
  let gx = 10, gy = 10;
  if (S.grid === "carreaux") { gx = gy = 5 * MM; }
  else if (S.grid === "seyes") { gx = 8 * MM; gy = 2 * MM; }
  else if (S.grid === "millimetre") { gx = gy = 2 * MM; }
  else if (S.grid === "repere") { gx = gy = 10 * MM; }
  return { x: Math.round(x / gx) * gx, y: Math.round(y / gy) * gy };
}
function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function imgRect(w, h) {
  const sc = Math.min(w / bgImg.width, h / bgImg.height) * bgS;
  const iw = bgImg.width * sc, ih = bgImg.height * sc;
  return { x: (w - iw) / 2 + bgX, y: (h - ih) / 2 + bgY, w: iw, h: ih };
}
function overImg(x, y) {
  if (!bgImg) return false;
  const r = imgRect(canvas.clientWidth, canvas.clientHeight);
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/* charge l'image d'une étape bgimg (mise en cache sur l'étape) */
function loadStepImage(st, done) {
  if (st._img) { done(); return; }
  const im = new Image();
  im.onload = () => { st._img = im; done(); render(); if (V.open) vRender(); };
  im.src = st.src;
}

/* ---------------- Application d'une étape (instantané) ---------------- */
function applyStep(st, stepIdx = S.script.length - 1) {
  switch (st.t) {
    case "bgimg":
      loadStepImage(st, () => { bgImg = st._img; });
      bgX = 0; bgY = 0; bgS = 1;
      if (st.a != null) bgAlpha = st.a;
      break;
    case "bgpose":
      bgX = st.x; bgY = st.y; bgS = st.s;
      if (st.a != null) bgAlpha = st.a;
      break;
    case "paper": S.grid = st.grid; document.getElementById("gridSelect").value = st.grid; break;
    case "show": S.inst[st.i].visible = true; break;
    case "hide": S.inst[st.i].visible = false; break;
    case "pose": Object.assign(S.inst[st.i], st.props); break;
    case "movePoint": {
      const o = S.objects.find(o => o.type === "point" && o.label === st.label);
      if (o) { o.x = st.x; o.y = st.y; }
      break;
    }
    case "moveObj": {
      const o = S.objects.find(o => o._step === st.ref);
      if (o) translateObject(o, st.dx, st.dy);
      break;
    }
    case "editText": {
      const o = S.objects.find(o => o._step === st.ref);
      if (o) o.str = st.str;
      break;
    }
    default: {
      const o = Object.assign({ type: st.t }, st);
      delete o.t; delete o.msg;
      o._step = stepIdx;   // indice de l'étape du script qui a créé l'objet (pour la gomme)
      S.objects.push(o);
      if (st.t === "point") S.labelN++;
    }
  }
}
function rebuild() {
  S.objects = [];
  S.inst = defaultInstruments();
  S.grid = "blanc";
  S.labelN = 0;
  S.selected = null;
  rappAngle = null;
  bgImg = null; bgX = 0; bgY = 0; bgS = 1;
  for (let i = 0; i < S.script.length; i++) applyStep(S.script[i], i);
  render();
  updateContextBar();
}

/* ---------------- Synchronisation UI ---------------- */
function syncScriptUI() {
  const lines = S.script.map(s => "  " + JSON.stringify(s));
  scriptArea.value = "[\n" + lines.join(",\n") + "\n]";
  playSlider.max = S.script.length;
  if (!play.active) playSlider.value = S.script.length;
  stepCounter.textContent = `${play.active ? play.idx : S.script.length} / ${S.script.length} étapes`;
}

/* ---------------- Barre contextuelle ---------------- */
let rappAngle = null;
function updateContextBar() {
  ctxActions.innerHTML = "";
  const k = S.selected;
  if (!k || !S.inst[k].visible) {
    ctxInfo.textContent = S.tool === "point" ? "Cliquez pour placer un point ; glissez un point existant pour le déplacer."
      : S.tool === "texte" ? "Cliquez pour insérer un texte."
      : S.tool === "gomme" ? "Cliquez sur un tracé pour l'effacer."
      : S.tool === "segment" ? "Cliquez-glissez pour tracer un segment (ou le long d'un bord orange)."
      : S.tool === "droite" ? "Cliquez-glissez pour tracer une droite."
      : S.tool === "polygone" ? "Cliquez les sommets (3 minimum), puis cliquez le 1er sommet ou double-cliquez pour fermer. Échap = annuler."
      : S.tool === "milieu" ? "Cliquez sur un segment pour placer son milieu (point nommé)."
      : S.tool === "dessin" ? "Cliquez-glissez pour dessiner à main levée."
      : S.tool === "fleche" ? "Cliquez-glissez pour tracer une flèche ; près de l'horizontale/verticale elle s'aligne automatiquement."
      : S.tool === "cadre" ? "Cliquez-glissez pour encadrer une zone (titre, énoncé…) ; la couleur de remplissage se règle dans Style."
      : "Glissez un objet tracé pour le déplacer, le long d'un bord orange pour tracer, ou attrapez le crayon pour écrire.";
    return;
  }
  const p = S.inst[k];
  const names = { crayon: "Crayon", compas: "Compas", regle: "Règle", equerre: "Équerre", rapporteur: "Rapporteur", regleEquerre: "Règle-équerre" };
  ctxInfo.textContent = names[k] + (k === "rapporteur"
    ? " — centrez-le sur le sommet, alignez le 0° sur un côté, puis survolez : l'angle s'affiche."
    : " — glissez le corps pour déplacer, la poignée bleue pour pivoter.");

  const btn = (label, fn, on = false) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label; if (on) b.classList.add("on");
    b.onclick = fn; ctxActions.appendChild(b); return b;
  };

  if (k === "compas") {
    btn("Régler l'ouverture", () => { S.compasMode = "open"; updateContextBar(); }, S.compasMode === "open");
    btn("Tracer un arc", () => { S.compasMode = "draw"; updateContextBar(); }, S.compasMode === "draw");
    btn("Cercle complet", () => {
      record({ t: "pose", i: "compas", props: serialProps(p) });
      const st = { t: "circle", cx: p.x, cy: p.y, r: p.r, c: S.ink };
      record(st); applyStep(st); render();
    });
    const lab = document.createElement("label");
    lab.style.fontSize = "12px";
    lab.innerHTML = 'ouverture : <input id="compasInput" type="number" min="0.5" max="10.5" step="0.1" style="width:58px"> cm';
    ctxActions.appendChild(lab);
    const inp = lab.querySelector("input");
    inp.value = (p.r / (10 * MM)).toFixed(1);
    inp.onchange = () => {
      const v = parseFloat(inp.value);
      if (isFinite(v)) {
        p.r = clamp(v * 10 * MM, 20, 400);
        record({ t: "pose", i: "compas", props: serialProps(p) });
        render();
      }
    };
  } else if (k === "equerre") {
    btn("Retourner", () => { p.flip *= -1; record({ t: "pose", i: k, props: serialProps(p) }); render(); });
  } else if (k === "regleEquerre") {
    btn("Équerre de l'autre bord", () => { p.side *= -1; record({ t: "pose", i: k, props: serialProps(p) }); render(); });
    btn("Retourner l'équerre", () => { p.eqFlip *= -1; record({ t: "pose", i: k, props: serialProps(p) }); render(); });
  } else if (k === "rapporteur") {
    const s = document.createElement("span");
    s.className = "ctx-angle"; s.id = "rappAngle";
    s.textContent = rappAngle == null ? "angle : —" : `angle : ${rappAngle.toFixed(0)}°`;
    ctxActions.appendChild(s);
    btn("Tracer ce rayon", () => {
      if (rappAngle == null) return;
      const a = -rappAngle * Math.PI / 180 + p.angle;
      const st = { t: "segment", x1: p.x, y1: p.y, x2: p.x + (p.R + 40) * Math.cos(a), y2: p.y + (p.R + 40) * Math.sin(a), c: S.ink };
      record(st); applyStep(st); render();
    });
    btn("Marquer l'angle", () => {
      if (rappAngle == null) return;
      const st = { t: "arc", cx: p.x, cy: p.y, r: 45,
                   a1: p.angle, a2: p.angle - rappAngle * Math.PI / 180, c: S.ink };
      record(st); applyStep(st); render();
    });
    btn("Angle + texte", () => {
      if (rappAngle == null) return;
      const am = p.angle - (rappAngle / 2) * Math.PI / 180;   // bissectrice
      const a2 = p.angle - rappAngle * Math.PI / 180;
      record({ t: "arc", cx: p.x, cy: p.y, r: 45, a1: p.angle, a2: a2, c: S.ink });
      record({ t: "text", x: p.x + 58 * Math.cos(am), y: p.y + 58 * Math.sin(am),
               str: Math.round(rappAngle) + "°", c: S.ink, fs: S.textSize });
      applyStep(S.script[S.script.length - 2]);
      applyStep(S.script[S.script.length - 1]);
      render();
    });
  }
}

/* ============================================================
   INTERACTIONS SOURIS / TACTILE
   ============================================================ */
function hitHandle(wx, wy) {
  // poignées de l'instrument sélectionné d'abord, puis des autres visibles
  const order = (S.selected ? [S.selected] : []).concat(DRAW_ORDER.filter(k => k !== S.selected));
  for (const k of order) {
    const p = S.inst[k];
    if (!p.visible || !INSTRUMENTS[k].handles) continue;
    for (const h of INSTRUMENTS[k].handles(p))
      if (dist(wx, wy, h.x, h.y) <= 14) return { inst: k, id: h.id };
  }
  return null;
}
function hitBody(wx, wy) {
  for (const k of [...DRAW_ORDER].reverse()) {
    const p = S.inst[k];
    if (p.visible && INSTRUMENTS[k].bodyHit(p, wx, wy)) return k;
  }
  return null;
}
function hitEdge(wx, wy) {
  // bord d'instrument le plus proche (< 13 px)
  let best = null;
  for (const k of DRAW_ORDER) {
    const p = S.inst[k];
    if (!p.visible) continue;
    const q = toLocal(p, wx, wy);
    for (const e of INSTRUMENTS[k].edges(p)) {
      const { d } = distToSeg(q.x, q.y, e.x1, e.y1, e.x2, e.y2);
      if (d < 14 && (!best || d < best.d)) best = { inst: k, edge: e, d };
    }
  }
  return best;
}
function hitText(wx, wy) {
  // zone généreuse autour d'un texte : retourne l'objet texte le plus récent touché
  for (let i = S.objects.length - 1; i >= 0; i--) {
    const o = S.objects[i];
    if (o.type !== "text") continue;
    const fs = o.fs || 15, w = (o.str ? o.str.length : 1) * fs * 0.6;
    if (wx > o.x - 12 && wx < o.x + w + 12 && wy > o.y - fs * 1.5 && wy < o.y + fs * 0.7) return o;
  }
  return null;
}
function hitObject(wx, wy) {
  for (let i = S.objects.length - 1; i >= 0; i--) {
    const o = S.objects[i];
    if ((o.type === "segment" || o.type === "fleche") && distToSeg(wx, wy, o.x1, o.y1, o.x2, o.y2).d < 7) return i;
    if ((o.type === "arc" || o.type === "circle") &&
        Math.abs(dist(wx, wy, o.cx, o.cy) - o.r) < 7) return i;
    if (o.type === "line") {
      const dx = o.x2 - o.x1, dy = o.y2 - o.y1, L = Math.hypot(dx, dy) || 1;
      if (Math.abs((wx - o.x1) * dy - (wy - o.y1) * dx) / L < 7) return i;
    }
    if ((o.type === "point" || o.type === "croix") && dist(wx, wy, o.x, o.y) < 10) return i;
    if (o.type === "text" && wx > o.x - 6 && wx < o.x + o.str.length * (o.fs || 15) * 0.6 + 6 &&
        wy > o.y - (o.fs || 15) * 1.1 && wy < o.y + (o.fs || 15) * 0.4) return i;
    if (o.type === "cadre" && wx > o.x - 5 && wx < o.x + o.w + 5 && wy > o.y - 5 && wy < o.y + o.h + 5) return i;
    if (o.type === "stroke" && o.pts.some(pt => dist(wx, wy, pt[0], pt[1]) < 6)) return i;
    if (o.type === "polygone") {
      for (let j = 0; j < o.pts.length; j++) {
        const a = o.pts[j], b = o.pts[(j + 1) % o.pts.length];
        if (distToSeg(wx, wy, a[0], a[1], b[0], b[1]).d < 7) return i;
      }
    }
  }
  return -1;
}

canvas.addEventListener("pointerdown", e => {
  if (play.active) return;
  const { x, y } = canvasPos(e);
  canvas.setPointerCapture(e.pointerId);

  /* ----- polygone en cours : ajouter un sommet ou refermer ----- */
  if (drag && drag.kind === "poly") {
    if (dist(x, y, drag.pts[0][0], drag.pts[0][1]) < 12 && drag.pts.length >= 3) commitPoly();
    else {
      const p = snapPt(x, y);
      drag.pts.push([p.x, p.y]);
      drag.preview = { type: "polyPreview", pts: drag.pts, cur: { x, y }, c: S.ink };
      render();
    }
    return;
  }

  /* ----- poignées des instruments : prioritaires quel que soit l'outil ----- */
  const h = hitHandle(x, y);
  if (h) {
    const p = S.inst[h.inst];
    S.selected = h.inst; updateContextBar();
    if (h.id === "rotate")
      drag = { kind: "rotate", inst: h.inst, off: p.angle - Math.atan2(y - p.y, x - p.x) };
    else if (h.id === "tip") {
      drag = S.compasMode === "draw"
        ? startArc(p, x, y)
        : { kind: "tip", inst: h.inst };
    }
    else if (h.id === "knob" || h.id === "spike" || h.id === "move")
      drag = { kind: "move", inst: h.inst, dx: x - p.x, dy: y - p.y };
    else if (h.id === "slide") drag = { kind: "slide", inst: h.inst };
    return;
  }

  /* ----- outils à clic ----- */
  if (S.tool === "point") {
    const idx = hitObject(x, y);
    if (idx >= 0 && S.objects[idx].type === "point") {
      drag = { kind: "pointMove", idx, obj: S.objects[idx] };
      return;
    }
    const p = snapPt(x, y);
    const label = String.fromCharCode(65 + (S.labelN % 26));
    const st = { t: "point", x: p.x, y: p.y, label, c: S.ink };
    record(st); applyStep(st); render();
    return;
  }
  if (S.tool === "texte") {
    const o = hitText(x, y);
    if (o) openTextInput(o.x, o.y, o);
    else openTextInput(x, y);
    return;
  }
  if (S.tool === "gomme") {
    const idx = hitObject(x, y);
    if (idx >= 0) {
      const stepIdx = S.objects[idx]._step;
      S.objects.splice(idx, 1);
      if (stepIdx >= 0 && stepIdx < S.script.length) { S.script.splice(stepIdx, 1); rebuild(); }
      syncScriptUI(); render();
    }
    return;
  }
  if (S.tool === "milieu") {
    const idx = hitObject(x, y);
    if (idx >= 0 && S.objects[idx].type === "segment") {
      const s = S.objects[idx];
      const label = String.fromCharCode(65 + (S.labelN % 26));
      const st = { t: "point", x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2, label, c: S.ink };
      record(st); applyStep(st); render();
    }
    return;
  }
  if (S.tool === "polygone") {
    const p0 = snapPt(x, y);
    drag = { kind: "poly", pts: [[p0.x, p0.y]], cur: { x, y } };
    drag.preview = { type: "polyPreview", pts: drag.pts, cur: { x, y }, c: S.ink };
    canvas.style.cursor = "crosshair";
    return;
  }

  /* ----- outil « crayon libre » : dessin à main levée partout ----- */
  if (S.tool === "dessin") {
    drag = { kind: "stroke", offX: 0, offY: 0, pts: [[x, y]] };
    drag.preview = { type: "stroke", pts: drag.pts, c: S.ink };
    return;
  }

  /* ----- outil « manipuler » ----- */
  const ed = (S.tool === "droite" || S.tool === "fleche") ? null : hitEdge(x, y);
  if (ed) {
    const p = S.inst[ed.inst];
    S.selected = ed.inst; updateContextBar();
    const q = toLocal(p, x, y);
    const s = projOnSeg(q.x, q.y, ed.edge.x1, ed.edge.y1, ed.edge.x2, ed.edge.y2, 6);
    const w = toWorld(p, s.x, s.y);
    drag = { kind: "edge", inst: ed.inst, edge: ed.edge, x1: w.x, y1: w.y, x2: w.x, y2: w.y };
    drag.preview = { type: "segment", x1: w.x, y1: w.y, x2: w.x, y2: w.y, c: S.ink };
    return;
  }

  /* ----- outil « cadre » : rectangle rempli ----- */
  if (S.tool === "cadre") {
    drag = { kind: "cadre", x1: x, y1: y, x2: x, y2: y };
    drag.preview = { type: "cadre", x, y, w: 0, h: 0, c: S.ink, fill: S.fill };
    return;
  }

  /* ----- outils segment / droite / flèche : cliquez-glissez ----- */
  if (S.tool === "segment" || S.tool === "droite" || S.tool === "fleche") {
    const p0 = snapPt(x, y);
    drag = { kind: "freeSeg", line: S.tool === "droite", fleche: S.tool === "fleche",
             x1: p0.x, y1: p0.y, x2: p0.x, y2: p0.y };
    drag.preview = { type: S.tool === "droite" ? "line" : S.tool === "fleche" ? "fleche" : "segment",
                     x1: p0.x, y1: p0.y, x2: p0.x, y2: p0.y, c: S.ink };
    return;
  }

  const comp = S.inst.compas;
  if (comp.visible && S.compasMode === "draw") {
    const d = dist(x, y, comp.x, comp.y);
    if (Math.abs(d - comp.r) < 45) {
      S.selected = "compas"; updateContextBar();
      drag = startArc(comp, x, y);
      return;
    }
  }

  const b = hitBody(x, y);
  if (b) {
    S.selected = b; updateContextBar();
    const p = S.inst[b];
    if (b === "crayon") {
      // attraper le crayon = écrire : la mine suit le curseur avec décalage
      drag = { kind: "stroke", offX: x - p.x, offY: y - p.y, pts: [[p.x, p.y]] };
      drag.preview = { type: "stroke", pts: drag.pts };
    } else {
      drag = { kind: "move", inst: b, dx: x - p.x, dy: y - p.y };
    }
    return;
  }

  /* ----- déplacer un objet tracé ----- */
  const oi = hitObject(x, y);
  if (oi >= 0) {
    const o = S.objects[oi];
    drag = o.type === "point"
      ? { kind: "pointMove", idx: oi, obj: o }
      : { kind: "objMove", idx: oi, obj: o, sx: x, sy: y, lx: x, ly: y };
    return;
  }

  /* ----- déplacer l'image de fond (outil Manipuler) ----- */
  if (S.tool === "move" && overImg(x, y)) {
    drag = { kind: "imgMove", sx: x, sy: y };
    return;
  }

  // clic sur la feuille : dessin libre si le crayon est sorti, sinon désélection
  if (S.inst.crayon.visible) {
    S.selected = "crayon"; updateContextBar();
    const p = S.inst.crayon;
    drag = { kind: "stroke", offX: 0, offY: 0, pts: [[x, y]] };
    drag.preview = { type: "stroke", pts: drag.pts };
    p.x = x; p.y = y; p.angle = -1.0;
    return;
  }
  S.selected = null; updateContextBar();
});

canvas.addEventListener("pointermove", e => {
  const { x, y } = canvasPos(e);

  if (!drag && !play.active) {
    // lecture d'angle au rapporteur (survol)
    const rp = S.inst.rapporteur;
    if (rp.visible) {
      const a = INSTRUMENTS.rapporteur.angleOf(rp, x, y);
      if (a !== rappAngle) {
        rappAngle = a;
        const s = document.getElementById("rappAngle");
        if (s) s.textContent = a == null ? "angle : —" : `angle : ${a.toFixed(0)}°`;
      }
    }
    // surlignage du bord « traçable » + curseur
    const canEdge = S.tool === "move" || S.tool === "segment";
    const ed = canEdge ? hitEdge(x, y) : null;
    const overObj = !ed && S.tool === "move" && hitObject(x, y) >= 0;
    const overBg = !ed && !overObj && S.tool === "move" && overImg(x, y);
    canvas.style.cursor = ed ? "crosshair"
      : (S.tool === "segment" || S.tool === "droite" || S.tool === "polygone" || S.tool === "milieu" || S.tool === "dessin" || S.tool === "fleche" || S.tool === "cadre") ? "crosshair"
      : (overObj || overBg) ? "move" : "default";
    if ((ed ? ed.inst : null) !== (S.hoverEdge ? S.hoverEdge.inst : null) || ed) {
      S.hoverEdge = ed; render();
    } else if (rp.visible && rappAngle != null) render();
    return;
  }
  if (!drag) return;
  const p = S.inst[drag.inst];

  switch (drag.kind) {
    case "move":
      p.x = x - drag.dx; p.y = y - drag.dy;
      break;
    case "rotate": {
      p.angle = Math.atan2(y - p.y, x - p.x) + drag.off;
      break;
    }
    case "tip": {
      const c = S.inst.compas;
      c.r = clamp(dist(x, y, c.x, c.y), 20, 400);
      c.tip = Math.atan2(y - c.y, x - c.x);
      const s = document.getElementById("compasInput");
      if (s) s.value = (c.r / (10 * MM)).toFixed(1);
      break;
    }
    case "slide": {
      const rq = S.inst.regleEquerre;
      const q = toLocal(rq, x, y);
      rq.s = clamp(q.x, -rq.L / 2 + 30, rq.L / 2 - 30);
      break;
    }
    case "edge": {
      const q = toLocal(p, x, y);
      const s = projOnSeg(q.x, q.y, drag.edge.x1, drag.edge.y1, drag.edge.x2, drag.edge.y2, 6);
      const w = toWorld(p, s.x, s.y);
      drag.x2 = w.x; drag.y2 = w.y;
      drag.preview = { type: "segment", x1: drag.x1, y1: drag.y1, x2: drag.x2, y2: drag.y2 };
      break;
    }
    case "arc": {
      const c = S.inst.compas;
      const a = Math.atan2(y - c.y, x - c.x);
      let dA = a - drag.lastA;
      dA = Math.atan2(Math.sin(dA), Math.cos(dA));   // déplier dans ]-π, π]
      drag.a2 += dA; drag.lastA = a;
      c.tip = drag.a2;
      drag.preview = { type: "arc", cx: c.x, cy: c.y, r: c.r, a1: drag.a1, a2: drag.a2 };
      break;
    }
    case "poly":
      drag.cur = { x, y };
      drag.preview = { type: "polyPreview", pts: drag.pts, cur: { x, y }, c: S.ink };
      break;
    case "cadre":
      drag.x2 = x; drag.y2 = y;
      drag.preview = { type: "cadre",
                       x: Math.min(drag.x1, x), y: Math.min(drag.y1, y),
                       w: Math.abs(x - drag.x1), h: Math.abs(y - drag.y1),
                       c: S.ink, fill: S.fill };
      break;
    case "freeSeg": {
      const p2 = snapPt(x, y);
      let x2 = p2.x, y2 = p2.y;
      if (drag.fleche) {   // alignement auto sur l'horizontale / la verticale
        if (Math.abs(y2 - drag.y1) < Math.abs(x2 - drag.x1) * 0.2) y2 = drag.y1;
        else if (Math.abs(x2 - drag.x1) < Math.abs(y2 - drag.y1) * 0.2) x2 = drag.x1;
      }
      drag.x2 = x2; drag.y2 = y2;
      drag.preview = { type: drag.line ? "line" : drag.fleche ? "fleche" : "segment",
                       x1: drag.x1, y1: drag.y1, x2: drag.x2, y2: drag.y2, c: S.ink };
      break;
    }
    case "stroke": {
      const tx = x - (drag.offX || 0), ty = y - (drag.offY || 0);   // position de la mine
      const last = drag.pts[drag.pts.length - 1];
      if (dist(tx, ty, last[0], last[1]) > 4) {
        drag.pts.push([tx, ty]);
        const cp = S.inst.crayon;
        cp.x = tx; cp.y = ty;
        cp.angle = Math.atan2(ty - last[1], tx - last[0]) + Math.PI / 2;
      }
      break;
    }
    case "objMove": {
      translateObject(drag.obj, x - drag.lx, y - drag.ly);
      drag.lx = x; drag.ly = y;
      break;
    }
    case "pointMove":
      drag.obj.x = x; drag.obj.y = y;
      break;
    case "imgMove":
      bgX += x - drag.sx; bgY += y - drag.sy;
      drag.sx = x; drag.sy = y;
      break;
  }
  render();
});

canvas.addEventListener("pointerup", e => {
  if (!drag) return;
  const { x, y } = canvasPos(e);
  const p = S.inst[drag.inst];

  switch (drag.kind) {
    case "move": case "rotate": case "tip": case "slide":
      record({ t: "pose", i: drag.inst, props: serialProps(p) });
      break;
    case "edge":
      if (dist(drag.x1, drag.y1, drag.x2, drag.y2) > 4) {
        const st = { t: "segment", x1: drag.x1, y1: drag.y1, x2: drag.x2, y2: drag.y2, c: S.ink };
        record(st); applyStep(st);
      }
      break;
    case "cadre":
      if (Math.abs(drag.x2 - drag.x1) > 6 && Math.abs(drag.y2 - drag.y1) > 6) {
        const st = { t: "cadre",
                     x: Math.min(drag.x1, drag.x2), y: Math.min(drag.y1, drag.y2),
                     w: Math.abs(drag.x2 - drag.x1), h: Math.abs(drag.y2 - drag.y1),
                     c: S.ink, fill: S.fill };
        record(st); applyStep(st);
      }
      break;
    case "freeSeg":
      if (dist(drag.x1, drag.y1, drag.x2, drag.y2) > 4) {
        const st = { t: drag.line ? "line" : drag.fleche ? "fleche" : "segment",
                     x1: drag.x1, y1: drag.y1, x2: drag.x2, y2: drag.y2, c: S.ink };
        record(st); applyStep(st);
      }
      break;
    case "arc": {
      const c = S.inst.compas;
      if (Math.abs(drag.a2 - drag.a1) > 0.04) {
        record({ t: "pose", i: "compas", props: Object.assign(serialProps(c), { tip: drag.a1 }) });
        const st = { t: "arc", cx: c.x, cy: c.y, r: c.r, a1: drag.a1, a2: drag.a2, c: S.ink };
        record(st); applyStep(st);
        record({ t: "pose", i: "compas", props: serialProps(c) });
      }
      break;
    }
    case "stroke":
      if (drag.pts.length > 2) {
        const st = { t: "stroke", pts: drag.pts.slice(), c: S.ink };
        record(st); applyStep(st);
      }
      break;
    case "objMove": {
      const dx = x - drag.sx, dy = y - drag.sy;
      if ((dx || dy) && drag.obj._step >= 0)
        record({ t: "moveObj", ref: drag.obj._step, dx, dy });
      break;
    }
    case "pointMove":
      record({ t: "movePoint", label: drag.obj.label, x: drag.obj.x, y: drag.obj.y });
      break;
    case "imgMove":
      record({ t: "bgpose", x: bgX, y: bgY, s: bgS, a: bgAlpha });
      break;
  }
  if (drag && drag.kind !== "poly") drag = null;   // le polygone reste actif entre les clics
  render();
});

canvas.addEventListener("dblclick", e => {
  if (drag && drag.kind === "poly" && drag.pts.length >= 3) { commitPoly(); return; }
  // double-clic sur un texte existant : le modifier
  if (play.active) return;
  const { x, y } = canvasPos(e);
  const o = hitText(x, y);
  if (o) openTextInput(o.x, o.y, o);
});
canvas.addEventListener("contextmenu", e => {
  // clic droit sur un texte : le modifier (autre chemin fiable)
  if (play.active) return;
  const { x, y } = canvasPos(e);
  const o = hitText(x, y);
  if (o) { e.preventDefault(); openTextInput(o.x, o.y, o); }
});
function commitPoly() {
  const st = { t: "polygone", pts: drag.pts.slice(), c: S.ink, fill: S.fill };
  record(st); applyStep(st);
  drag = null; canvas.style.cursor = "default";
  render();
}

function startArc(comp, x, y) {
  const a0 = Math.atan2(y - comp.y, x - comp.x);
  return { kind: "arc", inst: "compas", a1: a0, a2: a0, lastA: a0,
           preview: { type: "arc", cx: comp.x, cy: comp.y, r: comp.r, a1: a0, a2: a0, c: S.ink } };
}

/* ============================================================
   BARRE D'OUTILS
   ============================================================ */
document.querySelectorAll(".inst-btn").forEach(b => {
  b.onclick = () => {
    const k = b.dataset.inst, p = S.inst[k];
    p.visible = !p.visible;
    b.classList.toggle("active", p.visible);
    record({ t: p.visible ? "show" : "hide", i: k });
    if (p.visible) {
      S.selected = k;
      record({ t: "pose", i: k, props: serialProps(p) });
    }
    updateContextBar(); render();
  };
});
document.querySelectorAll(".tool-btn").forEach(b => {
  b.onclick = () => {
    S.tool = b.dataset.tool;
    document.querySelectorAll(".tool-btn").forEach(x => x.classList.toggle("active", x === b));
    updateContextBar();
  };
});
document.getElementById("gridSelect").onchange = e => {
  S.grid = e.target.value;
  record({ t: "paper", grid: S.grid });
  render();
};
document.getElementById("snapChk").onchange = e => { S.snap = e.target.checked; };
document.getElementById("inkColor").oninput = e => { S.ink = e.target.value; };
document.getElementById("fillColor").oninput = e => { S.fill = e.target.value; };
document.getElementById("textSizeSel").onchange = e => { S.textSize = +e.target.value; };

/* ----- saisie de texte directement sur la feuille ----- */
const textInput = document.getElementById("textInput");
function openTextInput(x, y, obj = null) {
  const fs = obj ? (obj.fs || 15) : S.textSize;
  textInput.value = obj ? obj.str : "";
  textInput.style.left = x + "px";
  textInput.style.top = (y - fs) + "px";
  textInput.style.fontSize = fs + "px";
  textInput.style.color = obj ? (obj.c || S.ink) : S.ink;
  textInput.classList.remove("hidden");
  textInput._pos = { x, y };
  textInput._edit = obj;
  setTimeout(() => { textInput.focus(); textInput.select(); }, 0);
}
function commitTextInput() {
  const str = textInput.value.trim();
  textInput.classList.add("hidden");
  if (textInput._edit) {
    const o = textInput._edit;
    if (str && str !== o.str) {
      o.str = str;
      if (o._step >= 0) record({ t: "editText", ref: o._step, str });
      render();
    }
  } else if (str && textInput._pos) {
    const st = { t: "text", x: textInput._pos.x, y: textInput._pos.y, str, c: S.ink, fs: S.textSize };
    record(st); applyStep(st); render();
  }
  textInput._pos = null; textInput._edit = null;
}
textInput.addEventListener("keydown", e => {
  e.stopPropagation();
  if (e.key === "Enter") commitTextInput();
  else if (e.key === "Escape") { textInput.value = ""; commitTextInput(); }
});
textInput.addEventListener("blur", commitTextInput);

/* ----- image d'exercice en fond ----- */
const imgFile = document.getElementById("imgFile");
document.getElementById("imgBtn").onclick = () => imgFile.click();
imgFile.onchange = e => {
  const f = e.target.files[0];
  if (f) loadBgImage(f);
  e.target.value = "";
};
document.getElementById("imgOpacity").oninput = e => { bgAlpha = +e.target.value; render(); };
document.getElementById("imgRemove").onclick = () => {
  bgImg = null; bgX = 0; bgY = 0; bgS = 1;
  S.script = S.script.filter(s => s.t !== "bgimg" && s.t !== "bgpose");   // retirer l'étape du script
  syncScriptUI();
  document.getElementById("imgRemove").classList.add("hidden");
  document.getElementById("imgCenter").classList.add("hidden");
  document.getElementById("imgOpRow").style.display = "none";
  render();
};
document.getElementById("imgCenter").onclick = () => { bgX = 0; bgY = 0; bgS = 1; render(); };
// molette sur l'image (outil Manipuler) : zoomer / dézoomer
let bgPoseTimer = null;
canvas.addEventListener("wheel", e => {
  if (play.active || S.tool !== "move") return;
  const { x, y } = canvasPos(e);
  if (!overImg(x, y)) return;
  e.preventDefault();
  bgS = clamp(bgS * (e.deltaY < 0 ? 1.12 : 0.89), 0.05, 10);
  clearTimeout(bgPoseTimer);
  bgPoseTimer = setTimeout(() => record({ t: "bgpose", x: bgX, y: bgY, s: bgS, a: bgAlpha }), 500);
  render();
}, { passive: false });
// collage direct d'une capture d'écran (Ctrl+V)
document.addEventListener("paste", e => {
  for (const item of e.clipboardData.items) {
    if (item.type.startsWith("image/")) { loadBgImage(item.getAsFile()); break; }
  }
});
function loadBgImage(file) {
  const rd = new FileReader();
  rd.onload = () => {
    const im = new Image();
    im.onload = () => {
      bgImg = im; bgX = 0; bgY = 0; bgS = 1;
      record({ t: "bgimg", src: rd.result, a: bgAlpha });   // l'image devient une étape du script
      document.getElementById("imgRemove").classList.remove("hidden");
      document.getElementById("imgCenter").classList.remove("hidden");
      document.getElementById("imgOpRow").style.display = "flex";
      render();
    };
    im.src = rd.result;
  };
  rd.readAsDataURL(file);
}

document.getElementById("undoBtn").onclick = undo;
document.addEventListener("keydown", e => {
  if (e.ctrlKey && e.key === "z") { e.preventDefault(); undo(); }
  if (e.key === "Escape") { drag = null; canvas.style.cursor = "default"; render(); }
});
function undo() {
  if (play.active || !S.script.length) return;
  S.script.pop();
  rebuild(); syncScriptUI();
}
document.getElementById("clearBtn").onclick = () => {
  if (play.active || !S.script.length && !S.objects.length) return;
  if (!confirm("Effacer toute la construction ?")) return;
  S.script = []; rebuild(); syncScriptUI();
};

/* ============================================================
   LECTEUR D'ANIMATION
   ============================================================ */
const DUR = { paper: 1, show: 350, hide: 300, pose: 600, segment: 750, fleche: 750, cadre: 500, line: 900,
              arc: 850, circle: 1000, point: 400, croix: 300, text: 450,
              movePoint: 400, moveObj: 400, editText: 400, bgimg: 550, bgpose: 450 };
function durOf(st) {
  if (st.t === "stroke") return clamp(st.pts.length * 22, 300, 2500);
  if (st.t === "polygone") return 400 + st.pts.length * 160;
  if (st.t === "pose") {
    const p = S.inst[st.i];
    const d = st.props.x != null ? dist(p.x, p.y, st.props.x, st.props.y ?? p.y) : 0;
    return clamp(400 + d * 0.6, 400, 1400);
  }
  return DUR[st.t] || 400;
}

function enterPlay(fromIdx = 0) {
  play.active = true; play.paused = false;
  play.idx = fromIdx; play.partial = null; play.ghost = null;
  drag = null; S.selected = null;
  // reconstruire l'état au début de l'étape fromIdx
  const keep = S.script.slice();
  S.objects = []; S.inst = defaultInstruments(); S.grid = "blanc"; S.labelN = 0;
  bgImg = null; bgX = 0; bgY = 0; bgS = 1;
  for (let i = 0; i < fromIdx; i++) applyStep(keep[i]);
  playOverlay.classList.remove("hidden");
  document.getElementById("btnExitPlay").classList.remove("hidden");
  setPlayButtons();
  updateContextBar();
  render();
}
function exitPlay() {
  play.active = false; play.playing = false; play.partial = null; play.ghost = null;
  rebuild();
  playOverlay.classList.add("hidden");
  showCaption(null);
  document.getElementById("btnExitPlay").classList.add("hidden");
  setPlayButtons(); syncScriptUI();
}
function setPlayButtons() {
  document.getElementById("btnPlay").disabled = play.active && play.playing && !play.paused;
  document.getElementById("btnPause").disabled = !(play.active && play.playing && !play.paused);
  document.getElementById("btnPrev").disabled = !play.active;
  document.getElementById("btnNext").disabled = !play.active;
}

function startStep() {
  play.t0 = performance.now(); play.elapsed = 0;
  const st = S.script[play.idx];
  showCaption(st ? st.msg : null);
  play.poseFrom = null; play.lastF = 0; play.objRef = null;
  if (st.t === "pose") play.poseFrom = Object.assign({}, S.inst[st.i]);
  if (st.t === "bgpose") play.poseFrom = { x: bgX, y: bgY, s: bgS, a: bgAlpha };
  if (st.t === "moveObj") play.objRef = S.objects.find(o => o._step === st.ref) || null;
  if (st.t === "arc" || st.t === "circle") {
    // placer le compas sur l'arc si visible
    const c = S.inst.compas;
    if (c.visible) { c.x = st.cx; c.y = st.cy; c.r = st.r; c.tip = st.t === "arc" ? st.a1 : 0; }
  }
}
function commitStep(st) {
  if (st.t !== "moveObj") applyStep(st);   // moveObj déjà appliqué par l'animation
  play.partial = null; play.ghost = null;
}
function tick(now) {
  if (play.active && play.playing && !play.paused) {
    const st = S.script[play.idx];
    if (!st) { finishPlay(); }
    else {
      const dur = durOf(st) / play.speed;
      const f = clamp((now - play.t0) / dur, 0, 1);
      animateStep(st, f);
      if (f >= 1) {
        commitStep(st);
        play.idx++;
        if (play.idx >= S.script.length) {
          if (play.loop) { enterPlay(0); play.playing = true; }
          else finishPlay();
        } else startStep();
      }
    }
    render();
    playSlider.value = play.idx;
    stepCounter.textContent = `${play.idx} / ${S.script.length} étapes`;
  }
  requestAnimationFrame(tick);
}
function finishPlay() {
  play.playing = false; play.paused = false; play.partial = null; play.ghost = null;
  setPlayButtons(); syncScriptUI();
}

/* rendu intermédiaire d'une étape */
function animateStep(st, f) {
  switch (st.t) {
    case "show":
      S.inst[st.i].visible = true;
      play.partial = { instAlpha: st.i, frac: f };
      break;
    case "pose": {
      const p = S.inst[st.i], from = play.poseFrom || Object.assign({}, p);
      for (const k in st.props) {
        if (k === "flip" || k === "side" || k === "eqFlip") {
          if (f >= 0.5) p[k] = st.props[k];
        } else if (typeof st.props[k] === "number" && typeof from[k] === "number") {
          let target = st.props[k], start = from[k];
          if (k === "angle" || k === "tip") {
            let d = target - start;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            p[k] = start + d * f;
          } else p[k] = lerp(start, target, f);
        } else if (f >= 1) p[k] = st.props[k];
      }
      break;
    }
    case "segment": case "fleche": {
      play.partial = { obj: { type: st.t, ...st }, frac: f };
      play.ghost = { x: lerp(st.x1, st.x2, f), y: lerp(st.y1, st.y2, f),
                     angle: Math.atan2(st.y2 - st.y1, st.x2 - st.x1) + Math.PI / 2 };
      break;
    }
    case "arc": {
      play.partial = { obj: { type: "arc", ...st }, frac: f };
      const a = st.a1 + (st.a2 - st.a1) * f;
      if (S.inst.compas.visible) S.inst.compas.tip = a;
      else play.ghost = { x: st.cx + st.r * Math.cos(a), y: st.cy + st.r * Math.sin(a), angle: a + Math.PI / 2 };
      break;
    }
    case "circle": {
      play.partial = { obj: { type: "circle", ...st }, frac: f };
      const a = TAU * f;
      if (S.inst.compas.visible) S.inst.compas.tip = a;
      else play.ghost = { x: st.cx + st.r * Math.cos(a), y: st.cy + st.r * Math.sin(a), angle: a + Math.PI / 2 };
      break;
    }
    case "point": case "croix": case "text": case "stroke": case "line": case "polygone": case "cadre":
      play.partial = { obj: { type: st.t, ...st }, frac: f };
      if (st.t === "stroke") {
        const i = clamp(Math.floor(st.pts.length * f), 0, st.pts.length - 1);
        play.ghost = { x: st.pts[i][0], y: st.pts[i][1], angle: -1 };
      } else if (st.t === "line") {
        play.ghost = { x: lerp(st.x1, st.x2, f), y: lerp(st.y1, st.y2, f),
                       angle: Math.atan2(st.y2 - st.y1, st.x2 - st.x1) + Math.PI / 2 };
      }
      break;
    case "movePoint": {
      const o = S.objects.find(o => o.type === "point" && o.label === st.label);
      if (o && play.poseFrom == null) play.poseFrom = { x: o.x, y: o.y };
      if (o) { o.x = lerp(play.poseFrom.x, st.x, f); o.y = lerp(play.poseFrom.y, st.y, f); }
      break;
    }
    case "moveObj": {
      const o = play.objRef || (play.objRef = S.objects.find(o => o._step === st.ref));
      if (o) {
        const prev = play.lastF || 0;
        translateObject(o, st.dx * (f - prev), st.dy * (f - prev));
        play.lastF = f;
      }
      break;
    }
    case "hide":
      play.partial = { instAlpha: st.i, frac: 1 - f };
      if (f >= 1) S.inst[st.i].visible = false;
      break;
    case "bgimg":
      loadStepImage(st, () => { bgImg = st._img; });
      play.partial = { bgA: (st.a != null ? st.a : bgAlpha) * f };   // fondu d'apparition
      break;
    case "bgpose": {
      const from = play.poseFrom || (play.poseFrom = { x: bgX, y: bgY, s: bgS, a: bgAlpha });
      bgX = lerp(from.x, st.x, f); bgY = lerp(from.y, st.y, f); bgS = lerp(from.s, st.s, f);
      if (st.a != null) bgAlpha = lerp(from.a, st.a, f);
      break;
    }
    default: break;
  }
}

/* ----- boutons du lecteur ----- */
document.getElementById("btnPlay").onclick = () => {
  if (!S.script.length) { scriptMsg.textContent = "Le script est vide : construisez ou chargez un exemple."; return; }
  scriptMsg.textContent = "";
  if (!play.active) { enterPlay(0); play.playing = true; startStep(); }
  else if (play.paused) { play.paused = false; play.t0 = performance.now() - play.elapsed; }
  else if (!play.playing) { enterPlay(0); play.playing = true; startStep(); }
  setPlayButtons();
};
document.getElementById("btnPause").onclick = () => {
  if (play.active && play.playing) { play.paused = true; play.elapsed = performance.now() - play.t0; setPlayButtons(); }
};
document.getElementById("btnNext").onclick = () => {
  if (!play.active) { if (S.script.length) { enterPlay(0); play.playing = false; play.paused = true; } else return; }
  if (play.idx < S.script.length) {
    const st = S.script[play.idx];
    animateStep(st, 1); commitStep(st); play.idx++;
    if (play.idx < S.script.length) startStep();
    else finishPlay();
    play.paused = true; setPlayButtons(); syncScriptUI(); render();
    playSlider.value = play.idx;
    stepCounter.textContent = `${play.idx} / ${S.script.length} étapes`;
  }
};
document.getElementById("btnPrev").onclick = () => {
  if (!play.active) return;
  const target = Math.max(0, play.idx - 1);
  const keep = S.script.slice();
  S.objects = []; S.inst = defaultInstruments(); S.grid = "blanc"; S.labelN = 0;
  for (let i = 0; i < target; i++) applyStep(keep[i]);
  play.idx = target; play.partial = null; play.ghost = null;
  play.playing = false; play.paused = true;
  startStep(); setPlayButtons(); render();
  playSlider.value = play.idx;
  stepCounter.textContent = `${play.idx} / ${S.script.length} étapes`;
};
playSlider.oninput = () => {
  const target = +playSlider.value;
  if (!play.active) { enterPlay(target); play.playing = false; play.paused = true; }
  else {
    const keep = S.script.slice();
    S.objects = []; S.inst = defaultInstruments(); S.grid = "blanc"; S.labelN = 0;
    for (let i = 0; i < target; i++) applyStep(keep[i]);
    play.idx = target; play.partial = null; play.ghost = null;
    if (play.playing) startStep();
  }
  stepCounter.textContent = `${play.idx} / ${S.script.length} étapes`;
  render();
};
document.getElementById("speedSel").onchange = e => {
  play.speed = +e.target.value;
  V.speed = play.speed;                                    // vitesse partagée avec la visionneuse
  document.getElementById("vSpeed").value = e.target.value;
};
document.getElementById("loopChk").onchange = e => { play.loop = e.target.checked; };
document.getElementById("btnExitPlay").onclick = exitPlay;

/* ============================================================
   IMPORT / EXPORT / EXEMPLES
   ============================================================ */
document.getElementById("exportBtn").onclick = () => {
  const blob = new Blob([scriptArea.value || "[]"], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "construction-instrumenpoche.json";
  a.click();
  URL.revokeObjectURL(a.href);
};
document.getElementById("importBtn").onclick = () => document.getElementById("importFile").click();
document.getElementById("importFile").onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const steps = JSON.parse(rd.result);
      if (!Array.isArray(steps)) throw new Error("tableau attendu");
      loadSteps(steps);
      addToBiblio(f.name.replace(/\.[^.]+$/, ""), steps, "Importés");   // devient un lien de la bibliothèque
      scriptMsg.style.color = "#2a7";
      scriptMsg.textContent = `Importé et ajouté à la bibliothèque : ${steps.length} étapes.`;
      setTimeout(() => { scriptMsg.textContent = ""; scriptMsg.style.color = "#a33"; }, 3000);
    } catch (err) {
      scriptMsg.style.color = "#a33";
      scriptMsg.textContent = "Script invalide : " + err.message;
    }
    e.target.value = "";
  };
  rd.readAsText(f);
};
document.getElementById("applyScriptBtn").onclick = () => loadScript(scriptArea.value);
function loadSteps(steps) {
  if (play.active) exitPlay();
  S.script = steps;
  rebuild(); syncScriptUI();
}
function loadScript(txt) {
  try {
    const steps = JSON.parse(txt);
    if (!Array.isArray(steps)) throw new Error("tableau attendu");
    loadSteps(steps);
    scriptMsg.style.color = "#2a7"; scriptMsg.textContent = `Script appliqué : ${steps.length} étapes.`;
    setTimeout(() => { scriptMsg.textContent = ""; scriptMsg.style.color = "#a33"; }, 3000);
  } catch (err) {
    scriptMsg.style.color = "#a33";
    scriptMsg.textContent = "Script invalide : " + err.message;
  }
}

/* ============================================================
   BIBLIOTHÈQUE — liens vers des constructions
   Exemples intégrés + constructions enregistrées (localStorage)
   ============================================================ */
const BIBLIO_EXEMPLES = [
  ["Triangle équilatéral au compas", "triangle", "Triangles"],
  ["Angle de 60° au compas", "angle60", "Triangles"],
  ["Médiatrice d'un segment (compas)", "mediatrice", "Médiatrices"],
  ["Cercle de diamètre [AB]", "cercleDiametre", "Cercles"],
  ["Perpendiculaire à (d) hors (d) (compas)", "perpCompas", "Parallèles et perpendiculaires"],
  ["Parallèle à (d) par un point (équerre)", "parallele", "Parallèles et perpendiculaires"],
  ["Perpendiculaire à la règle-équerre", "perpendiculaire", "Parallèles et perpendiculaires"],
];
const BIBLIO_KEY = "iep_biblio_v1";
function getBiblio() {
  try { return JSON.parse(localStorage.getItem(BIBLIO_KEY)) || []; }
  catch { return []; }
}
function setBiblio(arr) { localStorage.setItem(BIBLIO_KEY, JSON.stringify(arr)); }
function addToBiblio(name, steps, cat = "") {
  const arr = getBiblio().filter(e => !(e.name === name && (e.cat || "") === cat));   // dédoublonner
  arr.push({ name, steps, cat });
  setBiblio(arr); renderBiblio();
}
const bibCollapsed = {};
function renderBiblio() {
  const ul = document.getElementById("biblioList");
  ul.innerHTML = "";
  const head = txt => {
    const li = document.createElement("li");
    li.className = "bib-head"; li.textContent = txt; ul.appendChild(li);
  };
  const link = (txt, fn) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "#"; a.className = "bib-link"; a.textContent = txt;
    a.onclick = e => { e.preventDefault(); fn(); };
    li.appendChild(a); ul.appendChild(li);
    return li;
  };
  const delBtn = i => {
    const del = document.createElement("button");
    del.type = "button"; del.className = "bib-del"; del.textContent = "×";
    del.title = "Retirer de la bibliothèque";
    del.onclick = e => {
      e.stopPropagation();
      const arr = getBiblio(); arr.splice(i, 1); setBiblio(arr); renderBiblio();
    };
    return del;
  };
  // rend un chapitre repliable (« ▾ Chapitre » cliquable) contenant ses liens ;
  // le clic ouvre aussi la « page du chapitre » avec ses étiquettes
  const chapter = (cat, items, makeItem, pageItems) => {
    const li = document.createElement("li");
    li.className = "bib-cat";
    const open = !bibCollapsed[cat];
    li.textContent = (open ? "▾ " : "▸ ") + cat;
    li.title = "Ouvrir la page du chapitre";
    li.onclick = () => {
      bibCollapsed[cat] = open; renderBiblio();
      openChapter(cat, pageItems);
    };
    ul.appendChild(li);
    if (open) items.forEach(makeItem);
  };

  head("Constructions d'exemple");
  // regrouper les exemples par chapitre
  const exGroups = new Map();
  for (const [nom, k, cat] of BIBLIO_EXEMPLES) {
    if (!exGroups.has(cat)) exGroups.set(cat, []);
    exGroups.get(cat).push([nom, k]);
  }
  for (const [cat, items] of exGroups) {
    const sibs = items.map(([nom, k]) => ({ name: nom, getSteps: () => EXAMPLES[k]() }));
    chapter(cat, items,
      ([nom, k]) => {
        const li = link(nom, () => { openViewer(nom, EXAMPLES[k](), sibs); });
        li.classList.add("bib-sub");
      },
      items.map(([nom, k]) => ({ name: nom, open: () => openViewer(nom, EXAMPLES[k](), sibs) })));
  }

  const user = getBiblio();
  if (!user.length) return;
  head("Mes constructions");
  // regroupement par chapitre (cat) — sections repliables
  const groups = new Map();
  user.forEach((entry, i) => {
    const c = entry.cat || "Divers";
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c).push({ entry, i });
  });
  for (const [cat, items] of groups) {
    const sibs = items.map(({ entry }) => ({ name: entry.name, getSteps: () => entry.steps }));
    const renderItems = () => items.forEach(({ entry, i }) => {
      const li = link(entry.name, () => { openViewer(entry.name, entry.steps, sibs); });
      li.classList.add("bib-sub");
      li.appendChild(delBtn(i));
    });
    if (groups.size > 1 || cat !== "Divers")
      chapter(cat, items, renderItems,
        items.map(({ entry }) => ({ name: entry.name, open: () => openViewer(entry.name, entry.steps, sibs) })));
    else renderItems();
  }
}
document.getElementById("saveBiblioBtn").onclick = () => {
  if (!S.script.length) { scriptMsg.textContent = "Rien à enregistrer : le script est vide."; return; }
  const name = prompt("Nom de la construction.\nPour la ranger dans un chapitre, écrivez « Chapitre / Nom » :", "Ma construction");
  if (name && name.trim()) {
    const parts = name.split("/").map(s => s.trim()).filter(Boolean);
    const nom = parts.pop();
    const cat = parts.join(" / ");
    addToBiblio(nom, S.script.slice(), cat);
    scriptMsg.style.color = "#2a7";
    scriptMsg.textContent = `« ${nom} » ajouté à la bibliothèque${cat ? " (" + cat + ")" : ""}.`;
    setTimeout(() => { scriptMsg.textContent = ""; scriptMsg.style.color = "#a33"; }, 3000);
  }
};
renderBiblio();

/* ----- Page de chapitre : étiquettes des exercices ----- */
function openChapter(cat, pageItems) {
  document.getElementById("navTitle").textContent = cat;
  const box = document.getElementById("navCards");
  box.innerHTML = "";
  for (const it of pageItems) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "nav-card"; b.textContent = it.name;
    b.onclick = () => { closeNav(); it.open(); };
    box.appendChild(b);
  }
  document.getElementById("navModal").classList.remove("hidden");
}
function closeNav() { document.getElementById("navModal").classList.add("hidden"); }
document.getElementById("navClose").onclick = closeNav;
document.getElementById("navModal").addEventListener("pointerdown", e => {
  if (e.target === document.getElementById("navModal")) closeNav();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !document.getElementById("navModal").classList.contains("hidden")) closeNav();
});

/* ============================================================
   VISIONNEUSE — ouvre une construction dans une fenêtre encadrée
   (lecture animée autonome, sans toucher la feuille d'édition)
   ============================================================ */
const vCanvas = document.getElementById("vCanvas");
const vCtx = vCanvas.getContext("2d");
const vModal = document.getElementById("viewerModal");
const vCaption = document.getElementById("vCaption");
const vSlider = document.getElementById("vSlider");
const vCounter = document.getElementById("vCounter");

const V = { open: false, steps: [], idx: 0, playing: false, paused: false,
            t0: 0, elapsed: 0, speed: 1,
            objects: [], inst: null, grid: "blanc",
            partial: null, ghost: null, poseFrom: null, lastF: 0, objRef: null,
            siblings: null, sibIdx: -1,
            bgImg: null, bgAlpha: 0.65, bgX: 0, bgY: 0, bgS: 1 };

function vApply(st, i) {
  switch (st.t) {
    case "bgimg":
      loadStepImage(st, () => { V.bgImg = st._img; });
      V.bgX = 0; V.bgY = 0; V.bgS = 1;
      if (st.a != null) V.bgAlpha = st.a;
      break;
    case "bgpose":
      V.bgX = st.x; V.bgY = st.y; V.bgS = st.s;
      if (st.a != null) V.bgAlpha = st.a;
      break;
    case "paper": V.grid = st.grid; break;
    case "show": V.inst[st.i].visible = true; break;
    case "hide": V.inst[st.i].visible = false; break;
    case "pose": Object.assign(V.inst[st.i], st.props); break;
    case "movePoint": {
      const o = V.objects.find(o => o.type === "point" && o.label === st.label);
      if (o) { o.x = st.x; o.y = st.y; }
      break;
    }
    case "moveObj": {
      const o = V.objects.find(o => o._step === st.ref);
      if (o) translateObject(o, st.dx, st.dy);
      break;
    }
    case "editText": {
      const o = V.objects.find(o => o._step === st.ref);
      if (o) o.str = st.str;
      break;
    }
    default: {
      const o = Object.assign({ type: st.t }, st);
      delete o.t; delete o.msg;
      o._step = i;
      V.objects.push(o);
    }
  }
}
function vDur(st) {
  if (st.t === "stroke") return clamp(st.pts.length * 22, 300, 2500);
  if (st.t === "polygone") return 400 + st.pts.length * 160;
  if (st.t === "pose") {
    const p = V.inst[st.i];
    const d = st.props.x != null ? dist(p.x, p.y, st.props.x, st.props.y ?? p.y) : 0;
    return clamp(400 + d * 0.6, 400, 1400);
  }
  return DUR[st.t] || 400;
}
function vReset(target) {
  V.objects = []; V.inst = defaultInstruments(); V.grid = "blanc";
  V.bgImg = null; V.bgX = 0; V.bgY = 0; V.bgS = 1; V.bgAlpha = 0.65;
  for (let i = 0; i < target; i++) vApply(V.steps[i], i);
  V.idx = target; V.partial = null; V.ghost = null;
  const st = V.steps[V.idx];
  vCaption.textContent = st && st.msg ? st.msg : "";
  vCaption.classList.toggle("hidden", !(st && st.msg));
  vSlider.value = V.idx;
  vCounter.textContent = `${V.idx} / ${V.steps.length} étapes`;
}
function vStartStep() {
  V.t0 = performance.now(); V.elapsed = 0;
  const st = V.steps[V.idx];
  vCaption.textContent = st && st.msg ? st.msg : "";
  vCaption.classList.toggle("hidden", !(st && st.msg));
  V.poseFrom = null; V.lastF = 0; V.objRef = null;
  if (st.t === "pose") V.poseFrom = Object.assign({}, V.inst[st.i]);
  if (st.t === "bgpose") V.poseFrom = { x: V.bgX, y: V.bgY, s: V.bgS, a: V.bgAlpha };
  if (st.t === "moveObj") V.objRef = V.objects.find(o => o._step === st.ref) || null;
  if (st.t === "arc" || st.t === "circle") {
    const c = V.inst.compas;
    if (c.visible) { c.x = st.cx; c.y = st.cy; c.r = st.r; c.tip = st.t === "arc" ? st.a1 : 0; }
  }
}
function vAnimate(st, f) {
  switch (st.t) {
    case "show":
      V.inst[st.i].visible = true;
      V.partial = { instAlpha: st.i, frac: f };
      break;
    case "pose": {
      const p = V.inst[st.i], from = V.poseFrom || Object.assign({}, p);
      for (const k in st.props) {
        if (k === "flip" || k === "side" || k === "eqFlip") {
          if (f >= 0.5) p[k] = st.props[k];
        } else if (typeof st.props[k] === "number" && typeof from[k] === "number") {
          let target = st.props[k], start = from[k];
          if (k === "angle" || k === "tip") {
            let d = Math.atan2(Math.sin(target - start), Math.cos(target - start));
            p[k] = start + d * f;
          } else p[k] = lerp(start, target, f);
        } else if (f >= 1) p[k] = st.props[k];
      }
      break;
    }
    case "segment": case "fleche":
      V.partial = { obj: { type: st.t, ...st }, frac: f };
      V.ghost = { x: lerp(st.x1, st.x2, f), y: lerp(st.y1, st.y2, f),
                  angle: Math.atan2(st.y2 - st.y1, st.x2 - st.x1) + Math.PI / 2 };
      break;
    case "arc": {
      V.partial = { obj: { type: "arc", ...st }, frac: f };
      const a = st.a1 + (st.a2 - st.a1) * f;
      if (V.inst.compas.visible) V.inst.compas.tip = a;
      else V.ghost = { x: st.cx + st.r * Math.cos(a), y: st.cy + st.r * Math.sin(a), angle: a + Math.PI / 2 };
      break;
    }
    case "circle": {
      V.partial = { obj: { type: "circle", ...st }, frac: f };
      const a = TAU * f;
      if (V.inst.compas.visible) V.inst.compas.tip = a;
      else V.ghost = { x: st.cx + st.r * Math.cos(a), y: st.cy + st.r * Math.sin(a), angle: a + Math.PI / 2 };
      break;
    }
    case "point": case "croix": case "text": case "stroke": case "line": case "polygone": case "cadre":
      V.partial = { obj: { type: st.t, ...st }, frac: f };
      if (st.t === "stroke") {
        const i = clamp(Math.floor(st.pts.length * f), 0, st.pts.length - 1);
        V.ghost = { x: st.pts[i][0], y: st.pts[i][1], angle: -1 };
      } else if (st.t === "line") {
        V.ghost = { x: lerp(st.x1, st.x2, f), y: lerp(st.y1, st.y2, f),
                    angle: Math.atan2(st.y2 - st.y1, st.x2 - st.x1) + Math.PI / 2 };
      }
      break;
    case "movePoint": {
      const o = V.objects.find(o => o.type === "point" && o.label === st.label);
      if (o && V.poseFrom == null) V.poseFrom = { x: o.x, y: o.y };
      if (o) { o.x = lerp(V.poseFrom.x, st.x, f); o.y = lerp(V.poseFrom.y, st.y, f); }
      break;
    }
    case "moveObj": {
      const o = V.objRef || (V.objRef = V.objects.find(o => o._step === st.ref));
      if (o) {
        translateObject(o, st.dx * (f - (V.lastF || 0)), st.dy * (f - (V.lastF || 0)));
        V.lastF = f;
      }
      break;
    }
    case "hide":
      V.partial = { instAlpha: st.i, frac: 1 - f };
      if (f >= 1) V.inst[st.i].visible = false;
      break;
    case "bgimg":
      loadStepImage(st, () => { V.bgImg = st._img; });
      V.partial = { bgA: (st.a != null ? st.a : V.bgAlpha) * f };
      break;
    case "bgpose": {
      const from = V.poseFrom || (V.poseFrom = { x: V.bgX, y: V.bgY, s: V.bgS, a: V.bgAlpha });
      V.bgX = lerp(from.x, st.x, f); V.bgY = lerp(from.y, st.y, f); V.bgS = lerp(from.s, st.s, f);
      if (st.a != null) V.bgAlpha = lerp(from.a, st.a, f);
      break;
    }
    default: break;
  }
}
function vRender() {
  const w = vCanvas.clientWidth, h = vCanvas.clientHeight;
  if (!w || !h) return;
  drawGrid(vCtx, w, h, V.grid);
  if (V.bgImg) {
    const sc = Math.min(w / V.bgImg.width, h / V.bgImg.height) * V.bgS;
    const iw = V.bgImg.width * sc, ih = V.bgImg.height * sc;
    vCtx.save();
    vCtx.globalAlpha = (V.partial && V.partial.bgA != null) ? V.partial.bgA : V.bgAlpha;
    vCtx.drawImage(V.bgImg, (w - iw) / 2 + V.bgX, (h - ih) / 2 + V.bgY, iw, ih);
    vCtx.restore();
  }
  drawObjects(vCtx, V.objects);
  if (V.partial && V.partial.obj) drawObject(vCtx, V.partial.obj, V.partial.frac);
  for (const k of DRAW_ORDER) {
    const p = V.inst[k];
    if (!p.visible) continue;
    vCtx.save();
    if (V.partial && V.partial.instAlpha === k) vCtx.globalAlpha = V.partial.frac;
    INSTRUMENTS[k].draw(vCtx, p, false);
    vCtx.restore();
  }
  if (V.ghost) {
    const g = { kind: "crayon", x: V.ghost.x, y: V.ghost.y, angle: V.ghost.angle };
    vCtx.save(); INSTRUMENTS.crayon.draw(vCtx, g, false); vCtx.restore();
  }
}
function vFinish() { V.playing = false; V.paused = false; vUI(); }
function vUI() {
  document.getElementById("vPlayPause").textContent =
    (V.playing && !V.paused) ? "⏸" : "▶";
  const hasS = V.siblings && V.siblings.length > 1;
  document.getElementById("vPrevExo").disabled = !(hasS && V.sibIdx > 0);
  document.getElementById("vNextExo").disabled = !(hasS && V.sibIdx >= 0 && V.sibIdx < V.siblings.length - 1);
}
function vTick(now) {
  if (!V.open) { V.raf = false; return; }
  if (V.playing && !V.paused) {
    const st = V.steps[V.idx];
    if (!st) vFinish();
    else {
      const dur = vDur(st) / V.speed;
      const f = clamp((now - V.t0) / dur, 0, 1);
      vAnimate(st, f);
      if (f >= 1) {
        if (st.t !== "moveObj") vApply(st, V.idx);
        V.partial = null; V.ghost = null;
        V.idx++;
        if (V.idx >= V.steps.length) vFinish(); else vStartStep();
      }
      vSlider.value = V.idx;
      vCounter.textContent = `${V.idx} / ${V.steps.length} étapes`;
    }
  }
  vRender();
  requestAnimationFrame(vTick);
}
function openViewer(title, steps, siblings) {
  if (play.active) exitPlay();
  V.open = true; V.steps = steps.slice();
  V.speed = +document.getElementById("vSpeed").value || 1;
  play.speed = V.speed;                                    // garder le lecteur principal synchronisé
  V.siblings = siblings || null;
  V.sibIdx = siblings ? siblings.findIndex(s => s.name === title) : -1;
  V.playing = true; V.paused = false;
  document.getElementById("viewerTitle").textContent = title;
  vModal.classList.remove("hidden");
  const r = vCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  vCanvas.width = Math.round(r.width * dpr);
  vCanvas.height = Math.round(r.height * dpr);
  vCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  vSlider.max = V.steps.length;
  vReset(0); vStartStep(); vUI();
  if (!V.raf) { V.raf = true; requestAnimationFrame(vTick); }   // une seule boucle
}
function closeViewer() {
  V.open = false; V.playing = false;
  vModal.classList.add("hidden");
}
document.getElementById("vClose").onclick = closeViewer;
vModal.addEventListener("pointerdown", e => { if (e.target === vModal) closeViewer(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && V.open) closeViewer(); });
document.getElementById("vPlayPause").onclick = () => {
  if (!V.playing) {                       // terminé → relire
    vReset(0); V.playing = true; V.paused = false; vStartStep();
  } else if (V.paused) {
    V.paused = false; V.t0 = performance.now() - V.elapsed;
  } else {
    V.paused = true; V.elapsed = performance.now() - V.t0;
  }
  vUI();
};
document.getElementById("vNext").onclick = () => {
  if (V.idx >= V.steps.length) return;
  const st = V.steps[V.idx];
  vAnimate(st, 1);
  if (st.t !== "moveObj") vApply(st, V.idx);
  V.partial = null; V.ghost = null; V.idx++;
  V.paused = true;
  if (V.idx < V.steps.length) vStartStep(); else vFinish();
  vSlider.value = V.idx;
  vCounter.textContent = `${V.idx} / ${V.steps.length} étapes`;
  vUI(); vRender();
};
document.getElementById("vPrev").onclick = () => {
  vReset(Math.max(0, V.idx - 1));
  V.paused = true; vUI(); vRender();
};
vSlider.oninput = () => {
  vReset(+vSlider.value);
  V.paused = true; vUI(); vRender();
};
document.getElementById("vSpeed").onchange = e => {
  V.speed = +e.target.value;
  play.speed = V.speed;                                    // vitesse partagée avec le lecteur principal
  document.getElementById("speedSel").value = e.target.value;
};
const vNavExo = dir => () => {
  if (!V.siblings) return;
  const ni = V.sibIdx + dir;
  if (ni < 0 || ni >= V.siblings.length) return;
  const s = V.siblings[ni];
  openViewer(s.name, s.getSteps(), V.siblings);
};
document.getElementById("vPrevExo").onclick = vNavExo(-1);
document.getElementById("vNextExo").onclick = vNavExo(1);
document.getElementById("vEdit").onclick = () => {
  const steps = V.steps.slice();
  closeViewer();
  loadSteps(steps);                       // charger sur la feuille pour modifier
};

/* ---------------- init ---------------- */
S.script.push({ t: "paper", grid: S.grid });   // mémoriser le quadrillage initial
resizeCanvas();
syncScriptUI();
updateContextBar();
requestAnimationFrame(tick);
