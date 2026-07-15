const API_BASE = window.location.protocol === "file:" ? "http://localhost:8090" : window.location.origin;
const loginPanel = document.querySelector("#loginPanel");
const dashboard = document.querySelector("#dashboard");
const loginPassword = document.querySelector("#loginPassword");
const loginButton = document.querySelector("#loginButton");
const loginMessage = document.querySelector("#loginMessage");
const refreshButton = document.querySelector("#refreshButton");
const logoutButton = document.querySelector("#logoutButton");
localStorage.removeItem("MOVEMAP_ADMIN_TOKEN");
let sessionToken = "";

function adminHeaders(extra = {}) {
  return {
    ...extra,
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    "X-Movemap-Client": "admin",
  };
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function shortUserAgent(value) {
  const userAgent = String(value || "");
  if (!userAgent) return "-";
  if (userAgent.includes("Expo")) return "Expo 앱";
  if (userAgent.includes("iPhone")) return "iPhone";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) return "Safari";
  if (userAgent.includes("Chrome")) return "Chrome";
  return userAgent.slice(0, 42);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function imageMarkup(src, label) {
  if (!src) return "";
  return `<a class="application-image" href="${escapeHtml(src)}" target="_blank" rel="noreferrer">
    <img src="${escapeHtml(src)}" alt="${escapeHtml(label)}" />
  </a>`;
}

async function approveApplication(applicationId) {
  const response = await fetch(
    `${API_BASE}/api/approve-center?id=${encodeURIComponent(applicationId)}`,
    {
      method: "POST",
      headers: adminHeaders(),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    window.alert(data.error || "승인에 실패했습니다.");
    return;
  }

  await loadStats();
}

async function rejectApplication(applicationId) {
  const reason = window.prompt("반려 사유를 입력해 주세요.", "등록 정보 보완이 필요합니다.");
  if (reason === null) return;
  const response = await fetch(`${API_BASE}/api/approve-center?action=reject&id=${encodeURIComponent(applicationId)}`, {
    method: "POST", headers: adminHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ reason }),
  });
  if (!response.ok) return window.alert((await response.json().catch(() => ({}))).error || "반려에 실패했습니다.");
  await loadStats();
}

async function updateCenter(centerId) {
  const row = document.querySelector(`[data-center-row="${CSS.escape(centerId)}"]`);
  const value = (name) => row.querySelector(`[data-center-${name}]`).value.trim();
  const response = await fetch(`${API_BASE}/api/approve-center?action=update&id=${encodeURIComponent(centerId)}`, {
    method: "POST",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      name: value("name"), area: value("area"), address: value("address"),
      lat: Number(value("lat")) || null, lng: Number(value("lng")) || null,
      lead: value("lead"), tags: value("tags").split(",").map((item) => item.trim()).filter(Boolean),
      therapist: value("therapist"), price: value("price"), plan: value("plan"),
      naver_map_url: `https://map.naver.com/p/search/${encodeURIComponent(value("address") || value("area"))}`,
    }),
  });
  if (!response.ok) return window.alert((await response.json().catch(() => ({}))).error || "수정에 실패했습니다.");
  await loadStats();
}

async function deleteCenter(centerId, centerName) {
  if (!window.confirm(`‘${centerName}’ 센터를 지도에서 완전히 삭제할까요?`)) return;
  const response = await fetch(`${API_BASE}/api/approve-center?action=delete&id=${encodeURIComponent(centerId)}`, {
    method: "POST", headers: adminHeaders(),
  });
  if (!response.ok) return window.alert((await response.json().catch(() => ({}))).error || "삭제에 실패했습니다.");
  await loadStats();
}

function naverMapUrlFor(center) {
  return (
    center.naverMapUrl ||
    `https://map.naver.com/p/search/${encodeURIComponent(center.address || center.area || center.name)}`
  );
}

async function updateCenterLocation(centerId) {
  const row = document.querySelector(`[data-center-row="${CSS.escape(centerId)}"]`);
  const area = row.querySelector("[data-location-area]").value.trim();
  const address = row.querySelector("[data-location-address]").value.trim();
  const lat = row.querySelector("[data-location-lat]").value.trim();
  const lng = row.querySelector("[data-location-lng]").value.trim();

  const response = await fetch(`${API_BASE}/api/centers/${encodeURIComponent(centerId)}/location`, {
    method: "POST",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      area,
      address,
      lat,
      lng,
      naverMapUrl: `https://map.naver.com/p/search/${encodeURIComponent(address || area)}`,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    window.alert(data.error || "위치 저장에 실패했습니다.");
    return;
  }

  await loadStats();
}

async function login() {
  loginMessage.textContent = "";
  const response = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Movemap-Client": "admin",
    },
    body: JSON.stringify({
      password: loginPassword.value,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    loginMessage.textContent = data.error || "로그인에 실패했습니다.";
    return;
  }

  loginPassword.value = "";
  sessionToken = data.token || "";
  await loadStats();
}

async function loadStats() {
  const response = await fetch(`${API_BASE}/api/stats`, {
    headers: adminHeaders(),
  });

  if (response.status === 401) {
    loginPanel.hidden = false;
    dashboard.hidden = true;
    return;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    loginMessage.textContent = error.error || "관리자 데이터를 불러오지 못했습니다.";
    loginPanel.hidden = false;
    dashboard.hidden = true;
    return;
  }

  const data = await response.json();
  loginPanel.hidden = true;
  dashboard.hidden = false;

  document.querySelector("#totalCenters").textContent = data.totals.centers;
  document.querySelector("#totalPending").textContent = data.totals.pendingCenters;
  document.querySelector("#totalViews").textContent = data.totals.views;
  document.querySelector("#totalContacts").textContent = data.totals.contactClicks;
  document.querySelector("#totalEvents").textContent = data.totals.events;
  await loadAccessLogs();

  document.querySelector("#centerApplications").innerHTML =
    data.centerApplications
      .map(
        (item) => {
          const centerImages = item.photoUrls?.length ? item.photoUrls : [item.photoUrl].filter(Boolean);
          const mapUrl =
            item.naverMapUrl ||
            `https://map.naver.com/p/search/${encodeURIComponent(item.address || "")}`;
          return `
          <article class="application-item">
            <div class="application-main">
              <div>
                <strong>${escapeHtml(item.centerName)}</strong>
                <span>${escapeHtml(item.area)} · ${escapeHtml(item.ownerName)} · ${escapeHtml(item.phone)}</span>
              </div>
              <mark>${item.status === "pending" ? "승인 대기" : escapeHtml(item.status)}</mark>
            </div>
            <div class="application-media">
              ${centerImages.map((src, index) => imageMarkup(src, `${item.centerName} 사진 ${index + 1}`)).join("")}
              ${imageMarkup(item.licenseImageUrl, `${item.centerName} 면허 인증`)}
            </div>
            <p>${escapeHtml(item.address)} <a href="${escapeHtml(mapUrl)}" target="_blank" rel="noreferrer">네이버 지도 열기</a></p>
            <p>면허 인증: ${escapeHtml(item.licenseHolderName)} · ${escapeHtml(item.licenseNumber)}</p>
            ${item.website ? `<p>${escapeHtml(item.website)}</p>` : ""}
            ${item.services ? `<p>${escapeHtml(item.services)}</p>` : ""}
            ${item.memo ? `<p>${escapeHtml(item.memo)}</p>` : ""}
            ${
              item.status === "pending"
                ? `<div class="application-actions"><button class="approve-button" type="button" data-approve-id="${escapeHtml(item.id)}">승인하고 지도에 등록</button><button class="danger-button" type="button" data-reject-id="${escapeHtml(item.id)}">반려</button></div>`
                : `<p>${item.status === "rejected" ? `반려 사유: ${escapeHtml(item.rejectionReason || "-")}` : `등록 완료 센터 ID: ${escapeHtml(item.centerId)}`}</p>`
            }
            <small>${formatDate(item.createdAt)}</small>
          </article>
        `;
        }
      )
      .join("") || "<p class=\"intro\">아직 등록 신청이 없습니다.</p>";

  document.querySelector("#centerStats").innerHTML = data.centers
    .map(
      (center) => `
        <tr data-center-row="${escapeHtml(center.id)}">
          <td><input class="table-input" data-center-name value="${escapeHtml(center.name)}" /></td>
          <td><input class="table-input" data-center-area value="${escapeHtml(center.area)}" /></td>
          <td>
            <input class="table-input address-input" data-center-address value="${escapeHtml(center.address || "")}" placeholder="상세 주소" />
            <a href="${escapeHtml(naverMapUrlFor(center))}" target="_blank" rel="noreferrer">지도 열기</a>
          </td>
          <td>
            <div class="coordinate-editor">
              <input class="table-input" data-center-lat value="${escapeHtml(center.lat)}" placeholder="위도" />
              <input class="table-input" data-center-lng value="${escapeHtml(center.lng)}" placeholder="경도" />
            </div>
          </td>
          <td><input class="table-input" data-center-plan value="${escapeHtml(center.plan)}" /></td>
          <td><textarea class="table-textarea" data-center-lead>${escapeHtml(center.lead)}</textarea></td>
          <td><input class="table-input" data-center-tags value="${escapeHtml((center.tags || []).join(", "))}" /></td>
          <td><input class="table-input" data-center-therapist value="${escapeHtml(center.therapist)}" /></td>
          <td><input class="table-input" data-center-price value="${escapeHtml(center.price)}" /></td>
          <td>${center.views}</td>
          <td>${center.contactClicks}</td>
          <td>${formatDate(center.lastEventAt)}</td>
          <td><div class="row-actions"><button type="button" data-update-center="${escapeHtml(center.id)}">수정 저장</button><button class="danger-button" type="button" data-delete-center="${escapeHtml(center.id)}" data-center-name="${escapeHtml(center.name)}">삭제</button></div></td>
        </tr>
      `
    )
    .join("");

  document.querySelector("#recentEvents").innerHTML =
    data.recentEvents
      .map(
        (event) => `
          <article class="event-item">
            <div>
              <strong>${event.type}</strong>
              <span>${event.centerId} · ${event.source}</span>
            </div>
            <span>${formatDate(event.createdAt)}</span>
          </article>
        `
      )
      .join("") || "<p class=\"intro\">아직 기록된 이벤트가 없습니다.</p>";

  document.querySelectorAll("[data-approve-id]").forEach((button) => {
    button.addEventListener("click", () => approveApplication(button.dataset.approveId));
  });

  document.querySelectorAll("[data-reject-id]").forEach((button) => button.addEventListener("click", () => rejectApplication(button.dataset.rejectId)));
  document.querySelectorAll("[data-update-center]").forEach((button) => button.addEventListener("click", () => updateCenter(button.dataset.updateCenter)));
  document.querySelectorAll("[data-delete-center]").forEach((button) => button.addEventListener("click", () => deleteCenter(button.dataset.deleteCenter, button.dataset.centerName)));

  document.querySelectorAll("[data-save-location-id]").forEach((button) => {
    button.addEventListener("click", () => updateCenterLocation(button.dataset.saveLocationId));
  });
}

async function loadAccessLogs() {
  const response = await fetch(`${API_BASE}/api/access-logs`, {
    headers: adminHeaders(),
  });

  if (!response.ok) {
    document.querySelector("#totalAccessLogs").textContent = "0";
    document.querySelector("#accessLogs").innerHTML =
      "<tr><td colspan=\"8\">최고관리자만 접속 기록을 볼 수 있습니다.</td></tr>";
    return;
  }

  const data = await response.json();
  document.querySelector("#totalAccessLogs").textContent = data.totals.accessLogs;
  document.querySelector("#accessLogs").innerHTML =
    data.accessLogs
      .map(
        (log) => `
          <tr>
            <td>${formatDateTime(log.createdAt)}</td>
            <td>${escapeHtml(log.actorUserId)}</td>
            <td>${escapeHtml(log.actorRole)}</td>
            <td><span class="source-badge">${escapeHtml(log.source)}</span></td>
            <td>${escapeHtml(log.method)} ${escapeHtml(log.path)}</td>
            <td>${escapeHtml(log.statusCode)}</td>
            <td>${escapeHtml(log.ip)}</td>
            <td title="${escapeHtml(log.userAgent)}">${escapeHtml(shortUserAgent(log.userAgent))}</td>
          </tr>
        `
      )
      .join("") || "<tr><td colspan=\"8\">아직 접속 기록이 없습니다.</td></tr>";
}

loginButton.addEventListener("click", login);
refreshButton.addEventListener("click", loadStats);
logoutButton.addEventListener("click", async () => {
  await fetch(`${API_BASE}/api/logout`, { method: "POST", headers: adminHeaders() });
  sessionToken = "";
  loginPanel.hidden = false;
  dashboard.hidden = true;
});
loginPassword.addEventListener("keydown", (event) => {
  if (event.key === "Enter") login();
});

loadStats();
