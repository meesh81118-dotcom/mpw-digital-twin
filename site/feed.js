// ===================================================================== FEEDSTOCK LAB (sheet 10) and SUSTAINABILITY (sheet 11)
// The feed chosen on sheet 10 enters every model of the twin through MKX() (mk.fq): R-101 syngas, products, limits and economics.
const PCOL = {HDPE: 'var(--c-bl)', LDPE: 'var(--c-lb)', PP: 'var(--c-gr)', PS: 'var(--c-pu)', PET: 'var(--c-go)', PVC: 'var(--c-rd)', w: 'var(--s-water)', a: 'var(--c-gy)'};
const PNAME = {HDPE: 'HDPE', LDPE: 'LDPE', PP: 'PP', PS: 'PS', PET: 'PET', PVC: 'PVC', w: 'Moisture', a: 'Inerts'};
const PLONG = {HDPE: 'High-density polyethylene: bottles, crates, pipes', LDPE: 'Low-density polyethylene: films and bags', PP: 'Polypropylene: caps, containers, woven sacks',
  PS: 'Polystyrene: cups, trays, foam', PET: 'Polyethylene terephthalate: drink bottles', PVC: 'Polyvinyl chloride: pipes, cables, blister packs'};
// illustrative waste streams (wt%); the design MPW stands for Table 2.3
const FPRE = [
  ['des', 'Design MPW', {HDPE: 24, LDPE: 22, PP: 26, PS: 13, PET: 15, PVC: 0, w: 0, a: 0, pur: 0}, 'The basis of design: 37,879 kg/h with 81.05 % C, 13.69 % H and 5.26 % O, free of chlorine, moisture and ash (Table 2.3).'],
  ['muni', 'Municipal MPW', {HDPE: 20, LDPE: 27, PP: 21, PS: 10, PET: 18, PVC: 4, w: 10, a: 6, pur: 0}, 'Mixed plastics picked from household waste: films, bottles and some PVC, wet and dirty from the bin.'],
  ['olef', 'Polyolefin packaging', {HDPE: 32, LDPE: 36, PP: 28, PS: 2, PET: 2, PVC: 0, w: 2, a: 1, pur: 0}, 'Films, bags and rigid packaging of PE and PP: the most hydrogen-rich plastic.'],
  ['pet', 'PET-rich bottles', {HDPE: 8, LDPE: 6, PP: 8, PS: 3, PET: 75, PVC: 0, w: 4, a: 1, pur: 0}, 'Mostly drink bottles. PET carries one third of its mass as oxygen, so it makes CO₂ instead of CO.'],
  ['land', 'Landfill-mined plastic', {HDPE: 18, LDPE: 30, PP: 18, PS: 12, PET: 14, PVC: 8, w: 18, a: 15, pur: 0}, 'Plastic recovered from old landfills: wet, full of soil and with the most PVC.'],
  ['bale', 'Sorted industrial bales', {HDPE: 30, LDPE: 25, PP: 30, PS: 10, PET: 5, PVC: 0, w: 1, a: 0.5, pur: 0}, 'Clean post-industrial scrap in bales, already sorted at the source.']];
const FMD = feedModel(FQ_DES);
const curFM = () => (E && E.r.fm) || feedModel(ST.FQ);
const fqName = () => { const same = (q, ks) => ks.every(k => Math.abs((ST.FQ[k] || 0) - q[k]) < 1e-9), ks = PKEYS.concat(['w', 'a']);
  const p = FPRE.find(([, , q]) => same(q, ks)); return p ? p[1] + (ST.FQ.pur > 0 ? ', cleaned ' + fmt(ST.FQ.pur, 0) + ' %' : '') : 'Custom feed'; };
const shareTot = fq => PKEYS.reduce((a, k) => a + (fq[k] || 0), 0) || 1;
function setFeed(fq, msg) { ST.FQ = Object.assign({}, FQ_DES, fq); for (const k in FM_CACHE) delete FM_CACHE[k]; syncFeedInputs(); render(); if (msg) toast(msg); }
function syncFeedInputs() {
  PKEYS.forEach(k => { const el = $('fq-' + k); if (el) { el.value = ST.FQ[k]; fillRange(el); } });
  [['fqw', 'w'], ['fqa', 'a'], ['fqp', 'pur']].forEach(([id, k]) => { const el = $(id); if (el) { el.value = ST.FQ[k]; fillRange(el); } });
  const sel = $('opFeed'); if (sel) { const p = FPRE.find(([, , q]) => Object.keys(q).every(k => Math.abs((ST.FQ[k] || 0) - q[k]) < 1e-9)); sel.value = p ? p[0] : 'custom'; }
}
function buildFeed() {
  $('fqPre').innerHTML = FPRE.map(([k, n]) => `<button data-k="${k}">${n}</button>`).join('');
  $$('#fqPre button').forEach(b => b.addEventListener('click', () => { const p = FPRE.find(z => z[0] === b.dataset.k); setFeed(p[2], 'Feed selected: ' + p[1]); }));
  $('fqPoly').innerHTML = PKEYS.map(k => `<div class="ctl fqc"><label for="fq-${k}"><span><i class="sw" style="background:${PCOL[k]}"></i>${k} <small>${PLONG[k].split(':')[1]}</small></span><output id="o-fq-${k}"></output></label><input id="fq-${k}" type="range" min="0" max="100" step="0.5" value="${FQ_DES[k]}" aria-label="${PLONG[k]}"></div>`).join('');
  PKEYS.forEach(k => $('fq-' + k).addEventListener('input', () => { ST.FQ[k] = +$('fq-' + k).value; if (shareTot(ST.FQ) <= 0.001) { ST.FQ[k] = 0.5; } render(); }));
  [['fqw', 'w'], ['fqa', 'a'], ['fqp', 'pur']].forEach(([id, k]) => $(id).addEventListener('input', () => { ST.FQ[k] = +$(id).value; render(); }));
  $('fqAI').addEventListener('click', () => { const b = $('fqAI'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Searching…';
    setTimeout(() => { const best = bestPur(); ST.FQ.pur = best.p; syncFeedInputs(); render(); b.disabled = false; b.textContent = 'AI: best cleaning intensity';
      toast(best.p === 0 ? 'Nothing worth removing: the line is best switched off for this feed.' : 'Best cleaning intensity: ' + best.p + ' % (NPV ' + money(best.npv) + ' M).'); }, 30); });
  $('fqOpt').addEventListener('click', () => { const b = $('fqOpt'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Searching…';
    runMode('npv'); setTimeout(() => { b.disabled = false; b.textContent = 'AI: best set point for this feed'; $('fqNote').innerHTML = 'AI set point for this feed: β = ' + ST.X[0].toFixed(3) + ', φ = ' + ST.X[1].toFixed(3) + ', ρ = ' + ST.X[2].toFixed(3) + ', NPV ' + money(E.npv) + ' M. <a data-go="operations" href="#/operations">Open sheet 03</a>.'; }, 80); });
  $$('#fqFpK button').forEach(b => b.addEventListener('click', () => { ST.fpk = b.dataset.k; $$('#fqFpK button').forEach(x => x.classList.toggle('on', x === b)); rFeed(); }));
  $('fqMC').addEventListener('click', () => { ST.mcSeed = (ST.mcSeed || 1) + 1; TRUCK = null; rFeed(); });
  // the feed selector on the operations sheet
  const sel = $('opFeed'); if (sel) { sel.innerHTML = FPRE.map(([k, n]) => `<option value="${k}">${n}</option>`).join('') + '<option value="custom" disabled>Custom feed (sheet 10)</option>';
    sel.addEventListener('change', () => { const p = FPRE.find(z => z[0] === sel.value); if (p) setFeed(p[2], 'Feed selected: ' + p[1]); }); }
  // sustainability inputs
  [['grE', 'e'], ['grM', 'm'], ['grH', 'h'], ['grB', 'b']].forEach(([id, k]) => $(id).addEventListener('input', () => { ST.gr[k] = +$(id).value; rGreen(); }));
}
function bestPur() { let best = {p: 0, npv: -1e9}; for (let p = 0; p <= 100; p += 2) { const n = evaluate(ST.X, Object.assign(MKX(), {fq: Object.assign({}, ST.FQ, {pur: p})}), lims()).npv; if (n > best.npv + 1e-9) best = {p, npv: n}; } return best; }
// horizontal bars with a zero line (used for the polymer fingerprint)
function hbars(id, rows, unit, d) {
  const svg = $(id), W = 520, H = 300, ml = 70, mr = 70, mt = 10, rh = (H - mt - 34) / rows.length; const vals = rows.map(r => r[1]); const m = Math.max(1e-9, ...vals.map(Math.abs)) * 1.1;
  const X = v => ml + (v + m) / (2 * m) * (W - ml - mr); let g = `<line x1="${X(0)}" x2="${X(0)}" y1="${mt}" y2="${H - 30}" stroke="var(--muted)"/>`;
  ticks(-m, m).forEach(v => g += `<line class="gl" x1="${X(v)}" x2="${X(v)}" y1="${mt}" y2="${H - 30}" style="opacity:.5"/><text class="ax" x="${X(v)}" y="${H - 12}" text-anchor="middle">${fmt(v, Math.abs(m) >= 20 ? 0 : d)}</text>`);
  rows.forEach(([n, v, c, t], k) => { const y = mt + k * rh + rh * 0.2, h = rh * 0.6; g += `<text x="${ml - 8}" y="${y + h / 2 + 5}" text-anchor="end" style="font-size:14.5px;font-weight:600;fill:var(--ink)">${n}</text>`;
    g += `<rect class="tb" data-t="${t}" x="${Math.min(X(0), X(v))}" y="${y}" width="${Math.max(1, Math.abs(X(v) - X(0)))}" height="${h}" fill="${c}" rx="2"/>`;
    const lab = (v >= 0 ? '+' : '−') + fmt(Math.abs(v), d) + unit, inside = v >= 0 ? X(v) + 8 + lab.length * 7.5 > W : X(v) - 8 - lab.length * 7.5 < ml;
    g += `<text x="${inside ? (v >= 0 ? X(v) - 6 : X(v) + 6) : (v >= 0 ? X(v) + 6 : X(v) - 6)}" y="${y + h / 2 + 5}" text-anchor="${(v >= 0) !== inside ? 'start' : 'end'}" style="font-size:13.5px;font-weight:700;fill:${inside ? '#fff' : v >= 0 ? 'var(--ok)' : 'var(--bad)'};pointer-events:none">${lab}</text>`; });
  svg.innerHTML = g; bindTips(svg, '.tb');
}
let TRUCK = null, TRUCKKEY = '';
function rFeed() {
  const fm = curFM(), r = E.r, fq = ST.FQ, tot = shareTot(fq);
  PKEYS.forEach(k => { const o = $('o-fq-' + k); if (o) o.value = fmt(fq[k] / tot * 100, 1) + ' %'; });
  $('o-fqw').value = fmt(fq.w, 1) + ' %'; $('o-fqa').value = fmt(fq.a, 1) + ' %'; $('o-fqp').value = fmt(fq.pur, 0) + ' %';
  $('fqSum').textContent = 'shares of the plastic, scaled to 100 %';
  const pr = FPRE.find(([, , q]) => Object.keys(q).every(k => Math.abs((fq[k] || 0) - q[k]) < 1e-9)); $$('#fqPre button').forEach(b => b.classList.toggle('on', !!pr && b.dataset.k === pr[0]));
  $('fqTxt').textContent = pr ? pr[3] : 'Custom feed: ' + PKEYS.filter(k => fq[k] > 0).map(k => k + ' ' + fmt(fq[k] / tot * 100, 0) + ' %').join(', ') + (fq.w ? `, ${fmt(fq.w, 1)} % moisture` : '') + (fq.a ? `, ${fmt(fq.a, 1)} % inerts` : '') + '.';
  // KPIs
  const cl = fm.clppm, clS = cl < 1000 ? '' : cl < 5000 ? 'warn' : 'bad';
  const K = [['Methanol product', fmt(E.p.meoh_kgh * 7.92, 0) + ' t/y', dlt(E.r.MeOH, DES.r.MeOH), 'var(--navy)'], ['Hydrogen product', fmt(E.p.h2_kgh * 7.92, 0) + ' t/y', dlt(E.r.H2p, DES.r.H2p), 'var(--green)'],
    ['NPV at ' + fmt(E.p.i * 100, 1) + ' %', money(E.npv) + ' M', [(E.npv - DES.npv >= 0 ? '+' : '−') + fmt(Math.abs(E.npv - DES.npv), 2) + ' M vs design feed', E.npv >= DES.npv - 0.005 ? 'up' : 'dn'], 'var(--orange)'],
    ['Waste bought', fmt(E.p.mpw_kgh * 7.92, 0) + ' t/y', [fm.Y < 0.9999 ? fmt((1 - fm.Y) * 100, 1) + ' % removed before R-101' : 'all of it fed to R-101', ''], 'var(--sec-feed)'],
    ['Raw syngas H₂/CO', fmt(fm.h2co, 2), [Math.abs(fm.h2co - FMD.h2co) < 0.005 ? 'design value 2.07' : (fm.h2co > FMD.h2co ? '+' : '') + fmt((fm.h2co / FMD.h2co - 1) * 100, 1) + ' % vs design', ''], 'var(--sec-gas)'],
    ['Chlorine in the R-101 feed', fmt(cl, 0) + ' ppm', [clS === '' ? 'below the 1,000 ppm screening limit' : clS === 'warn' ? 'guard bed needed' : 'above 5,000 ppm', clS ? 'dn' : ''], clS === 'bad' ? 'var(--red)' : clS === 'warn' ? 'var(--gold)' : 'var(--grey)']];
  $('fqK').innerHTML = K.map(([l, v, [d, c], col]) => `<div class="kpi" style="--c:${col}"><div class="l">${l}</div><div class="v">${v}</div><div class="d ${c}">${d}</div></div>`).join('');
  // composition before and after cleaning
  { const P0 = Math.max(0, 1 - fq.w / 100 - fq.a / 100), recv = PKEYS.map(k => [k, P0 * fq[k] / tot * 100]).concat([['w', fq.w], ['a', fq.a]]);
    const st = shareTot(fm.sh), clean = PKEYS.map(k => [k, fm.fP * fm.sh[k] / st * 100]).concat([['w', fm.fW * 100], ['a', fm.fA * 100]]);
    const W = 520, ml = 10, mr = 10, X = v => ml + v / 100 * (W - ml - mr); let g = '';
    [0, 25, 50, 75, 100].forEach(v => g += `<line class="gl" x1="${X(v)}" x2="${X(v)}" y1="26" y2="212"/><text class="ax" x="${X(v)}" y="230" text-anchor="${v === 0 ? 'start' : v === 100 ? 'end' : 'middle'}">${v} %</text>`);
    [['Waste received', recv, ''], ['Feed to R-101, after the cleaning line', clean, fm.Y < 0.9999 ? ` · ${fmt(fm.Y * 100, 1)} % of the mass` : '']].forEach(([lab, seg, ex], j) => { const y = 34 + j * 96; let x0 = 0;
      g += `<text x="${ml}" y="${y - 8}" style="font-size:14px;font-weight:600;fill:var(--ink)">${lab}<tspan style="font-weight:400;fill:var(--graphite)">${ex}</tspan></text>`;
      seg.forEach(([k, v]) => { if (v <= 0.001) return; g += `<rect class="tb" data-t="<b>${PNAME[k]}</b>: ${fmt(v, 2)} wt%" x="${X(x0)}" y="${y}" width="${Math.max(0.6, X(x0 + v) - X(x0))}" height="50" fill="${PCOL[k]}" stroke="var(--panel)" stroke-width="1"/>`;
        if (v > 6) g += `<text x="${X(x0 + v / 2)}" y="${y + 30}" text-anchor="middle" style="font-size:13px;font-weight:700;fill:#fff;pointer-events:none">${PNAME[k] === 'Moisture' ? 'H₂O' : PNAME[k] === 'Inerts' ? 'Ash' : PNAME[k]}</text>`; x0 += v; }); });
    $('fqBar').innerHTML = g; bindTips($('fqBar'), '.tb');
    $('fqLg').innerHTML = PKEYS.concat(['w', 'a']).map(k => `<span><i class="sw" style="background:${PCOL[k]}"></i>${PNAME[k]}</span>`).join('');
    const rows = [['Carbon, C', MPW0.C * 100, fm.el.C * 100, fm.nC * r.feed, 2556.14 * r.feed], ['Hydrogen, H', MPW0.H * 100, fm.el.H * 100, fm.nH * r.feed, 5142.78 * r.feed], ['Oxygen, O', MPW0.O * 100, fm.el.O * 100, fm.nO * r.feed, 124.60 * r.feed], ['Chlorine, Cl', 0, fm.el.Cl * 100, fm.nCl * r.feed, 0]];
    $('fqEl').innerHTML = '<thead><tr><th>Element of the plastic</th><th>Table 2.3 (wt%)</th><th>Selected (wt%)</th><th>To R-101 (kmol/h of atoms)</th></tr></thead><tbody>' + rows.map(([n, a, b, c, d]) => `<tr><td>${n}</td><td>${fmt(a, 2)}</td><td><b>${fmt(b, 2)}</b></td><td>${fmt(c, 1)}${d > 0.01 && Math.abs(c - d) > 0.05 ? ` <small class="${c > d ? 'okc' : 'badc'}">(${c > d ? '+' : '−'}${fmt(Math.abs(c / Math.max(d, 1e-9) - 1) * 100, 1)} %)</small>` : ''}</td></tr>`).join('') +
      `<tr><td>Steam to carbon, S/C (mol/mol)</td><td>${fmt(FMD.SC, 3)}</td><td colspan="2"><b>${fmt(fm.SC, 3)}</b></td></tr><tr><td>Heating value of the feed (HHV, MJ/kg)</td><td>${fmt(FMD.hhv, 2)}</td><td colspan="2"><b>${fmt(fm.hhv, 2)}</b></td></tr></tbody>`; }
  // raw syngas
  { const G0 = FMD.S10, G = fm.S10, ks = [['H2', 'H₂'], ['CO', 'CO'], ['CO2', 'CO₂'], ['H2O', 'H₂O'], ['char', 'Char']];
    const v0 = k => k === 'char' ? FMD.char : G0[k], v1 = k => k === 'char' ? fm.char : G[k]; const ym = Math.ceil(Math.max(...ks.map(([k]) => Math.max(v0(k), v1(k)))) / 1000) * 1000 + 500;
    plot('fqGas', {x: [-0.6, 4.6], y: [0, ym], xt: [0, 1, 2, 3, 4], xf: v => (ks[Math.round(v)] || [, ''])[1], yl: 'kmol/h',
      bars: ks.flatMap(([k, n], i) => [{x: i - 0.19, y: v0(k), w: 34, c: 'var(--c-lb)', t: `<b>${n}</b>, design MPW: ${fmt(v0(k), 1)} kmol/h`}, {x: i + 0.19, y: v1(k), w: 34, c: 'var(--c-or)', t: `<b>${n}</b>, selected feed: ${fmt(v1(k), 1)} kmol/h (${v0(k) > 0 ? (v1(k) >= v0(k) ? '+' : '−') + fmt(Math.abs(v1(k) / v0(k) - 1) * 100, 1) + ' %' : ''})`}])});
    bindTips($('fqGas'), '.hb');
    const v = $('fqGasV'); v.className = 'verdict' + (fm.h2co >= 1.9 ? ' ok' : ' bad');
    v.innerHTML = `H₂/CO = <b>${fmt(fm.h2co, 2)}</b> (design 2.07); combustibles make the gas flammable from <b>${fmt(fm.LFL, 2)} %</b> to <b>${fmt(fm.UFL, 1)} %</b> in air (Le Chatelier, Eq. 7.2; design 5.14–74.67 %).${fm.hcl > 0.01 ? ` HCl: <b>${fmt(fm.hclppm, 0)} ppm</b> in the raw gas.` : ''}`; }
  // alarms
  { const q = (s, t, v, d) => `<div class="al ${s}"><b>${t}</b><span class="av">${v}</span><p>${d}</p></div>`; const A = [];
    A.push(q(clS || 'ok', 'Chlorine → HCl', fmt(cl, 0) + ' ppm', cl < 1 ? 'No chlorine: the Cu/ZnO catalysts of R-102 and R-103 and the Pd–Ag membrane are safe.' : `PVC releases ${fmt(fm.hcl * r.feed * 36.46, 0)} kg/h of HCl. It poisons the copper catalysts and the membrane and corrodes the coolers: a lime guard bed after CY-101 is needed (sorbent ≈ $${fmt(fm.hcl * r.feed * 36.46 * 0.30, 0)}/h). Raise the cleaning intensity to sort out the PVC.`));
    const wS = fm.fW < 0.05 ? 'ok' : fm.fW < 0.12 ? 'warn' : 'bad'; A.push(q(wS, 'Moisture → furnace duty', fmt(fm.fW * 100, 1) + ' wt%', fm.fW < 1e-6 ? 'Dry feed: the R-101 furnaces run at their design duty of 145.67 MW.' : `Evaporating the water takes ${fmt(fm.qExtra * r.feed, 1)} MW more from the R-101 furnaces (${fmt(r.Q101 * 100, 1)} % of the design duty, limit 110 %). The extra steam also shifts CO to H₂.`));
    const aS = fm.fA < 0.02 ? 'ok' : fm.fA < 0.08 ? 'warn' : 'bad'; A.push(q(aS, 'Inerts → bed and ash', fmt(fm.fA * 100, 1) + ' wt%', fm.fA < 1e-6 ? 'No ash: only the olivine attrition fines leave the beds (Table 7.23).' : `${fmt(MPW_KGH * fm.fA * r.feed * 7.92, 0)} t/y of ash pass through the beds: risk of agglomeration of the olivine and of erosion in CY-101; the ash goes to an approved landfill.`));
    A.push(q(E.ok ? (E.worst > 0.98 ? 'warn' : 'ok') : 'bad', 'Equipment limits', fmt(E.worst * 100, 1) + ' %', E.ok ? `The busiest unit is ${UNITNAME[E.limiting] || E.limiting}, inside its allowed limit.` : `${UNITNAME[E.limiting] || E.limiting} is beyond its allowed limit: run “AI: best set point for this feed” or lower the feed rate on sheet 03.`));
    const hS = fm.h2co >= 1.9 ? 'ok' : fm.h2co >= 1.5 ? 'warn' : 'bad'; A.push(q(hS, 'Gas quality for methanol', 'H₂/CO ' + fmt(fm.h2co, 2), hS === 'ok' ? 'Enough hydrogen in the bypass gas (Stream 11) for the methanol loop.' : 'Oxygen-rich plastic (PET) gives a CO₂-rich, hydrogen-poor gas: less methanol and more purge.'));
    A.push(q('ok', 'Flammability of Stream 10', fmt(fm.LFL, 2) + '–' + fmt(fm.UFL, 1) + ' %', 'Flammable as soon as a few per cent of air leak in: air ingress at the MPW feeder stays the main hazard (Table 7.5).'));
    $('fqAlarm').innerHTML = A.join(''); }
  // fingerprint of each polymer
  { const key = ST.fpk || 'npv', base = E, rows = PKEYS.map(k => { const s = {}; PKEYS.forEach(j => s[j] = fq[j] / tot * 90 + (j === k ? 10 : 0)); const e = evaluate(ST.X, Object.assign(MKX(), {fq: Object.assign({}, fq, s)}), lims());
      const v = key === 'npv' ? e.npv - base.npv : key === 'meoh' ? (e.p.meoh_kgh - base.p.meoh_kgh) * 7.92 : (e.p.h2_kgh - base.p.h2_kgh) * 7.92;
      return [k, v, PCOL[k], `<b>+10 points of ${k}</b><br>NPV ${(e.npv - base.npv >= 0 ? '+' : '−') + fmt(Math.abs(e.npv - base.npv), 1)} M$<br>Methanol ${fmt((e.p.meoh_kgh - base.p.meoh_kgh) * 7.92, 0)} t/y<br>Hydrogen ${fmt((e.p.h2_kgh - base.p.h2_kgh) * 7.92, 0)} t/y`]; });
    hbars('fqFp', rows, key === 'npv' ? ' M$' : ' t/y', key === 'npv' ? 1 : 0); $$('#fqFpK button').forEach(b => b.classList.toggle('on', b.dataset.k === key)); }
  // value of the cleaning line
  { const pts = []; for (let p = 0; p <= 100; p += 5) pts.push([p, evaluate(ST.X, Object.assign(MKX(), {fq: Object.assign({}, fq, {pur: p})}), lims()).npv]);
    const best = bestPur(); const ys = pts.map(p => p[1]).concat([best.npv]); const lo = Math.min(...ys), hi = Math.max(...ys), pad = Math.max(5, (hi - lo) * 0.15);
    plot('fqPur', {x: [0, 100], y: [Math.floor((lo - pad) / 10) * 10, Math.ceil((hi + pad) / 10) * 10], xt: 20, xl: 'Cleaning intensity of the pre-treatment line (%)', series: [{d: pts, c: cssv('--navy'), w: 2.8}],
      pts: [{x: best.p, y: best.npv, c: 'var(--c-gr)', r: 7}, {x: fq.pur, y: E.npv, c: 'var(--c-or)', r: 6}], tip: x => `<b>${fmt(x, 0)} %</b><br>NPV ${money(interp(pts, x))} M`});
    const n0 = pts[0][1], v = $('fqPurV'); const contam = (fq.PVC > 0) || fq.w > 0 || fq.a > 0;
    if (!contam) { v.className = 'verdict'; v.textContent = 'This feed has no PVC, moisture or inerts: the cleaning line only costs money and loses some plastic, so it is best left off.'; }
    else if (best.p === 0) { v.className = 'verdict bad'; v.textContent = 'At this feed price the cleaning line does not pay for itself; the gasifier copes with the dirt at the cost shown in the alarms.'; }
    else { v.className = 'verdict ok'; v.innerHTML = `Cleaning at <b>${best.p} %</b> adds <b>${money(best.npv - n0)} M</b> to the NPV against no cleaning${Math.abs(fq.pur - best.p) > 1 ? `; the selected ${fmt(fq.pur, 0)} % is ${money(Math.abs(best.npv - E.npv))} M ${E.npv < best.npv ? 'below' : 'above'} it` : ''}.`; } }
  // a day of truck deliveries
  { const key = JSON.stringify([fq, ST.X, ST.mcSeed || 1, ST.MK, ST.HI]); if (!TRUCK || TRUCKKEY !== key) { TRUCKKEY = key; TRUCK = truckDay(ST.mcSeed || 1); }
    const T = TRUCK, dm = DES.r.MeOH * 32.042 / 1000, dh = DES.r.H2p * 2.016 / 1000;
    const sM = T.map((t, i) => [i / 12, t.m]), sH = T.map((t, i) => [i / 12, t.h]); const all = sM.concat(sH).map(p => p[1]); const lo = Math.min(95, ...all) - 2, hi = Math.max(105, ...all) + 2;
    plot('fqMCc', {x: [0, 24], y: [Math.floor(lo), Math.ceil(hi)], xt: 4, xl: 'Hour of the day', yl: '% of the design output', hl: [{y: 100, c: 'var(--muted)', w: 1.2, dash: '4 4'}],
      series: [{d: sH, c: 'var(--c-gr)', w: 1.6}, {d: sM, c: cssv('--navy'), w: 1.6}], pts: T.map((t, i) => t.bad ? {x: i / 12, y: t.m, c: 'var(--c-rd)', r: 3.5} : null).filter(Boolean),
      tip: x => { const i = Math.max(0, Math.min(T.length - 1, Math.round(x * 12))), t = T[i]; return `<b>Load ${i + 1}</b>, ${String(Math.floor(i / 12)).padStart(2, '0')}:${String(i % 12 * 5).padStart(2, '0')}<br>Methanol ${fmt(t.m, 1)} % · H₂ ${fmt(t.h, 1)} %<br>PVC ${fmt(t.pvc, 1)} % · moisture ${fmt(t.w, 1)} %${t.bad ? `<br><b style="color:var(--bad)">${UNITNAME[t.lim] || t.lim} over its limit</b>` : ''}`; }});
    const nb = T.filter(t => t.bad).length, mM = T.reduce((a, t) => a + t.m, 0) / T.length, mH = T.reduce((a, t) => a + t.h, 0) / T.length, sd = Math.sqrt(T.reduce((a, t) => a + (t.m - mM) ** 2, 0) / T.length);
    $('fqMCk').innerHTML = [['Methanol, mean of the day', fmt(mM * dm * 24 / 100, 0) + ' t/d', `±${fmt(sd, 1)} % from load to load`, 'var(--navy)'], ['Hydrogen, mean of the day', fmt(mH * dh * 24 / 100, 1) + ' t/d', 'fuel-cell grade, 99.99 %', 'var(--green)'],
      ['Loads over a limit', nb + ' of ' + T.length, nb ? 'the AI safe mode keeps a margin for them' : 'the plant absorbs every load', nb ? 'var(--red)' : 'var(--grey)'], ['Worst load', fmt(Math.max(...T.map(t => t.worst)) * 100, 1) + ' %', 'of the allowed limit of its unit', 'var(--orange)']]
      .map(([l, v, d, c]) => `<div class="kpi" style="--c:${c}"><div class="l">${l}</div><div class="v" style="font-size:22px">${v}</div><div class="d">${d}</div></div>`).join(''); }
}
function truckDay(seed) {
  let s = (seed * 7919 + 17) % 2147483647; const rnd = () => (s = s * 16807 % 2147483647) / 2147483647, gauss = () => { let u = 0; for (let k = 0; k < 6; k++) u += rnd(); return (u - 3) / Math.sqrt(0.5); };
  const fq = ST.FQ, out = [], mk = MKX(), L = lims(), dM = DES.r.MeOH, dH = DES.r.H2p;
  for (let i = 0; i < 288; i++) { const q = Object.assign({}, fq); PKEYS.forEach(k => q[k] = Math.max(0, fq[k] * (1 + 0.25 * Math.max(-1.5, Math.min(1.5, gauss() / 2))))); if (fq.PVC === 0 && rnd() < 0.08) q.PVC = 0.5 + 1.5 * rnd();
    q.w = Math.max(0, Math.min(30, (fq.w || 0) * (1 + 0.4 * gauss() / 2) + (rnd() < 0.05 ? 3 : 0))); q.a = Math.max(0, Math.min(25, (fq.a || 0) * (1 + 0.4 * gauss() / 2)));
    const e = evaluate(ST.X, Object.assign({}, mk, {fq: q}), L); const t = shareTot(q);
    out.push({m: e.r.MeOH / dM * 100, h: e.r.H2p / dH * 100, bad: !e.ok, worst: e.worst, lim: e.limiting, pvc: q.PVC / t * 100 * (1 - q.w / 100 - q.a / 100), w: q.w}); }
  return out;
}
// ===================================================================== SUSTAINABILITY
function greenNumbers(Ein) {
  const e = Ein || E, r = e.r, fm = r.fm || FMD, f = r.feed, gr = ST.gr, Y = 7920 / 1000;
  const Cin = fm.nC * f, Cm = r.MeOH, Cch = r.char, Cpg = r.purgeCO + r.purgeCO2 + r.purgeCH4, Co = Math.max(0, Cin - Cm - Cch - Cpg);
  const cred = rr => (rr.char * 393.5 + rr.purgeCO * 283.0 + rr.purgeH2 * 241.8 + rr.purgeCH4 * 802.3) / 3600, cr0 = cred(DES.r);
  const Qneed = 145.67 * r.Q101 + (fm.qDry || 0) * f, Qcred = 38.5 * cred(r) / cr0, NG = Math.max(0, Qneed - Qcred) / 107.17 * 7716;   // kg/h of natural gas (Section 7.5.1)
  const co2Proc = (Cch + Cpg + Co) * 44.01, co2NG = NG / 16.04 * 44.01, co2El = e.p.W_total * gr.e;   // kg/h
  const meoh = e.p.meoh_kgh * Y, h2 = e.p.h2_kgh * Y, waste = e.p.mpw_kgh * Y;
  const burnAll = Cin * 44.01 * Y, base = {burn: burnAll * gr.b / 100, meoh: meoh * gr.m, h2: h2 * gr.h};
  const plantT = {proc: co2Proc * Y, ng: co2NG * Y, el: co2El * Y}; const B = base.burn + base.meoh + base.h2, P = plantT.proc + plantT.ng + plantT.el;
  const NG0 = Qneed / 145.67 * 10488, saved = Math.max(0, NG0 - NG);   // gas the furnaces would burn without the purge and char
  const water = (67267 + 28587 * 7.92) * f;   // t/y of process water recycled to E-101 (Section 7.5.2)
  return {Cin, Cm, Cch, Cpg, Co, NG, saved, base, plantT, B, P, net: B - P, netInc: burnAll + base.meoh + base.h2 - P, netLand: base.meoh + base.h2 - P, meoh, h2, waste, water, fm, cpct: Cm / Cin * 100};
}
function rGreen() {
  const gr = ST.gr; $('o-grE').value = fmt(gr.e, 3); $('o-grM').value = fmt(gr.m, 2); $('o-grH').value = fmt(gr.h, 2); $('o-grB').value = fmt(gr.b, 0) + ' % burned';
  const G = greenNumbers(), kt = v => fmt(v / 1000, 0) + ' kt/y';
  const K = [['Plastic kept out of landfill', fmt(G.waste, 0) + ' t/y', 'every tonne the plant buys', 'var(--sec-feed)'], ['Carbon kept in products', fmt(G.cpct, 1) + ' %', 'of the carbon in the plastic, as methanol', 'var(--navy)'],
    ['Net CO₂ saving', (G.net >= 0 ? '' : '−') + kt(Math.abs(G.net)), 'against the routes replaced (factors at the right)', G.net >= 0 ? 'var(--green)' : 'var(--red)'], ['If the waste were burned', kt(G.netInc), 'net saving against incineration', 'var(--orange)'],
    ['Clean hydrogen', fmt(G.h2, 0) + ' t/y', '≈ ' + fmt(G.h2 * 1000 / 150, 0) + ' fuel-cell cars (15,000 km/y at 1 kg/100 km)', 'var(--green)'], ['Water recycled, zero discharge', fmt(G.water, 0) + ' t/y', 'T-101 bottoms and C-101 condensate to E-101', 'var(--s-water)']];
  $('grK').innerHTML = K.map(([l, v, d, c]) => `<div class="kpi" style="--c:${c}"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('');
  const ch = $('grChip'); ch.className = 'chip' + (G.net >= 0 ? '' : ' warn'); ch.innerHTML = `<i></i>Net CO₂ ${G.net >= 0 ? 'saving' : 'increase'}: ${kt(Math.abs(G.net))} · feed: ${fqName()}`;
  // Sankey of the carbon
  { const svg = $('grSk'), W = 1000, H = 340, x0 = 40, x1 = 64, x2 = 520, x3 = 544, x4 = 790, x5 = 812, top = 20, hh = 280, k = hh / G.Cin;
    const outs = [['Methanol product (Stream 29)', G.Cm, cssv('--navy')], ['Purge gas (Stream 25)', G.Cpg, 'var(--c-or)'], ['Char (Stream 9)', G.Cch, 'var(--c-gy)'], ['Other (CH₄, losses)', G.Co, 'var(--c-lb)']];
    let g = `<rect x="${x0}" y="${top}" width="${x1 - x0}" height="${hh}" fill="var(--sec-feed)"/><text x="${x0}" y="${top - 6}" style="font-size:14px;font-weight:700;fill:var(--ink)">Carbon in the plastic: ${fmt(G.Cin, 0)} kmol/h</text>`;
    let yL = top, yR = top, gap = 14, yT = -1e9; const yF = []; outs.forEach(([n, v, c], i) => { const h = Math.max(1.5, v * k), a = yL, b = yR; const path = (xa, ya, xb, yb, hgt) => `M${xa},${ya} C${(xa + xb) / 2},${ya} ${(xa + xb) / 2},${yb} ${xb},${yb} L${xb},${yb + hgt} C${(xa + xb) / 2},${yb + hgt} ${(xa + xb) / 2},${ya + hgt} ${xa},${ya + hgt} Z`;
      g += `<path class="tb" data-t="<b>${n}</b><br>${fmt(v, 1)} kmol/h of C, ${fmt(v / G.Cin * 100, 2)} %" d="${path(x1, a, x2, b, h)}" fill="${c}" opacity=".55"/><rect x="${x2}" y="${b}" width="${x3 - x2}" height="${h}" fill="${c}"/>`;
      const ty = Math.max(b + Math.min(h / 2, 40) + 5, yT + 38); yT = ty;
      g += `<text x="${x3 + 8}" y="${ty}" style="font-size:13.5px;font-weight:600;fill:var(--ink)">${n}<tspan x="${x3 + 8}" dy="17" style="font-weight:400;fill:var(--graphite)">${fmt(v, 0)} kmol/h · ${fmt(v / G.Cin * 100, 1)} %</tspan></text>`;
      if (i === 1 || i === 2) yF.push([b, h, c, v]); yL += h; yR += h + gap; });
    // purge and char burn in the furnaces, replacing natural gas
    const fh = yF.reduce((a, q) => a + q[1], 0), fy = top + hh - fh - 10; let yy = fy;
    yF.forEach(([b, h, c]) => { g += `<path d="M${x3},${b} C${x3 + 140},${b} ${x4 - 120},${yy} ${x4},${yy} L${x4},${yy + h} C${x4 - 120},${yy + h} ${x3 + 140},${b + h} ${x3},${b + h} Z" fill="${c}" opacity=".18"/>`; yy += h; });
    const my = fy + fh / 2; g += `<rect x="${x4}" y="${fy}" width="${x5 - x4}" height="${fh}" fill="var(--hot)"/><text x="${x5 + 10}" y="${my - 14}" style="font-size:13.5px;font-weight:700;fill:var(--ink)">R-101 furnaces<tspan x="${x5 + 10}" dy="17" style="font-weight:400;fill:var(--ink2)">CO₂ stack, ready for capture</tspan><tspan x="${x5 + 10}" dy="17" style="font-weight:400;fill:var(--graphite)">replaces ${fmt(G.saved, 0)} kg/h of gas</tspan></text>`;
    svg.innerHTML = g; bindTips(svg, '.tb'); }
  // CO2 ledger
  { const svg = $('grL'), W = 520, H = 320, ml = 56, mr = 14, mt = 14, mb = 44; const ymax = Math.ceil(Math.max(G.B, G.P) / 1000 / 200) * 200 + 100; const Y = v => mt + (ymax - v / 1000) / ymax * (H - mt - mb); let g = '';
    ticks(0, ymax).forEach(v => g += `<line class="gl" x1="${ml}" x2="${W - mr}" y1="${Y(v * 1000)}" y2="${Y(v * 1000)}"/><text class="ax" x="${ml - 7}" y="${Y(v * 1000) + 4}" text-anchor="end">${fmt(v, 0)}</text>`);
    const cols = [['Routes replaced', [['Waste burned', G.base.burn, 'var(--c-rs)'], ['Grey methanol', G.base.meoh, 'var(--c-go)'], ['Grey hydrogen', G.base.h2, 'var(--c-gy)']]],
      ['This plant', [['Furnace stack: purge, char, other C', G.plantT.proc, 'var(--c-or)'], ['Natural gas for R-101', G.plantT.ng, 'var(--c-pu)'], ['Grid electricity', G.plantT.el, 'var(--c-bl)']]]];
    cols.forEach(([lab, seg], j) => { const bw = 130, bx = ml + 40 + j * 210; let y0 = 0; seg.forEach(([n, v, c]) => { if (v <= 0) return; g += `<rect class="tb" data-t="<b>${n}</b>: ${fmt(v / 1000, 1)} kt CO₂/y" x="${bx}" y="${Y(y0 + v)}" width="${bw}" height="${Y(y0) - Y(y0 + v)}" fill="${c}"/>`; y0 += v; });
      g += `<text x="${bx + bw / 2}" y="${Y(y0) - 8}" text-anchor="middle" style="font-size:15px;font-weight:700;fill:var(--ink)">${fmt(y0 / 1000, 0)}</text><text class="ax" x="${bx + bw / 2}" y="${H - 22}" text-anchor="middle" style="font-size:13.5px">${lab}</text>`; });
    svg.innerHTML = g; bindTips(svg, '.tb');
    $('grLg').innerHTML = cols.flatMap(c => c[1]).map(([n, , c]) => `<span><i class="sw" style="background:${c}"></i>${n}</span>`).join('');
    const v = $('grV'); v.className = 'verdict ' + (G.net >= 0 ? 'ok' : 'bad'); v.innerHTML = G.net >= 0 ? `The plant saves <b>${kt(G.net)}</b> of CO₂ (${fmt(G.net / G.B * 100, 0)} % of the routes it replaces). Capturing the furnace stack or the solar e-methanol of sheet 09 would raise the saving further.`
      : `With these factors the plant emits <b>${kt(-G.net)}</b> more than the routes it replaces: solar electricity (grid factor 0) and the e-methanol of sheet 09 close the gap.`; }
  // Vision 2030 and the 4R framework
  { const T = (tag, h, v, p, go) => `<div class="vt"${go ? ` data-go="${go}" role="link" tabindex="0"` : ''}><span class="tag">${tag}</span><h4>${h}</h4><b>${v}</b><p>${p}</p></div>`;
    $('grV30').innerHTML = [T('Saudi Green Initiative', 'Net zero by 2060', (G.net >= 0 ? '−' : '+') + kt(Math.abs(G.net)) + ' CO₂', (G.net >= 0 ? 'Avoided against the routes replaced, with the factors selected above' : 'Above the routes replaced with grid power; solar electricity or the e-methanol extension turn it into a saving') + '; the single furnace stack is reserved for carbon capture (Chapter 9).'),
      T('National waste strategy (MWAN)', 'Waste diverted from landfill', fmt(G.waste, 0) + ' t/y', 'The national framework aims to divert about 82 % of all waste from landfill by 2035; char and purge become fuel, so no carbon is landfilled.'),
      T('Circular carbon economy', 'Plastic back into chemicals', fmt(G.cpct, 1) + ' % C', 'of the carbon in the plastic leaves as methanol, raised to 94 % with the solar e-methanol extension.', 'emethanol'),
      T('Energy transition', 'Clean hydrogen for industry', fmt(G.h2, 0) + ' t/y', 'at 99.99 % and 30 bar from the Pd–Ag membrane: fuel-cell grade hydrogen for the Jubail pipeline network.'),
      T('Industrial localisation', 'Feedstock for Jubail', fmt(G.meoh, 0) + ' t/y', 'of 99.5 mol% methanol for local formaldehyde, MTBE and acetic acid producers in Jubail Industrial City.'),
      T('Water security', 'Zero liquid discharge', fmt(G.water, 0) + ' t/y', 'of process water returned to the gasifiers instead of fresh desalinated water (Section 7.5.2).')].join('');
    const hiTxt = ST.HI ? 'Heat integration cuts the hot utility by 81.7 % (Chapter 4).' : 'Heat integration is OFF: switch it on in sheet 04 to cut the hot utility by 81.7 %.';
    $('grR4').innerHTML = [T('Reduce', 'Less energy per tonne', ST.HI ? '−81.7 % hot utility' : 'OFF', hiTxt, 'heat'), T('Reuse', 'Waste streams as fuel and water', fmt(G.saved, 0) + ' kg/h gas saved', 'Purge gas and char replace natural gas in the R-101 furnaces; the water is recycled with zero discharge.'),
      T('Recycle', 'Chemical recycling of plastic', fmt(G.cpct, 1) + ' % C to methanol', 'Mixed plastic that mechanical recycling cannot take becomes methanol and hydrogen.', 'feed'), T('Remove', 'Carbon capture ready', fmt(G.plantT.proc / 1000, 0) + ' kt/y CO₂', 'One concentrated furnace stack, reserved for CCU, and the purge carbon turned into e-methanol on sheet 09.', 'emethanol')].join(''); }
}
// ===================================================================== share the current case as a link
function shareState() { const o = {p: PAGE, X: ST.X, M: ST.MODE, K: ST.MK, S: ST.SCID, H: ST.HI, d: ST.dT, c: ST.cpm, F: ST.FQ, G: ST.gr, C: ST.EC, e: ST.em};
  try { return location.origin + location.pathname + '?s=' + btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '#/' + PAGE; } catch (e) { return location.href; } }
function readShared() { const m = /[?&]s=([^&#]+)/.exec(location.search); if (!m) return null;
  try { const o = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))))); const D = clone(DEF);
    ST = Object.assign(D, {X: o.X || D.X, MODE: o.M || D.MODE, MK: o.K || {}, SCID: o.S || 'base', HI: o.H !== undefined ? o.H : true, dT: o.d || D.dT, cpm: o.c || D.cpm, FQ: Object.assign({}, FQ_DES, o.F || {}), gr: Object.assign(D.gr, o.G || {}),
      EC: Object.assign(D.EC, o.C || {}, {eq: Object.assign(D.EC.eq, (o.C || {}).eq || {})}), em: Object.assign(D.em, o.e || {})}); return o.p || null; } catch (e) { return null; } }
