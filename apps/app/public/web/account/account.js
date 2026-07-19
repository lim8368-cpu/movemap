const AUTH_STORAGE_KEY="dail_auth_session";
const form=document.querySelector("#accountForm"),loading=document.querySelector("#accountLoading"),message=document.querySelector("#accountMessage");
function session(){try{return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)||"null")}catch{return null}}
async function load(){
  const auth=session();if(!auth?.access_token)return location.replace("/?login=1");
  const response=await fetch("/api/auth/profile",{headers:{Authorization:`Bearer ${auth.access_token}`}});
  if(response.status===401){localStorage.removeItem(AUTH_STORAGE_KEY);return location.replace("/?login=1")}
  if(!response.ok){loading.textContent="회원 정보를 불러오지 못했습니다.";return}
  const data=await response.json();document.querySelector("#accountEmail").value=data.user?.email||"";document.querySelector("#accountNickname").value=data.profile?.nickname||"";document.querySelector("#marketingAgreement").checked=Boolean(data.profile?.marketing_agreed_at);loading.hidden=true;form.hidden=false;
}
form.addEventListener("submit",async event=>{
  event.preventDefault();const auth=session();if(!auth?.access_token)return location.replace("/?login=1");
  const button=form.querySelector("button");button.disabled=true;message.className="message";message.textContent="저장하는 중입니다.";
  const response=await fetch("/api/auth/profile",{method:"PATCH",headers:{Authorization:`Bearer ${auth.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({nickname:document.querySelector("#accountNickname").value.trim(),acceptRequired:true,marketingAgreed:document.querySelector("#marketingAgreement").checked})});
  const data=await response.json().catch(()=>({}));button.disabled=false;if(!response.ok){message.className="message error";message.textContent=data.error||"회원 정보를 저장하지 못했습니다.";return}message.textContent="변경사항을 저장했습니다.";window.setTimeout(()=>location.replace("/"),500);
});
load();
