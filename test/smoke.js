/* Test de fumée : charge l'app dans un faux DOM et simule des interactions. */
const fs = require("fs"), vm = require("vm"), path = require("path");

const listeners = {};
function el(id) {
  return {
    id, value: "", textContent: "", innerHTML: "", disabled: false,
    max: 0, checked: false, style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    onclick: null, onchange: null, oninput: null,
    appendChild() {}, click() {}, focus() {},
    querySelector: () => el("q"),
    addEventListener(t, f) { listeners[id + ":" + t] = f; },
    getBoundingClientRect: () => ({ width: 1000, height: 640, left: 0, top: 0 }),
    getContext: () => ctxStub,
    setPointerCapture() {},
    clientWidth: 1000, clientHeight: 640, width: 0, height: 0,
  };
}
const ctxStub = new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : () => ctxStub),
  set: (t, k, v) => (t[k] = v, true),
});
const elements = {};
const sandbox = {
  document: {
    getElementById: id => (elements[id] ||= el(id)),
    querySelectorAll: () => [],
    createElement: () => el("anon"),
    addEventListener() {},
  },
  window: { devicePixelRatio: 1, addEventListener() {} },
  performance: { now: () => 0 },
  requestAnimationFrame() {},
  prompt: () => "test", confirm: () => true, alert() {},
  URL: { createObjectURL: () => "blob:", revokeObjectURL() {} },
  Blob: function () {}, FileReader: function () {},
  localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } },
  console,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const dir = path.join(__dirname, "..", "js");
let bundle = ["render.js", "examples.js", "app.js"]
  .map(f => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");

/* ---- scénario de test exécuté dans le même contexte ---- */
bundle += `
;(function test() {
  const ev = (x, y) => ({ clientX: x, clientY: y, pointerId: 1 });
  const pd = __listeners["paper:pointerdown"], pm = __listeners["paper:pointermove"], pu = __listeners["paper:pointerup"];

  // 1. Exemple triangle
  S.script = EXAMPLES.triangle();
  rebuild();
  const nObj = S.objects.length;
  console.log("[1] triangle ->", nObj, "objets,", S.script.length, "étapes");
  if (nObj !== 10) throw new Error("attendu 10 objets, obtenu " + nObj);
  const c = S.objects.find(o => o.type === "point" && o.label === "C");
  if (!c || Math.abs(c.x - 420) > 1) throw new Error("point C mal placé");

  // 2. Tracé le long du bord de la règle
  S.script = [{ t: "paper", grid: "carreaux" }];
  rebuild();
  S.inst.regle.visible = true;
  S.inst.regle.x = 470; S.inst.regle.y = 540; S.inst.regle.angle = 0;
  const edgeY = S.inst.regle.y + S.inst.regle.W / 2;   // bord inférieur
  pd(ev(400, edgeY));
  if (!drag || drag.kind !== "edge") throw new Error("drag edge attendu, obtenu " + JSON.stringify(drag && drag.kind));
  pm(ev(560, edgeY));
  pu(ev(560, edgeY));
  const seg = S.objects.find(o => o.type === "segment");
  if (!seg) throw new Error("segment non créé");
  if (Math.abs(seg.y1 - edgeY) > 0.5 || Math.abs(seg.y2 - edgeY) > 0.5) throw new Error("segment pas sur le bord : " + JSON.stringify(seg));
  console.log("[2] segment au bord de la règle OK :", JSON.stringify(seg));

  // 2b. Outil segment libre + droite
  S.tool = "segment";
  pd(ev(100, 100)); pm(ev(300, 200)); pu(ev(300, 200));
  const seg2 = S.objects.filter(o => o.type === "segment").pop();
  if (!seg2 || seg2.x1 !== 100 || seg2.x2 !== 300) throw new Error("outil segment KO : " + JSON.stringify(seg2));
  S.tool = "droite";
  pd(ev(100, 300)); pm(ev(400, 300)); pu(ev(400, 300));
  if (!S.objects.some(o => o.type === "line")) throw new Error("outil droite KO");
  S.tool = "move";
  console.log("[2b] outils segment/droite OK");

  // 2c. Milieu d'un segment
  S.tool = "milieu";
  pd(ev(200, 150));            // milieu du segment (100,100)-(300,200)
  const mid = S.objects.find(o => o.type === "point");
  if (!mid || Math.abs(mid.x - 200) > 0.5 || Math.abs(mid.y - 150) > 0.5)
    throw new Error("milieu KO : " + JSON.stringify(mid));
  if (mid.label !== "A") throw new Error("label milieu = " + mid.label);
  S.tool = "move";
  console.log("[2c] milieu de segment OK :", JSON.stringify(mid));

  // 2d. Polygone (triangle) : 3 clics + clic sur le 1er sommet pour fermer
  S.tool = "polygone";
  pd(ev(400, 100));
  if (!drag || drag.kind !== "poly") throw new Error("drag poly attendu");
  pd(ev(500, 120)); pd(ev(450, 200));
  if (S.objects.some(o => o.type === "polygone")) throw new Error("polygone fermé trop tôt");
  pd(ev(405, 103));            // < 12 px du 1er sommet -> fermeture
  const pg = S.objects.find(o => o.type === "polygone");
  if (!pg || pg.pts.length !== 3) throw new Error("polygone KO : " + JSON.stringify(pg));
  if (drag) throw new Error("drag poly non terminé");
  S.tool = "move";
  console.log("[2d] polygone OK :", JSON.stringify(pg.pts));

  // 2e. Déplacer un objet tracé (le polygone) avec l'outil Manipuler
  pd(ev(450, 110));            // sur un côté du triangle
  if (!drag || drag.kind !== "objMove") throw new Error("drag objMove attendu, obtenu " + JSON.stringify(drag && drag.kind));
  pm(ev(500, 140)); pu(ev(500, 140));
  if (Math.abs(pg.pts[0][0] - 450) > 0.5 || Math.abs(pg.pts[0][1] - 130) > 0.5)
    throw new Error("polygone non déplacé : " + JSON.stringify(pg.pts));
  const mv = S.script.filter(s => s.t === "moveObj");
  if (mv.length !== 1 || mv[0].dx !== 50 || mv[0].dy !== 30)
    throw new Error("moveObj mal enregistré : " + JSON.stringify(mv));
  console.log("[2e] déplacement d'objet OK :", JSON.stringify(mv[0]));

  // 3. Arc au compas
  const cp = S.inst.compas;
  cp.visible = true; cp.x = 500; cp.y = 300; cp.r = 100; cp.tip = 0;
  S.compasMode = "draw";
  pd(ev(600, 300));            // sur le cercle
  if (!drag || drag.kind !== "arc") throw new Error("drag arc attendu");
  pm(ev(500, 200));            // quart de tour vers le haut
  pu(ev(500, 200));
  const arc = S.objects.find(o => o.type === "arc");
  if (!arc) throw new Error("arc non créé");
  if (Math.abs(arc.a1 - 0) > 0.01 || Math.abs(arc.a2 - (-Math.PI / 2)) > 0.01)
    throw new Error("angles d'arc incorrects : " + JSON.stringify(arc));
  console.log("[3] arc au compas OK :", JSON.stringify(arc));

  // 3b. Réglage de l'ouverture par la pointe (mode open)
  S.compasMode = "open";
  cp.x = 500; cp.y = 300; cp.r = 100; cp.tip = 0;
  pd(ev(600, 300));            // pointe (tip) du compas
  if (!drag || drag.kind !== "tip") throw new Error("drag tip attendu, obtenu " + JSON.stringify(drag && drag.kind));
  pm(ev(650, 300));            // ouverture -> 150 px
  pu(ev(650, 300));
  if (Math.abs(cp.r - 150) > 0.5) throw new Error("ouverture = " + cp.r);
  console.log("[3b] réglage ouverture compas OK : r =", cp.r);

  // 3c. Idem avec l'outil point actif (les poignées restent prioritaires)
  S.tool = "point";
  const nbSteps = S.script.length;
  pd(ev(650, 300));
  if (!drag || drag.kind !== "tip") throw new Error("tip attendu même en mode point");
  pm(ev(560, 300)); pu(ev(560, 300));
  if (Math.abs(cp.r - 60) > 0.5) throw new Error("ouverture = " + cp.r);
  S.tool = "move";
  console.log("[3b-2] ouverture réglable en mode point OK");

  // 4. Déplacement de la règle (drag du corps, au centre)
  pd(ev(470, 540));            // centre de la règle -> corps
  if (!drag || drag.kind !== "move") throw new Error("drag move attendu, obtenu " + JSON.stringify(drag && drag.kind));
  pm(ev(500, 560)); pu(ev(500, 560));
  if (Math.abs(S.inst.regle.x - 500) > 0.1 || Math.abs(S.inst.regle.y - 560) > 0.1)
    throw new Error("règle non déplacée");
  console.log("[4] déplacement règle OK");

  // 4b. Attraper le crayon démarre un tracé libre
  const cr = S.inst.crayon;
  cr.visible = true; cr.x = 700; cr.y = 500; cr.angle = -1;
  pd(ev(700, 470));            // corps du crayon (au-dessus de la mine)
  if (!drag || drag.kind !== "stroke") throw new Error("drag stroke attendu, obtenu " + JSON.stringify(drag && drag.kind));
  pm(ev(730, 460)); pm(ev(760, 450)); pu(ev(760, 450));
  if (!S.objects.some(o => o.type === "stroke")) throw new Error("trait de crayon non créé");
  cr.visible = false;
  console.log("[4b] tracé au crayon OK");

  // 5. Rotation via poignée
  const hx = S.inst.regle.x + S.inst.regle.L / 2 + 24;
  pd(ev(hx, S.inst.regle.y));  // poignée rotate de la règle
  if (!drag || drag.kind !== "rotate") throw new Error("drag rotate attendu, obtenu " + JSON.stringify(drag && drag.kind));
  pm(ev(S.inst.regle.x, S.inst.regle.y + hx - S.inst.regle.x));  // 90° vers le bas
  pu(ev(S.inst.regle.x, S.inst.regle.y + hx - S.inst.regle.x));
  if (Math.abs(S.inst.regle.angle - Math.PI / 2) > 0.05)
    throw new Error("angle règle = " + S.inst.regle.angle);
  console.log("[5] rotation règle OK");

  // 6. Annuler / reconstruire
  const before = S.script.length;
  S.script.pop(); rebuild();
  if (S.script.length !== before - 1) throw new Error("pop");
  console.log("[6] rebuild OK,", S.objects.length, "objets conservés");

  // 7. Animation d'étape (pas d'exception)
  enterPlay(0); play.playing = false;
  animateStep({ t: "segment", x1: 0, y1: 0, x2: 10, y2: 0 }, 0.5);
  animateStep({ t: "pose", i: "regle", props: { x: 100, y: 100, angle: 1 } }, 0.5);
  render();
  exitPlay();
  console.log("[7] lecture/partial OK");

  // 8. Export JSON valide
  const json = scriptArea.value;
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error("export non-tableau");
  console.log("[8] export OK :", parsed.length, "étapes");

  // 9. Tous les exemples de la bibliothèque se reconstruisent
  for (const [nom, k] of BIBLIO_EXEMPLES) {
    const steps = EXAMPLES[k]();
    if (!Array.isArray(steps) || !steps.length) throw new Error("exemple vide : " + k);
    S.script = steps; rebuild();
    if (!S.objects.length) throw new Error("exemple sans objet : " + k);
    console.log("[9] exemple « " + nom + " » OK : " + steps.length + " étapes, " + S.objects.length + " objets");
  }

  // 10. Bibliothèque : enregistrer / recharger / supprimer
  S.script = [{ t: "paper", grid: "blanc" }, { t: "point", x: 1, y: 2, label: "Z" }];
  addToBiblio("Test", S.script.slice());
  let b = getBiblio();
  if (b.length !== 1 || b[0].name !== "Test") throw new Error("biblio save KO");
  addToBiblio("Test", [{ t: "paper", grid: "carreaux" }]);      // dédoublonnage
  b = getBiblio();
  if (b.length !== 1 || b[0].steps.length !== 1) throw new Error("biblio dédoublonnage KO");
  S.script = b[0].steps; rebuild();
  if (S.grid !== "carreaux") throw new Error("biblio reload KO");
  console.log("[10] bibliothèque OK");

  console.log("TOUS LES TESTS PASSENT");
})();
`;
// rendre les listeners accessibles au bundle
bundle = "const __listeners = globalThis.__listeners;\n" + bundle;
sandbox.__listeners = listeners;

try {
  vm.runInContext(bundle, sandbox, { filename: "bundle.js" });
} catch (e) {
  console.error("ÉCHEC:", e);
  process.exit(1);
}
