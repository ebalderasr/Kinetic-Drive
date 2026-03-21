'use strict';

const MW_GLC = 180.16;
const MW_LAC = 90.08;

let currentLang = 'es';
let growthScale = 'linear';
let activeStart = 0;
let activeEnd = 1;
let syncLock = false;

const rawData = [
  { day: 0, xv: 0.232, viability: 98.30508, glc_gL: 6.94000, lac_gL: 0.00000, product_mgL: 0.0 },
  { day: 1, xv: 0.352, viability: 98.32402, glc_gL: 6.69667, lac_gL: 0.38133, product_mgL: 0.6 },
  { day: 2, xv: 1.158, viability: 99.48454, glc_gL: 5.43000, lac_gL: 0.92500, product_mgL: 1.5 },
  { day: 3, xv: 2.590, viability: 98.47909, glc_gL: 4.58667, lac_gL: 1.53333, product_mgL: 3.6 },
  { day: 4, xv: 4.540, viability: 97.00855, glc_gL: 3.03333, lac_gL: 1.34000, product_mgL: 7.2 },
  { day: 5, xv: 6.500, viability: 95.00000, glc_gL: 1.80000, lac_gL: 1.10000, product_mgL: 9.0 }
].map(d => ({
  ...d,
  glc_mM: (d.glc_gL * 1000) / MW_GLC,
  lac_mM: (d.lac_gL * 1000) / MW_LAC
}));

const pairIntervals = rawData.slice(0, -1).map((d, i) => ({ start: i, end: i + 1 }));
const el = (id) => document.getElementById(id);

const defaultTexts = {};
document.querySelectorAll('[id]').forEach((node) => {
  if (!(node.id in defaultTexts)) defaultTexts[node.id] = node.innerHTML;
});

const t = (key) => translations[currentLang]?.[key] ?? defaultTexts[key] ?? key;

function fmt(v, d = 3) {
  if (v === null || v === undefined || Number.isNaN(v) || !isFinite(v)) return t('noData');
  return Number(v).toFixed(d);
}

function calcInterval(startIdx, endIdx) {
  const a = rawData[startIdx];
  const b = rawData[endIdx];
  const dtD = b.day - a.day;
  const dtH = dtD * 24;
  let ivcd = 0;
  for (let i = startIdx; i < endIdx; i++) {
    ivcd += ((rawData[i].xv + rawData[i + 1].xv) / 2) * (rawData[i + 1].day - rawData[i].day);
  }
  const dGlc = a.glc_mM - b.glc_mM;
  const dLac = b.lac_mM - a.lac_mM;
  const dP = b.product_mgL - a.product_mgL;
  return {
    label: `${t('dayLabel')} ${a.day}–${b.day}`,
    startIdx,
    endIdx,
    t1: a.day,
    t2: b.day,
    dtD,
    dtH,
    x1: a.xv,
    x2: b.xv,
    glc1: a.glc_mM,
    glc2: b.glc_mM,
    lac1: a.lac_mM,
    lac2: b.lac_mM,
    p1: a.product_mgL,
    p2: b.product_mgL,
    ivcd,
    mu: (Math.log(b.xv) - Math.log(a.xv)) / dtH,
    rGlc: dGlc / dtD,
    qGlc: dGlc / ivcd,
    rLac: dLac / dtD,
    qLac: dLac / ivcd,
    qP: dP / ivcd,
    yxGlc: dGlc !== 0 ? (b.xv - a.xv) / dGlc : null,
    ypGlc: dGlc !== 0 ? dP / dGlc : null
  };
}

function allIntervalRows() {
  const rows = [];
  for (let i = 0; i < rawData.length - 1; i++) rows.push(calcInterval(i, i + 1));
  return rows;
}

function activeInterval() {
  return calcInterval(activeStart, activeEnd);
}

function populateControls() {
  if (!el('pairSelect') || !el('startSelect') || !el('endSelect')) return;
  el('pairSelect').innerHTML = pairIntervals.map((r, idx) => `<option value="${idx}">${t('pairPrefix')} ${rawData[r.start].day}–${rawData[r.end].day}</option>`).join('');
  const opts = rawData.map((d, idx) => `<option value="${idx}">${t('dayLabel')} ${d.day}</option>`).join('');
  el('startSelect').innerHTML = opts;
  el('endSelect').innerHTML = opts;
  el('startSelect').value = String(activeStart);
  el('endSelect').value = String(activeEnd);
  const pairIdx = pairIntervals.findIndex(p => p.start === activeStart && p.end === activeEnd);
  if (pairIdx >= 0) el('pairSelect').value = String(pairIdx);
}

function setSelectionModeText() {
  if (!el('selectionModeText')) return;
  el('selectionModeText').innerHTML = activeEnd === activeStart + 1 ? t('selectionConsecutive') : t('selectionCustom');
}

function renderDerivedText() {
  const r = activeInterval();
  const ivcdUnits = currentLang === 'es' ? '×10⁶ cél·d/mL' : '×10⁶ cells·d/mL';
  if (el('selectedRangeOut')) el('selectedRangeOut').textContent = r.label;
  el('deltaTimeOut').textContent = `${fmt(r.dtD, 2)} d`;
  el('muOut').innerHTML = `${fmt(r.mu, 4)} h⁻¹<br><span style="font-size:0.82em;opacity:0.6;">${fmt(r.mu * 24, 3)} d⁻¹</span>`;
  el('ivcdOutCompact').textContent = `${fmt(r.ivcd, 3)} ${ivcdUnits}`;
  el('qGlcOut').textContent = `${fmt(r.qGlc, 3)} pmol/cel/d`;
  el('qLacOut').textContent = `${fmt(r.qLac, 3)} pmol/cel/d`;
  el('qPOut').textContent = `${fmt(r.qP, 3)} pg/cel/d`;
  if (el('dGlcOut')) el('dGlcOut').textContent = `${fmt(r.glc1 - r.glc2, 3)} mM`;
  if (el('dLacOut')) el('dLacOut').textContent = `${fmt(r.lac2 - r.lac1, 3)} mM`;
  if (el('dProdOut')) el('dProdOut').textContent = `${fmt(r.p2 - r.p1, 3)} mg/L`;
  el('muExplain').innerHTML =
    `μ = [ln(${fmt(r.x2, 3)}) − ln(${fmt(r.x1, 3)})] / ${fmt(r.dtH, 0)} h = <strong>${fmt(r.mu, 4)} h⁻¹</strong><br>` +
    `μ = [ln(${fmt(r.x2, 3)}) − ln(${fmt(r.x1, 3)})] / ${fmt(r.dtD, 2)} d = <strong>${fmt(r.mu * 24, 3)} d⁻¹</strong>`;
  el('ivcdExplain').innerHTML = `IVCDΔ = ${currentLang === 'es' ? 'suma trapezoidal' : 'trapezoidal sum'} ${currentLang === 'es' ? 'entre' : 'between'} ${t('dayLabel').toLowerCase()} ${fmt(r.t1, 0)} ${currentLang === 'es' ? 'y' : 'and'} ${t('dayLabel').toLowerCase()} ${fmt(r.t2, 0)} = <strong>${fmt(r.ivcd, 3)}</strong> ×10⁶ ${currentLang === 'es' ? 'cél·día/mL' : 'cells·day/mL'}`;
  el('qGlcExplain').innerHTML = `rGlc = (${fmt(r.glc1, 3)} − ${fmt(r.glc2, 3)}) / ${fmt(r.dtD, 2)} = <strong>${fmt(r.rGlc, 3)} mM/day</strong><br>qGlc = (${fmt(r.glc1, 3)} − ${fmt(r.glc2, 3)}) / ${fmt(r.ivcd, 3)} = <strong>${fmt(r.qGlc, 3)} pmol/cell/day</strong>`;
  el('qPExplain').innerHTML = `qP = (${fmt(r.p2, 3)} − ${fmt(r.p1, 3)}) / ${fmt(r.ivcd, 3)} = <strong>${fmt(r.qP, 3)} pg/cell/day</strong>`;
  el('yieldExplain').innerHTML = `Yx/Glc = (${fmt(r.x2, 3)} − ${fmt(r.x1, 3)}) / (${fmt(r.glc1, 3)} − ${fmt(r.glc2, 3)}) = <strong>${fmt(r.yxGlc, 3)}</strong><br>Yp/Glc = (${fmt(r.p2, 3)} − ${fmt(r.p1, 3)}) / (${fmt(r.glc1, 3)} − ${fmt(r.glc2, 3)}) = <strong>${fmt(r.ypGlc, 3)}</strong>`;
  if (window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise();
}

function intervalPolygon() {
  const xs = [rawData[activeStart].day];
  const ys = [0];
  for (let i = activeStart; i <= activeEnd; i++) {
    xs.push(rawData[i].day);
    ys.push(rawData[i].xv);
  }
  xs.push(rawData[activeEnd].day);
  ys.push(0);
  return { xs, ys };
}

function hoverLine(day) {
  return [{ type: 'line', x0: day, x1: day, y0: 0, y1: 1, xref: 'x', yref: 'paper', line: { color: '#334155', width: 1.5, dash: 'dot' } }];
}

function metIntervalShape() {
  return {
    type: 'rect',
    x0: rawData[activeStart].day,
    x1: rawData[activeEnd].day,
    y0: 0, y1: 1,
    xref: 'x', yref: 'paper',
    fillcolor: 'rgba(88,86,214,0.10)',
    line: { color: '#5856D6', width: 1.5, dash: 'dash' },
    layer: 'below'
  };
}

function nearestDayFromEvent(e) {
  return e && e.points && e.points.length ? e.points[0].x : null;
}

function setSharedHover(day) {
  Plotly.relayout('growthPlotData', { shapes: hoverLine(day), transition: { duration: 0 } });
  Plotly.relayout('metPlotData', { shapes: [metIntervalShape(), ...hoverLine(day)], transition: { duration: 0 } });
}

function clearSharedHover() {
  Plotly.relayout('growthPlotData', { shapes: [], transition: { duration: 0 } });
  Plotly.relayout('metPlotData', { shapes: [metIntervalShape()], transition: { duration: 0 } });
}

function attachHoverSync() {
  const g = el('growthPlotData');
  const m = el('metPlotData');
  if (!g || !m || g.__syncBound) return;
  const hoverHandler = (e) => {
    if (syncLock) return;
    syncLock = true;
    const day = nearestDayFromEvent(e);
    if (day !== null) setSharedHover(day);
    syncLock = false;
  };
  const unhoverHandler = () => {
    if (syncLock) return;
    syncLock = true;
    clearSharedHover();
    syncLock = false;
  };
  g.on('plotly_hover', hoverHandler);
  m.on('plotly_hover', hoverHandler);
  g.on('plotly_unhover', unhoverHandler);
  m.on('plotly_unhover', unhoverHandler);
  g.__syncBound = true;
  m.__syncBound = true;
}

function drawDataPlots(sharedDay = null) {
  // Reset sync flags so attachHoverSync re-binds after each redraw
  const gEl = el('growthPlotData');
  const mEl = el('metPlotData');
  if (gEl) gEl.__syncBound = false;
  if (mEl) mEl.__syncBound = false;

  const isLog = growthScale === 'log';
  // In log mode: skip polygon (contains y=0 → log undefined) and remove fill-to-zero
  const poly = isLog ? { xs: [], ys: [] } : intervalPolygon();
  const growthShapes = sharedDay === null ? [] : hoverLine(sharedDay);
  // metPlot always shows the interval rect; hover line is added on top
  const metShapes = sharedDay === null
    ? [metIntervalShape()]
    : [metIntervalShape(), ...hoverLine(sharedDay)];

  // Log range: compute decade bounds from data so ticks are 0.1 → 1 → 10 etc.
  const xvValues = rawData.map(d => d.xv).filter(v => v > 0);
  const logRangeMin = Math.floor(Math.log10(Math.min(...xvValues)));
  const logRangeMax = Math.ceil(Math.log10(Math.max(...xvValues)));

  Plotly.newPlot('growthPlotData', [
    { x: rawData.map(d => d.day), y: rawData.map(d => d.xv), type: 'scatter', mode: 'lines+markers', name: t('traceXv'), line: { color: '#34C759', width: 3 }, marker: { size: 8, color: '#1A8A3A' }, fill: isLog ? 'none' : 'tozeroy', fillcolor: 'rgba(52,199,89,0.1)', hovertemplate: `${t('sampleHover')} %{x}<br>${t('traceXv')} %{y:.3f}<extra></extra>` },
    { x: poly.xs, y: poly.ys, type: 'scatter', mode: 'lines', name: t('traceRange'), fill: 'toself', fillcolor: 'rgba(88,86,214,0.15)', line: { color: '#5856D6', width: 2, dash: 'dash' }, hovertemplate: `${t('traceRange')}<extra></extra>` },
    { x: rawData.map(d => d.day), y: rawData.map((d, i) => { if (i === 0) return 0; let total = 0; for (let j = 0; j < i; j++) total += ((rawData[j].xv + rawData[j + 1].xv) / 2) * (rawData[j + 1].day - rawData[j].day); return total; }), type: 'scatter', mode: 'lines+markers', name: t('traceIvcdAcc'), yaxis: 'y2', line: { color: '#5856D6', width: 3, dash: 'dot' }, marker: { size: 6, color: '#5856D6' }, hovertemplate: `${t('sampleHover')} %{x}<br>${t('traceIvcdAcc')} %{y:.3f}<extra></extra>` }
  ], {
    margin: { l: 65, r: 70, t: 10, b: 55 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(242,242,247,0.6)',
    hovermode: 'x unified',
    legend: { orientation: 'h', y: 1.14, x: 0 },
    xaxis: { title: t('plotXTitle'), gridcolor: 'rgba(60,60,67,0.1)' },
    yaxis: {
      title: t('plotYGrowth'),
      type: growthScale,
      ...(isLog ? { range: [logRangeMin, logRangeMax] } : { rangemode: 'tozero' }),
      gridcolor: 'rgba(60,60,67,0.1)'
    },
    yaxis2: { title: t('plotYIvcd'), overlaying: 'y', side: 'right', rangemode: 'tozero', showgrid: false },
    shapes: growthShapes
  }, { responsive: true, displaylogo: false });

  Plotly.newPlot('metPlotData', [
    { x: rawData.map(d => d.day), y: rawData.map(d => d.glc_mM), type: 'scatter', mode: 'lines+markers', name: t('traceGlc'), line: { color: '#FF9500', width: 3 }, marker: { size: 8, color: '#C75300' }, hovertemplate: `${t('sampleHover')} %{x}<br>${t('traceGlc')} %{y:.3f} mM<extra></extra>` },
    { x: rawData.map(d => d.day), y: rawData.map(d => d.lac_mM), type: 'scatter', mode: 'lines+markers', name: t('traceLac'), line: { color: '#5AC8FA', width: 3 }, marker: { size: 8, color: '#0062CC' }, hovertemplate: `${t('sampleHover')} %{x}<br>${t('traceLac')} %{y:.3f} mM<extra></extra>` },
    { x: rawData.map(d => d.day), y: rawData.map(d => d.product_mgL), type: 'scatter', mode: 'lines+markers', name: t('traceProd'), yaxis: 'y2', line: { color: '#FF3B30', width: 3 }, marker: { size: 8, color: '#C0003C' }, hovertemplate: `${t('sampleHover')} %{x}<br>${t('traceProd')} %{y:.3f} mg/L<extra></extra>` }
  ], {
    margin: { l: 65, r: 70, t: 10, b: 55 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(242,242,247,0.6)',
    hovermode: 'x unified',
    legend: { orientation: 'h', y: 1.14, x: 0 },
    xaxis: { title: t('plotXTitle'), gridcolor: 'rgba(60,60,67,0.1)' },
    yaxis: { title: t('plotYSubs'), rangemode: 'tozero', gridcolor: 'rgba(60,60,67,0.1)' },
    yaxis2: { title: t('plotYProd'), overlaying: 'y', side: 'right', rangemode: 'tozero', showgrid: false },
    shapes: metShapes
  }, { responsive: true, displaylogo: false }).then(attachHoverSync);
}

function fillTable() {
  el('tableBody').innerHTML = allIntervalRows().map(r => `
    <tr>
      <td>${r.label}</td>
      <td class="mono">${fmt(r.x1, 3)}</td>
      <td class="mono">${fmt(r.x2, 3)}</td>
      <td class="mono">${fmt(r.glc1, 3)}</td>
      <td class="mono">${fmt(r.glc2, 3)}</td>
      <td class="mono">${fmt(r.lac1, 3)}</td>
      <td class="mono">${fmt(r.lac2, 3)}</td>
      <td class="mono">${fmt(r.p1, 3)}</td>
      <td class="mono">${fmt(r.p2, 3)}</td>
      <td class="mono">${fmt(r.dtD, 2)}</td>
      <td class="mono">${fmt(r.mu, 4)}</td>
      <td class="mono">${fmt(r.ivcd, 3)}</td>
      <td class="mono">${fmt(r.rGlc, 3)}</td>
      <td class="mono">${fmt(r.qGlc, 3)}</td>
      <td class="mono">${fmt(r.rLac, 3)}</td>
      <td class="mono">${fmt(r.qLac, 3)}</td>
      <td class="mono">${fmt(r.qP, 3)}</td>
      <td class="mono">${fmt(r.yxGlc, 3)}</td>
      <td class="mono">${fmt(r.ypGlc, 3)}</td>
    </tr>
  `).join('');
}

function downloadCSV() {
  const rows = allIntervalRows();
  const header = ['interval','Xv1','Xv2','Glc1_mM','Glc2_mM','Lac1_mM','Lac2_mM','P1_mgL','P2_mgL','dt_d','mu_h-1','IVCD_delta','rGlc_mM_day','qGlc_pmol_cell_day','rLac_mM_day','qLac_pmol_cell_day','qP_pg_cell_day','Yx_Glc','Yp_Glc'];
  const body = rows.map(r => [r.label, r.x1, r.x2, r.glc1, r.glc2, r.lac1, r.lac2, r.p1, r.p2, r.dtD, r.mu, r.ivcd, r.rGlc, r.qGlc, r.rLac, r.qLac, r.qP, r.yxGlc, r.ypGlc]);
  const csv = [header, ...body].map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kinetic_drive_results.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function redrawExplanation() {
  setSelectionModeText();
  renderDerivedText();
  drawDataPlots();
  renderIntervalSelector();
}

function updateFromCustom() {
  let s = parseInt(el('startSelect').value, 10);
  let e = parseInt(el('endSelect').value, 10);
  if (e <= s) e = s + 1;
  if (e >= rawData.length) e = rawData.length - 1;
  activeStart = s;
  activeEnd = e;
  el('endSelect').value = String(e);
  const pairIdx = pairIntervals.findIndex(p => p.start === s && p.end === e);
  if (pairIdx >= 0) el('pairSelect').value = String(pairIdx);
  redrawExplanation();
}

const simDefaults = { mu: 0.035, x0: 0.3, xmax: 10, glc0: 7.0, yxs: 0.18, qp: 1.5 };

function runSimulator() {
  const mu = parseFloat(el('simMu').value);
  const x0 = parseFloat(el('simX0').value);
  const xmax = parseFloat(el('simXmax').value);
  const glc0gL = parseFloat(el('simGlc0').value);
  const yxs = parseFloat(el('simYxs').value);
  const qp = parseFloat(el('simQp').value);

  el('simMuLabel').textContent = `${fmt(mu, 3)} h⁻¹`;
  el('simX0Label').textContent = `${fmt(x0, 2)} ×10⁶ ${currentLang === 'es' ? 'cél/mL' : 'cells/mL'}`;
  el('simXmaxLabel').textContent = `${fmt(xmax, 0)} ×10⁶ ${currentLang === 'es' ? 'cél/mL' : 'cells/mL'}`;
  el('simGlc0Label').textContent = `${fmt(glc0gL, 1)} g/L`;
  el('simYxsLabel').textContent = fmt(yxs, 2);
  el('simQpLabel').textContent = `${fmt(qp, 2)} pg/cell/day`;

  const glc0 = glc0gL * 1000 / MW_GLC;
  const dtH = 1;
  const dtD = dtH / 24;
  const totalH = 120;
  const timeDays = [0];
  const X = [x0];
  const Glc = [glc0];
  const P = [0];
  const IV = [0];

  for (let i = 0; i < totalH; i++) {
    const x = X[i];
    const glc = Glc[i];
    const active = glc > 1e-9;
    const muEffMax = active ? Math.max(mu * (1 - x / xmax), 0) : 0;
    // Calculate uncapped growth and glucose requirement
    const xNextUncapped = active ? Math.min(x * Math.exp(muEffMax * dtH), xmax) : x;
    const dXUncapped = Math.max(xNextUncapped - x, 0);
    const ivStepUncapped = ((x + xNextUncapped) / 2) * dtD;
    const dGlcNeeded = (yxs > 0 ? dXUncapped / yxs : 0) + 0.05 * ivStepUncapped;
    // Scale down growth proportionally if glucose is insufficient
    const glucoseScale = (active && dGlcNeeded > glc) ? glc / dGlcNeeded : 1;
    const dX = dXUncapped * glucoseScale;
    const xNext = Math.min(x + dX, xmax);
    const ivStep = ((x + xNext) / 2) * dtD;
    const dGlc = active ? Math.min(glc, (yxs > 0 ? dX / yxs : 0) + 0.05 * ivStep) : 0;
    const dP = active ? qp * ivStep : 0;
    timeDays.push((i + 1) / 24);
    X.push(xNext);
    Glc.push(Math.max(glc - dGlc, 0));
    P.push(P[i] + dP);
    IV.push(IV[i] + ivStep);
  }

  const totalGlc = glc0 - Glc[Glc.length - 1];
  const totalIV = IV[IV.length - 1];
  const totalP = P[P.length - 1];
  const muEffInit = Math.max(mu * (1 - x0 / xmax), 0);
  el('simTdOut').textContent = muEffInit > 0 ? `${fmt(Math.log(2) / muEffInit, 1)} h` : '—';
  el('simQglcOut').textContent = `${fmt(totalGlc / totalIV, 2)} pmol/cell/day`;
  el('simYpsOut').textContent = fmt(totalP / totalGlc, 2);
  el('simGlcFinalOut').textContent = `${fmt(Glc[Glc.length - 1], 2)} mM`;

  Plotly.newPlot('simPlot', [
    { x: timeDays, y: X, type: 'scatter', mode: 'lines', name: t('simXv'), line: { color: '#34C759', width: 3 }, fill: 'tozeroy', fillcolor: 'rgba(52,199,89,0.1)', hovertemplate: `${t('sampleHover')} %{x:.2f}<br>${t('simXv')} %{y:.2f}<extra></extra>` },
    { x: timeDays, y: Glc, type: 'scatter', mode: 'lines', name: t('simGlc'), yaxis: 'y2', line: { color: '#FF9500', width: 3 }, hovertemplate: `${t('sampleHover')} %{x:.2f}<br>${t('simGlc')} %{y:.2f} mM<extra></extra>` },
    { x: timeDays, y: P, type: 'scatter', mode: 'lines', name: t('simProd'), yaxis: 'y2', line: { color: '#FF3B30', width: 3, dash: 'dot' }, hovertemplate: `${t('sampleHover')} %{x:.2f}<br>${t('simProd')} %{y:.2f} mg/L<extra></extra>` }
  ], {
    margin: { l: 72, r: 95, t: 10, b: 55 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(242,242,247,0.6)',
    hovermode: 'x unified',
    legend: { orientation: 'h', y: 1.14, x: 0 },
    xaxis: { title: t('plotXTitle'), gridcolor: 'rgba(60,60,67,0.1)' },
    yaxis: { title: t('simXvTitle'), rangemode: 'tozero', gridcolor: 'rgba(60,60,67,0.1)', automargin: true },
    yaxis2: { title: t('simRightTitle'), overlaying: 'y', side: 'right', rangemode: 'tozero', showgrid: false, automargin: true }
  }, { responsive: true, displaylogo: false });
}

// ── Module switching ──
let activeModule = 'teaching';
function switchModule(name) {
  activeModule = name;
  const t1 = el('seccion-1');
  const t2 = el('seccion-2');
  const btn1 = el('tabTeaching');
  const btn2 = el('tabSimulation');
  if (t1) t1.style.display = name === 'teaching' ? '' : 'none';
  if (t2) t2.style.display = name === 'simulation' ? '' : 'none';
  if (btn1) { btn1.classList.toggle('active', name === 'teaching'); btn1.setAttribute('aria-selected', String(name === 'teaching')); }
  if (btn2) { btn2.classList.toggle('active', name === 'simulation'); btn2.setAttribute('aria-selected', String(name === 'simulation')); }
  // Update scale toggle button visual state
  if (name === 'teaching') {
    const linBtn = el('dataLinearBtn');
    const logBtn = el('dataLogBtn');
    if (linBtn && logBtn) {
      linBtn.classList.toggle('btn-scale-active', growthScale === 'linear');
      logBtn.classList.toggle('btn-scale-active', growthScale === 'log');
    }
  }
}

// ── Interval selector rendering ──
function renderIntervalSelector() {
  const n = rawData.length;

  // Update range track
  const rangeTrack = el('timelineRangeTrack');
  if (rangeTrack) {
    const leftPct = (activeStart / (n - 1)) * 100;
    const rightPct = (activeEnd / (n - 1)) * 100;
    rangeTrack.style.left = leftPct + '%';
    rangeTrack.style.width = (rightPct - leftPct) + '%';
  }

  // Render node circles
  const nodeRow = el('timelineNodeRow');
  if (nodeRow) {
    nodeRow.innerHTML = rawData.map((d, idx) => {
      const isStart = idx === activeStart;
      const isEnd = idx === activeEnd;
      const inRange = idx > activeStart && idx < activeEnd;
      let bg, border, color, scale = '';
      if (isStart) { bg='#5856D6'; border='#5856D6'; color='white'; scale='transform:scale(1.2);'; }
      else if (isEnd) { bg='#3634A3'; border='#3634A3'; color='white'; scale='transform:scale(1.2);'; }
      else if (inRange) { bg='rgba(88,86,214,0.12)'; border='rgba(88,86,214,0.4)'; color='#5856D6'; }
      else { bg='white'; border='rgba(0,0,0,0.12)'; color='rgba(60,60,67,0.5)'; }
      return `<div onclick="handleTimelineClick(${idx})" style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;cursor:pointer;transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1);box-shadow:0 2px 8px rgba(0,0,0,0.1);border:2px solid ${border};background:${bg};color:${color};${scale}">${d.day}</div>`;
    }).join('');
  }

  // Render timeline labels
  const labelRow = el('timelineLabelRow');
  if (labelRow) {
    labelRow.innerHTML = rawData.map((d, idx) => {
      const isActive = idx === activeStart || idx === activeEnd;
      return `<span style="font-size:11px;font-weight:${isActive?'700':'500'};color:${isActive?'#5856D6':'rgba(60,60,67,0.4)'};text-align:center;line-height:1.2;">${t('dayLabel')}<br>${d.day}</span>`;
    }).join('');
  }

  // Render start buttons
  const startBtnRow = el('startBtnRow');
  if (startBtnRow) {
    startBtnRow.innerHTML = rawData.slice(0, -1).map((d, idx) => {
      const isActive = idx === activeStart;
      const sty = isActive
        ? 'background:#5856D6;color:white;border:1px solid #5856D6;box-shadow:0 3px 10px rgba(88,86,214,0.35);'
        : 'background:rgba(255,255,255,0.85);color:rgba(0,0,0,0.7);border:1px solid rgba(0,0,0,0.1);';
      return `<button onclick="setIntervalStart(${idx})" style="padding:7px 14px;border-radius:9999px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.18s;${sty}">${t('dayLabel')} ${d.day}</button>`;
    }).join('');
  }

  // Render end buttons
  const endBtnRow = el('endBtnRow');
  if (endBtnRow) {
    endBtnRow.innerHTML = rawData.slice(1).map((d, idx) => {
      const realIdx = idx + 1;
      const isActive = realIdx === activeEnd;
      const isDisabled = realIdx <= activeStart;
      let sty;
      if (isActive) sty = 'background:#3634A3;color:white;border:1px solid #3634A3;box-shadow:0 3px 10px rgba(54,52,163,0.35);';
      else if (isDisabled) sty = 'background:transparent;color:rgba(0,0,0,0.2);border:1px solid rgba(0,0,0,0.05);cursor:not-allowed;opacity:0.5;';
      else sty = 'background:rgba(255,255,255,0.85);color:rgba(0,0,0,0.7);border:1px solid rgba(0,0,0,0.1);';
      return `<button onclick="setIntervalEnd(${realIdx})" ${isDisabled?'disabled':''} style="padding:7px 14px;border-radius:9999px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.18s;${sty}">${t('dayLabel')} ${d.day}</button>`;
    }).join('');
  }

  // Update scale toggle button active state
  const linBtn = el('dataLinearBtn');
  const logBtn = el('dataLogBtn');
  if (linBtn && logBtn) {
    linBtn.classList.toggle('btn-scale-active', growthScale === 'linear');
    logBtn.classList.toggle('btn-scale-active', growthScale === 'log');
  }
}

function handleTimelineClick(idx) {
  if (idx === 0 || idx < activeEnd) {
    activeStart = idx;
    if (activeEnd <= activeStart) activeEnd = Math.min(activeStart + 1, rawData.length - 1);
  } else {
    activeEnd = idx;
    if (activeStart >= activeEnd) activeStart = Math.max(0, activeEnd - 1);
  }
  renderIntervalSelector();
  redrawExplanation();
}

function setIntervalStart(idx) {
  activeStart = idx;
  if (activeEnd <= activeStart) activeEnd = Math.min(activeStart + 1, rawData.length - 1);
  renderIntervalSelector();
  redrawExplanation();
}

function setIntervalEnd(idx) {
  if (idx <= activeStart) return;
  activeEnd = idx;
  renderIntervalSelector();
  redrawExplanation();
}

// ── Translations ──
function applyTranslations() {
  document.documentElement.lang = currentLang;
  document.title = t('title');
  const ids = [
    'brandTag','heroTitle','heroLead','repoBtn',
    'section1Chip','section1Title','section1Lead',
    'intervalSelectorTitle','intervalSelectorDesc','intervalExampleNote',
    'startRowLabel','endRowLabel',
    'plot1Title','plot1Lead','plot2Title','plot2Lead',
    'mLabelDt','mLabelMu','mLabelIvcd','mLabelQglc','mLabelQLac','mLabelQp',
    'formulaMainTitle','formulaMainLead','formulaChip',
    'muTitle','muWarn','muLead','ivcdTitle','ivcdWarn','ivcdLead','ivcdRef',
    'qglcTitle','qglcWarn','qglcLead','qpTitle','qpWarn','qpLead',
    'yieldTitle','yieldWarn','yieldLead','apparentTitle','apparentCopy','realTitle','realCopy',
    'stepsTitle','step1Badge','step1Title','step1Copy','step2Badge','step2Title','step2Copy',
    'step3Badge','step3Title','step3Copy','step4Badge','step4Title','step4Copy',
    'section2Chip','section2Title','section2Lead',
    'simTitle','simLead','simMuHelp','simX0Help','simXmaxHelp','simGlcText','simGlcHelp',
    'simYxsHelp','simQpHelp','simResetBtn','simHowTitle','simHowCopy',
    'simMetric1','simMetric2','simMetric3','simMetric4','simPlotTitle','simPlotLead',
    'tableTitle','tableLead','csvBtn',
    'thInterval','thXv1','thXv2','thGlc1','thGlc2','thLac1','thLac2',
    'thP1','thP2','thDt','thMu','thIvcd','thRglc','thQglc','thRlac','thQlac','thQp','thYx','thYp',
    'footerText'
  ];
  ids.forEach(id => {
    const node = el(id);
    if (node) node.innerHTML = t(id);
  });
  el('langBtn').textContent = t('langBtn');
  el('dataLinearBtn').textContent = t('linearBtn');
  el('dataLogBtn').textContent = t('logBtn');
  // Update tab labels
  const tl = el('tabTeachingLabel');
  if (tl) tl.textContent = t('moduleTeaching');
  const sl = el('tabSimulationLabel');
  if (sl) sl.textContent = t('moduleSimulation');
  const tabTeachingBtn = el('tabTeaching');
  const tabSimulationBtn = el('tabSimulation');
  if (tabTeachingBtn) tabTeachingBtn.title = t('tabTeachingTooltip');
  if (tabSimulationBtn) tabSimulationBtn.title = t('tabSimulationTooltip');
  el('simMuText').innerHTML = t('simMuText');
  el('simX0Text').innerHTML = t('simX0Text');
  el('simXmaxText').innerHTML = t('simXmaxText');
  el('simYxsText').innerHTML = t('simYxsText');
  el('simQpText').innerHTML = t('simQpText');
  ['continuous1','continuous2','continuous3','continuous4','continuous5'].forEach(id => { const n = el(id); if(n) n.innerHTML = t('continuous'); });
  ['discrete1','discrete2','discrete3','discrete4','discrete5'].forEach(id => { const n = el(id); if(n) n.innerHTML = t('discrete'); });
  [1, 2].forEach(i => {
    const lbl = el(`authorLabel${i}`); if (lbl) lbl.textContent = t('authorLabel');
    const nm  = el(`authorName${i}`);  if (nm)  nm.textContent  = t('authorName');
    const rol = el(`authorRole${i}`);  if (rol) rol.textContent  = t('authorRole');
  });
  populateControls();
  setSelectionModeText();
  fillTable();
  renderDerivedText();
  drawDataPlots();
  runSimulator();
  renderIntervalSelector();
  if (window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise();
}

// ── Init ──
function init() {
  // Tab switching (remove onclick from HTML, bind here)
  el('tabTeaching').addEventListener('click', () => switchModule('teaching'));
  el('tabSimulation').addEventListener('click', () => switchModule('simulation'));

  if (el('pairSelect')) {
    el('pairSelect').addEventListener('change', (e) => {
      const idx = parseInt(e.target.value, 10);
      const pair = pairIntervals[idx];
      activeStart = pair.start;
      activeEnd = pair.end;
      el('startSelect').value = String(activeStart);
      el('endSelect').value = String(activeEnd);
      redrawExplanation();
    });
  }
  if (el('startSelect')) el('startSelect').addEventListener('change', updateFromCustom);
  if (el('endSelect')) el('endSelect').addEventListener('change', updateFromCustom);

  el('dataLinearBtn').addEventListener('click', () => {
    growthScale = 'linear';
    el('dataLinearBtn').classList.add('btn-scale-active');
    el('dataLogBtn').classList.remove('btn-scale-active');
    drawDataPlots();
  });
  el('dataLogBtn').addEventListener('click', () => {
    growthScale = 'log';
    el('dataLogBtn').classList.add('btn-scale-active');
    el('dataLinearBtn').classList.remove('btn-scale-active');
    drawDataPlots();
  });

  el('csvBtn').addEventListener('click', downloadCSV);
  el('langBtn').addEventListener('click', () => {
    currentLang = currentLang === 'es' ? 'en' : 'es';
    applyTranslations();
  });

  ['simMu','simX0','simXmax','simGlc0','simYxs','simQp'].forEach(id => el(id).addEventListener('input', runSimulator));
  el('simResetBtn').addEventListener('click', () => {
    el('simMu').value = simDefaults.mu;
    el('simX0').value = simDefaults.x0;
    el('simXmax').value = simDefaults.xmax;
    el('simGlc0').value = simDefaults.glc0;
    el('simYxs').value = simDefaults.yxs;
    el('simQp').value = simDefaults.qp;
    runSimulator();
  });

  switchModule('teaching');
  populateControls();
  fillTable();
  setSelectionModeText();
  renderDerivedText();
  drawDataPlots();
  runSimulator();
  renderIntervalSelector();
  if (window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise();
}

init();
