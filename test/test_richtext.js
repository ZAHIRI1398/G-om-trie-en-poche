// Test rapide du tokenizer/rendu riche — node test/test_richtext.js
const fs = require('fs');
const path = require('path');
let src = fs.readFileSync(path.join(__dirname, '..', 'js', 'render.js'), 'utf8');
eval(src.substring(src.indexOf('var RT_SYMBOLS'), src.indexOf('function drawObjects')));

// faux ctx minimal pour mesurer sans canvas
const fakeCtx = {
  font: '',
  measureText: (t) => ({ width: t.length * 8 }),
  fillText: () => {},
  beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {},
  strokeRect: () => {},
};

const cases = [
  'aire = \\frac{1}{2} × b × h',
  'x^{2} + \\sqrt{\\frac{1}{4}} ≥ 5°',
  '\\(\\frac{a}{b} - \\frac{1}{8}\\)',
  '\\boxed{\\frac{3}{4}}',
  'a_{1} + b_{max}',
  '\\pi r^{2}',
];
for (const c of cases) {
  console.log(JSON.stringify(c), '=>', JSON.stringify(rtTokens(c)), '| w =', measureRichText(fakeCtx, c, 16));
}
