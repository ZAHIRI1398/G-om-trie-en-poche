/* ============================================================
   Constructions d'exemple (scripts prêts à rejouer)
   Chaque étape peut porter un champ `msg` : texte explicatif
   affiché pendant la lecture.
   ============================================================ */
"use strict";

const EXAMPLES = {

  /* Triangle équilatéral à la règle et au compas */
  triangle() {
    const A = { x: 280, y: 430 }, B = { x: 560, y: 430 };
    const r = dist(A.x, A.y, B.x, B.y);
    const C = { x: (A.x + B.x) / 2, y: A.y - r * Math.sin(Math.PI / 3) };
    const aAC = Math.atan2(C.y - A.y, C.x - A.x);
    const aBC = Math.atan2(C.y - B.y, C.x - B.x);
    return [
      { t: "paper", grid: "carreaux", msg: "Construire un triangle équilatéral ABC à la règle et au compas." },
      { t: "point", x: A.x, y: A.y, label: "A", msg: "On place le point A." },
      { t: "point", x: B.x, y: B.y, label: "B", msg: "On place le point B." },
      { t: "show", i: "regle", msg: "On sort la règle." },
      { t: "pose", i: "regle", props: { x: (A.x + B.x) / 2, y: A.y + 17, angle: 0 }, msg: "On aligne le bord de la règle sur A et B." },
      { t: "segment", x1: A.x, y1: A.y, x2: B.x, y2: B.y, msg: "On trace le segment [AB]." },
      { t: "hide", i: "regle", msg: "On range la règle." },
      { t: "show", i: "compas", msg: "On sort le compas." },
      { t: "pose", i: "compas", props: { x: A.x, y: A.y, r: r, tip: 0 }, msg: "On prend l'écartement AB au compas et on pique en A." },
      { t: "arc", cx: A.x, cy: A.y, r: r, a1: aAC - 0.25, a2: aAC + 0.25, msg: "On trace un arc de cercle de centre A." },
      { t: "pose", i: "compas", props: { x: B.x, y: B.y, r: r, tip: Math.PI }, msg: "Sans changer l'ouverture, on pique le compas en B." },
      { t: "arc", cx: B.x, cy: B.y, r: r, a1: aBC - 0.25, a2: aBC + 0.25, msg: "On trace un arc de cercle de centre B : il coupe le premier." },
      { t: "croix", x: C.x, y: C.y, msg: "On marque l'intersection des deux arcs." },
      { t: "hide", i: "compas", msg: "On range le compas." },
      { t: "point", x: C.x, y: C.y, label: "C", msg: "Cette intersection est le sommet C." },
      { t: "show", i: "regle", msg: "On reprend la règle." },
      { t: "pose", i: "regle", props: { x: (A.x + C.x) / 2 - 14 * Math.sin(aAC), y: (A.y + C.y) / 2 + 14 * Math.cos(aAC), angle: aAC }, msg: "On aligne la règle sur A et C." },
      { t: "segment", x1: A.x, y1: A.y, x2: C.x, y2: C.y, msg: "On trace le segment [AC]." },
      { t: "pose", i: "regle", props: { x: (B.x + C.x) / 2 - 14 * Math.sin(aBC), y: (B.y + C.y) / 2 + 14 * Math.cos(aBC), angle: aBC }, msg: "On aligne la règle sur B et C." },
      { t: "segment", x1: B.x, y1: B.y, x2: C.x, y2: C.y, msg: "On trace le segment [BC]." },
      { t: "hide", i: "regle", msg: "On range la règle." },
      { t: "text", x: 300, y: 180, str: "Triangle équilatéral ABC", msg: "Terminé : AB = AC = BC, le triangle est équilatéral." },
    ];
  },

  /* Médiatrice d'un segment au compas */
  mediatrice() {
    const A = { x: 300, y: 300 }, B = { x: 620, y: 300 };
    const r = 210;
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    const h = Math.sqrt(r * r - (dist(A.x, A.y, B.x, B.y) / 2) ** 2);
    const P = { x: mx, y: my - h }, Q = { x: mx, y: my + h };
    return [
      { t: "paper", grid: "carreaux", msg: "Construire la médiatrice du segment [AB] au compas." },
      { t: "point", x: A.x, y: A.y, label: "A", msg: "On place le point A." },
      { t: "point", x: B.x, y: B.y, label: "B", msg: "On place le point B." },
      { t: "show", i: "regle", msg: "On sort la règle." },
      { t: "pose", i: "regle", props: { x: mx, y: my + 17, angle: 0 }, msg: "On aligne la règle sur A et B." },
      { t: "segment", x1: A.x, y1: A.y, x2: B.x, y2: B.y, msg: "On trace le segment [AB]." },
      { t: "hide", i: "regle", msg: "On range la règle." },
      { t: "show", i: "compas", msg: "On sort le compas." },
      { t: "pose", i: "compas", props: { x: A.x, y: A.y, r: r, tip: -Math.PI / 2 }, msg: "On pique le compas en A avec une ouverture plus grande que la moitié de AB." },
      { t: "arc", cx: A.x, cy: A.y, r: r, a1: Math.atan2(P.y - A.y, P.x - A.x) - 0.35, a2: Math.atan2(P.y - A.y, P.x - A.x) + 0.35, msg: "On trace un arc au-dessus de [AB]." },
      { t: "arc", cx: A.x, cy: A.y, r: r, a1: Math.atan2(Q.y - A.y, Q.x - A.x) - 0.35, a2: Math.atan2(Q.y - A.y, Q.x - A.x) + 0.35, msg: "On trace un arc en dessous de [AB]." },
      { t: "pose", i: "compas", props: { x: B.x, y: B.y, r: r, tip: -Math.PI / 2 }, msg: "Avec la même ouverture, on pique le compas en B." },
      { t: "arc", cx: B.x, cy: B.y, r: r, a1: Math.atan2(P.y - B.y, P.x - B.x) - 0.35, a2: Math.atan2(P.y - B.y, P.x - B.x) + 0.35, msg: "On trace un arc : il coupe le premier au-dessus." },
      { t: "arc", cx: B.x, cy: B.y, r: r, a1: Math.atan2(Q.y - B.y, Q.x - B.x) - 0.35, a2: Math.atan2(Q.y - B.y, Q.x - B.x) + 0.35, msg: "On trace un second arc : il coupe aussi en dessous." },
      { t: "croix", x: P.x, y: P.y, msg: "On marque la première intersection." },
      { t: "croix", x: Q.x, y: Q.y, msg: "On marque la deuxième intersection." },
      { t: "hide", i: "compas", msg: "On range le compas." },
      { t: "show", i: "regle", msg: "On reprend la règle." },
      { t: "pose", i: "regle", props: { x: mx + 17, y: my, angle: -Math.PI / 2 }, msg: "On aligne la règle sur les deux intersections." },
      { t: "segment", x1: P.x, y1: P.y - 30, x2: Q.x, y2: Q.y + 30, msg: "On trace la droite : c'est la médiatrice de [AB]." },
      { t: "hide", i: "regle", msg: "On range la règle." },
      { t: "text", x: mx + 30, y: my - h - 30, str: "Médiatrice de [AB]", msg: "Terminé : elle est perpendiculaire à [AB] en son milieu." },
    ];
  },

  /* Angle de 60° au compas */
  angle60() {
    const O = { x: 280, y: 430 }, r = 200;
    const P = { x: O.x + r, y: O.y };
    const Q = { x: O.x + r * Math.cos(-Math.PI / 3), y: O.y + r * Math.sin(-Math.PI / 3) };
    const ext = (p, k) => ({ x: O.x + (p.x - O.x) * k, y: O.y + (p.y - O.y) * k });
    return [
      { t: "paper", grid: "carreaux", msg: "Construire un angle de 60° au compas." },
      { t: "point", x: O.x, y: O.y, label: "O", msg: "On place le sommet O de l'angle." },
      { t: "show", i: "regle", msg: "On sort la règle." },
      { t: "pose", i: "regle", props: { x: O.x + r, y: O.y + 17, angle: 0 }, msg: "On pose la règle à partir de O." },
      { t: "segment", x1: O.x, y1: O.y, x2: O.x + 2 * r, y2: O.y, msg: "On trace la première demi-droite d'origine O." },
      { t: "hide", i: "regle", msg: "On range la règle." },
      { t: "show", i: "compas", msg: "On sort le compas." },
      { t: "pose", i: "compas", props: { x: O.x, y: O.y, r: r, tip: -0.6 }, msg: "On choisit une ouverture et on pique le compas en O." },
      { t: "arc", cx: O.x, cy: O.y, r: r, a1: -1.35, a2: 0.15, msg: "On trace un arc de centre O : il coupe la demi-droite." },
      { t: "croix", x: P.x, y: P.y, msg: "On marque l'intersection avec la demi-droite." },
      { t: "croix", x: Q.x, y: Q.y, msg: "Le même arc passe par un second point utile." },
      { t: "pose", i: "compas", props: { x: P.x, y: P.y, r: r, tip: -Math.PI / 2 }, msg: "Sans changer l'ouverture, on pique le compas à l'intersection." },
      { t: "arc", cx: P.x, cy: P.y, r: r, a1: Math.atan2(Q.y - P.y, Q.x - P.x) - 0.3, a2: Math.atan2(Q.y - P.y, Q.x - P.x) + 0.3, msg: "On trace un arc qui recoupe le premier." },
      { t: "hide", i: "compas", msg: "On range le compas." },
      { t: "show", i: "regle", msg: "On reprend la règle." },
      { t: "pose", i: "regle", props: { x: (O.x + Q.x) / 2 - 14 * Math.sin(-Math.PI / 3) + (Q.x - O.x) * 0.4, y: (O.y + Q.y) / 2 + 14 * Math.cos(-Math.PI / 3) + (Q.y - O.y) * 0.4, angle: -Math.PI / 3 }, msg: "On aligne la règle sur O et la nouvelle intersection." },
      { t: "segment", x1: O.x, y1: O.y, x2: ext(Q, 1.5).x, y2: ext(Q, 1.5).y, msg: "On trace la deuxième demi-droite d'origine O." },
      { t: "hide", i: "regle", msg: "On range la règle." },
      { t: "text", x: O.x + 60, y: O.y - 80, str: "60°", msg: "Terminé : l'angle obtenu mesure 60°." },
    ];
  },

  /* Cercle de diamètre [AB] */
  cercleDiametre() {
    const A = { x: 320, y: 350 }, B = { x: 620, y: 350 };
    const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    const r = dist(A.x, A.y, B.x, B.y) / 2;
    return [
      { t: "paper", grid: "carreaux", msg: "Tracer le cercle de diamètre [AB]." },
      { t: "point", x: A.x, y: A.y, label: "A", msg: "On place le point A." },
      { t: "point", x: B.x, y: B.y, label: "B", msg: "On place le point B." },
      { t: "show", i: "regle", msg: "On sort la règle." },
      { t: "pose", i: "regle", props: { x: M.x, y: M.y + 20, angle: 0 }, msg: "On aligne la règle sur A et B." },
      { t: "segment", x1: A.x, y1: A.y, x2: B.x, y2: B.y, msg: "On trace le diamètre [AB]." },
      { t: "hide", i: "regle", msg: "On range la règle." },
      { t: "show", i: "compas", msg: "On sort le compas." },
      { t: "pose", i: "compas", props: { x: M.x, y: M.y, r: r, tip: 0 }, msg: "On pique le compas au milieu O de [AB], ouverture la moitié de AB." },
      { t: "circle", cx: M.x, cy: M.y, r: r, msg: "On trace le cercle : il passe par A et B." },
      { t: "point", x: M.x, y: M.y, label: "O", msg: "O est le centre du cercle." },
      { t: "hide", i: "compas", msg: "On range le compas." },
      { t: "text", x: 330, y: 150, str: "Cercle de diamètre [AB]", msg: "Terminé : [AB] est un diamètre du cercle de centre O." },
    ];
  },

  /* Perpendiculaire à d passant par P hors de d, au compas */
  perpCompas() {
    const d1 = { x: 240, y: 400 }, d2 = { x: 700, y: 400 };
    const P = { x: 470, y: 250 };
    const r = 190;
    const dx = Math.sqrt(r * r - (d1.y - P.y) ** 2);
    const I = { x: P.x - dx, y: d1.y }, J = { x: P.x + dx, y: d1.y };
    const r2 = 150;
    const K = { x: P.x, y: d1.y + Math.sqrt(r2 * r2 - dx * dx) };
    const aI = Math.atan2(I.y - P.y, I.x - P.x), aJ = Math.atan2(J.y - P.y, J.x - P.x);
    const aIK = Math.atan2(K.y - I.y, K.x - I.x), aJK = Math.atan2(K.y - J.y, K.x - J.x);
    return [
      { t: "paper", grid: "carreaux", msg: "Tracer la perpendiculaire à d passant par P, au compas." },
      { t: "show", i: "regle", msg: "On sort la règle." },
      { t: "pose", i: "regle", props: { x: 470, y: 420, angle: 0 }, msg: "On pose la règle." },
      { t: "segment", x1: d1.x, y1: d1.y, x2: d2.x, y2: d2.y, msg: "On trace la droite d." },
      { t: "hide", i: "regle", msg: "On range la règle." },
      { t: "point", x: P.x, y: P.y, label: "P", msg: "On place le point P hors de d." },
      { t: "text", x: d2.x + 10, y: d2.y + 4, str: "d", msg: "On nomme la droite d." },
      { t: "show", i: "compas", msg: "On sort le compas." },
      { t: "pose", i: "compas", props: { x: P.x, y: P.y, r: r, tip: aI }, msg: "On pique le compas en P avec une ouverture assez grande." },
      { t: "arc", cx: P.x, cy: P.y, r: r, a1: aJ - 0.15, a2: aI + 0.15, msg: "On trace un arc de centre P qui coupe d en deux points." },
      { t: "croix", x: I.x, y: I.y, msg: "On marque la première intersection." },
      { t: "croix", x: J.x, y: J.y, msg: "On marque la deuxième intersection." },
      { t: "pose", i: "compas", props: { x: I.x, y: I.y, r: r2, tip: aIK }, msg: "On pique le compas sur la première intersection." },
      { t: "arc", cx: I.x, cy: I.y, r: r2, a1: aIK - 0.3, a2: aIK + 0.3, msg: "On trace un arc sous d." },
      { t: "pose", i: "compas", props: { x: J.x, y: J.y, r: r2, tip: aJK }, msg: "Même ouverture, on pique sur la deuxième intersection." },
      { t: "arc", cx: J.x, cy: J.y, r: r2, a1: aJK - 0.3, a2: aJK + 0.3, msg: "On trace un arc : il coupe le précédent sous d." },
      { t: "croix", x: K.x, y: K.y, msg: "On marque cette nouvelle intersection." },
      { t: "hide", i: "compas", msg: "On range le compas." },
      { t: "show", i: "regle", msg: "On reprend la règle." },
      { t: "pose", i: "regle", props: { x: P.x + 20, y: (P.y + K.y) / 2, angle: -Math.PI / 2 }, msg: "On aligne la règle sur P et cette intersection." },
      { t: "segment", x1: P.x, y1: P.y, x2: K.x, y2: K.y + 10, msg: "On trace la droite : elle est perpendiculaire à d." },
      { t: "hide", i: "regle", msg: "On range la règle." },
      { t: "text", x: P.x + 20, y: P.y - 20, str: "Perpendiculaire à d par P", msg: "Terminé : la droite tracée passe par P et coupe d à angle droit." },
    ];
  },

  /* Parallèle à d passant par M, à l'équerre */
  parallele() {
    const d1 = { x: 240, y: 430 }, d2 = { x: 700, y: 430 };
    const M = { x: 480, y: 300 };
    const px = 320;
    return [
      { t: "paper", grid: "carreaux", msg: "Tracer la parallèle à d passant par M, à l'équerre." },
      { t: "show", i: "regle", msg: "On sort la règle." },
      { t: "pose", i: "regle", props: { x: 470, y: 450, angle: 0 }, msg: "On pose la règle." },
      { t: "segment", x1: d1.x, y1: d1.y, x2: d2.x, y2: d2.y, msg: "On trace la droite d." },
      { t: "hide", i: "regle", msg: "On range la règle." },
      { t: "text", x: d2.x + 10, y: d2.y + 4, str: "d", msg: "On nomme la droite d." },
      { t: "point", x: M.x, y: M.y, label: "M", msg: "On place le point M hors de d." },
      { t: "show", i: "equerre", msg: "On sort l'équerre." },
      { t: "pose", i: "equerre", props: { x: px, y: d1.y, angle: -Math.PI / 2, flip: 1 }, msg: "On plaque un côté de l'angle droit de l'équerre sur d." },
      { t: "segment", x1: px, y1: d1.y, x2: px, y2: d1.y - 190, msg: "On trace le long de l'autre côté : une perpendiculaire à d." },
      { t: "pose", i: "equerre", props: { x: px, y: M.y, angle: -Math.PI / 2, flip: 1 }, msg: "On déplace l'équerre le long de cette perpendiculaire jusqu'au niveau de M." },
      { t: "segment", x1: px, y1: M.y, x2: px + 320, y2: M.y, msg: "On trace la perpendiculaire à la perpendiculaire, passant par M." },
      { t: "hide", i: "equerre", msg: "On range l'équerre." },
      { t: "text", x: px + 335, y: M.y + 4, str: "d' parallèle à d par M", msg: "Terminé : deux droites perpendiculaires à une même droite sont parallèles." },
    ];
  },

  /* Perpendiculaire à la règle-équerre */
  perpendiculaire() {
    const A = { x: 240, y: 380 }, B = { x: 700, y: 380 };
    const M = { x: 470, y: 380 };
    return [
      { t: "paper", grid: "carreaux", msg: "Tracer une perpendiculaire à la règle-équerre." },
      { t: "show", i: "regle", msg: "On sort la règle." },
      { t: "pose", i: "regle", props: { x: 470, y: 397, angle: 0 }, msg: "On pose la règle." },
      { t: "segment", x1: A.x, y1: A.y, x2: B.x, y2: B.y, msg: "On trace la droite." },
      { t: "hide", i: "regle", msg: "On range la règle." },
      { t: "point", x: M.x, y: M.y, label: "M", msg: "On place le point M sur la droite." },
      { t: "show", i: "regleEquerre", msg: "On sort la règle-équerre." },
      { t: "pose", i: "regleEquerre", props: { x: 470, y: 393, angle: 0, s: -60, side: -1, eqFlip: 1 }, msg: "On plaque le bord de la règle sur la droite." },
      { t: "pose", i: "regleEquerre", props: { s: 0 }, msg: "On fait coulisser l'équerre jusqu'au point M." },
      { t: "segment", x1: M.x, y1: M.y, x2: M.x, y2: M.y - 160, msg: "On trace le long du bord de l'équerre : la perpendiculaire en M." },
      { t: "text", x: M.x + 15, y: M.y - 150, str: "Perpendiculaire en M", msg: "Terminé : l'équerre garantit l'angle droit." },
    ];
  },

  /* Hexagone régulier inscrit dans un cercle :
     le côté de l'hexagone est égal au rayon du cercle. */
  hexagone() {
    const O = { x: 450, y: 300 }, R = 170;
    const V = a => ({ x: O.x + R * Math.cos(a), y: O.y - R * Math.sin(a) });
    const pts = [0, 60, 120, 180, 240, 300].map(d => V(d * Math.PI / 180));
    const L = "ABCDEF";
    const steps = [
      { t: "paper", grid: "carreaux", msg: "Tracer un hexagone régulier ABCDEF inscrit dans un cercle." },
      { t: "point", x: O.x, y: O.y, label: "O", msg: "On place le centre O." },
      { t: "show", i: "compas", msg: "On sort le compas." },
      { t: "pose", i: "compas", props: { x: O.x, y: O.y, r: R, tip: 0 }, msg: "On pique en O et on ouvre le compas sur un rayon quelconque." },
      { t: "circle", cx: O.x, cy: O.y, r: R, msg: "On trace le cercle de centre O." },
      { t: "point", x: pts[0].x, y: pts[0].y, label: "A", msg: "On marque un premier sommet A sur le cercle." },
    ];
    for (let i = 1; i < 6; i++) {
      const a = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
      steps.push(
        { t: "pose", i: "compas", props: { x: pts[i - 1].x, y: pts[i - 1].y, r: R, tip: a }, msg: `Sans changer l'ouverture, on pique le compas en ${L[i - 1]}.` },
        { t: "arc", cx: pts[i - 1].x, cy: pts[i - 1].y, r: R, a1: a - 0.3, a2: a + 0.3, msg: "On reporte le rayon sur le cercle." },
        { t: "croix", x: pts[i].x, y: pts[i].y, msg: `On marque l'intersection : sommet ${L[i]}.` },
        { t: "point", x: pts[i].x, y: pts[i].y, label: L[i], msg: `Le point ${L[i]} est le ${i + 1}e sommet.` },
      );
    }
    steps.push(
      { t: "hide", i: "compas", msg: "On range le compas." },
      { t: "show", i: "regle", msg: "On prend la règle." },
    );
    for (let i = 0; i < 6; i++) {
      const p = pts[i], q = pts[(i + 1) % 6];
      const a = Math.atan2(q.y - p.y, q.x - p.x);
      steps.push(
        { t: "pose", i: "regle", props: { x: (p.x + q.x) / 2 - 14 * Math.sin(a), y: (p.y + q.y) / 2 + 14 * Math.cos(a), angle: a }, msg: `On aligne la règle sur ${L[i]} et ${L[(i + 1) % 6]}.` },
        { t: "segment", x1: p.x, y1: p.y, x2: q.x, y2: q.y, msg: `On trace le côté [${L[i]}${L[(i + 1) % 6]}].` },
      );
    }
    steps.push(
      { t: "hide", i: "regle", msg: "On range la règle." },
      { t: "text", x: 370, y: 160, str: "Hexagone régulier ABCDEF", msg: "Terminé : 6 côtés égaux au rayon. C'est le secret de la construction !" },
    );
    return steps;
  },

  /* Pentagone régulier inscrit dans un cercle :
     construction classique (médiatrice + milieu + report QN). */
  pentagone() {
    const O = { x: 450, y: 300 }, R = 170;
    const V = a => ({ x: O.x + R * Math.cos(a), y: O.y - R * Math.sin(a) });
    const A = V(0), B = V(Math.PI), Q = V(Math.PI / 2);
    const M = { x: (O.x + B.x) / 2, y: (O.y + B.y) / 2 };
    const dMQ = dist(M.x, M.y, Q.x, Q.y);
    const N = { x: M.x + dMQ, y: O.y };
    const side = dist(Q.x, Q.y, N.x, N.y);
    const P = [90, 162, 234, 306, 18].map(d => V(d * Math.PI / 180));
    const mUp = { x: O.x, y: O.y - 215 }, mDn = { x: O.x, y: O.y + 215 };
    const mUp2 = { x: M.x, y: M.y - 95 }, mDn2 = { x: M.x, y: M.y + 95 };
    return [
      { t: "paper", grid: "carreaux", msg: "Tracer un pentagone régulier inscrit dans un cercle — construction classique au compas." },
      { t: "point", x: O.x, y: O.y, label: "O", msg: "On place le centre O." },
      { t: "show", i: "compas", msg: "On sort le compas." },
      { t: "pose", i: "compas", props: { x: O.x, y: O.y, r: R, tip: 0 }, msg: "On pique en O." },
      { t: "circle", cx: O.x, cy: O.y, r: R, msg: "On trace le cercle de centre O." },
      { t: "hide", i: "compas", msg: "On range le compas." },
      { t: "show", i: "regle", msg: "On prend la règle." },
      { t: "pose", i: "regle", props: { x: O.x, y: O.y + 17, angle: 0 }, msg: "On aligne la règle horizontalement par O." },
      { t: "segment", x1: B.x, y1: B.y, x2: A.x, y2: A.y, msg: "On trace le diamètre [AB]." },
      { t: "point", x: A.x, y: A.y, label: "A", msg: "Extrémité A." },
      { t: "point", x: B.x, y: B.y, label: "B", msg: "Extrémité B." },
      { t: "hide", i: "regle", msg: "On range la règle." },
      { t: "show", i: "compas", msg: "On reprend le compas pour la médiatrice de [AB]." },
      { t: "pose", i: "compas", props: { x: A.x, y: A.y, r: 200, tip: -Math.PI / 2 }, msg: "Ouverture > moitié de AB, on pique en A." },
      { t: "arc", cx: A.x, cy: A.y, r: 200, a1: Math.atan2(mUp.y - A.y, mUp.x - A.x) - 0.3, a2: Math.atan2(mUp.y - A.y, mUp.x - A.x) + 0.3, msg: "Arc au-dessus." },
      { t: "arc", cx: A.x, cy: A.y, r: 200, a1: Math.atan2(mDn.y - A.y, mDn.x - A.x) - 0.3, a2: Math.atan2(mDn.y - A.y, mDn.x - A.x) + 0.3, msg: "Arc en dessous." },
      { t: "pose", i: "compas", props: { x: B.x, y: B.y, r: 200, tip: -Math.PI / 2 }, msg: "Même ouverture, on pique en B." },
      { t: "arc", cx: B.x, cy: B.y, r: 200, a1: Math.atan2(mUp.y - B.y, mUp.x - B.x) - 0.3, a2: Math.atan2(mUp.y - B.y, mUp.x - B.x) + 0.3, msg: "Arc au-dessus : il croise le premier." },
      { t: "arc", cx: B.x, cy: B.y, r: 200, a1: Math.atan2(mDn.y - B.y, mDn.x - B.x) - 0.3, a2: Math.atan2(mDn.y - B.y, mDn.x - B.x) + 0.3, msg: "Arc en dessous." },
      { t: "croix", x: mUp.x, y: mUp.y, msg: "Croisement au-dessus." },
      { t: "croix", x: mDn.x, y: mDn.y, msg: "Croisement en dessous." },
      { t: "hide", i: "compas", msg: "On range le compas." },
      { t: "show", i: "regle", msg: "On trace la médiatrice." },
      { t: "segment", x1: mUp.x, y1: mUp.y, x2: mDn.x, y2: mDn.y, msg: "La médiatrice de [AB] passe par O : c'est la perpendiculaire au diamètre." },
      { t: "point", x: Q.x, y: Q.y, label: "Q", msg: "Elle coupe le cercle en Q : premier sommet du pentagone." },
      { t: "hide", i: "regle", msg: "On range la règle." },
      { t: "show", i: "compas", msg: "On cherche maintenant le milieu de [OB]." },
      { t: "pose", i: "compas", props: { x: O.x, y: O.y, r: 110, tip: Math.PI / 2 }, msg: "Ouverture > moitié de OB, on pique en O." },
      { t: "arc", cx: O.x, cy: O.y, r: 110, a1: Math.atan2(mUp2.y - O.y, mUp2.x - O.x) - 0.35, a2: Math.atan2(mUp2.y - O.y, mUp2.x - O.x) + 0.35, msg: "Petit arc au-dessus de OB." },
      { t: "arc", cx: O.x, cy: O.y, r: 110, a1: Math.atan2(mDn2.y - O.y, mDn2.x - O.x) - 0.35, a2: Math.atan2(mDn2.y - O.y, mDn2.x - O.x) + 0.35, msg: "Petit arc en dessous." },
      { t: "pose", i: "compas", props: { x: B.x, y: B.y, r: 110, tip: Math.PI / 2 }, msg: "Même ouverture, on pique en B." },
      { t: "arc", cx: B.x, cy: B.y, r: 110, a1: Math.atan2(mUp2.y - B.y, mUp2.x - B.x) - 0.35, a2: Math.atan2(mUp2.y - B.y, mUp2.x - B.x) + 0.35, msg: "Arcs croisés." },
      { t: "arc", cx: B.x, cy: B.y, r: 110, a1: Math.atan2(mDn2.y - B.y, mDn2.x - B.x) - 0.35, a2: Math.atan2(mDn2.y - B.y, mDn2.x - B.x) + 0.35, msg: "Et en dessous." },
      { t: "croix", x: mUp2.x, y: mUp2.y, msg: "Deux croisements." },
      { t: "croix", x: mDn2.x, y: mDn2.y, msg: "" },
      { t: "hide", i: "compas", msg: "" },
      { t: "show", i: "regle", msg: "On trace la médiatrice de [OB]." },
      { t: "segment", x1: mUp2.x, y1: mUp2.y, x2: mDn2.x, y2: mDn2.y, msg: "Elle coupe [OB] en son milieu." },
      { t: "point", x: M.x, y: M.y, label: "M", msg: "M = milieu de [OB]." },
      { t: "hide", i: "regle", msg: "" },
      { t: "show", i: "compas", msg: "Le coup de compas décisif." },
      { t: "pose", i: "compas", props: { x: M.x, y: M.y, r: dMQ, tip: -Math.PI / 4 }, msg: "On prend l'écartement de M à Q." },
      { t: "arc", cx: M.x, cy: M.y, r: dMQ, a1: Math.atan2(Q.y - M.y, Q.x - M.x) - 0.05, a2: Math.atan2(O.y - M.y, O.x - M.x) + 0.1, msg: "On le reporte sur le diamètre [AB]." },
      { t: "croix", x: N.x, y: N.y, msg: "Le point N est obtenu." },
      { t: "point", x: N.x, y: N.y, label: "N", msg: "N est sur le diamètre." },
      { t: "pose", i: "compas", props: { x: Q.x, y: Q.y, r: side, tip: Math.PI / 4 }, msg: "On prend maintenant l'écartement QN : c'est exactement le côté du pentagone !" },
      { t: "arc", cx: Q.x, cy: Q.y, r: side, a1: Math.atan2(N.y - Q.y, N.x - Q.x) - 0.35, a2: Math.atan2(N.y - Q.y, N.x - Q.x) + 0.35, msg: "On vérifie l'écartement QN." },
    ].concat(
      P.slice(1).flatMap((v, i) => {
        const a = Math.atan2(v.y - P[i].y, v.x - P[i].x);
        return [
          { t: "pose", i: "compas", props: { x: P[i].x, y: P[i].y, r: side, tip: a }, msg: `On pique le compas sur le sommet ${i ? i : 'Q'} et on reporte le côté.` },
          { t: "arc", cx: P[i].x, cy: P[i].y, r: side, a1: a - 0.3, a2: a + 0.3, msg: "Nouveau sommet sur le cercle." },
          { t: "point", x: v.x, y: v.y, label: "", msg: `Sommet ${i + 2} / 5.` },
        ];
      }),
      [
        { t: "hide", i: "compas", msg: "Les 5 sommets sont placés." },
        { t: "show", i: "regle", msg: "On relie à la règle." },
      ],
      P.flatMap((p, i) => {
        const q = P[(i + 1) % 5];
        const a = Math.atan2(q.y - p.y, q.x - p.x);
        return [
          { t: "pose", i: "regle", props: { x: (p.x + q.x) / 2 - 14 * Math.sin(a), y: (p.y + q.y) / 2 + 14 * Math.cos(a), angle: a }, msg: `On aligne le côté ${i + 1}.` },
          { t: "segment", x1: p.x, y1: p.y, x2: q.x, y2: q.y, msg: `On trace le côté ${i + 1} / 5.` },
        ];
      }),
      [
        { t: "hide", i: "regle", msg: "On range la règle." },
        { t: "text", x: 370, y: 160, str: "Pentagone régulier", msg: "Terminé : 5 côtés égaux — la construction du compas depuis l'Antiquité." },
      ],
    );
  },
};
