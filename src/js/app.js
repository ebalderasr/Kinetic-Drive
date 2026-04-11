'use strict';

const MW_GLC = 180.16;
const MW_LAC = 90.08;

let currentLang = 'es';
let growthScale = 'linear';
let batchStart = 0;
let batchEnd = 1;
let fedStart = 0;
let fedEnd = 1;

const datasets = {
  batch: [],
  fed: []
};

let fedAuditRows = [];

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

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function parseLocaleNumber(value) {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.replace(/^"|"$/g, '').trim();
  if (!normalized) return null;
  if (/^(true|false)$/i.test(normalized)) return null;
  const cleaned = normalized.includes(',') && !normalized.includes('.')
    ? normalized.replace(',', '.')
    : normalized.replace(/,/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeXv(value) {
  if (value === null || value === undefined) return null;
  return value > 50 ? value / 1000 : value;
}

function convertRow(map) {
  const day = parseLocaleNumber(map.T);
  const xv = normalizeXv(parseLocaleNumber(map.Xv));
  const viability = parseLocaleNumber(map.v);
  const glc_gL = parseLocaleNumber(map.G);
  const lac_gL = parseLocaleNumber(map.L);
  const product_mgL = parseLocaleNumber(map.P);
  const vol_mL = parseLocaleNumber(map.Vol_mL);
  const isPostFeed = /^true$/i.test(String(map.is_post_feed ?? '').trim());
  if (!Number.isFinite(day) || !Number.isFinite(xv)) return null;
  return {
    day,
    xv,
    viability,
    glc_gL,
    lac_gL,
    product_mgL,
    vol_mL,
    isPostFeed,
    glc_mM: Number.isFinite(glc_gL) ? (glc_gL * 1000) / MW_GLC : null,
    lac_mM: Number.isFinite(lac_gL) ? (lac_gL * 1000) / MW_LAC : null,
    totalCells_1e6: Number.isFinite(vol_mL) ? xv * vol_mL : null
  };
}

function parseDataset(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) return [];
  const headers = splitCsvLine(lines[1]);
  return lines.slice(2)
    .map((line) => {
      const parts = splitCsvLine(line);
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = parts[idx] ?? '';
      });
      return convertRow(row);
    })
    .filter(Boolean)
    .sort((a, b) => a.day - b.day);
}

async function loadDataset(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  const text = await response.text();
  return parseDataset(text);
}

function calcLogMean(x0, x1) {
  if (!(x0 > 0) || !(x1 > 0)) return null;
  if (Math.abs(x1 - x0) < 1e-12) return x0;
  const lnRatio = Math.log(x1 / x0);
  if (Math.abs(lnRatio) < 1e-12) return x0;
  return (x1 - x0) / lnRatio;
}

function diffIfBoth(a, b, fn) {
  return Number.isFinite(a) && Number.isFinite(b) ? fn(a, b) : null;
}

function totalMmol(conc_mM, vol_mL) {
  return Number.isFinite(conc_mM) && Number.isFinite(vol_mL) ? conc_mM * (vol_mL / 1000) : null;
}

function totalMg(conc_mgL, vol_mL) {
  return Number.isFinite(conc_mgL) && Number.isFinite(vol_mL) ? conc_mgL * (vol_mL / 1000) : null;
}

function fedNoteFor(status, method) {
  if (status === 'skip') {
    return currentLang === 'es'
      ? 'Evento de feed: se excluye porque mezcla adición de medio con respuesta celular.'
      : 'Feed event: excluded because it mixes medium addition with cell response.';
  }
  if (method === 'fed_mass') {
    return currentLang === 'es'
      ? 'Post-feed: usar masas totales e ITVC con el volumen medido.'
      : 'Post-feed: use total masses and ITVC with the measured volume.';
  }
  return currentLang === 'es'
    ? 'Antes del primer feed: usar concentración + IVCD.'
    : 'Before first feed: use concentration + IVCD.';
}

function calcBatchInterval(data, startIdx, endIdx) {
  const a = data[startIdx];
  const b = data[endIdx];
  const dtD = b.day - a.day;
  const dtH = dtD * 24;
  let ivcd = 0;
  for (let i = startIdx; i < endIdx; i++) {
    ivcd += ((data[i].xv + data[i + 1].xv) / 2) * (data[i + 1].day - data[i].day);
  }
  const logMean = calcLogMean(a.xv, b.xv);
  const ivcdLog = logMean !== null ? logMean * dtD : null;
  return {
    label: `${t('dayLabel')} ${fmt(a.day, 1)}–${fmt(b.day, 1)}`,
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
    logMean,
    ivcdLog,
    mu: (Math.log(b.xv) - Math.log(a.xv)) / dtH,
    qGlc: diffIfBoth(a.glc_mM, b.glc_mM, (v1, v2) => (v1 - v2) / ivcd),
    qLac: diffIfBoth(a.lac_mM, b.lac_mM, (v1, v2) => (v2 - v1) / ivcd),
    qP: diffIfBoth(a.product_mgL, b.product_mgL, (v1, v2) => (v2 - v1) / ivcd),
    yxGlc: diffIfBoth(a.glc_mM, b.glc_mM, (v1, v2) => {
      const dGlc = v1 - v2;
      return dGlc !== 0 ? (b.xv - a.xv) / dGlc : null;
    }),
    ypGlc: diffIfBoth(a.glc_mM, b.glc_mM, (v1, v2) => {
      const dGlc = v1 - v2;
      return dGlc !== 0 && Number.isFinite(a.product_mgL) && Number.isFinite(b.product_mgL)
        ? (b.product_mgL - a.product_mgL) / dGlc
        : null;
    })
  };
}

function buildFedMetadata(data) {
  const firstFeedIdx = data.findIndex((row) => row.isPostFeed);
  const validIntervals = [];
  const audit = [];

  for (let i = 0; i < data.length - 1; i++) {
    const a = data[i];
    const b = data[i + 1];
    const mu = (Math.log(b.xv) - Math.log(a.xv)) / ((b.day - a.day) * 24);
    let status = 'valid';
    let method = 'batch';
    let note = fedNoteFor(status, method);

    if (!a.isPostFeed && b.isPostFeed) {
      status = 'skip';
      method = 'excluded';
      note = fedNoteFor(status, method);
    } else if (a.isPostFeed && !b.isPostFeed) {
      status = 'valid';
      method = 'fed_mass';
      note = fedNoteFor(status, method);
    } else if (firstFeedIdx !== -1 && i >= firstFeedIdx) {
      status = 'valid';
      method = 'fed_mass';
      note = fedNoteFor(status, method);
    }

    const row = {
      index: i,
      start: a,
      end: b,
      label: `${fmt(a.day, 1)}–${fmt(b.day, 1)}`,
      status,
      method,
      mu,
      note
    };
    audit.push(row);
    if (status === 'valid') validIntervals.push(row);
  }

  return { validIntervals, audit };
}

function activeBatchInterval() {
  return calcBatchInterval(datasets.batch, batchStart, batchEnd);
}

function calcFedInterval(data, startIdx, endIdx) {
  const a = data[startIdx];
  const b = data[endIdx];
  const dtD = b.day - a.day;
  const dtH = dtD * 24;

  let ivcd = 0;
  for (let i = startIdx; i < endIdx; i++) {
    ivcd += ((data[i].xv + data[i + 1].xv) / 2) * (data[i + 1].day - data[i].day);
  }

  let itvc = null;
  const allHaveVol = data.slice(startIdx, endIdx + 1).every((row) => Number.isFinite(row.vol_mL));
  if (allHaveVol) {
    itvc = 0;
    for (let i = startIdx; i < endIdx; i++) {
      const tc1i = data[i].xv * data[i].vol_mL;
      const tc2i = data[i + 1].xv * data[i + 1].vol_mL;
      itvc += ((tc1i + tc2i) / 2) * (data[i + 1].day - data[i].day);
    }
  }

  const firstFeedIdx = data.findIndex((row) => row.isPostFeed);
  const method = (firstFeedIdx !== -1 && endIdx >= firstFeedIdx) ? 'fed_mass' : 'batch';

  let hasSkip = false;
  for (let i = startIdx; i < endIdx; i++) {
    if (!data[i].isPostFeed && data[i + 1].isPostFeed) { hasSkip = true; break; }
  }

  const logMean = calcLogMean(a.xv, b.xv);
  const tc1 = a.totalCells_1e6;
  const tc2 = b.totalCells_1e6;
  const glcM1 = totalMmol(a.glc_mM, a.vol_mL);
  const glcM2 = totalMmol(b.glc_mM, b.vol_mL);
  const lacM1 = totalMmol(a.lac_mM, a.vol_mL);
  const lacM2 = totalMmol(b.lac_mM, b.vol_mL);
  const pM1 = totalMg(a.product_mgL, a.vol_mL);
  const pM2 = totalMg(b.product_mgL, b.vol_mL);

  const qGlc = method === 'batch'
    ? diffIfBoth(a.glc_mM, b.glc_mM, (v1, v2) => (v1 - v2) / ivcd)
    : (Number.isFinite(glcM1) && Number.isFinite(glcM2) && itvc ? ((glcM1 - glcM2) / itvc) * 1000 : null);
  const qLac = method === 'batch'
    ? diffIfBoth(a.lac_mM, b.lac_mM, (v1, v2) => (v2 - v1) / ivcd)
    : (Number.isFinite(lacM1) && Number.isFinite(lacM2) && itvc ? ((lacM2 - lacM1) / itvc) * 1000 : null);
  const qP = method === 'batch'
    ? diffIfBoth(a.product_mgL, b.product_mgL, (v1, v2) => (v2 - v1) / ivcd)
    : (Number.isFinite(pM1) && Number.isFinite(pM2) && itvc ? ((pM2 - pM1) / itvc) * 1000 : null);

  return {
    t1: a.day, t2: b.day, dtD, dtH,
    x1: a.xv, x2: b.xv,
    mu: (Math.log(b.xv) - Math.log(a.xv)) / dtH,
    ivcd, itvc, method, hasSkip,
    logMean, ivcdLog: logMean !== null ? logMean * dtD : null,
    start: a, end: b,
    tc1, tc2, glcM1, glcM2, lacM1, lacM2, pM1, pM2,
    qGlc, qLac, qP
  };
}

function activeFedDescriptor() {
  if (!datasets.fed.length) return null;
  return { start: datasets.fed[fedStart], end: datasets.fed[fedEnd] };
}

function activeFedIntervalData() {
  if (!datasets.fed.length) return null;
  return calcFedInterval(datasets.fed, fedStart, fedEnd);
}

function batchRows() {
  const rows = [];
  for (let i = 0; i < datasets.batch.length - 1; i++) rows.push(calcBatchInterval(datasets.batch, i, i + 1));
  return rows;
}

function populateBatchControls() {
  const data = datasets.batch;

  el('startBtnRow').innerHTML = data.slice(0, -1).map((d, idx) => {
    const isActive = idx === batchStart;
    const sty = isActive
      ? 'background:#5856D6;color:white;border:1px solid #5856D6;box-shadow:0 3px 10px rgba(88,86,214,0.35);'
      : 'background:rgba(255,255,255,0.85);color:rgba(0,0,0,0.7);border:1px solid rgba(0,0,0,0.1);';
    return `<button onclick="window.setBatchStart(${idx})" style="padding:7px 14px;border-radius:9999px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.18s;${sty}">${t('dayLabel')} ${fmt(d.day, 1)}</button>`;
  }).join('');

  el('endBtnRow').innerHTML = data.slice(1).map((d, idx) => {
    const realIdx = idx + 1;
    const isActive = realIdx === batchEnd;
    const isDisabled = realIdx <= batchStart;
    let sty;
    if (isActive) sty = 'background:#3634A3;color:white;border:1px solid #3634A3;box-shadow:0 3px 10px rgba(54,52,163,0.35);';
    else if (isDisabled) sty = 'background:transparent;color:rgba(0,0,0,0.2);border:1px solid rgba(0,0,0,0.05);cursor:not-allowed;opacity:0.5;';
    else sty = 'background:rgba(255,255,255,0.85);color:rgba(0,0,0,0.7);border:1px solid rgba(0,0,0,0.1);';
    return `<button onclick="window.setBatchEnd(${realIdx})" ${isDisabled ? 'disabled' : ''} style="padding:7px 14px;border-radius:9999px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.18s;${sty}">${t('dayLabel')} ${fmt(d.day, 1)}</button>`;
  }).join('');
}

function renderBatchMetrics() {
  const r = activeBatchInterval();
  const ivcdUnits = currentLang === 'es' ? '×10⁶ cél·d/mL' : '×10⁶ cells·day/mL';
  el('deltaTimeOut').textContent = `${fmt(r.dtD, 2)} d`;
  el('muOut').innerHTML = `${fmt(r.mu, 4)} h⁻¹<br><span style="font-size:0.82em;opacity:0.6;">${fmt(r.mu * 24, 3)} d⁻¹</span>`;
  el('ivcdOutCompact').textContent = `${fmt(r.ivcd, 3)} ${ivcdUnits}`;
  el('qGlcOut').textContent = `${fmt(r.qGlc, 3)} pmol/cel/d`;
  el('qLacOut').textContent = `${fmt(r.qLac, 3)} pmol/cel/d`;
  el('qPOut').textContent = `${fmt(r.qP, 3)} pg/cel/d`;
  el('muExplain').innerHTML = `μ = [ln(${fmt(r.x2, 3)}) − ln(${fmt(r.x1, 3)})] / ${fmt(r.dtH, 2)} h = <strong>${fmt(r.mu, 4)} h⁻¹</strong>`;
  el('ivcdExplain').innerHTML = `${currentLang === 'es' ? 'IVCD trapezoidal' : 'Trapezoidal IVCD'} = <strong>${fmt(r.ivcd, 3)}</strong> ${ivcdUnits}`;
  el('qGlcExplain').innerHTML = `qGlc = (${fmt(r.glc1, 3)} − ${fmt(r.glc2, 3)}) / ${fmt(r.ivcd, 3)} = <strong>${fmt(r.qGlc, 3)}</strong><br>qLac = (${fmt(r.lac2, 3)} − ${fmt(r.lac1, 3)}) / ${fmt(r.ivcd, 3)} = <strong>${fmt(r.qLac, 3)}</strong>`;
  el('qPExplain').innerHTML = `qP = (${fmt(r.p2, 3)} − ${fmt(r.p1, 3)}) / ${fmt(r.ivcd, 3)} = <strong>${fmt(r.qP, 3)}</strong>`;
  el('yieldExplain').innerHTML = `Yx/Glc = (${fmt(r.x2, 3)} − ${fmt(r.x1, 3)}) / (${fmt(r.glc1, 3)} − ${fmt(r.glc2, 3)}) = <strong>${fmt(r.yxGlc, 3)}</strong><br>Yp/Glc = (${fmt(r.p2, 3)} − ${fmt(r.p1, 3)}) / (${fmt(r.glc1, 3)} − ${fmt(r.glc2, 3)}) = <strong>${fmt(r.ypGlc, 3)}</strong>`;
}

function drawBatchPlots() {
  const data = datasets.batch;
  const r = activeBatchInterval();
  const intervalXs = [r.t1];
  const intervalYs = [0];
  for (let i = batchStart; i <= batchEnd; i++) {
    intervalXs.push(data[i].day);
    intervalYs.push(data[i].xv);
  }
  intervalXs.push(r.t2);
  intervalYs.push(0);

  const xvValues = data.map((d) => d.xv).filter((v) => v > 0);
  const logRangeMin = Math.floor(Math.log10(Math.min(...xvValues)));
  const logRangeMax = Math.ceil(Math.log10(Math.max(...xvValues)));

  Plotly.newPlot('growthPlotData', [
    { x: data.map((d) => d.day), y: data.map((d) => d.xv), type: 'scatter', mode: 'lines+markers', name: t('traceXv'), line: { color: '#34C759', width: 3 }, marker: { size: 8, color: '#1A8A3A' }, fill: growthScale === 'log' ? 'none' : 'tozeroy', fillcolor: 'rgba(52,199,89,0.1)' },
    { x: intervalXs, y: intervalYs, type: 'scatter', mode: 'lines', name: t('traceRange'), fill: 'toself', fillcolor: 'rgba(88,86,214,0.15)', line: { color: '#5856D6', width: 2, dash: 'dash' } },
    { x: data.map((d) => d.day), y: data.map((d, i) => {
      if (i === 0) return 0;
      let total = 0;
      for (let j = 0; j < i; j++) total += ((data[j].xv + data[j + 1].xv) / 2) * (data[j + 1].day - data[j].day);
      return total;
    }), type: 'scatter', mode: 'lines+markers', name: t('traceIvcdAcc'), yaxis: 'y2', line: { color: '#5856D6', width: 3, dash: 'dot' }, marker: { size: 6, color: '#5856D6' } }
  ], {
    margin: { l: 65, r: 70, t: 10, b: 55 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(242,242,247,0.6)',
    hovermode: 'x unified',
    legend: { orientation: 'h', y: 1.14, x: 0 },
    xaxis: { title: t('plotXTitle'), gridcolor: 'rgba(60,60,67,0.1)' },
    yaxis: { title: t('plotYGrowth'), type: growthScale, ...(growthScale === 'log' ? { range: [logRangeMin, logRangeMax] } : { rangemode: 'tozero' }), gridcolor: 'rgba(60,60,67,0.1)' },
    yaxis2: { title: t('plotYIvcd'), overlaying: 'y', side: 'right', rangemode: 'tozero', showgrid: false }
  }, { responsive: true, displaylogo: false });

  Plotly.newPlot('metPlotData', [
    { x: data.map((d) => d.day), y: data.map((d) => d.glc_mM), type: 'scatter', mode: 'lines+markers', name: t('traceGlc'), line: { color: '#FF9500', width: 3 }, marker: { size: 8, color: '#C75300' } },
    { x: data.map((d) => d.day), y: data.map((d) => d.lac_mM), type: 'scatter', mode: 'lines+markers', name: t('traceLac'), line: { color: '#5AC8FA', width: 3 }, marker: { size: 8, color: '#0062CC' } },
    { x: data.map((d) => d.day), y: data.map((d) => d.product_mgL), type: 'scatter', mode: 'lines+markers', name: t('traceProd'), yaxis: 'y2', line: { color: '#FF3B30', width: 3 }, marker: { size: 8, color: '#C0003C' } }
  ], {
    margin: { l: 65, r: 70, t: 10, b: 55 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(242,242,247,0.6)',
    hovermode: 'x unified',
    legend: { orientation: 'h', y: 1.14, x: 0 },
    xaxis: { title: t('plotXTitle'), gridcolor: 'rgba(60,60,67,0.1)' },
    yaxis: { title: t('plotYSubs'), rangemode: 'tozero', gridcolor: 'rgba(60,60,67,0.1)' },
    yaxis2: { title: t('plotYProd'), overlaying: 'y', side: 'right', rangemode: 'tozero', showgrid: false },
    shapes: [{ type: 'rect', x0: r.t1, x1: r.t2, y0: 0, y1: 1, xref: 'x', yref: 'paper', fillcolor: 'rgba(88,86,214,0.10)', line: { color: '#5856D6', width: 1.5, dash: 'dash' }, layer: 'below' }]
  }, { responsive: true, displaylogo: false });
}

function fillBatchTable() {
  el('tableBody').innerHTML = batchRows().map((r) => `
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
      <td class="mono">${fmt(r.qGlc, 3)}</td>
      <td class="mono">${fmt(r.qLac, 3)}</td>
      <td class="mono">${fmt(r.qP, 3)}</td>
      <td class="mono">${fmt(r.yxGlc, 3)}</td>
      <td class="mono">${fmt(r.ypGlc, 3)}</td>
    </tr>
  `).join('');
}

function populateFedControls() {
  const data = datasets.fed;

  el('fedStartBtnRow').innerHTML = data.slice(0, -1).map((d, idx) => {
    const isActive = idx === fedStart;
    const sty = isActive
      ? 'background:#5856D6;color:white;border:1px solid #5856D6;box-shadow:0 3px 10px rgba(88,86,214,0.35);'
      : 'background:rgba(255,255,255,0.85);color:rgba(0,0,0,0.7);border:1px solid rgba(0,0,0,0.1);';
    return `<button onclick="window.setFedStart(${idx})" style="padding:7px 14px;border-radius:9999px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.18s;${sty}">${t('dayLabel')} ${fmt(d.day, 1)}</button>`;
  }).join('');

  el('fedEndBtnRow').innerHTML = data.slice(1).map((d, idx) => {
    const realIdx = idx + 1;
    const isActive = realIdx === fedEnd;
    const isDisabled = realIdx <= fedStart;
    let sty;
    if (isActive) sty = 'background:#3634A3;color:white;border:1px solid #3634A3;box-shadow:0 3px 10px rgba(54,52,163,0.35);';
    else if (isDisabled) sty = 'background:transparent;color:rgba(0,0,0,0.2);border:1px solid rgba(0,0,0,0.05);cursor:not-allowed;opacity:0.5;';
    else sty = 'background:rgba(255,255,255,0.85);color:rgba(0,0,0,0.7);border:1px solid rgba(0,0,0,0.1);';
    return `<button onclick="window.setFedEnd(${realIdx})" ${isDisabled ? 'disabled' : ''} style="padding:7px 14px;border-radius:9999px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.18s;${sty}">${t('dayLabel')} ${fmt(d.day, 1)}</button>`;
  }).join('');
}

function renderFedSection() {
  const r = activeFedIntervalData();
  if (!r) return;
  const isBatchLike = r.method === 'batch';
  const ivcdUnits = currentLang === 'es' ? '×10⁶ cél·d/mL' : '×10⁶ cells·day/mL';
  const itvcUnits = currentLang === 'es' ? '×10⁶ cél·d' : '×10⁶ cells·day';

  // Method chip
  const methodLabel = isBatchLike
    ? (currentLang === 'es' ? 'Concentración + IVCD' : 'Concentration + IVCD')
    : (currentLang === 'es' ? 'Masas totales + ITVC' : 'Total masses + ITVC');
  el('fedModeChip').textContent = methodLabel;
  el('fedModeChip').className = `chip ${isBatchLike ? 'chip-indigo' : 'chip-blue'}`;

  // Main metrics
  el('fedDeltaTimeOut').textContent = `${fmt(r.dtD, 2)} d`;
  el('fedMuOut').innerHTML = `${fmt(r.mu, 4)} h⁻¹<br><span style="font-size:0.82em;opacity:0.6;">${fmt(r.mu * 24, 3)} d⁻¹</span>`;
  el('fedIvcdOut').textContent = `${fmt(r.ivcd, 3)} ${ivcdUnits}`;
  el('fedQGlcOut').textContent = `${fmt(r.qGlc, 3)} pmol/cel/d`;
  el('fedQLacOut').textContent = `${fmt(r.qLac, 3)} pmol/cel/d`;
  el('fedQPOut').textContent = `${fmt(r.qP, 3)} pg/cel/d`;

  // ITVC sub-display inside IVCD card
  const itvcSub = el('fedItvcSub');
  if (!isBatchLike && r.itvc !== null) {
    itvcSub.style.display = '';
    el('fedItvcOut').textContent = `${fmt(r.itvc, 3)} ${itvcUnits}`;
  } else {
    itvcSub.style.display = 'none';
  }

  const a = r.start;
  const b = r.end;

  // μ explain
  el('fedFMuExplain').innerHTML = `μ = [ln(${fmt(b.xv, 3)}) − ln(${fmt(a.xv, 3)})] / ${fmt(r.dtH, 2)} h = <strong>${fmt(r.mu, 4)} h⁻¹</strong>`;

  // Normalizer explain
  if (isBatchLike) {
    el('fedFNormExplain').innerHTML = `IVCD = ((${fmt(a.xv, 3)} + ${fmt(b.xv, 3)}) / 2) × ${fmt(r.dtD, 2)} d = <strong>${fmt(r.ivcd, 3)}</strong>`;
  } else {
    el('fedFNormExplain').innerHTML =
      `TC₁ = ${fmt(a.xv, 3)} × ${fmt(a.vol_mL, 2)} mL = <strong>${fmt(r.tc1, 3)}</strong> ×10⁶ cél<br>` +
      `TC₂ = ${fmt(b.xv, 3)} × ${fmt(b.vol_mL, 2)} mL = <strong>${fmt(r.tc2, 3)}</strong> ×10⁶ cél<br>` +
      `ITVC = ((${fmt(r.tc1, 3)} + ${fmt(r.tc2, 3)}) / 2) × ${fmt(r.dtD, 2)} = <strong>${fmt(r.itvc, 3)}</strong>`;
  }

  // Rates explain
  if (isBatchLike) {
    el('fedFQExplain').innerHTML =
      `qGlc = (${fmt(a.glc_mM, 3)} − ${fmt(b.glc_mM, 3)}) / ${fmt(r.ivcd, 3)} = <strong>${fmt(r.qGlc, 3)}</strong><br>` +
      `qLac = (${fmt(b.lac_mM, 3)} − ${fmt(a.lac_mM, 3)}) / ${fmt(r.ivcd, 3)} = <strong>${fmt(r.qLac, 3)}</strong><br>` +
      `qP   = (${fmt(b.product_mgL, 3)} − ${fmt(a.product_mgL, 3)}) / ${fmt(r.ivcd, 3)} = <strong>${fmt(r.qP, 3)}</strong>`;
  } else {
    el('fedFQExplain').innerHTML =
      `ΔMGlc = (${fmt(r.glcM1, 3)} − ${fmt(r.glcM2, 3)}) mmol → qGlc = <strong>${fmt(r.qGlc, 3)}</strong><br>` +
      `ΔMLac = (${fmt(r.lacM2, 3)} − ${fmt(r.lacM1, 3)}) mmol → qLac = <strong>${fmt(r.qLac, 3)}</strong><br>` +
      `ΔMP   = (${fmt(r.pM2, 3)} − ${fmt(r.pM1, 3)}) mg → qP = <strong>${fmt(r.qP, 3)}</strong>`;
  }

  // Combined reading (card 4) — LaTeX equations
  const explainEl = el('fedExplain');
  if (window.MathJax) MathJax.typesetClear([explainEl]);
  const uCell = currentLang === 'es' ? '\\text{cél}' : '\\text{cells}';
  const uCellD = currentLang === 'es' ? '\\text{cél·d/mL}' : '\\text{cells·day/mL}';
  const uTotalD = currentLang === 'es' ? '\\times\\!10^6\\,\\text{cél·d}' : '\\times\\!10^6\\,\\text{cells·day}';
  let eqs;
  if (isBatchLike) {
    eqs = [
      `$$\\mu = \\frac{\\ln\\!\\left(\\dfrac{${fmt(b.xv, 3)}}{${fmt(a.xv, 3)}}\\right)}{${fmt(r.dtH, 2)}\\,\\text{h}} = \\mathbf{${fmt(r.mu, 4)}\\,\\text{h}^{-1}}$$`,
      `$$IVCD = ${fmt(r.ivcd, 3)}\\;\\times\\!10^6\\,${uCellD}$$`,
      `$$q_{Glc} = \\frac{${fmt(a.glc_mM, 3)} - ${fmt(b.glc_mM, 3)}}{${fmt(r.ivcd, 3)}} = \\mathbf{${fmt(r.qGlc, 3)}}$$`,
      `$$q_{Lac} = \\frac{${fmt(b.lac_mM, 3)} - ${fmt(a.lac_mM, 3)}}{${fmt(r.ivcd, 3)}} = \\mathbf{${fmt(r.qLac, 3)}}$$`,
      `$$q_P = \\frac{${fmt(b.product_mgL, 3)} - ${fmt(a.product_mgL, 3)}}{${fmt(r.ivcd, 3)}} = \\mathbf{${fmt(r.qP, 3)}}$$`
    ];
  } else {
    eqs = [
      `$$\\mu = \\frac{\\ln\\!\\left(\\dfrac{${fmt(b.xv, 3)}}{${fmt(a.xv, 3)}}\\right)}{${fmt(r.dtH, 2)}\\,\\text{h}} = \\mathbf{${fmt(r.mu, 4)}\\,\\text{h}^{-1}}$$`,
      `$$TC_1 = ${fmt(a.xv, 3)} \\times ${fmt(a.vol_mL, 2)}\\,\\text{mL} = ${fmt(r.tc1, 3)}\\;\\times\\!10^6\\,${uCell}$$`,
      `$$TC_2 = ${fmt(b.xv, 3)} \\times ${fmt(b.vol_mL, 2)}\\,\\text{mL} = ${fmt(r.tc2, 3)}\\;\\times\\!10^6\\,${uCell}$$`,
      `$$ITVC = \\frac{${fmt(r.tc1, 3)} + ${fmt(r.tc2, 3)}}{2} \\times ${fmt(r.dtD, 2)}\\,\\text{d} = ${fmt(r.itvc, 3)}\\;${uTotalD}$$`,
      `$$q_{Glc} = \\frac{${fmt(r.glcM1, 3)} - ${fmt(r.glcM2, 3)}}{${fmt(r.itvc, 3)}} \\times 1000 = \\mathbf{${fmt(r.qGlc, 3)}}$$`,
      `$$q_{Lac} = \\frac{${fmt(r.lacM2, 3)} - ${fmt(r.lacM1, 3)}}{${fmt(r.itvc, 3)}} \\times 1000 = \\mathbf{${fmt(r.qLac, 3)}}$$`,
      `$$q_P = \\frac{${fmt(r.pM2, 3)} - ${fmt(r.pM1, 3)}}{${fmt(r.itvc, 3)}} \\times 1000 = \\mathbf{${fmt(r.qP, 3)}}$$`
    ];
  }
  explainEl.innerHTML = eqs.map((eq) => `<div class="equation">${eq}</div>`).join('');
  if (window.MathJax && window.MathJax.typesetPromise) MathJax.typesetPromise([explainEl]);

  // Note
  if (r.hasSkip) {
    el('fedExplainNote').textContent = currentLang === 'es'
      ? '⚠ El intervalo cruza un evento de feed (FALSE → TRUE). Los resultados pueden no reflejar actividad celular pura.'
      : '⚠ Interval crosses a feed event (FALSE → TRUE). Results may not reflect pure cellular activity.';
  } else {
    el('fedExplainNote').textContent = isBatchLike
      ? (currentLang === 'es' ? 'Antes del primer feed: usar concentración + IVCD.' : 'Before first feed: use concentration + IVCD.')
      : (currentLang === 'es' ? 'Post-feed: usar masas totales e ITVC con el volumen medido.' : 'Post-feed: use total masses and ITVC with the measured volume.');
  }
}

function fedPlotShapes() {
  const feedDays = datasets.fed.filter((row) => row.isPostFeed).map((row) => row.day);
  const shapes = feedDays.map((day) => ({
    type: 'line', x0: day, x1: day, y0: 0, y1: 1,
    xref: 'x', yref: 'paper',
    line: { color: '#FF9500', width: 1.5, dash: 'dot' }
  }));
  const desc = activeFedDescriptor();
  if (desc) {
    shapes.push({
      type: 'rect',
      x0: desc.start.day, x1: desc.end.day,
      y0: 0, y1: 1,
      xref: 'x', yref: 'paper',
      fillcolor: 'rgba(88,86,214,0.10)',
      line: { color: '#5856D6', width: 1.5, dash: 'dash' },
      layer: 'below'
    });
  }
  return shapes;
}

function drawFedPlots() {
  const data = datasets.fed;
  const feedShapes = fedPlotShapes();

  Plotly.newPlot('fedGrowthPlot', [
    { x: data.filter((row) => !row.isPostFeed).map((row) => row.day), y: data.filter((row) => !row.isPostFeed).map((row) => row.xv), type: 'scatter', mode: 'lines+markers', name: currentLang === 'es' ? 'Muestreo regular' : 'Regular sample', line: { color: '#34C759', width: 3 }, marker: { size: 8, color: '#1A8A3A' } },
    { x: data.filter((row) => row.isPostFeed).map((row) => row.day), y: data.filter((row) => row.isPostFeed).map((row) => row.xv), type: 'scatter', mode: 'markers', name: currentLang === 'es' ? 'Post-feed' : 'Post-feed', marker: { size: 10, color: '#FF9500', symbol: 'diamond' } }
  ], {
    margin: { l: 65, r: 20, t: 10, b: 55 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(242,242,247,0.6)',
    hovermode: 'x unified',
    legend: { orientation: 'h', y: 1.14, x: 0 },
    xaxis: { title: t('plotXTitle'), gridcolor: 'rgba(60,60,67,0.1)' },
    yaxis: { title: t('plotYGrowth'), rangemode: 'tozero', gridcolor: 'rgba(60,60,67,0.1)' },
    shapes: feedShapes
  }, { responsive: true, displaylogo: false });

  Plotly.newPlot('fedMetPlot', [
    { x: data.map((row) => row.day), y: data.map((row) => row.glc_mM), type: 'scatter', mode: 'lines+markers', connectgaps: false, name: t('traceGlc'), line: { color: '#FF9500', width: 3 }, marker: { size: 8, color: '#C75300' } },
    { x: data.map((row) => row.day), y: data.map((row) => row.lac_mM), type: 'scatter', mode: 'lines+markers', connectgaps: false, name: t('traceLac'), line: { color: '#5AC8FA', width: 3 }, marker: { size: 8, color: '#0062CC' } },
    { x: data.map((row) => row.day), y: data.map((row) => row.product_mgL), type: 'scatter', mode: 'lines+markers', connectgaps: false, name: t('traceProd'), yaxis: 'y2', line: { color: '#FF3B30', width: 3 }, marker: { size: 8, color: '#C0003C' } }
  ], {
    margin: { l: 65, r: 70, t: 10, b: 55 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(242,242,247,0.6)',
    hovermode: 'x unified',
    legend: { orientation: 'h', y: 1.14, x: 0 },
    xaxis: { title: t('plotXTitle'), gridcolor: 'rgba(60,60,67,0.1)' },
    yaxis: { title: t('plotYSubs'), rangemode: 'tozero', gridcolor: 'rgba(60,60,67,0.1)' },
    yaxis2: { title: t('plotYProd'), overlaying: 'y', side: 'right', rangemode: 'tozero', showgrid: false },
    shapes: feedShapes
  }, { responsive: true, displaylogo: false });
}

function fillFedAuditTable() {
  el('fedTableBody').innerHTML = fedAuditRows.map((row) => {
    const status = row.status === 'skip'
      ? (currentLang === 'es' ? 'Excluir' : 'Exclude')
      : (currentLang === 'es' ? 'Usar' : 'Use');
    const method = row.method === 'batch'
      ? (currentLang === 'es' ? 'Concentración + IVCD' : 'Concentration + IVCD')
      : row.method === 'fed_mass'
        ? (currentLang === 'es' ? 'Masas + ITVC' : 'Masses + ITVC')
        : (currentLang === 'es' ? 'Evento de feed' : 'Feed event');
    return `
      <tr>
        <td>${fmt(row.start.day, 1)}–${fmt(row.end.day, 1)}</td>
        <td>${status}</td>
        <td>${method}</td>
        <td class="mono">${fmt(row.mu, 4)}</td>
        <td>${row.note}</td>
      </tr>
    `;
  }).join('');
}

function renderCompareSection() {
  const data = datasets.batch;
  const r = activeBatchInterval();
  const diffPct = r.ivcdLog ? ((r.ivcd - r.ivcdLog) / r.ivcdLog) * 100 : null;
  const ivcdU = currentLang === 'es' ? '×10⁶ cél·d/mL' : '×10⁶ cells·day/mL';
  const cellU = currentLang === 'es' ? '×10⁶ cél/mL'   : '×10⁶ cells/mL';

  // Metrics
  el('trapIvcdOut').textContent = `${fmt(r.ivcd, 3)} ${ivcdU}`;
  el('logIvcdOut').textContent  = `${fmt(r.ivcdLog, 3)} ${ivcdU}`;
  el('logMeanOut').textContent  = `${fmt(r.logMean, 3)} ${cellU}`;
  el('ivcdDiffOut').textContent = diffPct === null ? t('noData') : `${fmt(diffPct, 2)} %`;
  el('logIvcdCompare').textContent = currentLang === 'es'
    ? `La diferencia relativa entre los dos métodos en el intervalo activo es ${fmt(Math.abs(diffPct), 2)} %.`
    : `The relative difference between both methods in the active interval is ${fmt(Math.abs(diffPct), 2)} %.`;

  // Accumulated IVCD (trapezoidal and logarithmic) over the full batch dataset
  const accTrap = [0];
  const accLog  = [0];
  for (let i = 0; i < data.length - 1; i++) {
    const dt = data[i + 1].day - data[i].day;
    accTrap.push(accTrap[i] + ((data[i].xv + data[i + 1].xv) / 2) * dt);
    const lm = calcLogMean(data[i].xv, data[i + 1].xv);
    accLog.push(accLog[i] + (lm !== null ? lm * dt : ((data[i].xv + data[i + 1].xv) / 2) * dt));
  }

  const yAxisTitle = currentLang === 'es' ? 'IVCD acumulada (×10⁶ cél·d/mL)' : 'Accumulated IVCD (×10⁶ cells·day/mL)';
  Plotly.newPlot('comparePlot', [
    { x: data.map((d) => d.day), y: data.map((d) => d.xv),
      type: 'scatter', mode: 'lines+markers', name: 'Xv',
      line: { color: '#34C759', width: 2.5 }, marker: { size: 7, color: '#1A8A3A' } },
    { x: data.map((d) => d.day), y: accTrap,
      type: 'scatter', mode: 'lines+markers',
      name: currentLang === 'es' ? 'IVCD trapezoidal' : 'Trapezoidal IVCD',
      yaxis: 'y2',
      line: { color: '#1A8A3A', width: 2.5, dash: 'dot' }, marker: { size: 6, color: '#1A8A3A' } },
    { x: data.map((d) => d.day), y: accLog,
      type: 'scatter', mode: 'lines+markers',
      name: currentLang === 'es' ? 'IVCD logarítmica' : 'Logarithmic IVCD',
      yaxis: 'y2',
      line: { color: '#0062CC', width: 2.5 }, marker: { size: 6, color: '#0062CC' } }
  ], {
    margin: { l: 65, r: 85, t: 10, b: 55 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(242,242,247,0.6)',
    hovermode: 'x unified',
    legend: { orientation: 'h', y: 1.14, x: 0 },
    xaxis: { title: t('plotXTitle'), gridcolor: 'rgba(60,60,67,0.1)' },
    yaxis: { title: t('plotYGrowth'), rangemode: 'tozero', gridcolor: 'rgba(60,60,67,0.1)' },
    yaxis2: { title: yAxisTitle, overlaying: 'y', side: 'right', rangemode: 'tozero', showgrid: false },
    shapes: [{ type: 'rect', x0: r.t1, x1: r.t2, y0: 0, y1: 1,
      xref: 'x', yref: 'paper',
      fillcolor: 'rgba(88,86,214,0.10)',
      line: { color: '#5856D6', width: 1.5, dash: 'dash' }, layer: 'below' }]
  }, { responsive: true, displaylogo: false });

  // Numerical substitution — both methods with actual values
  const explainEl = el('logIvcdExplain');
  const uCell  = currentLang === 'es' ? '\\text{cél/mL}'   : '\\text{cells/mL}';
  const uCellD = currentLang === 'es' ? '\\text{cél·d/mL}' : '\\text{cells·d/mL}';
  if (window.MathJax) MathJax.typesetClear([explainEl]);
  explainEl.innerHTML = [
    `<div class="equation">$$IVCD_{\\text{trap}}=\\sum_i\\frac{X_{v,i}+X_{v,i+1}}{2}\\,\\Delta t_i=\\mathbf{${fmt(r.ivcd,3)}}\\;\\times10^6\\;${uCellD}$$</div>`,
    `<div class="equation">$$L(X_1,X_2)=\\frac{${fmt(r.x2,3)}-${fmt(r.x1,3)}}{\\ln\\!\\left(\\dfrac{${fmt(r.x2,3)}}{${fmt(r.x1,3)}}\\right)}=${fmt(r.logMean,3)}\\;\\times10^6\\;${uCell}$$</div>`,
    `<div class="equation">$$IVCD_{\\log}=${fmt(r.logMean,3)}\\times${fmt(r.dtD,2)}\\;\\text{d}=\\mathbf{${fmt(r.ivcdLog,3)}}\\;\\times10^6\\;${uCellD}$$</div>`
  ].join('');
  if (window.MathJax && window.MathJax.typesetPromise) MathJax.typesetPromise([explainEl]);
}

const SECTION_IDS = { lote: 'seccion-lote', fed: 'seccion-fed', compare: 'seccion-compare' };
const NAV_IDS     = { lote: 'navBatch',     fed: 'navFed',     compare: 'navCompare'  };
let activeSection = 'lote';

function switchSection(name) {
  activeSection = name;
  Object.keys(SECTION_IDS).forEach((key) => {
    el(SECTION_IDS[key]).classList.toggle('is-active', key === name);
    el(NAV_IDS[key]).classList.toggle('active', key === name);
  });
  requestAnimationFrame(() => {
    if (name === 'lote') {
      Plotly.Plots.resize('growthPlotData');
      Plotly.Plots.resize('metPlotData');
    } else if (name === 'fed') {
      Plotly.Plots.resize('fedGrowthPlot');
      Plotly.Plots.resize('fedMetPlot');
    } else if (name === 'compare') {
      Plotly.Plots.resize('comparePlot');
    }
  });
}

function renderAll() {
  populateBatchControls();
  renderBatchMetrics();
  drawBatchPlots();
  fillBatchTable();
  populateFedControls();
  renderFedSection();
  drawFedPlots();
  fillFedAuditTable();
  renderCompareSection();
  if (window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise();
}

function applyTranslations() {
  document.documentElement.lang = currentLang;
  document.title = t('title');
  [
    'heroTitle','heroLead','navBatchLabel','navFedLabel','navCompareLabel','section1Chip','section1Title','section1Lead',
    'batchSelectorTitle','batchSelectorDesc','startRowLabel','endRowLabel','mLabelDt','mLabelMu','mLabelIvcd','mLabelQglc','mLabelQLac','mLabelQp',
    'intervalExampleNote','plot1Title','plot1Lead','plot2Title','plot2Lead','formulaMainTitle','formulaMainLead','formulaChip',
    'muTitle','muLead','ivcdTitle','ivcdLead','qglcTitle','qglcLead','yieldTitle','yieldLead','tableTitle','tableLead','csvBtn',
    'section2Chip','section2Title','section2Lead','fedSelectorTitle','fedSelectorLead','fedStartLabel','fedEndLabel','fedLabelDt','fedMetricMu','fedMetricIvcd','fedMetricItvc','fedMetricQglc','fedMetricQlac','fedMetricQp',
    'fedPlot1Title','fedPlot1Lead','fedPlot2Title','fedPlot2Lead','fedTableTitle','fedTableLead',
    'fedThInterval','fedThStatus','fedThMethod','fedThMu','fedThNote',
    'fedFormulaTitle','fedFormulaLead','fedFormulaChip',
    'fedFMuTitle','fedFMuLead','fedFNormTitle','fedFNormLead','fedFQTitle','fedFQLead',
    'fedExplainTitle','fedExplainLead',
    'section3Chip','section3Title','section3Lead','compareTitle','compareMetric1','compareMetric2','compareMetric3','compareMetric4',
    'logIvcdHowTitle','logIvcdHowCopy','logIvcdExplainTitle','logIvcdExplainLead','logIvcdPlotTitle','logIvcdPlotLead'
  ].forEach((id) => {
    const node = el(id);
    if (node) node.innerHTML = t(id);
  });
  el('langBtn').textContent = t('langBtn');
  el('dataLinearBtn').textContent = t('linearBtn');
  el('dataLogBtn').textContent = t('logBtn');
  el('thInterval').textContent = t('thInterval');
  el('thXv1').textContent = t('thXv1');
  el('thXv2').textContent = t('thXv2');
  el('thGlc1').textContent = t('thGlc1');
  el('thGlc2').textContent = t('thGlc2');
  el('thLac1').textContent = t('thLac1');
  el('thLac2').textContent = t('thLac2');
  el('thP1').textContent = t('thP1');
  el('thP2').textContent = t('thP2');
  el('thDt').textContent = t('thDt');
  el('thMu').textContent = t('thMu');
  el('thIvcd').textContent = t('thIvcd');
  el('thQglc').textContent = t('thQglc');
  el('thQlac').textContent = t('thQlac');
  el('thQp').textContent = t('thQp');
  el('thYx').textContent = t('thYx');
  el('thYp').textContent = t('thYp');
  const fedMeta = buildFedMetadata(datasets.fed);
  fedAuditRows = fedMeta.audit;
  if (fedEnd >= datasets.fed.length) fedEnd = Math.max(1, datasets.fed.length - 1);
  if (fedStart >= fedEnd) fedStart = fedEnd - 1;
  renderAll();
}

function downloadBatchCSV() {
  const rows = batchRows();
  const header = ['interval','Xv1','Xv2','Glc1_mM','Glc2_mM','Lac1_mM','Lac2_mM','P1_mgL','P2_mgL','dt_d','mu_h-1','IVCD_delta','qGlc','qLac','qP','Yx_Glc','Yp_Glc'];
  const body = rows.map((r) => [r.label, r.x1, r.x2, r.glc1, r.glc2, r.lac1, r.lac2, r.p1, r.p2, r.dtD, r.mu, r.ivcd, r.qGlc, r.qLac, r.qP, r.yxGlc, r.ypGlc]);
  const csv = [header, ...body].map((row) => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kinetic_drive_lote.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

window.setBatchRange = (idx) => {
  if (idx <= batchStart) {
    batchStart = idx;
    if (batchEnd <= batchStart) batchEnd = Math.min(batchStart + 1, datasets.batch.length - 1);
  } else {
    batchEnd = idx;
  }
  renderAll();
};

window.setBatchStart = (idx) => {
  batchStart = idx;
  if (batchEnd <= batchStart) batchEnd = Math.min(batchStart + 1, datasets.batch.length - 1);
  renderAll();
};

window.setBatchEnd = (idx) => {
  if (idx <= batchStart) return;
  batchEnd = idx;
  renderAll();
};

async function init() {
  datasets.batch = await loadDataset('./Datos_lote.csv');
  datasets.fed = await loadDataset('./Datos_lote_alimentado.csv');
  const fedMeta = buildFedMetadata(datasets.fed);
  fedAuditRows = fedMeta.audit;

  el('dataLinearBtn').addEventListener('click', () => {
    growthScale = 'linear';
    el('dataLinearBtn').classList.add('btn-scale-active');
    el('dataLogBtn').classList.remove('btn-scale-active');
    drawBatchPlots();
  });
  el('dataLogBtn').addEventListener('click', () => {
    growthScale = 'log';
    el('dataLogBtn').classList.add('btn-scale-active');
    el('dataLinearBtn').classList.remove('btn-scale-active');
    drawBatchPlots();
  });
  el('langBtn').addEventListener('click', () => {
    currentLang = currentLang === 'es' ? 'en' : 'es';
    applyTranslations();
  });
  el('csvBtn').addEventListener('click', downloadBatchCSV);
  function refreshFed() {
    populateFedControls();
    renderFedSection();
    const shapes = fedPlotShapes();
    Plotly.relayout('fedGrowthPlot', { shapes });
    Plotly.relayout('fedMetPlot', { shapes });
  }
  window.setFedStart = (idx) => {
    fedStart = idx;
    if (fedEnd <= fedStart) fedEnd = Math.min(fedStart + 1, datasets.fed.length - 1);
    refreshFed();
  };
  window.setFedEnd = (idx) => {
    if (idx <= fedStart) return;
    fedEnd = idx;
    refreshFed();
  };
  el('navBatch').addEventListener('click',   () => switchSection('lote'));
  el('navFed').addEventListener('click',     () => switchSection('fed'));
  el('navCompare').addEventListener('click', () => switchSection('compare'));

  applyTranslations();
}

init().catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;bottom:16px;left:16px;right:16px;padding:12px 14px;border-radius:14px;background:#fff3cd;color:#5c4400;border:1px solid #f3d57a;z-index:9999;">${currentLang === 'es' ? 'No se pudieron cargar los datasets CSV.' : 'The CSV datasets could not be loaded.'}</div>`);
});
