const AUTH_STORAGE_KEY="dail_auth_session";
const form=document.querySelector("#accountForm"),loading=document.querySelector("#accountLoading"),message=document.querySelector("#accountMessage"),centerCard=document.querySelector("#centerOperationCard"),centerBadge=document.querySelector("#centerOperationBadge"),centerTitle=document.querySelector("#centerOperationTitle"),centerMessage=document.querySelector("#centerOperationMessage"),centerAction=document.querySelector("#centerOperationAction");
function session(){try{return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)||"null")}catch{return null}}
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
async function load(){
  const auth=session();if(!auth?.access_token)return location.replace("/?login=1");
  const response=await fetch("/api/auth/profile",{headers:{Authorization:`Bearer ${auth.access_token}`}});
  if(response.status===401){localStorage.removeItem(AUTH_STORAGE_KEY);return location.replace("/?login=1")}
  if(!response.ok){loading.textContent="회원 정보를 불러오지 못했습니다.";return}
  const data=await response.json();document.querySelector("#accountEmail").value=data.user?.email||"";document.querySelector("#accountNickname").value=data.profile?.nickname||"";document.querySelector("#marketingAgreement").checked=Boolean(data.profile?.marketing_agreed_at);renderCenterAccess(data);loading.hidden=true;form.hidden=false;
}
form.addEventListener("submit",async event=>{
  event.preventDefault();const auth=session();if(!auth?.access_token)return location.replace("/?login=1");
  const button=form.querySelector("button");button.disabled=true;message.className="message";message.textContent="저장하는 중입니다.";
  const response=await fetch("/api/auth/profile",{method:"PATCH",headers:{Authorization:`Bearer ${auth.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({nickname:document.querySelector("#accountNickname").value.trim(),acceptRequired:true,marketingAgreed:document.querySelector("#marketingAgreement").checked})});
  const data=await response.json().catch(()=>({}));button.disabled=false;if(!response.ok){message.className="message error";message.textContent=data.error||"회원 정보를 저장하지 못했습니다.";return}message.textContent="변경사항을 저장했습니다.";window.setTimeout(()=>location.replace("/"),500);
});
load();
