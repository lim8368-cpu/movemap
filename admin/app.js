const API_BASE = "http://localhost:8090";
const loginPanel = document.querySelector("#loginPanel");
const dashboard = document.querySelector("#dashboard");
const loginId = document.querySelector("#loginId");
const loginPassword = document.querySelector("#loginPassword");
const loginButton = document.querySelector("#loginButton");
const loginMessage = document.querySelector("#loginMessage");
const refreshButton = document.querySelector("#refreshButton");

let token = localStorage.getItem("MOVEMAP_ADMIN_TOKEN") || "";

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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
  const response = await fetch(`${API_BASE}/api/center-applications/${applicationId}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    window.alert(data.error || "승인에 실패했습니다.");
    return;
  }

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
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: loginId.value.trim(),
      password: loginPassword.value,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    loginMessage.textContent = data.error || "로그인에 실패했습니다.";
    return;
  }

  token = data.token;
  localStorage.setItem("MOVEMAP_ADMIN_TOKEN", token);
  await loadStats();
}

async function loadStats() {
  const response = await fetch(`${API_BASE}/api/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    localStorage.removeItem("MOVEMAP_ADMIN_TOKEN");
    token = "";
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

  document.querySelector("#centerApplications").innerHTML =
    data.centerApplications
      .map(
        (item) => {
          const centerImage = item.photoDataUrl || item.photoUrl;
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
              ${imageMarkup(centerImage, `${item.centerName} 대표 사진`)}
              ${imageMarkup(item.licenseImageDataUrl, `${item.centerName} 면허 인증`)}
            </div>
            <p>${escapeHtml(item.address)} <a href="${escapeHtml(mapUrl)}" target="_blank" rel="noreferrer">네이버 지도 열기</a></p>
            <p>면허 인증: ${escapeHtml(item.licenseHolderName)} · ${escapeHtml(item.licenseNumber)}</p>
            ${item.website ? `<p>${escapeHtml(item.website)}</p>` : ""}
            ${item.services ? `<p>${escapeHtml(item.services)}</p>` : ""}
            ${item.memo ? `<p>${escapeHtml(item.memo)}</p>` : ""}
            ${
              item.status === "pending"
                ? `<button class="approve-button" type="button" data-approve-id="${escapeHtml(item.id)}">승인하고 지도에 등록</button>`
                : `<p>등록 완료 센터 ID: ${escapeHtml(item.centerId)}</p>`
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
          <td>${escapeHtml(center.name)}</td>
          <td><input class="table-input" data-location-area value="${escapeHtml(center.area)}" /></td>
          <td>
            <input class="table-input address-input" data-location-address value="${escapeHtml(center.address || "")}" placeholder="상세 주소" />
            <a href="${escapeHtml(naverMapUrlFor(center))}" target="_blank" rel="noreferrer">지도 열기</a>
          </td>
          <td>
            <div class="coordinate-editor">
              <input class="table-input" data-location-lat value="${escapeHtml(center.lat)}" placeholder="위도" />
              <input class="table-input" data-location-lng value="${escapeHtml(center.lng)}" placeholder="경도" />
              <button class="save-location-button" type="button" data-save-location-id="${escapeHtml(center.id)}">저장</button>
            </div>
          </td>
          <td>${escapeHtml(center.plan)}</td>
          <td>${center.views}</td>
          <td>${center.contactClicks}</td>
          <td>${formatDate(center.lastEventAt)}</td>
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

  document.querySelectorAll("[data-save-location-id]").forEach((button) => {
    button.addEventListener("click", () => updateCenterLocation(button.dataset.saveLocationId));
  });
}

loginButton.addEventListener("click", login);
refreshButton.addEventListener("click", loadStats);
loginPassword.addEventListener("keydown", (event) => {
  if (event.key === "Enter") login();
});

if (token) {
  loadStats();
}
