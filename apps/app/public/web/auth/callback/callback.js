const title=document.querySelector("#callbackTitle"),message=document.querySelector("#callbackMessage"),home=document.querySelector("#callbackHome");
const AUTH_RETURN_KEY="dail_auth_return_to";
function safeReturnPath(){const value=sessionStorage.getItem(AUTH_RETURN_KEY)||"/";sessionStorage.removeItem(AUTH_RETURN_KEY);if(["/center-dashboard/","/account/","/partner-apply/"].includes(value))return value;if(/^\/register\/\?invite=[A-Za-z0-9._~-]+$/.test(value))return value;return "/"}
function fail(text){sessionStorage.removeItem(AUTH_RETURN_KEY);title.textContent="로그인하지 못했어요";message.textContent=text;document.querySelector(".auth-spinner").hidden=true;home.hidden=false}
async function run(){
  const query=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.slice(1));
  if(query.get("error")||hash.get("error"))return fail("로그인이 취소되었거나 인증 설정을 확인해야 합니다.");
  try{
    const config=await fetch("/api/config").then(r=>r.json());const auth=config.auth||{};let session;
    if(query.get("token_hash")){
      const response=await fetch(`${auth.supabaseUrl}/auth/v1/verify`,{method:"POST",headers:{apikey:auth.supabaseAnonKey,"Content-Type":"application/json"},body:JSON.stringify({token_hash:query.get("token_hash"),type:query.get("type")||"magiclink"})});
      session=await response.json();if(!response.ok)throw new Error(session.error_description||session.msg);
    }else{
      session={access_token:hash.get("access_token"),refresh_token:hash.get("refresh_token"),expires_in:Number(hash.get("expires_in")||3600),token_type:hash.get("token_type")||"bearer"};
      if(!session.access_token)throw new Error("Access token missing");
    }
    session.expires_at=Math.floor(Date.now()/1000)+(Number(session.expires_in)||3600);localStorage.setItem("dail_auth_session",JSON.stringify(session));
    const returnPath=safeReturnPath();history.replaceState(null,"",location.pathname);location.replace(returnPath+(returnPath.includes("?")?"&":"?")+"auth=success");
  }catch(error){console.error(error);fail("인증 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.")}
}run();
