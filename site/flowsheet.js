// ===== Detailed interactive flowsheet (based on Figures 3.79 and 4.18) =====
const PFD = (() => {
  const q = (a) => a.map(p => p.join(',')).join(' ');
  const path = (pts) => 'M' + pts.map(p => p.join(',')).join(' L');
  let S = '';
  const add = s => { S += s; };
  const pipe = (pts, o = {}) => {
    const d = path(pts); const cls = 'pipe' + (o.hi ? ' hi' : '') + (o.cls ? ' ' + o.cls : '');
    add(`<path class="${cls}" d="${d}" ${o.arrow === false ? '' : `marker-end="url(#${o.hi ? 'arH' : 'ar'})"`} ${o.st ? `data-st="${o.st}"` : ''}/>`);
    if (o.flow !== false) add(`<path class="flow${o.hi ? ' hi' : ''}${o.cls ? ' ' + o.cls : ''}" d="${d}" ${o.st ? `data-fl="${o.st}"` : ''}/>`);
  };
  const util = (pts, t, o = {}) => { add(`<path class="util${o.cls ? ' ' + o.cls : ''}" d="${path(pts)}" marker-end="url(#arU)"/>`); if (t) add(`<text class="note${o.cls ? ' ' + o.cls : ''}" x="${o.tx ?? pts[0][0]}" y="${o.ty ?? pts[0][1] - 6}" text-anchor="${o.ta || 'middle'}">${t}</text>`); };
  const dia = (x, y, n, o = {}) => add(`<g class="dg${o.cls ? ' ' + o.cls : ''}" data-st="${n}"><path class="dia${o.hi ? ' hi' : ''}" d="M${x},${y - 13} L${x + 13},${y} L${x},${y + 13} L${x - 13},${y}z"/><text class="dn${o.hi ? ' hi' : ''}" x="${x}" y="${y + 4}" text-anchor="middle">${n}</text></g>`);
  const prod = (x, y, t, solid = true) => add(`<path d="M${x - 11},${y} L${x},${y - 11} L${x + 11},${y} L${x},${y + 11}z" fill="${solid ? 'var(--ink)' : 'var(--panel)'}" stroke="var(--ink)" stroke-width="1.6"/><text class="lbl" x="${x + 18}" y="${y + 5}" style="font-size:16px">${t}</text>`);
  const lbl = (x, y, t, o = {}) => add(`<text class="lbl${o.hi ? ' hi' : ''}${o.cls ? ' ' + o.cls : ''}" x="${x}" y="${y}" text-anchor="${o.a || 'middle'}" ${o.fs ? `style="font-size:${o.fs}px"` : ''}>${t}</text>`);
  const note = (x, y, t, o = {}) => add(`<text class="note${o.cls ? ' ' + o.cls : ''}" x="${x}" y="${y}" text-anchor="${o.a || 'middle'}" ${o.fill ? `style="fill:${o.fill}"` : ''}>${t}</text>`);
  const U = (id, inner, o = {}) => add(`<g class="u${o.cls ? ' ' + o.cls : ''}" data-u="${id}"><g class="body">${inner}</g></g>`);
  const eq = (hi) => `eq${hi ? ' hi' : ''}`;
  const hops = [];
  const hop = (x, y, v, hi) => hops.push(v ? `<rect x="${x - 3}" y="${y - 8}" width="6" height="16" fill="var(--panel)"/><path d="M${x},${y - 8} a8,8 0 0 1 0,16" fill="none" stroke="${hi ? 'var(--red)' : 'var(--ink2)'}" stroke-width="2.4"/>` : `<rect x="${x - 8}" y="${y - 3}" width="16" height="6" fill="var(--panel)"/><path d="M${x - 8},${y} a8,8 0 0 1 16,0" fill="none" stroke="${hi ? 'var(--red)' : 'var(--ink2)'}" stroke-width="2.4"/>`);
  // ---- symbols ----
  const capsuleH = (x, y, w, h, hi, tubes = 3) => { let s = `<rect class="${eq(hi)}" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${h / 2}"/>`;
    const x0 = x - w / 2 + h * 0.45, x1 = x + w / 2 - h * 0.45; s += `<line class="thin" x1="${x0}" y1="${y - h / 2}" x2="${x0}" y2="${y + h / 2}"/><line class="thin" x1="${x1}" y1="${y - h / 2}" x2="${x1}" y2="${y + h / 2}"/>`;
    for (let k = 1; k <= tubes; k++) { const yy = y - h / 2 + h * k / (tubes + 1); s += `<line class="thin" x1="${x0}" y1="${yy}" x2="${x1}" y2="${yy}"/>`; } return s; };
  const drum = (x, y, w, h, hi) => `<rect class="${eq(hi)}" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${h / 2}"/><line class="thin" x1="${x - w / 2 + 12}" y1="${y - 4}" x2="${x + w / 2 - 12}" y2="${y - 4}" stroke-dasharray="5 3"/><line class="thin" x1="${x - w / 2 + 12}" y1="${y + 7}" x2="${x + w / 2 - 12}" y2="${y + 7}" stroke-dasharray="5 3"/><path class="${eq(hi)}" d="M${x + w * 0.18},${y - h / 2} v-9 a7,7 0 0 1 14,0 v9"/>`;
  const mixer = (x, y, split, hi) => `<path class="${eq(hi)}" d="M${x - 20},${y - 24} L${x + 20},${y - 24} L${x + 20},${y + 6} A20,20 0 0 1 ${x - 20},${y + 6} Z"/>` +
    (split ? `<path class="thin" d="M${x - 9},${y + 6} L${x},${y - 6} L${x + 9},${y + 6} M${x},${y - 6} L${x},${y - 18}"/>` : `<path class="thin" d="M${x - 9},${y - 14} L${x},${y - 2} L${x + 9},${y - 14} M${x},${y - 2} L${x},${y + 12}"/>`);
  const comp = (x, y, w, h, rev, hi) => { const a = rev ? [[x + w / 2, y - h / 2], [x - w / 2, y - h / 4], [x - w / 2, y + h / 4], [x + w / 2, y + h / 2]] : [[x - w / 2, y - h / 2], [x + w / 2, y - h / 4], [x + w / 2, y + h / 4], [x - w / 2, y + h / 2]]; return `<polygon class="${eq(hi)}" points="${q(a)}"/>`; };
  const evap = (x, y, r, hi) => `<circle class="${eq(hi)}" cx="${x}" cy="${y}" r="${r}"/><path class="thin" style="stroke-width:1.8;${hi ? 'stroke:var(--red)' : ''}" d="M${x - r * .6},${y + r * .3} L${x - r * .28},${y - r * .5} L${x},${y + r * .5} L${x + r * .28},${y - r * .5} L${x + r * .6},${y + r * .3}"/>`;
  // ---- section boxes ----
  const SEC = [['Feed Preparation', 'var(--sec-feed)', 14, 16, 470, 420], ['Gasification and Gas Cleaning', 'var(--sec-gas)', 490, 16, 960, 420],
    ['Water-Gas Shift and Hydrogen Separation', 'var(--sec-wgs)', 980, 16, 1786, 420], ['Methanol Synthesis', 'var(--sec-syn)', 14, 462, 1340, 978], ['Methanol Purification', 'var(--sec-pur)', 1360, 462, 1786, 978]];
  function build() {
    S = ''; hops.length = 0;
    add(`<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="var(--ink2)"/></marker>
      <marker id="arH" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="var(--red)"/></marker>
      <marker id="arU" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L10,5L0,10z" fill="var(--grey)"/></marker>
      <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="var(--ink2)" stroke-width="1"/></pattern>
      <pattern id="dots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="2.2" fill="none" stroke="var(--ink2)" stroke-width="1"/></pattern></defs>`);
    SEC.forEach(([t, c, x0, y0, x1, y1]) => add(`<rect class="sec" x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="10" style="stroke:${c}"/><text class="sect" x="${x0 + 14}" y="${y0 + 26}" style="fill:${c}">${t} Section</text>`));
    // ================= FEED PREPARATION =================
    prod(38, 130, ''); dia(72, 130, 1); pipe([[85, 130], [110, 130]], {arrow: false, st: 1});
    pipe([[110, 130], [110, 92], [160, 92]], {st: 1}); pipe([[110, 130], [110, 172], [160, 172]], {st: 1});
    note(40, 108, 'MPW', {a: 'start'});
    ['A', 'B'].forEach((k, j) => { const y = j ? 172 : 92; U('CR-101', `<polygon class="eq" points="${q([[162, y - 22], [232, y - 22], [218, y + 4], [176, y + 4]])}"/><rect class="eq" x="178" y="${y + 4}" width="38" height="22"/><circle class="thin" cx="190" cy="${y + 15}" r="7"/><circle class="thin" cx="205" cy="${y + 15}" r="7"/>`);
      lbl(197, y - 28, 'CR-101 ' + k, {fs: 13}); });
    pipe([[216, 107], [262, 107], [262, 130]], {arrow: false, st: 2}); pipe([[216, 187], [262, 187], [262, 130]], {arrow: false, st: 2});
    pipe([[262, 130], [596, 130]], {st: 2}); dia(360, 130, 2);
    // water train
    prod(38, 312, ''); note(40, 290, 'Process water', {a: 'start'}); dia(72, 312, 3); pipe([[85, 312], [110, 312]], {arrow: false, st: 3});
    pipe([[110, 312], [110, 276], [152, 276]], {st: 3}); pipe([[110, 312], [110, 350], [152, 350]], {st: 3});
    U('E-101', drum(205, 276, 104, 30, false) + drum(205, 350, 104, 30, false), {cls: 'hx'});
    add(`<g class="hiTint"><rect x="146" y="252" width="118" height="122" rx="8" fill="none" stroke="var(--red)" stroke-dasharray="5 4" class="hiOnly"/></g>`);
    lbl(205, 386, 'E-101 A/B', {fs: 13}); util([[236, 232], [236, 256]], 'flue gas', {ty: 228});
    add(`<text class="note hiOnly" x="205" y="404" text-anchor="middle" style="fill:var(--red)">+ preheat on effluent 40 → 42</text>`);
    pipe([[257, 276], [290, 276], [290, 312]], {arrow: false, st: 4}); pipe([[257, 350], [290, 350], [290, 312]], {arrow: false, st: 4});
    pipe([[290, 312], [338, 312]], {st: 4}); dia(312, 312, 4);
    U('E-102', `<rect class="eq" x="340" y="288" width="64" height="48"/><path class="thin" style="stroke-width:1.6" d="M346,296 h10 v32 h10 v-32 h10 v32 h10 v-32 h12"/>`, {cls: 'baseOnly'});
    lbl(372, 282, 'E-102', {fs: 13, cls: 'baseOnly'}); util([[372, 366], [372, 338]], 'flue gas', {ty: 380, cls: 'baseOnly'});
    add(`<text class="note hiOnly" x="372" y="262" text-anchor="middle" style="fill:var(--red)">E-102 moved</text><text class="note hiOnly" x="372" y="277" text-anchor="middle" style="fill:var(--red)">to the syngas</text><text class="note hiOnly" x="372" y="292" text-anchor="middle" style="fill:var(--red)">line (13 → 35)</text>`);
    pipe([[404, 312], [440, 312]], {st: 5}); dia(422, 312, 5);
    U('D-101', mixer(462, 312, true));
    lbl(462, 278, 'D-101', {fs: 13});
    pipe([[482, 312], [596, 312]], {st: 7}); dia(548, 312, 7);
    pipe([[462, 336], [462, 398], [1086, 398], [1086, 128]], {st: 6}); dia(520, 398, 6); hop(800, 398, false); hop(940, 398, false);
    // ================= GASIFICATION =================
    U('R-101', `<path class="eq" d="M600,96 a70,40 0 0 1 140,0 v212 l-30,40 h-80 l-30,-40 z"/><rect x="600" y="248" width="140" height="62" fill="url(#hatch)" stroke="var(--ink2)" stroke-width="1"/><rect x="600" y="248" width="140" height="62" fill="url(#dots)" opacity=".7"/>`);
    lbl(670, 80, 'R-101', {fs: 15}); note(670, 372, '5 trains, 1,200 °C', {});
    pipe([[740, 112], [784, 112], [784, 140], [792, 140]], {st: 8}); dia(762, 112, 8);
    U('CY-101', [800, 840, 880].map(x => `<rect class="eq" x="${x - 17}" y="128" width="34" height="62"/><polygon class="eq" points="${q([[x - 17, 190], [x + 17, 190], [x + 5, 258], [x - 5, 258]])}"/><rect class="eq" x="${x - 7}" y="116" width="14" height="30"/>`).join('') + `<rect x="772" y="100" width="136" height="172" rx="8" fill="none" stroke="var(--muted)" stroke-dasharray="4 4"/>`);
    lbl(848, 292, 'CY-101', {fs: 13, a: 'start'}); note(848, 308, '3 per train', {a: 'start'});
    pipe([[800, 258], [800, 432], [1798, 432]], {st: 9}); dia(800, 340, 9); prod(1812, 432, 'Solid residue', false); hop(940, 432, false); hop(1638, 432, false);
    pipe([[880, 116], [880, 92], [918, 92]], {st: 10}); dia(899, 92, 10, {});
    U('D-102', mixer(940, 104, true)); lbl(940, 70, 'D-102', {fs: 13});
    pipe([[960, 104], [1064, 104]], {st: 12}); dia(1010, 104, 12);
    pipe([[940, 128], [940, 488], [1300, 488], [1300, 540]], {st: 11}); dia(940, 210, 11);
    note(1050, 480, 'unshifted syngas bypass (D-102 split 1 − β)', {a: 'start'});
    // ================= WATER-GAS SHIFT =================
    U('M-101', mixer(1086, 104, false)); lbl(1086, 70, 'M-101', {fs: 13});
    pipe([[1106, 104], [1128, 104]], {arrow: false, st: 13}); dia(1140, 104, 13); pipe([[1153, 104], [1250, 104]], {st: 13, arrow: false});
    // E-102 in its heat-integrated position (syngas 13 -> 35)
    U('E-102HI', `<rect class="eq hi" x="1168" y="84" width="56" height="40"/><path class="thin" style="stroke:var(--red);stroke-width:1.5" d="M1173,92 h8 v24 h9 v-24 h9 v24 h9 v-24 h10"/>`, {cls: 'hiOnly'});
    add(`<g class="hiOnly"><text class="lbl hi" x="1196" y="76" text-anchor="middle" style="font-size:13px">E-102</text><text class="note" x="1196" y="142" text-anchor="middle" style="fill:var(--red)">34 → 5 steam</text></g>`);
    pipe([[1250, 104], [1250, 70], [1290, 70]], {st: 13}); pipe([[1250, 104], [1250, 150], [1290, 150]], {st: 13});
    U('E-103', capsuleH(1340, 70, 96, 30, false) + capsuleH(1340, 150, 96, 30, false) + `<rect class="eq" x="1312" y="40" width="56" height="12" rx="6"/><rect class="eq" x="1312" y="120" width="56" height="12" rx="6"/>`);
    lbl(1340, 192, 'E-103 A/B', {fs: 13}); note(1340, 208, 'BFW → steam (40 bar)', {cls: 'baseOnly'}); add(`<text class="note hiOnly" x="1340" y="208" text-anchor="middle" style="fill:var(--red)">water 33 → 34 (boiling)</text>`);
    pipe([[1388, 70], [1414, 70], [1414, 110]], {arrow: false, st: 14}); pipe([[1388, 150], [1414, 150], [1414, 110]], {arrow: false, st: 14});
    pipe([[1414, 110], [1470, 110]], {st: 14}); dia(1442, 110, 14);
    U('R-102', `<path class="eq" d="M1472,70 a38,24 0 0 1 76,0 v120 a38,24 0 0 1 -76,0 z"/><rect x="1472" y="82" width="76" height="96" fill="url(#hatch)" stroke="var(--ink2)" stroke-width="1"/>`);
    lbl(1510, 36, 'R-102', {fs: 15}); note(1510, 236, '6 beds, 270 °C', {});
    pipe([[1548, 110], [1592, 110]], {st: 15}); dia(1570, 110, 15);
    U('ME-101', `<rect class="eq" x="1594" y="80" width="88" height="62"/><line class="thin" x1="1594" y1="142" x2="1682" y2="80" stroke-dasharray="5 3"/>`);
    lbl(1638, 54, 'ME-101', {fs: 15}); note(1638, 70, '26 Pd–Ag modules', {});
    pipe([[1682, 100], [1706, 100]], {st: 16});
    U('C-102', comp(1726, 100, 34, 56, false)); lbl(1726, 62, 'C-102', {fs: 13}); note(1730, 160, 'vacuum compressor');
    pipe([[1743, 100], [1798, 100]], {st: 16}); dia(1768, 100, 16); prod(1812, 100, 'Hydrogen');
    pipe([[1638, 142], [1638, 452], [1330, 452], [1330, 540]], {st: 17}); dia(1638, 300, 17);
    // ================= METHANOL SYNTHESIS : C-101 package (right to left) =================
    const yC = 552;
    pipe([[1300, 540], [1300, yC], [1290, yC]], {arrow: false, st: 11}); pipe([[1330, 540], [1330, yC], [1290, yC]], {arrow: false, st: 17});
    // E-106 slot (HI) on the suction gas
    U('E-106', evap(1262, yC, 18, true), {cls: 'hiOnly'});
    add(`<g class="hiOnly"><text class="lbl hi" x="1262" y="${yC - 28}" text-anchor="middle" style="font-size:13px">E-106</text><text class="note" x="1262" y="${yC + 36}" text-anchor="middle" style="fill:var(--red)">32 → 33</text></g>`);
    pipe([[1290, yC], [1236, yC]], {st: 36, arrow: false}); pipe([[1236, yC], [1212, yC]], {st: 36});
    U('SC-1', capsuleH(1180, yC, 62, 26, false)); lbl(1180, yC + 32, 'SC-1', {fs: 12.5}); util([[1180, yC - 44], [1180, yC - 15]], 'CW', {ty: yC - 48});
    pipe([[1149, yC], [1128, yC]], {st: 38});
    U('SC-2', capsuleH(1096, yC, 62, 26, false)); lbl(1096, yC + 32, 'SC-2', {fs: 12.5}); util([[1096, yC - 44], [1096, yC - 15]], 'CHW', {ty: yC - 48});
    pipe([[1065, yC], [1046, yC]], {});
    U('KO', `<rect class="eq" x="1018" y="${yC - 44}" width="28" height="88" rx="14"/><line class="thin" x1="1020" y1="${yC + 16}" x2="1044" y2="${yC + 16}" stroke-dasharray="3 2"/>`); note(1032, yC - 52, 'KO drum');
    pipe([[1032, yC + 44], [1032, yC + 66], [1090, yC + 66]], {st: 30}); dia(1060, yC + 66, 30); note(1096, yC + 84, 'condensate to the gasifier water', {a: 'start'});
    pipe([[1018, yC], [990, yC]], {});
    // stages and intercoolers
    let x = 960; const stages = [], ics = [];
    for (let k = 0; k < 5; k++) { stages.push(x); x -= 76; if (k < 4) { ics.push(x); x -= 76; } }
    U('C-101', stages.map((sx, k) => comp(sx, yC, 40, 60, true)).join('') + ics.map(ix => capsuleH(ix, yC, 56, 24, false)).join(''));
    stages.forEach((sx, k) => { note(sx, yC - 40, 'Stage ' + (k + 1)); });
    ics.forEach((ix, k) => { lbl(ix, yC + 30, 'IC-' + (k + 1), {fs: 12}); util([[ix, yC - 34], [ix, yC - 13]], '', {}); });
    for (let k = 0; k < 5; k++) { if (k < 4) { pipe([[stages[k] - 20, yC], [ics[k] + 28, yC]], {}); pipe([[ics[k] - 28, yC], [stages[k + 1] + 20, yC]], {}); } }
    lbl(600, 494, 'C-101  five-stage centrifugal syngas compressor (1 → 50 bar)', {fs: 15});
    const yS = 612; add(`<path d="M${stages[4] - 62},${yS} H${stages[0]} M${stages[4]},${yC + 30} V${yS} M${stages[1]},${yC + 30} V${yS} M${stages[2]},${yC + 30} V${yS} M${stages[3]},${yC + 30} V${yS} M${stages[0]},${yC + 30} V${yS}" fill="none" stroke="var(--ink2)" stroke-width="1.6" stroke-dasharray="10 4 2 4"/>`);
    U('M', `<circle class="eq" cx="${stages[4] - 80}" cy="${yS}" r="18"/><text x="${stages[4] - 80}" y="${yS + 6}" text-anchor="middle" style="font-weight:700;font-size:16px;fill:var(--ink)">M</text>`);
    note(stages[4] - 80, yS + 36, 'motor (VFD)');
    pipe([[stages[4] - 20, yC], [110, yC], [110, 772]], {st: 18}); dia(110, 660, 18);
    // ================= synthesis loop (left to right) =================
    const yL = 812;
    U('M-102', mixer(110, yL - 6, false)); lbl(60, yL - 30, 'M-102', {fs: 13});
    pipe([[130, yL], [196, yL]], {st: 19}); dia(160, yL, 19);
    U('E-104', capsuleH(248, yL, 100, 34, false)); lbl(248, yL + 36, 'E-104', {fs: 13});
    util([[278, yL - 52], [278, yL - 18]], 'steam (40 bar)', {ty: yL - 56, cls: 'baseOnly'});
    add(`<g class="hiOnly"><rect x="196" y="${yL - 19}" width="104" height="38" rx="17" fill="none" stroke="var(--red)" stroke-width="2"/><text class="note" x="248" y="${yL - 30}" text-anchor="middle" style="fill:var(--red)">(a) effluent 40 → 41 · (b) gas 37 → 38</text></g>`);
    pipe([[298, yL], [372, yL]], {st: 20}); dia(334, yL, 20);
    U('R-103', `<path class="eq" d="M374,${yL - 92} a52,30 0 0 1 104,0 v184 a52,30 0 0 1 -104,0 z"/>` + Array.from({length: 9}, (_, k) => `<line class="thin" x1="${384 + k * 10.6}" y1="${yL - 86}" x2="${384 + k * 10.6}" y2="${yL + 86}"/>`).join('') + `<rect x="374" y="${yL - 86}" width="104" height="172" fill="url(#hatch)" opacity=".55"/>`);
    lbl(426, yL - 150, 'R-103', {fs: 15}); note(426, yL - 134, '3,447 tubes, 200 °C');
    U('SD', `<rect class="eq" x="490" y="${yL - 150}" width="82" height="24" rx="12"/>`); note(531, yL - 158, 'steam drum (11.75 bar)');
    add(`<path d="M478,${yL - 60} H510 V${yL - 126} M552,${yL - 126} V${yL - 30} H478" fill="none" stroke="var(--grey)" stroke-width="1.5"/>`);
    pipe([[478, yL], [560, yL]], {st: 21, arrow: false}); dia(520, yL, 21, {});
    U('E-107', evap(590, yL, 18, true), {cls: 'hiOnly'});
    add(`<g class="hiOnly"><text class="lbl hi" x="590" y="${yL - 26}" text-anchor="middle" style="font-size:13px">E-107</text><text class="note" x="590" y="${yL + 36}" text-anchor="middle" style="fill:var(--red)">4 → 32</text></g>`);
    pipe([[560, yL], [636, yL]], {st: 21});
    U('E-105', [0, 1, 2, 3].map(k => capsuleH(690, yL - 60 + k * 40, 104, 24, false)).join('') + `<rect x="630" y="${yL - 82}" width="120" height="164" rx="8" fill="none" stroke="var(--muted)" stroke-dasharray="4 4"/>`);
    add(`<path d="M636,${yL - 60} V${yL + 60} M744,${yL - 60} V${yL + 60}" fill="none" stroke="var(--ink2)" stroke-width="1.6"/>`);
    lbl(690, yL - 92, 'E-105 (4 shells)', {fs: 13}); util([[690, yL + 106], [690, yL + 84]], 'CW', {ty: yL + 122});
    pipe([[744, yL], [826, yL]], {st: 22}); dia(786, yL, 22);
    U('F-101', `<rect class="eq" x="828" y="${yL - 84}" width="66" height="168" rx="33"/><line class="thin" x1="832" y1="${yL + 30}" x2="890" y2="${yL + 30}" stroke-dasharray="4 3"/>`); lbl(861, yL + 108, 'F-101 (47 bar)', {fs: 13});
    pipe([[861, yL - 84], [861, yL - 112], [956, yL - 112]], {st: 23}); dia(910, yL - 112, 23);
    U('D-103', mixer(976, yL - 112, true)); lbl(976, yL - 146, 'D-103', {fs: 13});
    pipe([[996, yL - 112], [1232, yL - 112], [1232, 994], [1798, 994]], {st: 25}); dia(1120, yL - 112, 25); prod(1812, 994, 'Purge', false);
    pipe([[976, yL - 88], [976, 944], [548, 944]], {st: 24}); dia(760, 944, 24);
    U('C-101R', comp(526, 944, 40, 52, true)); lbl(526, 908, 'C-101R', {fs: 13}); note(526, 970, 'recycle wheel (C-101 drive)');
    pipe([[506, 944], [110, 944], [110, yL + 22]], {st: 31}); dia(300, 944, 31);
    pipe([[861, yL + 84], [861, 872], [1406, 872]], {st: 26}); dia(1040, 872, 26); hop(976, 872, false); hop(1232, 872, false);
    // ================= PURIFICATION =================
    U('V-101', `<path class="eq" d="M1408,860 L1432,884 L1432,860 L1408,884 Z"/>`); lbl(1420, 850, 'V-101', {fs: 12.5}); note(1420, 906, '47 → 1 bar');
    pipe([[1432, 872], [1534, 872]], {st: 27}); dia(1480, 872, 27);
    U('T-101', `<rect class="eq" x="1536" y="520" width="62" height="380" rx="31"/>` + Array.from({length: 14}, (_, k) => `<line class="thin" x1="${k % 2 ? 1550 : 1540}" y1="${552 + k * 24}" x2="${k % 2 ? 1594 : 1584}" y2="${552 + k * 24}" stroke-dasharray="4 3"/>`).join(''));
    lbl(1510, 700, 'T-101', {fs: 15, a: 'end'}); note(1510, 718, '52 trays', {a: 'end'});
    pipe([[1567, 520], [1567, 500], [1626, 500]], {});
    U('COND', capsuleH(1660, 500, 68, 26, false)); note(1660, 482, 'condenser'); util([[1660, 540], [1660, 514]], '', {});
    pipe([[1694, 500], [1716, 500], [1716, 548]], {});
    U('RD', `<rect class="eq" x="1680" y="550" width="72" height="28" rx="14"/>`); note(1716, 598, 'reflux drum');
    pipe([[1716, 578], [1716, 640], [1598, 640]], {}); note(1650, 632, 'reflux');
    pipe([[1716, 640], [1716, 700], [1798, 700]], {st: 29}); dia(1760, 700, 29); prod(1812, 700, 'Methanol');
    pipe([[1567, 900], [1567, 926], [1626, 926]], {});
    U('REB', `<path class="eq" d="M1628,912 h22 l12,-12 h40 a12,12 0 0 1 12,12 v20 a12,12 0 0 1 -12,12 h-62 a12,12 0 0 1 -12,-12 z"/>`, {cls: 'reb'});
    add(`<path class="hiOnly" d="M1628,912 h22 l12,-12 h40 a12,12 0 0 1 12,12 v20 a12,12 0 0 1 -12,12 h-62 a12,12 0 0 1 -12,-12 z" fill="none" stroke="var(--red)" stroke-width="2.2"/>`);
    note(1672, 962, 'reboiler'); util([[1640, 966], [1640, 946]], '', {cls: 'baseOnly'}); add(`<text class="note hiOnly" x="1700" y="890" text-anchor="middle" style="fill:var(--red)">effluent 39 → 40</text>`);
    pipe([[1680, 900], [1680, 868], [1598, 868]], {});
    pipe([[1714, 930], [1798, 930]], {st: 28}); dia(1760, 930, 28); prod(1812, 930, 'Wastewater', false);
    S += hops.join('');
    return S;
  }
  return {build};
})();
// equipment data sheets (Chapter 3, Appendix C and Table 8.7)
const UNITS = {
 'CR-101': {n: 'Plastic shredders', s: 'Feed preparation', c: 'var(--sec-feed)', d: [['Units', '2 (A/B)'], ['MPW feed', '37,879 kg/h'], ['Power', '2,083 kW'], ['Bare-module cost', '$186,740']], live: 'feed'},
 'E-101': {n: 'Water preheater and boiler', s: 'Feed preparation', c: 'var(--sec-feed)', d: [['Type', 'Water-tube boiler (A/B)'], ['Duty (base)', '70,379 kW'], ['Area', '3,637 m²'], ['After heat integration', 'Preheat on the effluent (40 → 42) + 25.93 MW fired heat'], ['Bare-module cost', '$2,012,680']]},
 'E-102': {n: 'Steam superheater', s: 'Feed preparation', c: 'var(--sec-feed)', d: [['Duty', '27,363 kW'], ['Steam', '101 → 600 °C (Stream 5)'], ['Base heating', 'Flue gas'], ['After heat integration', 'Hot syngas 13 → 35 (941.87 → 547.64 °C)'], ['Bare-module cost', '$1,373,842']]},
 'E-102HI': {alias: 'E-102'},
 'D-101': {n: 'Steam divider', s: 'Feed preparation', c: 'var(--sec-feed)', d: [['Steam to R-101 (7)', '50,400 kg/h'], ['Steam bypass (6)', 'to M-101 (sets S/CO = 2)'], ['Volume', '110.4 m³ (D = 3.60 m)'], ['Bare-module cost', '$446,180']]},
 'R-101': {n: 'Dual fluidised-bed gasifier', s: 'Gasification', c: 'var(--sec-gas)', d: [['Trains', '5 in parallel'], ['Temperature / pressure', '1,200 °C / 1.013 bar'], ['Bed material', 'Olivine, 550 µm'], ['Steam-to-carbon ratio', '1.09 mol/mol'], ['Raw syngas', '7,852 kmol/h, H₂/CO = 2.07'], ['Carbon conversion', '97.16 %'], ['Bare-module cost', '$113,422,863']], live: 'feed'},
 'CY-101': {n: 'Cyclones', s: 'Gasification', c: 'var(--sec-gas)', d: [['Type', 'Stairmand high efficiency'], ['Number', '15 (3 per train)'], ['Body diameter', '3.50 m'], ['Cut size d50', '22.9 µm'], ['Pressure drop', '61 Pa']]},
 'D-102': {n: 'Syngas divider', s: 'Gasification', c: 'var(--sec-gas)', d: [['Split β (to methanol)', 'live'], ['To shift (12)', 'live'], ['Bypass (11)', 'live'], ['Bare-module cost', '$646,126']], live: 'beta'},
 'M-101': {n: 'Syngas–steam mixer', s: 'Water-gas shift', c: 'var(--sec-wgs)', d: [['Volume', '214.2 m³'], ['Outlet (13)', '941.87 °C'], ['Bare-module cost', '$1,153,058']]},
 'E-103': {n: 'Pre-shift syngas cooler', s: 'Water-gas shift', c: 'var(--sec-wgs)', d: [['Duty', '46,633 kW (base)'], ['Outlet (14)', '270 °C'], ['Base service', 'Waste-heat boiler, 40-bar steam'], ['After heat integration', 'Evaporates the gasifier water (33 → 34)'], ['Control', 'TC-202 syngas bypass'], ['Bare-module cost', '$2,281,832']]},
 'R-102': {n: 'Water-gas shift reactor', s: 'Water-gas shift', c: 'var(--sec-wgs)', d: [['Type', 'Radial flow, 6 beds, interbed cooled'], ['Catalyst', 'Cu/ZnO/Al₂O₃, 71,198 kg'], ['Temperature', '270 °C'], ['CO conversion', '90 %'], ['Heat duty', '14.23 MW (28 bar steam)'], ['Bare-module cost', '$1,196,248']], live: 'S15'},
 'ME-101': {n: 'Hydrogen membrane', s: 'Hydrogen separation', c: 'var(--sec-wgs)', d: [['Membrane', 'Pd–Ag film, 5 µm on SS tubes'], ['Area', '6,040 m² (26 modules)'], ['Recovery ρ / purity', 'live / 99.99 %'], ['Permeate pressure', '0.04 bar'], ['Bare-module cost', '$31,827,522']], live: 'A'},
 'C-102': {n: 'Hydrogen compressor', s: 'Hydrogen separation', c: 'var(--sec-wgs)', d: [['Duty', '0.04 → 30 bar'], ['Power', '28,552 kW'], ['Product', '61,831 t/y H₂ (99.99 %)'], ['Bare-module cost', '$47,098,903']], live: 'H2p'},
 'E-106': {n: 'Water evaporator (new)', s: 'Heat integration', c: 'var(--red)', d: [['Match', 'H2 – C2'], ['Duty', '15,356.16 kW'], ['Hot side', 'Suction gas 36 → 37 (639.40 → 400.91 °C)'], ['Cold side', 'Water 32 → 33 (boiling)'], ['Bare-module cost', '$558,949']]},
 'SC-1': {n: 'C-101 suction cooler', s: 'Methanol synthesis', c: 'var(--sec-syn)', d: [['Utility', 'Cooling water'], ['Outlet', '40 °C'], ['Duty after heat integration', '20,625 kW'], ['Bare-module cost', '$5,215,466']]},
 'SC-2': {n: 'C-101 suction chiller', s: 'Methanol synthesis', c: 'var(--sec-syn)', d: [['Utility', 'Chilled water (7 → 12 °C)'], ['Outlet', '24.18 °C'], ['Duty', '4,052.93 kW'], ['Bare-module cost', '$615,756']]},
 'KO': {n: 'Suction knock-out drum', s: 'Methanol synthesis', c: 'var(--sec-syn)', d: [['Condensate (30)', '1,586.87 kmol/h to the water feed'], ['Control', 'LC-323'], ['Bare-module cost', '$897,480']]},
 'C-101': {n: 'Syngas compressor', s: 'Methanol synthesis', c: 'var(--sec-syn)', d: [['Type', 'Centrifugal, 5 stages, 4 intercoolers'], ['Pressure', '1 → 50 bar (2.187 per stage)'], ['Power', '22,533 kW'], ['Control', 'PC-301 → SC-301, FC-302 anti-surge'], ['Bare-module cost', '$63,557,666']], live: 'S18'},
 'M': {alias: 'C-101'}, 'C-101R': {n: 'Recycle wheel', s: 'Methanol synthesis', c: 'var(--sec-syn)', d: [['Duty', 'Recycle 24 → 31 to 50 bar'], ['Power', '823 kW'], ['Control', 'PC-324'], ['Bare-module cost', '$3,339,799']], live: 'S24'},
 'M-102': {n: 'Synthesis-loop mixer', s: 'Methanol synthesis', c: 'var(--sec-syn)', d: [['Inlets', 'Fresh gas 18 + recycle 31'], ['Outlet (19)', '72.19 °C, 50 bar'], ['Control', 'AC-308 (stoichiometric number)']]},
 'E-104': {n: 'Synthesis-feed heater', s: 'Methanol synthesis', c: 'var(--sec-syn)', d: [['Type', 'TEMA NEN, 1 shell, 1 pass'], ['Duty', '23,818.78 kW'], ['Area / tubes', '399.14 m², 1,025 tubes'], ['Base heating', '40-bar steam'], ['After heat integration', '(a) effluent 40 → 41, (b) suction gas 37 → 38'], ['Control', 'TC-310 (steam, or gas bypass after HI)']]},
 'R-103': {n: 'Methanol reactor', s: 'Methanol synthesis', c: 'var(--sec-syn)', d: [['Type', 'Multitubular, boiling-water cooled'], ['Tubes', '3,447 × 4.88 m'], ['Catalyst', 'Cu/ZnO/Al₂O₃, 20 m³'], ['Temperature / pressure', '200 °C / 50 bar'], ['Heat duty', '24.62 MW (44.6 t/h steam)'], ['Bare-module cost', '$2,188,759']], live: 'S20'},
 'SD': {alias: 'R-103'},
 'E-107': {n: 'Water evaporator (new)', s: 'Heat integration', c: 'var(--red)', d: [['Match', 'H3 – C2'], ['Duty', '1,328.67 kW'], ['Hot side', 'Effluent 21 → 39 (200 → 193.19 °C)'], ['Cold side', 'Water 4 → 32'], ['Bare-module cost', '$208,326']]},
 'E-105': {n: 'Effluent cooler', s: 'Methanol synthesis', c: 'var(--sec-syn)', d: [['Type', 'TEMA AES, 4 shells'], ['Duty', '47,235 kW (base) / 12,396 kW (HI)'], ['Outlet (22)', '40 °C'], ['Control', 'TC-316 → FC-317'], ['Bare-module cost', '$3,474,660']]},
 'F-101': {n: 'High-pressure flash drum', s: 'Methanol synthesis', c: 'var(--sec-syn)', d: [['Pressure', '47 bar, 40 °C'], ['Diameter / height', '3.50 / 8.75 m'], ['Liquid level', '0.90 m (LC-318, P-only)'], ['Bare-module cost', '$5,474,053']], live: 'S23'},
 'D-103': {n: 'Recycle / purge divider', s: 'Methanol synthesis', c: 'var(--sec-syn)', d: [['Purge fraction φ', 'live'], ['Loop pressure', '47 bar (PC-319)'], ['Bare-module cost', '$139,295']], live: 'phi'},
 'V-101': {n: 'Let-down valve', s: 'Methanol purification', c: 'var(--sec-pur)', d: [['Pressure', '47 → 1 bar'], ['Final element of', 'LC-318']]},
 'T-101': {n: 'Methanol column', s: 'Methanol purification', c: 'var(--sec-pur)', d: [['Trays', '52 sieve trays, feed tray 39'], ['Diameter / height', '3.38 / 33.6 m'], ['Reflux ratio', '0.8231 (1.20 Rmin)'], ['Distillate', '99.5 mol% methanol'], ['Condenser / reboiler', '18.84 / 19.98 MW'], ['Bare-module cost', '$2,266,993 (shell + trays)']], live: 'S26'},
 'COND': {alias: 'T-101'}, 'RD': {alias: 'T-101'},
 'REB': {n: 'Kettle reboiler', s: 'Methanol purification', c: 'var(--sec-pur)', d: [['Duty', '19,977 kW'], ['Bottom temperature', '99.22 °C'], ['Base heating', 'LP steam (FC-408)'], ['After heat integration', 'Effluent 39 → 40, TC-406 bypass'], ['Bare-module cost', '$2,234,933']]}
};
