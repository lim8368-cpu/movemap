const reportRoot = document.querySelector("#reportRoot");
const printButton = document.querySelector("#printReportButton");
const closeButton = document.querySelector("#closeReportButton");
const TOTAL_PAGES = 3;

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const displayValue = (value) => value === "" || value === null || value === undefined ? "—" : String(value);
const sideLabel = (value) => ({ left: "좌", right: "우", bilateral: "양측", not_applicable: "해당 없음" })[value] || "—";
const visitLabel = (value) => ({ initial: "첫 평가", follow_up: "중간 평가", discharge: "종료 평가" })[value] || "방문 평가";
const referralLabel = (value) => ({ none: "별도 안내 없음", monitor: "변화 관찰", recommended: "전문 의료기관 상담 안내" })[value] || "별도 안내 없음";
const dateLabel = (value) => {
  if (!value) return "—";
  const marker = new Date(`${value}T12:00:00+09:00`);
  return Number.isNaN(marker.getTime()) ? "—" : new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(marker);
};
const generatedLabel = (value) => {
  const marker = new Date(value);
  return Number.isNaN(marker.getTime()) ? "—" : new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(marker);
};
const scoreValue = (value) => Number.isInteger(Number(value)) ? Number(value) : null;

function pageHeader(title, subtitle, reportCode, page) {
  return `<header class="report-header"><div><div class="brand-line"><img src="/assets/dail-logo-primary.png?v=20260812-logo-alpha" alt="" /><b>DAIL</b><span>FUNCTION ASSESSMENT</span></div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div><div class="report-code"><span>ASSESSMENT ID · ${escapeHtml(reportCode)}</span><strong>${page} / ${TOTAL_PAGES}</strong></div></header>`;
}

function pageFooter(center, payload, page) {
  return `<footer class="report-footer"><span>${escapeHtml(displayValue(center.name))} · ${escapeHtml(displayValue(center.address))}<br />출력 ${escapeHtml(generatedLabel(payload.generatedAt))} · ${page}/${TOTAL_PAGES}</span><div class="footer-brand"><img src="/assets/dail-logo-primary.png?v=20260812-logo-alpha" alt="" /><b>DAIL</b></div></footer>`;
}

function metaGrid(center, client, assessment) {
  const intake = assessment.intake || {};
  const evaluator = assessment.evaluator || {};
  return `<dl class="report-meta"><div><dt>이용자</dt><dd>${escapeHtml(displayValue(client.name))}</dd></div><div><dt>연락처</dt><dd>${escapeHtml(displayValue(client.phone))}</dd></div><div><dt>평가일</dt><dd>${escapeHtml(dateLabel(assessment.assessed_on))}</dd></div><div><dt>방문 구분</dt><dd>${escapeHtml(visitLabel(assessment.visit_kind))}</dd></div><div><dt>주요 평가 부위</dt><dd>${escapeHtml(displayValue(intake.primaryArea))}</dd></div><div><dt>불편 시작일</dt><dd>${escapeHtml(dateLabel(intake.onsetDate))}</dd></div><div class="wide"><dt>평가 담당자</dt><dd>${escapeHtml(displayValue(evaluator.name || center.manager))}${evaluator.credential ? ` · ${escapeHtml(evaluator.credential)}` : ""}</dd></div></dl>`;
}

function scoreChartRow(label, value, previousValue, direction = "higher") {
  const current = scoreValue(value);
  const previous = scoreValue(previousValue);
  const difference = previous === null || current === null ? null : current - previous;
  const improved = difference === null || difference === 0 ? null : direction === "lower" ? difference < 0 : difference > 0;
  const change = difference === null ? "첫 측정" : difference === 0 ? "변화 없음" : `${difference > 0 ? "+" : ""}${difference}`;
  const currentWidth = current === null ? 0 : Math.max(0, Math.min(100, current * 10));
  const previousWidth = previous === null ? 0 : Math.max(0, Math.min(100, previous * 10));
  return `<div class="score-chart-row"><strong>${escapeHtml(label)}</strong><div class="score-bars"><span><small>이전</small><i><b style="--bar-width:${previousWidth}%"></b></i><em>${previous ?? "—"}</em></span><span class="current"><small>현재</small><i><b style="--bar-width:${currentWidth}%"></b></i><em>${current ?? "—"}</em></span></div><u class="${improved === true ? "positive" : improved === false ? "caution" : ""}">${escapeHtml(change)}</u></div>`;
}

function soapRow(letter, label, value) {
  return `<tr><th><b>${letter}</b><span>${escapeHtml(label)}</span></th><td>${escapeHtml(displayValue(value))}</td></tr>`;
}

function romRows(rows) {
  if (!rows.length) return '<tr><td class="empty-cell" colspan="10">기록된 ROM 측정값이 없습니다.</td></tr>';
  return rows.map((row) => `<tr><td>${escapeHtml(displayValue(row.joint))}</td><td>${escapeHtml(displayValue(row.movement))}</td><td>${escapeHtml(sideLabel(row.side))}</td><td class="numeric">${escapeHtml(displayValue(row.active))}${row.active === null || row.active === undefined ? "" : "°"}</td><td class="numeric">${escapeHtml(displayValue(row.passive))}${row.passive === null || row.passive === undefined ? "" : "°"}</td><td>${escapeHtml(displayValue(row.reference))}</td><td>${escapeHtml(displayValue(row.endFeel))}</td><td class="numeric">${scoreValue(row.pain) === null ? "—" : `${scoreValue(row.pain)}/10`}</td><td colspan="2">${escapeHtml(displayValue(row.note))}</td></tr>`).join("");
}

function mmtRows(rows) {
  if (!rows.length) return '<tr><td class="empty-cell" colspan="5">기록된 MMT 측정값이 없습니다.</td></tr>';
  return rows.map((row) => `<tr><td>${escapeHtml(displayValue(row.movement))}</td><td>${escapeHtml(sideLabel(row.side))}</td><td class="numeric">${scoreValue(row.grade) === null ? "—" : `${scoreValue(row.grade)}/5`}</td><td class="numeric">${scoreValue(row.pain) === null ? "—" : `${scoreValue(row.pain)}/10`}</td><td>${escapeHtml(displayValue(row.note))}</td></tr>`).join("");
}

function functionalRows(rows) {
  if (!rows.length) return '<tr><td class="empty-cell" colspan="5">기록된 기능검사가 없습니다.</td></tr>';
  return rows.map((row) => `<tr><td>${escapeHtml(displayValue(row.name))}</td><td>${escapeHtml(displayValue(row.condition))}</td><td class="numeric">${escapeHtml(displayValue(row.result))}</td><td>${escapeHtml(displayValue(row.unit))}</td><td>${escapeHtml(displayValue(row.note))}</td></tr>`).join("");
}

function renderReport(payload) {
  const center = payload.center || {};
  const client = payload.client || {};
  const assessment = payload.assessment || {};
  const previous = payload.previousAssessment || {};
  const scores = assessment.scores || {};
  const previousScores = previous.scores || {};
  const intake = assessment.intake || {};
  const goals = assessment.goals || {};
  const evaluator = assessment.evaluator || {};
  const soap = assessment.soap || {};
  const reportCode = String(assessment.id || "").slice(0, 8).toUpperCase() || "DAIL";
  document.title = `DAIL 기능평가지 - ${client.name || "이용자"} - ${assessment.assessed_on || ""}`;

  const scoreRows = [
    scoreChartRow("현재 통증 · VAS", scores.painVas, previousScores.painVas, "lower"),
    scoreChartRow("안정 시 통증", scores.painAtRest, previousScores.painAtRest, "lower"),
    scoreChartRow("활동 시 통증", scores.painWithActivity, previousScores.painWithActivity, "lower"),
    scoreChartRow("최근 24시간 최고 통증", scores.painWorst24h, previousScores.painWorst24h, "lower"),
    scoreChartRow("일상 기능", scores.dailyFunction, previousScores.dailyFunction),
    scoreChartRow("움직임 자신감", scores.movementConfidence, previousScores.movementConfidence),
    scoreChartRow("균형 자신감", scores.balanceConfidence, previousScores.balanceConfidence),
  ].join("");

  reportRoot.innerHTML = `
    <article class="report-page report-summary-page">
      ${pageHeader("기능평가 결과 요약", "이전 평가와 현재 상태를 한눈에 비교합니다.", reportCode, 1)}
      ${metaGrid(center, client, assessment)}
      <section class="report-section"><div class="report-section-head"><div><span>01</span><h2>통증과 기능 변화</h2></div><p>각 지표 0–10점 · 청록색이 현재 값</p></div><div class="score-chart"><div class="score-chart-axis"><strong>평가 지표</strong><span>0</span><i></i><span>10</span><em>변화</em></div>${scoreRows}</div></section>
      <section class="report-section"><div class="report-section-head"><div><span>02</span><h2>이번 평가의 핵심</h2></div><p>제한 활동과 목표를 먼저 확인하세요.</p></div><table class="summary-table"><tbody><tr><th>가장 제한되는 활동</th><td>${escapeHtml(displayValue(intake.activityLimitation))}</td></tr><tr><th>이용자가 원하는 목표</th><td>${escapeHtml(displayValue(intake.patientGoal))}</td></tr><tr><th>의료기관 상담 안내</th><td>${escapeHtml(referralLabel(intake.referralStatus))}</td></tr><tr><th>다음 재평가</th><td>${escapeHtml(dateLabel(goals.reviewOn))}</td></tr></tbody></table></section>
      <p class="report-notice"><b>안내:</b> 이 문서는 센터의 운동·기능평가 내용을 이용자와 공유하기 위한 기록지이며 의료기관의 진단서, 의무기록 또는 치료 결과를 의미하지 않습니다. 개인정보가 포함되어 있으므로 본인 동의 없이 제3자에게 전달하지 마세요.</p>
      ${pageFooter(center, payload, 1)}
    </article>
    <article class="report-page report-record-page">
      ${pageHeader("평가 기록과 목표", "문장형 기록을 항목별 표로 정리했습니다.", reportCode, 2)}
      <section class="report-section"><div class="report-section-head"><div><span>03</span><h2>평가 전 확인</h2></div><p>발생 계기 · 증상 변화 · 주의사항</p></div><table class="context-table"><tbody><tr><th>발생 계기</th><td>${escapeHtml(displayValue(intake.onsetMechanism))}</td><th>불편 시작일</th><td>${escapeHtml(dateLabel(intake.onsetDate))}</td></tr><tr><th>심해지는 상황</th><td>${escapeHtml(displayValue(intake.aggravatingFactors))}</td><th>줄어드는 상황</th><td>${escapeHtml(displayValue(intake.easingFactors))}</td></tr><tr><th>운동 전 확인사항</th><td colspan="3">${escapeHtml(displayValue(intake.precautions))}</td></tr></tbody></table></section>
      <section class="report-section"><div class="report-section-head"><div><span>04</span><h2>SOAP 기록</h2></div><p>주관적 정보 · 객관적 기록 · 해석 · 계획</p></div><table class="soap-table"><tbody>${soapRow("S", "주관적 정보", soap.subjective)}${soapRow("O", "객관적 기록", soap.objective)}${soapRow("A", "기능적 해석", soap.assessment)}${soapRow("P", "운동·관리 계획", soap.plan)}</tbody></table></section>
      <section class="report-section"><div class="report-section-head"><div><span>05</span><h2>목표와 다음 확인</h2></div><p>재평가 때 같은 기준으로 비교합니다.</p></div><table class="goal-table"><tbody><tr><th>단기 목표</th><td colspan="3">${escapeHtml(displayValue(goals.shortTerm))}</td></tr><tr><th>장기 목표</th><td colspan="3">${escapeHtml(displayValue(goals.longTerm))}</td></tr><tr><th>권장 빈도·기간</th><td>${escapeHtml(displayValue(goals.frequency))}</td><th>재평가 예정일</th><td>${escapeHtml(dateLabel(goals.reviewOn))}</td></tr></tbody></table></section>
      ${pageFooter(center, payload, 2)}
    </article>
    <article class="report-page report-measurement-page">
      ${pageHeader("세부 측정 기록", "ROM · MMT · 기능검사를 표로 비교합니다.", reportCode, 3)}
      <section class="report-section"><div class="report-section-head"><div><span>06</span><h2>관절가동범위 · ROM</h2></div><p>AROM·PROM 단위 ° · 통증 0–10</p></div><table class="measurement-table rom-report-table"><thead><tr><th>관절·부위</th><th>동작</th><th>좌우</th><th>AROM</th><th>PROM</th><th>참고</th><th>종말감</th><th>통증</th><th colspan="2">비고</th></tr></thead><tbody>${romRows(Array.isArray(assessment.rom) ? assessment.rom : [])}</tbody></table></section>
      <section class="report-section"><div class="report-section-head"><div><span>07</span><h2>도수근력검사 · MMT</h2></div><p>근력 0–5 · 통증 0–10</p></div><table class="measurement-table"><thead><tr><th>근육·동작</th><th>좌우</th><th>등급</th><th>통증</th><th>저항·보상 움직임</th></tr></thead><tbody>${mmtRows(Array.isArray(assessment.mmt) ? assessment.mmt : [])}</tbody></table></section>
      <section class="report-section"><div class="report-section-head"><div><span>08</span><h2>기능검사</h2></div><p>동일한 측정 조건으로 재평가</p></div><table class="measurement-table"><thead><tr><th>검사명</th><th>측정 조건</th><th>결과</th><th>단위</th><th>비고</th></tr></thead><tbody>${functionalRows(Array.isArray(assessment.functional_tests) ? assessment.functional_tests : [])}</tbody></table></section>
      <section class="evaluator-confirmation"><div><span>평가 담당자</span><strong>${escapeHtml(displayValue(evaluator.name || center.manager))}</strong><small>${escapeHtml(displayValue(evaluator.credential))}</small></div><div><span>확인 서명</span><i aria-hidden="true"></i></div></section>
      <p class="report-notice"><b>기록 원칙:</b> 같은 검사 조건을 유지하면 방문별 변화를 비교하기 쉽습니다. 수치는 센터가 실제로 시행한 평가 결과만 기록하고, 위험 신호가 있으면 운동보다 의료기관 상담 안내를 우선합니다.</p>
      ${pageFooter(center, payload, 3)}
    </article>`;
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
  if (!payload || !["dail_function_professional_v2", "dail_function_soap_v1"].includes(payload.version) || !payload.assessment) throw new Error("평가 정보 형식을 확인할 수 없습니다.");
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
