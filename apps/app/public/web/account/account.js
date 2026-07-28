const AUTH_STORAGE_KEY = "dail_auth_session";
const form = document.querySelector("#accountForm");
const loading = document.querySelector("#accountLoading");
const message = document.querySelector("#accountMessage");
const accountContent = document.querySelector("#accountContent");
const favoritesSection = document.querySelector("#favoritesSection");
const favoriteCenterList = document.querySelector("#favoriteCenterList");
const favoriteCount = document.querySelector("#favoriteCount");
const favoriteEmptyTemplate = document.querySelector("#favoriteEmptyTemplate");
const centerCard = document.querySelector("#centerOperationCard");
const centerBadge = document.querySelector("#centerOperationBadge");
const centerTitle = document.querySelector("#centerOperationTitle");
const centerMessage = document.querySelector("#centerOperationMessage");
const centerAction = document.querySelector("#centerOperationAction");
let authConfig = { supabaseUrl: "", supabaseAnonKey: "" };

function storedSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

async function loadAuthConfig() {
  try {
    const response = await fetch("/api/config", { headers: { "X-DAIL-Source": "web" } });
    if (!response.ok) throw new Error();
    const config = await response.json();
    authConfig = config.auth || authConfig;
  } catch {
    authConfig = { supabaseUrl: "", supabaseAnonKey: "" };
  }
}

async function refreshSession(current) {
  if (!current?.refresh_token || !authConfig.supabaseUrl || !authConfig.supabaseAnonKey) return null;
  try {
    const response = await fetch(`${authConfig.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: authConfig.supabaseAnonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    });
    if (!response.ok) return null;
    const next = await response.json();
    next.expires_at = Math.floor(Date.now() / 1000) + (Number(next.expires_in) || 3600);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

async function activeSession(forceRefresh = false) {
  let current = storedSession();
  if (!current) return null;
  const expiresSoon = Number(current.expires_at || 0) < Math.floor(Date.now() / 1000) + 60;
  if (forceRefresh || expiresSoon) current = await refreshSession(current);
  if (!current) localStorage.removeItem(AUTH_STORAGE_KEY);
  return current;
}

async function requestWithAuth(url, options = {}, preferredSession = null) {
  let auth = preferredSession || await activeSession();
  if (!auth?.access_token) return { auth: null, response: null };
  const send = (current) => fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${current.access_token}`,
    },
  });
  let response = await send(auth);
  if (response.status === 401) {
    auth = await refreshSession(auth);
    if (auth?.access_token) response = await send(auth);
  }
  return { auth, response };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function icon(name) {
  return `<svg aria-hidden="true"><use href="/assets/ui-icons.svg#${name}"></use></svg>`;
}

function renderCenterAccess(data){
  const access=data.centerAccess||{},application=access.latestApplication;
  centerCard.hidden=false;
  if(access.hasActiveMembership){
    centerBadge.textContent="운영 권한 활성";centerBadge.className="active";centerTitle.textContent="센터 운영 계정이 연결되어 있습니다";centerMessage.textContent="이 계정으로 승인된 센터의 정보와 직원 권한을 관리할 수 있습니다.";centerAction.textContent="센터 대시보드 열기";centerAction.href="/center-dashboard/";return;
  }
  if(application?.status==="pending"){
    centerBadge.textContent="심사 중";centerBadge.className="pending";centerTitle.textContent=`${application.center_name||"센터"} 등록 신청을 검토하고 있습니다`;centerMessage.textContent="검토가 끝나면 이 계정에 센터 운영 권한이 자동으로 추가됩니다.";centerAction.textContent="신청 상태 확인";centerAction.href="/register/";return;
  }
  if(application?.status==="rejected"){
    centerBadge.textContent="보완 필요";centerBadge.className="rejected";centerTitle.textContent=`${application.center_name||"센터"} 신청의 보완 사항이 있습니다`;centerMessage.textContent=application.rejection_reason||"신청 내용을 보완한 뒤 다시 제출해주세요.";centerAction.textContent="센터 다시 신청하기";centerAction.href="/register/";return;
  }
  centerBadge.textContent="센터 파트너";centerBadge.className="ready";centerTitle.textContent="센터를 운영하고 계신가요?";centerMessage.textContent="현재 DAIL 계정으로 센터를 신청하면 승인 후 별도 비밀번호 없이 관리할 수 있습니다.";centerAction.textContent="센터 등록 신청하기";centerAction.href="/register/";
}

function favoriteCardMarkup(item) {
  const center = item.center || {};
  const detailUrl = `/?center=${encodeURIComponent(center.id || "")}#search`;
  const tags = [...(center.categories || []), ...(center.tags || [])]
    .filter(Boolean)
    .slice(0, 3);
  const photo = center.photoUrl
    ? `<img src="${escapeHtml(center.photoUrl)}" alt="${escapeHtml(center.name)} 센터 사진" loading="lazy" />`
    : `<div class="favorite-photo-placeholder"><i></i><b>DAIL</b></div>`;
  const rating = center.rating && center.rating !== "신규"
    ? `<span class="favorite-rating">${icon("star")} ${escapeHtml(center.rating)} · 후기 ${escapeHtml(center.reviews || "0")}</span>`
    : `<span class="favorite-rating is-new">새로 등록된 센터</span>`;

  return `<article class="favorite-center-card" data-favorite-center="${escapeHtml(center.id)}">
    <a class="favorite-photo" href="${detailUrl}">${photo}</a>
    <div class="favorite-card-body">
      <div class="favorite-card-heading">
        <div>
          <p>${escapeHtml(center.area || center.address || "위치 정보 확인 중")}</p>
          <h3><a href="${detailUrl}">${escapeHtml(center.name || "센터 정보")}</a></h3>
        </div>
        <button type="button" class="favorite-remove" data-favorite-remove="${escapeHtml(center.id)}" aria-label="${escapeHtml(center.name)} 관심 저장 해제" aria-pressed="true">
          ${icon("heart")}
        </button>
      </div>
      <div class="favorite-meta">${rating}</div>
      <p class="favorite-lead">${escapeHtml(center.lead || "센터의 프로그램과 운영 정보를 확인해 보세요.")}</p>
      <div class="favorite-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      <a class="favorite-detail-link" href="${detailUrl}">센터 상세 보기 ${icon("arrow-right")}</a>
    </div>
  </article>`;
}

function renderFavorites(items) {
  const favorites = Array.isArray(items) ? items : [];
  favoriteCount.textContent = String(favorites.length);
  if (!favorites.length) {
    favoriteCenterList.replaceChildren(favoriteEmptyTemplate.content.cloneNode(true));
    return;
  }
  favoriteCenterList.innerHTML = favorites.map(favoriteCardMarkup).join("");
  favoriteCenterList.querySelectorAll("[data-favorite-remove]").forEach((button) => {
    button.addEventListener("click", () => removeFavorite(button.dataset.favoriteRemove));
  });
}

async function loadFavorites(auth) {
  favoritesSection.hidden = false;
  favoriteCenterList.innerHTML = '<p class="favorite-loading">저장한 센터를 불러오는 중입니다.</p>';
  try {
    const result = await requestWithAuth("/api/favorites", {
      headers: {
        "X-DAIL-Source": "web",
      },
    }, auth);
    const response = result.response;
    if (!response.ok) throw new Error();
    const data = await response.json();
    renderFavorites(data.favorites || []);
  } catch {
    favoriteCenterList.innerHTML = `<div class="favorite-error">${icon("info")}<div><b>저장한 센터를 불러오지 못했습니다.</b><button type="button" id="favoriteRetry">다시 시도</button></div></div>`;
    document.querySelector("#favoriteRetry")?.addEventListener("click", () => loadFavorites(null));
  }
}

async function removeFavorite(centerId) {
  const card = favoriteCenterList.querySelector(`[data-favorite-center="${centerId}"]`);
  const button = card?.querySelector("[data-favorite-remove]");
  if (button) button.disabled = true;
  const result = await requestWithAuth("/api/favorites", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "X-DAIL-Source": "web",
    },
    body: JSON.stringify({ centerId }),
  });
  const response = result.response;
  if (!response) return location.replace("/?login=1");
  if (!response.ok) {
    if (button) button.disabled = false;
    return;
  }
  card?.remove();
  const remaining = favoriteCenterList.querySelectorAll("[data-favorite-center]").length;
  favoriteCount.textContent = String(remaining);
  if (!remaining) renderFavorites([]);
}

async function load(){
  await loadAuthConfig();
  const result=await requestWithAuth("/api/auth/profile");
  const auth=result.auth,response=result.response;
  if(!auth?.access_token||!response)return location.replace("/?login=1");
  if(response.status===401){localStorage.removeItem(AUTH_STORAGE_KEY);return location.replace("/?login=1")}
  if(!response.ok){loading.textContent="회원 정보를 불러오지 못했습니다.";return}
  const data=await response.json();
  document.querySelector("#accountEmail").value=data.user?.email||`${data.user?.provider||"소셜"} 계정`;
  document.querySelector("#accountNickname").value=data.profile?.nickname||"";
  document.querySelector("#marketingAgreement").checked=Boolean(data.profile?.marketing_agreed_at);
  renderCenterAccess(data);
  loading.hidden=true;
  accountContent.hidden=false;
  await loadFavorites(auth);
}
form.addEventListener("submit",async event=>{
  event.preventDefault();
  const button=form.querySelector("button");button.disabled=true;message.className="message";message.textContent="저장하는 중입니다.";
  const result=await requestWithAuth("/api/auth/profile",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({nickname:document.querySelector("#accountNickname").value.trim(),acceptRequired:true,marketingAgreed:document.querySelector("#marketingAgreement").checked})});
  const response=result.response;
  if(!response){button.disabled=false;return location.replace("/?login=1")}
  const data=await response.json().catch(()=>({}));button.disabled=false;if(!response.ok){message.className="message error";message.textContent=data.error||"회원 정보를 저장하지 못했습니다.";return}message.textContent="변경사항을 저장했습니다.";window.setTimeout(()=>location.replace("/"),500);
});
load();
