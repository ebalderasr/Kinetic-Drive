'use strict';

const MW_GLC = 180.16;
const MW_LAC = 90.08;

let currentLang = 'es';
let growthScale = 'linear';
let batchStart = 0;
let batchEnd = 1;
let fedActiveInterval = 0;
let compareSource = 'batch';

const datasets = {
  batch: [],
  fed: []
};

let fedIntervals = [];
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

function activeFedDescriptor() {
  return fedIntervals[fedActiveInterval];
}

function activeFedIntervalData() {
  const desc = activeFedDescriptor();
  if (!desc) return null;
  const a = desc.start;
  const b = desc.end;
  const dtD = b.day - a.day;
  const dtH = dtD * 24;
  const ivcd = ((a.xv + b.xv) / 2) * dtD;
  const tc1 = a.totalCells_1e6;
  const tc2 = b.totalCells_1e6;
  const itvc = Number.isFinite(tc1) && Number.isFinite(tc2) ? ((tc1 + tc2) / 2) * dtD : null;
  const glcMass1 = totalMmol(a.glc_mM, a.vol_mL);
  const glcMass2 = totalMmol(b.glc_mM, b.vol_mL);
  const lacMass1 = totalMmol(a.lac_mM, a.vol_mL);
  const lacMass2 = totalMmol(b.lac_mM, b.vol_mL);
  const pMass1 = totalMg(a.product_mgL, a.vol_mL);
  const pMass2 = totalMg(b.product_mgL, b.vol_mL);
  const logMean = calcLogMean(a.xv, b.xv);
  return {
    ...desc,
    dtD,
    dtH,
    ivcd,
    tc1,
    tc2,
    itvc,
    glcMass1,
    glcMass2,
    lacMass1,
    lacMass2,
    pMass1,
    pMass2,
    logMean,
    ivcdLog: logMean !== null ? logMean * dtD : null,
    qGlc: desc.method === 'batch'
      ? diffIfBoth(a.glc_mM, b.glc_mM, (v1, v2) => (v1 - v2) / ivcd)
      : diffIfBoth(glcMass1, glcMass2, (m1, m2) => itvc ? ((m1 - m2) / itvc) * 1000 : null),
    qLac: desc.method === 'batch'
      ? diffIfBoth(a.lac_mM, b.lac_mM, (v1, v2) => (v2 - v1) / ivcd)
      : diffIfBoth(lacMass1, lacMass2, (m1, m2) => itvc ? ((m2 - m1) / itvc) * 1000 : null),
    qP: desc.method === 'batch'
      ? diffIfBoth(a.product_mgL, b.product_mgL, (v1, v2) => (v2 - v1) / ivcd)
      : diffIfBoth(pMass1, pMass2, (m1, m2) => itvc ? ((m2 - m1) / itvc) * 1000 : null)
  };
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
  el('fedBtnRow').innerHTML = fedIntervals.map((interval, idx) => {
    const isActive = idx === fedActiveInterval;
    const methodTag = interval.method === 'batch'
      ? (currentLang === 'es' ? 'pre-feed' : 'pre-feed')
      : (currentLang === 'es' ? 'post-feed' : 'post-feed');
    const sty = isActive
      ? 'background:#0062CC;color:white;border:1px solid #0062CC;box-shadow:0 3px 10px rgba(0,98,204,0.35);'
      : 'background:rgba(255,255,255,0.85);color:rgba(0,0,0,0.7);border:1px solid rgba(0,0,0,0.1);';
    return `<button onclick="window.setFedInterval(${idx})" style="padding:7px 14px;border-radius:9999px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.18s;${sty}">${t('dayLabel')} ${interval.label} <span style="font-size:11px;opacity:0.7;">(${methodTag})</span></button>`;
  }).join('');
}

function renderFedSection() {
  const r = activeFedIntervalData();
  if (!r) return;
  const isBatchLike = r.method === 'batch';
  const methodLabel = isBatchLike
    ? (currentLang === 'es' ? 'Concentración + IVCD' : 'Concentration + IVCD')
    : (currentLang === 'es' ? 'Masas totales + ITVC' : 'Total masses + ITVC');
  const normLabel = isBatchLike
    ? `${currentLang === 'es' ? 'IVCD' : 'IVCD'} = ${fmt(r.ivcd, 3)}`
    : `${currentLang === 'es' ? 'ITVC' : 'ITVC'} = ${fmt(r.itvc, 3)} ×10⁶ ${currentLang === 'es' ? 'cél·d' : 'cells·day'}`;
  el('fedModeOut').textContent = methodLabel;
  el('fedMuOut').innerHTML = `${fmt(r.mu, 4)} h⁻¹<br><span style="font-size:0.82em;opacity:0.6;">${fmt(r.mu * 24, 3)} d⁻¹</span>`;
  el('fedNormOut').textContent = normLabel;
  el('fedQGlcOut').textContent = `${fmt(r.qGlc, 3)} pmol/cel/d`;
  el('fedQLacOut').textContent = `${fmt(r.qLac, 3)} pmol/cel/d`;
  el('fedQPOut').textContent = `${fmt(r.qP, 3)} pg/cel/d`;

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
      `ΔMGlc = (${fmt(r.glcMass1, 3)} − ${fmt(r.glcMass2, 3)}) mmol → qGlc = <strong>${fmt(r.qGlc, 3)}</strong><br>` +
      `ΔMLac = (${fmt(r.lacMass2, 3)} − ${fmt(r.lacMass1, 3)}) mmol → qLac = <strong>${fmt(r.qLac, 3)}</strong><br>` +
      `ΔMP   = (${fmt(r.pMass2, 3)} − ${fmt(r.pMass1, 3)}) mg → qP = <strong>${fmt(r.qP, 3)}</strong>`;
  }

  // Combined reading (card 4)
  el('fedExplain').innerHTML = isBatchLike
    ? `μ = [ln(${fmt(b.xv, 3)}) − ln(${fmt(a.xv, 3)})] / ${fmt(r.dtH, 2)} h = <strong>${fmt(r.mu, 4)} h⁻¹</strong><br>IVCD = ((${fmt(a.xv, 3)} + ${fmt(b.xv, 3)}) / 2) × ${fmt(r.dtD, 2)} d = <strong>${fmt(r.ivcd, 3)}</strong><br>qGlc = (${fmt(a.glc_mM, 3)} − ${fmt(b.glc_mM, 3)}) / ${fmt(r.ivcd, 3)} = <strong>${fmt(r.qGlc, 3)}</strong>`
    : `μ = [ln(${fmt(b.xv, 3)}) − ln(${fmt(a.xv, 3)})] / ${fmt(r.dtH, 2)} h = <strong>${fmt(r.mu, 4)} h⁻¹</strong><br>TC = Xv·V: (${fmt(a.xv, 3)}×${fmt(a.vol_mL, 2)}) y (${fmt(b.xv, 3)}×${fmt(b.vol_mL, 2)}) = <strong>${fmt(r.tc1, 3)}</strong>, <strong>${fmt(r.tc2, 3)}</strong><br>ITVC = ((${fmt(r.tc1, 3)} + ${fmt(r.tc2, 3)}) / 2) × ${fmt(r.dtD, 2)} = <strong>${fmt(r.itvc, 3)}</strong><br>qGlc = (M1 − M2) / ITVC = <strong>${fmt(r.qGlc, 3)}</strong>`;

  el('fedExplainNote').textContent = r.note;
}

function drawFedPlots() {
  const data = datasets.fed;
  const feedDays = data.filter((row) => row.isPostFeed).map((row) => row.day);
  const feedShapes = feedDays.map((day) => ({
    type: 'line',
    x0: day,
    x1: day,
    y0: 0,
    y1: 1,
    xref: 'x',
    yref: 'paper',
    line: { color: '#FF9500', width: 1.5, dash: 'dot' }
  }));

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

function currentCompareInterval() {
  if (compareSource === 'batch') {
    const r = activeBatchInterval();
    return { ...r, sourceNote: currentLang === 'es' ? 'Usando el intervalo activo de lote.' : 'Using the active batch interval.' };
  }
  const r = activeFedIntervalData();
  return {
    ...r,
    sourceNote: r.method === 'batch'
      ? (currentLang === 'es' ? 'Usando un intervalo pre-feed de lote alimentado, todavía interpretable con IVCD.' : 'Using a pre-feed fed-batch interval, still interpretable with IVCD.')
      : (currentLang === 'es' ? 'Usando un intervalo post-feed: el balance metabólico ya se puede cerrar con masas e ITVC, pero aquí la comparación sigue enfocada en la integración de Xv.' : 'Using a post-feed interval: the metabolic balance can now be closed with masses and ITVC, but this comparison still focuses on integrating Xv.')
  };
}

function renderCompareSection() {
  const r = currentCompareInterval();
  const diffPct = r.ivcdLog ? ((r.ivcd - r.ivcdLog) / r.ivcdLog) * 100 : null;
  el('trapIvcdOut').textContent = `${fmt(r.ivcd, 3)} ×10⁶ ${currentLang === 'es' ? 'cél·d/mL' : 'cells·day/mL'}`;
  el('logIvcdOut').textContent = `${fmt(r.ivcdLog, 3)} ×10⁶ ${currentLang === 'es' ? 'cél·d/mL' : 'cells·day/mL'}`;
  el('logMeanOut').textContent = `${fmt(r.logMean, 3)} ×10⁶ ${currentLang === 'es' ? 'cél/mL' : 'cells/mL'}`;
  el('ivcdDiffOut').textContent = diffPct === null ? t('noData') : `${fmt(diffPct, 2)} %`;
  const explainEl = el('logIvcdExplain');
  const uCell  = currentLang === 'es' ? '\\text{cél/mL}'     : '\\text{cells/mL}';
  const uCellD = currentLang === 'es' ? '\\text{cél·d/mL}'   : '\\text{cells·d/mL}';
  if (window.MathJax) MathJax.typesetClear([explainEl]);
  explainEl.innerHTML =
    `<div class="equation">$$L(X_0,\\,X_1)=\\frac{${fmt(r.x2,3)}-${fmt(r.x1,3)}}{\\ln\\!\\left(\\dfrac{${fmt(r.x2,3)}}{${fmt(r.x1,3)}}\\right)}=${fmt(r.logMean,3)}\\;\\times10^6\\;${uCell}$$</div>` +
    `<div class="equation">$$IVCD_{\\log}=${fmt(r.logMean,3)}\\times${fmt(r.dtD,2)}\\;\\text{d}=\\mathbf{${fmt(r.ivcdLog,3)}}\\;\\times10^6\\;${uCellD}$$</div>` +
    `<div class="equation">$$IVCD_{\\text{trap}}=\\mathbf{${fmt(r.ivcd,3)}}\\;\\times10^6\\;${uCellD}$$</div>`;
  if (window.MathJax && window.MathJax.typesetPromise) MathJax.typesetPromise([explainEl]);
  el('logIvcdCompare').textContent = `${r.sourceNote} ${currentLang === 'es' ? 'La diferencia relativa entre ambos métodos es' : 'The relative difference between both methods is'} ${fmt(Math.abs(diffPct), 2)} %.`;

  const samples = 60;
  const xs = [];
  const expYs = [];
  const linYs = [];
  const lnRatio = Math.log(r.x2 / r.x1);
  for (let i = 0; i <= samples; i++) {
    const f = i / samples;
    const day = r.t1 + (r.dtD * f);
    xs.push(day);
    expYs.push(r.x1 * Math.exp(lnRatio * f));
    linYs.push(r.x1 + ((r.x2 - r.x1) * f));
  }

  Plotly.newPlot('comparePlot', [
    { x: xs, y: expYs, type: 'scatter', mode: 'lines', name: currentLang === 'es' ? 'Exponencial exacta' : 'Exact exponential', line: { color: '#0062CC', width: 3 }, fill: 'tozeroy', fillcolor: 'rgba(0,98,204,0.12)' },
    { x: xs, y: linYs, type: 'scatter', mode: 'lines', name: currentLang === 'es' ? 'Interpolación lineal' : 'Linear interpolation', line: { color: '#1A8A3A', width: 3, dash: 'dash' } },
    { x: [r.t1, r.t2], y: [r.x1, r.x2], type: 'scatter', mode: 'markers', name: currentLang === 'es' ? 'Datos medidos' : 'Measured data', marker: { color: '#3634A3', size: 9 } }
  ], {
    margin: { l: 68, r: 24, t: 10, b: 55 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(242,242,247,0.6)',
    hovermode: 'x unified',
    legend: { orientation: 'h', y: 1.14, x: 0 },
    xaxis: { title: t('plotXTitle'), gridcolor: 'rgba(60,60,67,0.1)' },
    yaxis: { title: t('plotYGrowth'), rangemode: 'tozero', gridcolor: 'rgba(60,60,67,0.1)' }
  }, { responsive: true, displaylogo: false });

  el('compareBatchBtn').classList.toggle('btn-scale-active', compareSource === 'batch');
  el('compareFedBtn').classList.toggle('btn-scale-active', compareSource === 'fed');
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
    'section2Chip','section2Title','section2Lead','fedSelectorTitle','fedSelectorLead','fedSelectorLabel','fedMetricMode','fedMetricMu','fedMetricNorm','fedMetricQglc','fedMetricQlac','fedMetricQp',
    'fedPlot1Title','fedPlot1Lead','fedPlot2Title','fedPlot2Lead','fedTableTitle','fedTableLead',
    'fedThInterval','fedThStatus','fedThMethod','fedThMu','fedThNote',
    'fedFormulaTitle','fedFormulaLead','fedFormulaChip',
    'fedFMuTitle','fedFMuLead','fedFNormTitle','fedFNormLead','fedFQTitle','fedFQLead',
    'fedExplainTitle','fedExplainLead',
    'section3Chip','section3Title','section3Lead','compareTitle','compareLead','compareMetric1','compareMetric2','compareMetric3','compareMetric4',
    'logIvcdHowTitle','logIvcdHowCopy','logIvcdExplainTitle','logIvcdExplainLead','logIvcdPlotTitle','logIvcdPlotLead',
    'compareBatchBtn','compareFedBtn'
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
  fedIntervals = fedMeta.validIntervals;
  fedAuditRows = fedMeta.audit;
  if (fedActiveInterval >= fedIntervals.length) fedActiveInterval = 0;
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
  fedIntervals = fedMeta.validIntervals;
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
  window.setFedInterval = (idx) => {
    fedActiveInterval = idx;
    populateFedControls();
    renderFedSection();
    renderCompareSection();
  };
  el('compareBatchBtn').addEventListener('click', () => {
    compareSource = 'batch';
    renderCompareSection();
  });
  el('compareFedBtn').addEventListener('click', () => {
    compareSource = 'fed';
    renderCompareSection();
  });

  el('navBatch').addEventListener('click',   () => switchSection('lote'));
  el('navFed').addEventListener('click',     () => switchSection('fed'));
  el('navCompare').addEventListener('click', () => switchSection('compare'));

  applyTranslations();
}

init().catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;bottom:16px;left:16px;right:16px;padding:12px 14px;border-radius:14px;background:#fff3cd;color:#5c4400;border:1px solid #f3d57a;z-index:9999;">${currentLang === 'es' ? 'No se pudieron cargar los datasets CSV.' : 'The CSV datasets could not be loaded.'}</div>`);
});
