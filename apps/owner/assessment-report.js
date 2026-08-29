const reportRoot = document.querySelector("#reportRoot");
const printButton = document.querySelector("#printReportButton");
const closeButton = document.querySelector("#closeReportButton");

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const displayValue = (value) => value === "" || value === null || value === undefined ? "—" : String(value);
const sideLabel = (value) => ({ left: "좌", right: "우", bilateral: "양측", not_applicable: "해당 없음" })[value] || "—";
const visitLabel = (value) => ({ initial: "첫 방문", follow_up: "재방문", discharge: "마지막 방문" })[value] || "방문 평가";
const dateLabel = (value) => {
  const marker = new Date(`${value}T12:00:00+09:00`);
  return Number.isNaN(marker.getTime()) ? "—" : new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(marker);
};
const generatedLabel = (value) => {
  const marker = new Date(value);
  return Number.isNaN(marker.getTime()) ? "—" : new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(marker);
};

function scoreCell(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${value === null || value === undefined ? "—" : `${escapeHtml(value)}/10`}</strong></div>`;
}

function romRows(rows) {
  if (!rows.length) return '<tr><td class="empty-cell" colspan="7">기록된 ROM 측정값이 없습니다.</td></tr>';
  return rows.map((row) => `<tr><td>${escapeHtml(displayValue(row.joint))}</td><td>${escapeHtml(displayValue(row.movement))}</td><td>${escapeHtml(sideLabel(row.side))}</td><td class="numeric">${escapeHtml(displayValue(row.active))}${row.active === null || row.active === undefined ? "" : "°"}</td><td class="numeric">${escapeHtml(displayValue(row.passive))}${row.passive === null || row.passive === undefined ? "" : "°"}</td><td>${escapeHtml(displayValue(row.reference))}</td><td>${escapeHtml(displayValue(row.note))}</td></tr>`).join("");
}

function mmtRows(rows) {
  if (!rows.length) return '<tr><td class="empty-cell" colspan="4">기록된 MMT 측정값이 없습니다.</td></tr>';
  return rows.map((row) => `<tr><td>${escapeHtml(displayValue(row.movement))}</td><td>${escapeHtml(sideLabel(row.side))}</td><td class="numeric">${escapeHtml(displayValue(row.grade))}/5</td><td>${escapeHtml(displayValue(row.note))}</td></tr>`).join("");
}

function soapItem(letter, label, value) {
  return `<section class="soap-item"><header><b>${letter}</b><span>${escapeHtml(label)}</span></header><p>${escapeHtml(displayValue(value))}</p></section>`;
}

function renderReport(payload) {
  const center = payload.center || {};
  const client = payload.client || {};
  const assessment = payload.assessment || {};
  const scores = assessment.scores || {};
  const soap = assessment.soap || {};
  const vas = Number.isInteger(Number(scores.painVas)) ? Number(scores.painVas) : null;
  const reportCode = String(assessment.id || "").slice(0, 8).toUpperCase() || "DAIL";
  document.title = `DAIL 기능평가지 - ${client.name || "이용자"} - ${assessment.assessed_on || ""}`;
  reportRoot.innerHTML = `
    <header class="report-header">
      <div><div class="brand-line"><img src="/assets/dail-logo-primary.png?v=20260812-logo-alpha" alt="" /><b>DAIL</b></div><h1>기능평가 기록지</h1><p>VAS · Range of Motion · Manual Muscle Test · SOAP Note</p></div>
      <div class="report-code"><span>ASSESSMENT ID</span><strong>${escapeHtml(reportCode)}</strong></div>
    </header>
    <dl class="report-meta">
      <div><dt>이용자</dt><dd>${escapeHtml(displayValue(client.name))}</dd></div>
      <div><dt>연락처</dt><dd>${escapeHtml(displayValue(client.phone))}</dd></div>
      <div><dt>평가일</dt><dd>${escapeHtml(dateLabel(assessment.assessed_on))}</dd></div>
      <div><dt>방문 구분</dt><dd>${escapeHtml(visitLabel(assessment.visit_kind))}</dd></div>
      <div class="wide"><dt>센터</dt><dd>${escapeHtml(displayValue(center.name))}</dd></div>
      <div><dt>담당자</dt><dd>${escapeHtml(displayValue(center.manager))}</dd></div>
      <div><dt>센터 연락처</dt><dd>${escapeHtml(displayValue(center.phone))}</dd></div>
    </dl>
    <section class="report-section">
      <div class="report-section-head"><div><span>01</span><h2>통증 및 기능 지표</h2></div><p>0–10점 방문별 기록</p></div>
      <div class="score-board"><div class="vas-score"><div><span>통증 정도 · VAS</span><strong>${vas === null ? "—" : `${vas}/10`}</strong><small>0 통증 없음 · 10 매우 심함</small></div><div class="vas-track"><i style="--vas-position:${vas === null ? 0 : vas * 10}%"></i><div><span>0</span><span>10</span></div></div></div><div class="dail-scores">${scoreCell("일상 기능", scores.dailyFunction)}${scoreCell("움직임 자신감", scores.movementConfidence)}${scoreCell("균형 자신감", scores.balanceConfidence)}</div></div>
    </section>
    <section class="report-section">
      <div class="report-section-head"><div><span>02</span><h2>관절가동범위 · ROM</h2></div><p>단위 °</p></div>
      <table class="measurement-table"><colgroup><col style="width:14%" /><col style="width:14%" /><col style="width:9%" /><col style="width:9%" /><col style="width:9%" /><col style="width:12%" /><col /></colgroup><thead><tr><th>관절·부위</th><th>동작</th><th>좌우</th><th>AROM</th><th>PROM</th><th>참고</th><th>비고</th></tr></thead><tbody>${romRows(Array.isArray(assessment.rom) ? assessment.rom : [])}</tbody></table>
    </section>
    <section class="report-section">
      <div class="report-section-head"><div><span>03</span><h2>도수근력검사 · MMT</h2></div><p>0–5등급</p></div>
      <table class="measurement-table"><colgroup><col style="width:32%" /><col style="width:14%" /><col style="width:12%" /><col /></colgroup><thead><tr><th>근육·동작</th><th>좌우</th><th>등급</th><th>비고</th></tr></thead><tbody>${mmtRows(Array.isArray(assessment.mmt) ? assessment.mmt : [])}</tbody></table>
    </section>
    <section class="report-section">
      <div class="report-section-head"><div><span>04</span><h2>SOAP Note</h2></div><p>Subjective · Objective · Assessment · Plan</p></div>
      <div class="soap-grid">${soapItem("S", "주관적 정보", soap.subjective)}${soapItem("O", "객관적 정보", soap.objective)}${soapItem("A", "평가", soap.assessment)}${soapItem("P", "계획", soap.plan)}</div>
    </section>
    <p class="report-notice"><b>안내:</b> 이 문서는 센터의 운동·기능평가 내용을 이용자와 공유하기 위한 기록지이며 의료기관의 진단서, 의무기록 또는 치료 결과를 의미하지 않습니다. 개인정보가 포함되어 있으므로 본인 동의 없이 제3자에게 전달하지 마세요.</p>
    <footer class="report-footer"><span>${escapeHtml(displayValue(center.name))} · ${escapeHtml(displayValue(center.address))}<br />출력 ${escapeHtml(generatedLabel(payload.generatedAt))}</span><div class="footer-brand"><img src="/assets/dail-logo-primary.png?v=20260812-logo-alpha" alt="" /><b>DAIL</b></div></footer>`;
  document.documentElement.dataset.reportReady = "true";
}

function loadPayload() {
  const token = new URLSearchParams(location.search).get("print") || "";
  if (!/^[a-zA-Z0-9-]{10,80}$/.test(token)) throw new Error("인쇄 정보를 찾을 수 없습니다.");
  const storageKey = `dail_assessment_print:${token}`;
  const raw = sessionStorage.getItem(storageKey);
  sessionStorage.removeItem(storageKey);
  if (!raw) throw new Error("인쇄 정보가 만료되었습니다. 센터장 페이지에서 PDF·인쇄를 다시 눌러 주세요.");
  const payload = JSON.parse(raw);
  if (!payload || payload.version !== "dail_function_soap_v1" || !payload.assessment) throw new Error("평가 정보 형식을 확인할 수 없습니다.");
  return payload;
}

printButton.addEventListener("click", () => window.print());
closeButton.addEventListener("click", () => window.close());

try {
  const payload = loadPayload();
  try { window.opener = null; } catch {}
  renderReport(payload);
  Promise.resolve(document.fonts?.ready).finally(() => window.setTimeout(() => window.print(), 450));
} catch (error) {
  reportRoot.innerHTML = `<div class="report-error">${escapeHtml(error.message || "평가 정보를 불러오지 못했습니다.")}</div>`;
  printButton.disabled = true;
}
