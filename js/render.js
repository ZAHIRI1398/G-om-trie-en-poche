/* ============================================================
   InstrumenPoche Web — moteur de rendu
   Quadrillages, objets géométriques, instruments virtuels.
   ============================================================ */
"use strict";

const TAU = Math.PI * 2;
const MM = 3.8;                       // pixels par millimètre
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

/* ---------- coordonnées locales d'un instrument ---------- */
function toLocal(inst, wx, wy) {
  const c = Math.cos(-inst.angle), s = Math.sin(-inst.angle);
  const dx = wx - inst.x, dy = wy - inst.y;
  return { x: (c * dx - s * dy) * (inst.flip || 1), y: s * dx + c * dy };
}
function toWorld(inst, lx, ly) {
  lx *= (inst.flip || 1);
  const c = Math.cos(inst.angle), s = Math.sin(inst.angle);
  return { x: inst.x + c * lx - s * ly, y: inst.y + s * lx + c * ly };
}
function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
  let t = L2 ? ((px - x1) * dx + (py - y1) * dy) / L2 : 0;
  t = clamp(t, 0, 1);
  return { d: dist(px, py, x1 + t * dx, y1 + t * dy), t };
}
function projOnSeg(px, py, x1, y1, x2, y2, extra = 0) {
  const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
  let t = L2 ? ((px - x1) * dx + (py - y1) * dy) / L2 : 0;
  const L = Math.sqrt(L2) || 1;
  t = clamp(t, -extra / L, 1 + extra / L);
  return { x: x1 + t * dx, y: y1 + t * dy, t };
}
function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(neg && pos);
}

/* ============================================================
   Quadrillages de la feuille
   ============================================================ */
function drawGrid(ctx, w, h, type) {
  ctx.fillStyle = "#fffdf6";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  if (type === "carreaux") {
    gridLines(ctx, w, h, 5 * MM, "#bcd2e8", true);
    gridLines(ctx, w, h, 20 * MM, "#8fb4d8", false);
  } else if (type === "seyes") {
    // grands carreaux Seyès ~8 mm avec réglure horizontale
    const g = 8 * MM;
    ctx.strokeStyle = "#9fc2e0"; ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += g) line(ctx, x, 0, x, h);
    for (let y = 0; y <= h; y += g) line(ctx, 0, y, w, y);
    ctx.strokeStyle = "#d4e4f2"; ctx.lineWidth = 0.6;
    for (let y = g / 4; y <= h; y += g / 4) line(ctx, 0, y, w, y);
  } else if (type === "millimetre") {
    gridLines(ctx, w, h, 2 * MM, "#f0c9c9", true);
    gridLines(ctx, w, h, 10 * MM, "#dfa0a0", false);
    gridLines(ctx, w, h, 50 * MM, "#c87878", false);
  } else if (type === "repere") {
    gridLines(ctx, w, h, 10 * MM, "#e2e8ef", true);
    const cx = w / 2, cy = h / 2;
    ctx.strokeStyle = "#333"; ctx.lineWidth = 1.4; ctx.fillStyle = "#333";
    arrow(ctx, 12, cy, w - 8, cy); arrow(ctx, cx, h - 12, cx, 8);
    ctx.font = "11px Arial"; ctx.textAlign = "center";
    for (let x = cx + 10 * MM; x < w - 15; x += 10 * MM) tickX(ctx, x, cy);
    for (let x = cx - 10 * MM; x > 15; x -= 10 * MM) tickX(ctx, x, cy);
    for (let y = cy - 10 * MM; y > 15; y -= 10 * MM) tickY(ctx, cx, y);
    for (let y = cy + 10 * MM; y < h - 15; y += 10 * MM) tickY(ctx, cx, y);
    ctx.fillText("O", cx - 9, cy + 13);
    ctx.fillText("x", w - 14, cy - 6);
    ctx.fillText("y", cx + 10, 14);
  }
  ctx.restore();
}
function gridLines(ctx, w, h, step, color, thin) {
  ctx.strokeStyle = color; ctx.lineWidth = thin ? 0.5 : 1;
  ctx.beginPath();
  for (let x = 0; x <= w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = 0; y <= h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
}
function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function arrow(ctx, x1, y1, x2, y2) {
  line(ctx, x1, y1, x2, y2);
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 8 * Math.cos(a - .4), y2 - 8 * Math.sin(a - .4));
  ctx.lineTo(x2 - 8 * Math.cos(a + .4), y2 - 8 * Math.sin(a + .4));
  ctx.closePath(); ctx.fill();
}
function tickX(ctx, x, y) { line(ctx, x, y - 4, x, y + 4); }
function tickY(ctx, x, y) { line(ctx, x - 4, y, x + 4, y); }

/* ============================================================
   Objets géométriques tracés sur la feuille
   ============================================================ */
const INK = "#20355e";
function drawObjects(ctx, objects) {
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const o of objects) drawObject(ctx, o);
  ctx.restore();
}
function drawObject(ctx, o, frac = 1) {
  ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 1.6;
  switch (o.type) {
    case "segment": {
      const x2 = lerp(o.x1, o.x2, frac), y2 = lerp(o.y1, o.y2, frac);
      line(ctx, o.x1, o.y1, x2, y2);
      break;
    }
    case "line": {   // droite passant par (x1,y1) et (x2,y2)
      const dx = o.x2 - o.x1, dy = o.y2 - o.y1, L = Math.hypot(dx, dy) || 1;
      const ux = dx / L, uy = dy / L, ext = 1400 * frac;
      line(ctx, o.x1 - ux * ext, o.y1 - uy * ext, o.x2 + ux * ext, o.y2 + uy * ext);
      break;
    }
    case "arc": {
      const sweep = o.a2 - o.a1;
      ctx.beginPath();
      ctx.arc(o.cx, o.cy, o.r, o.a1, o.a1 + sweep * frac, sweep < 0);
      ctx.stroke();
      break;
    }
    case "circle": {
      ctx.beginPath();
      ctx.arc(o.cx, o.cy, o.r, 0, TAU * frac);
      ctx.stroke();
      break;
    }
    case "point": {
      ctx.globalAlpha = frac;
      ctx.beginPath(); ctx.arc(o.x, o.y, 2.6, 0, TAU); ctx.fill();
      ctx.font = "italic bold 14px Georgia"; ctx.textAlign = "left";
      ctx.fillText(o.label || "", o.x + 7, o.y - 7);
      ctx.globalAlpha = 1;
      break;
    }
    case "croix": {  // petit repère de construction (marque d'angle, intersection…)
      ctx.globalAlpha = frac; ctx.lineWidth = 1.2;
      line(ctx, o.x - 4, o.y - 4, o.x + 4, o.y + 4);
      line(ctx, o.x - 4, o.y + 4, o.x + 4, o.y - 4);
      ctx.globalAlpha = 1;
      break;
    }
    case "text": {
      ctx.globalAlpha = frac;
      ctx.font = "15px Georgia"; ctx.textAlign = "left";
      ctx.fillText(o.str, o.x, o.y);
      ctx.globalAlpha = 1;
      break;
    }
    case "stroke": {
      const n = Math.max(2, Math.ceil(o.pts.length * frac));
      ctx.beginPath();
      ctx.moveTo(o.pts[0][0], o.pts[0][1]);
      for (let i = 1; i < n; i++) ctx.lineTo(o.pts[i][0], o.pts[i][1]);
      ctx.stroke();
      break;
    }
    case "polygone": {
      const P = o.pts;
      let total = 0; const cum = [0];
      for (let i = 0; i < P.length; i++) {
        const a = P[i], b = P[(i + 1) % P.length];
        total += dist(a[0], a[1], b[0], b[1]); cum.push(total);
      }
      let rem = total * frac;
      if (frac >= 1) {                       // remplissage léger quand terminé
        ctx.fillStyle = "rgba(32,53,94,.08)";
        ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]);
        for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
        ctx.closePath(); ctx.fill();
      }
      ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]);
      for (let i = 0; i < P.length && rem > 0; i++) {
        const a = P[i], b = P[(i + 1) % P.length], L = cum[i + 1] - cum[i];
        const t = L ? Math.min(1, rem / L) : 0; rem -= L;
        ctx.lineTo(lerp(a[0], b[0], t), lerp(a[1], b[1], t));
      }
      ctx.stroke();
      break;
    }
    case "polyPreview": {                    // polygone en cours de saisie
      const P = o.pts;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]);
      for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
      ctx.stroke();
      ctx.setLineDash([5, 4]);               // côté flottant vers le curseur
      ctx.beginPath();
      ctx.moveTo(P[P.length - 1][0], P[P.length - 1][1]);
      ctx.lineTo(o.cur.x, o.cur.y);
      if (P.length >= 3) { ctx.moveTo(o.cur.x, o.cur.y); ctx.lineTo(P[0][0], P[0][1]); }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(P[0][0], P[0][1], 6, 0, TAU); ctx.stroke();  // 1er sommet
      break;
    }
  }
}

/* ============================================================
   INSTRUMENTS — chaque instrument définit :
   draw(ctx, inst, sel)      : aspect + poignées si sel
   edges(inst)               : segments « bords » pour tracer (coords locales)
   bodyHit(inst, lx, ly)     : test d'appartenance du corps (coords locales)
   handles(inst)             : poignées en coords monde {id,x,y}
   ============================================================ */
const INSTRUMENTS = {

  /* ---------- CRAYON ---------- */
  crayon: {
    draw(ctx, p, sel) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      // corps du crayon
      ctx.fillStyle = "#f5b942"; ctx.strokeStyle = "#9a6b12"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.rect(-4, -70, 8, 58); ctx.fill(); ctx.stroke();
      // mine
      ctx.fillStyle = "#4a4a4a";
      ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(0, 0); ctx.lineTo(4, -12); ctx.closePath();
      ctx.fill();
      // gomme
      ctx.fillStyle = "#e88"; ctx.fillRect(-4, -74, 8, 6);
      ctx.restore();
      if (sel) drawHandle(ctx, p.x, p.y - 84, "move");
    },
    edges() { return []; },
    bodyHit(p, lx, ly) {
      const q = toLocal(p, lx, ly);
      return Math.abs(q.x) < 10 && q.y > -80 && q.y < 6;
    },
    handles(p) { return [{ id: "move", x: p.x, y: p.y - 84 }]; },
  },

  /* ---------- RÈGLE ---------- */
  regle: {
    draw(ctx, p, sel) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      const L = p.L, W = p.W;
      ctx.fillStyle = "rgba(247,208,112,.55)";
      ctx.strokeStyle = "#a8741a"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.rect(-L / 2, -W / 2, L, W); ctx.fill(); ctx.stroke();
      // graduations (bord supérieur)
      ctx.strokeStyle = "#7a5410"; ctx.fillStyle = "#7a5410";
      ctx.font = "8px Arial"; ctx.textAlign = "center";
      for (let x = -L / 2 + 8, cm = 0; x <= L / 2 - 8; x += MM, cm += 0.1) {
        const is5 = Math.round(cm * 10) % 5 === 0, is10 = Math.round(cm * 10) % 10 === 0;
        const len = is10 ? 11 : is5 ? 8 : 5;
        line(ctx, x, -W / 2, x, -W / 2 + len);
        if (is10) ctx.fillText(String(Math.round(cm)), x, -W / 2 + 19);
      }
      ctx.restore();
      if (sel) drawHandle(ctx, toWorld(p, p.L / 2 + 24, 0).x, toWorld(p, p.L / 2 + 24, 0).y, "rotate");
    },
    edges(p) {
      const L = p.L, W = p.W;
      return [
        { x1: -L / 2, y1: -W / 2, x2: L / 2, y2: -W / 2 },
        { x1: -L / 2, y1: W / 2, x2: L / 2, y2: W / 2 },
      ];
    },
    bodyHit(p, wx, wy) {
      const q = toLocal(p, wx, wy);
      return Math.abs(q.x) <= p.L / 2 && Math.abs(q.y) <= p.W / 2;
    },
    handles(p) { return [{ id: "rotate", ...toWorld(p, p.L / 2 + 24, 0) }]; },
  },

  /* ---------- ÉQUERRE (45°) ---------- */
  equerre: {
    draw(ctx, p, sel) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.scale(p.flip, 1);
      const a = p.a;
      ctx.fillStyle = "rgba(150,205,245,.5)";
      ctx.strokeStyle = "#2874a6"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(a, 0); ctx.lineTo(0, a); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // découpe intérieure
      const k = 0.42, m = a * 0.20;
      ctx.fillStyle = "rgba(255,253,246,.9)";
      ctx.beginPath(); ctx.moveTo(m + k * a, m); ctx.lineTo(m, m + k * a); ctx.lineTo(m, m); ctx.closePath();
      ctx.beginPath();
      ctx.moveTo(a * .22 + a * .40, a * .18); ctx.lineTo(a * .22, a * .18 + a * .40); ctx.lineTo(a * .22, a * .18);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // graduations sur les deux côtés de l'angle droit
      ctx.strokeStyle = "#1a5276"; ctx.font = "7px Arial"; ctx.textAlign = "center";
      for (let x = 8; x < a - 6; x += MM) {
        const is5 = Math.round(x / MM) % 5 === 0;
        line(ctx, x, 0, x, 3 + (is5 ? 4 : 0));
        line(ctx, 0, x, 3 + (is5 ? 4 : 0), x);
      }
      ctx.restore();
      if (sel) {
        const h = toWorld(p, p.a * .62, p.a * .62);
        drawHandle(ctx, h.x, h.y, "rotate");
      }
    },
    edges(p) {
      const a = p.a;
      return [
        { x1: 0, y1: 0, x2: a, y2: 0 },          // côté horizontal
        { x1: 0, y1: 0, x2: 0, y2: a },          // côté vertical
        { x1: a, y1: 0, x2: 0, y2: a },          // hypoténuse
      ];
    },
    bodyHit(p, wx, wy) {
      const q = toLocal(p, wx, wy), a = p.a;
      return pointInTriangle(q.x, q.y, 0, 0, a, 0, 0, a);
    },
    handles(p) { return [{ id: "rotate", ...toWorld(p, p.a * .62, p.a * .62) }]; },
  },

  /* ---------- COMPAS ---------- */
  compas: {
    tipWorld(p) { return { x: p.x + p.r * Math.cos(p.tip), y: p.y + p.r * Math.sin(p.tip) }; },
    knobWorld(p) {
      // charnière au-dessus du milieu branche/pointe
      const mx = p.x + (p.r / 2) * Math.cos(p.tip), my = p.y + (p.r / 2) * Math.sin(p.tip);
      const px = -Math.sin(p.tip), py = Math.cos(p.tip);
      return { x: mx + p.headH * px, y: my + p.headH * py };
    },
    draw(ctx, p, sel) {
      const tip = this.tipWorld(p), knob = this.knobWorld(p);
      ctx.save();
      ctx.lineCap = "round";
      // branches
      ctx.strokeStyle = "#5d6d7e"; ctx.lineWidth = 6;
      line(ctx, knob.x, knob.y, p.x, p.y);
      line(ctx, knob.x, knob.y, tip.x, tip.y);
      // pointe sèche
      ctx.strokeStyle = "#333"; ctx.lineWidth = 2;
      line(ctx, p.x, p.y, p.x + (knob.x - p.x) * .08, p.y + (knob.y - p.y) * .08);
      // crayon du compas
      const ux = Math.cos(p.tip), uy = Math.sin(p.tip);
      ctx.save(); ctx.translate(tip.x, tip.y); ctx.rotate(Math.atan2(uy, ux) + Math.PI / 2);
      ctx.fillStyle = "#f5b942"; ctx.strokeStyle = "#9a6b12"; ctx.lineWidth = 1;
      ctx.fillRect(-3.5, -30, 7, 30); ctx.strokeRect(-3.5, -30, 7, 30);
      ctx.fillStyle = "#333";
      ctx.beginPath(); ctx.moveTo(-3.5, 0); ctx.lineTo(0, 6); ctx.lineTo(3.5, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
      // charnière
      ctx.fillStyle = "#85929e"; ctx.strokeStyle = "#4d5656";
      ctx.beginPath(); ctx.arc(knob.x, knob.y, 9, 0, TAU); ctx.fill(); ctx.stroke();
      // pointe au centre
      ctx.fillStyle = "#c0392b";
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, TAU); ctx.fill();
      ctx.restore();
      if (sel) {
        drawHandle(ctx, tip.x, tip.y, "tip");
        drawHandle(ctx, knob.x, knob.y, "knob");
        drawHandle(ctx, p.x, p.y, "spike");
      }
    },
    edges() { return []; },
    bodyHit(p, wx, wy) {
      // pointe sèche, charnière ou branches
      if (dist(wx, wy, p.x, p.y) < 12) return true;
      const tip = this.tipWorld(p), knob = this.knobWorld(p);
      return dist(wx, wy, knob.x, knob.y) < 12 ||
             distToSeg(wx, wy, knob.x, knob.y, p.x, p.y).d < 10 ||
             distToSeg(wx, wy, knob.x, knob.y, tip.x, tip.y).d < 10;
    },
    handles(p) {
      const tip = this.tipWorld(p), knob = this.knobWorld(p);
      return [
        { id: "tip", x: tip.x, y: tip.y },
        { id: "knob", x: knob.x, y: knob.y },
        { id: "spike", x: p.x, y: p.y },
      ];
    },
  },

  /* ---------- RAPPORTEUR ---------- */
  rapporteur: {
    draw(ctx, p, sel) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      const R = p.R;
      ctx.fillStyle = "rgba(190,230,210,.55)";
      ctx.strokeStyle = "#1e8449"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, 0, R, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      // graduations
      ctx.strokeStyle = "#145a32"; ctx.fillStyle = "#145a32";
      ctx.font = "8px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (let deg = 0; deg <= 180; deg += 1) {
        const a = Math.PI + deg * Math.PI / 180;
        const is10 = deg % 10 === 0, is5 = deg % 5 === 0;
        const r1 = R - (is10 ? 13 : is5 ? 9 : 5);
        line(ctx, r1 * Math.cos(a), r1 * Math.sin(a), R * Math.cos(a), R * Math.sin(a));
        if (is10) {
          const rt = R - 22;
          ctx.fillText(String(deg), rt * Math.cos(a), rt * Math.sin(a));
        }
      }
      // ligne de foi
      line(ctx, -R, 0, R, 0);
      ctx.fillStyle = "#c0392b";
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill();
      ctx.restore();
      if (sel) {
        const h = toWorld(p, 0, -p.R - 22);
        drawHandle(ctx, h.x, h.y, "rotate");
      }
    },
    edges() { return []; },
    bodyHit(p, wx, wy) {
      const q = toLocal(p, wx, wy);
      return q.y <= 2 && Math.hypot(q.x, q.y) <= p.R;
    },
    handles(p) { return [{ id: "rotate", ...toWorld(p, 0, -p.R - 22) }]; },
    // angle (0..180) sous lequel on voit le point monde depuis le centre, ou null
    angleOf(p, wx, wy) {
      const q = toLocal(p, wx, wy);
      if (Math.hypot(q.x, q.y) < 12) return null;
      let deg = -Math.atan2(q.y, q.x) * 180 / Math.PI;
      deg = ((deg % 360) + 360) % 360;
      return deg <= 180 ? deg : null;
    },
  },

  /* ---------- RÈGLE-ÉQUERRE ---------- */
  regleEquerre: {
    eqVertices(p) {
      // sommets de l'équerre coulissante en coords locales de la règle
      const s = p.s, e = p.side * p.W / 2, f = p.eqFlip, L2 = 130;
      return { O: { x: s, y: e }, P: { x: s + f * L2, y: e }, Q: { x: s, y: e + p.side * L2 } };
    },
    draw(ctx, p, sel) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      const L = p.L, W = p.W;
      // la règle non graduée
      ctx.fillStyle = "rgba(220,220,230,.65)";
      ctx.strokeStyle = "#5d6d7e"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.rect(-L / 2, -W / 2, L, W); ctx.fill(); ctx.stroke();
      // l'équerre coulissante
      const { O, P, Q } = this.eqVertices(p);
      ctx.fillStyle = "rgba(150,205,245,.55)";
      ctx.strokeStyle = "#2874a6";
      ctx.beginPath(); ctx.moveTo(O.x, O.y); ctx.lineTo(P.x, P.y); ctx.lineTo(Q.x, Q.y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      if (sel) {
        drawHandle(ctx, toWorld(p, p.L / 2 + 24, 0).x, toWorld(p, p.L / 2 + 24, 0).y, "rotate");
        const mid = toWorld(p, p.s + p.eqFlip * 40, p.side * (p.W / 2 + 60));
        drawHandle(ctx, mid.x, mid.y, "slide");
      }
    },
    edges(p) {
      const L = p.L, W = p.W, { O, P, Q } = this.eqVertices(p);
      return [
        { x1: -L / 2, y1: -W / 2, x2: L / 2, y2: -W / 2 },
        { x1: -L / 2, y1: W / 2, x2: L / 2, y2: W / 2 },
        { x1: O.x, y1: O.y, x2: Q.x, y2: Q.y },   // côté ⊥ à la règle
        { x1: P.x, y1: P.y, x2: Q.x, y2: Q.y },   // hypoténuse
      ];
    },
    bodyHit(p, wx, wy) {
      const q = toLocal(p, wx, wy);
      if (Math.abs(q.x) <= p.L / 2 && Math.abs(q.y) <= p.W / 2) return true;
      const { O, P, Q } = this.eqVertices(p);
      return pointInTriangle(q.x, q.y, O.x, O.y, P.x, P.y, Q.x, Q.y);
    },
    handles(p) {
      return [
        { id: "rotate", ...toWorld(p, p.L / 2 + 24, 0) },
        { id: "slide", ...toWorld(p, p.s + p.eqFlip * 40, p.side * (p.W / 2 + 60)) },
      ];
    },
  },
};

function drawHandle(ctx, x, y, kind) {
  const colors = { rotate: "#3498db", tip: "#27ae60", knob: "#95a5a6", spike: "#c0392b", move: "#3498db", slide: "#8e44ad" };
  ctx.save();
  ctx.fillStyle = colors[kind] || "#3498db";
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, kind === "spike" ? 6 : 7, 0, TAU);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}
