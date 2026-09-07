const l={apiKey:"NCSSAJEYGIGWUDA4",apiSecret:"D4XROTV8TWXBT5GEBBJALNM7W7XDZTKY",sender:"01076797880"};async function g(){const s=new Date().toISOString(),a=new Uint8Array(16);crypto.getRandomValues(a);const r=Array.from(a).map(e=>e.toString(16).padStart(2,"0")).join(""),o=new TextEncoder,c=o.encode(l.apiSecret),n=o.encode(s+r),i=await crypto.subtle.importKey("raw",c,{name:"HMAC",hash:"SHA-256"},!1,["sign"]),p=await crypto.subtle.sign("HMAC",i,n),u=Array.from(new Uint8Array(p)).map(e=>e.toString(16).padStart(2,"0")).join("");return`HMAC-SHA256 apiKey=${l.apiKey}, date=${s}, salt=${r}, signature=${u}`}async function y({clientName:s,clientPhone:a,authUrl:r,plannerName:o="WLB 재무설계사",plannerPhone:c="010-7679-7880"}){const n=(a||"").replace(/[^0-9]/g,""),i=l.sender.replace(/[^0-9]/g,"");if(!n)return{success:!1,error:"수신자 휴대폰 번호가 없습니다."};const u=`[WLB] 숨은 보험금 찾기 서비스

${s} 고객님, 놓친 숨은 보험금 조회를 위한 본인인증 링크입니다.

${r||"https://dddi1989-cell.github.io/alpha-crm-app/"}

위 링크를 터치하여 본인인증을 완료해 주세요.

담당 설계사: ${o} (${c})`;try{const e=await g(),d=await fetch("https://api.solapi.com/messages/v4/send",{method:"POST",headers:{Authorization:e,"Content-Type":"application/json"},body:JSON.stringify({message:{to:n,from:i,text:u,subject:"[WLB] 숨은 보험금 찾기 서비스"}})}),t=await d.json();return d.ok&&t.statusCode==="2000"||t.groupId||t.messageId?{success:!0,messageId:t.messageId||t.groupId}:{success:!1,error:t.statusMessage||"SMS 발송 실패",details:t}}catch(e){return console.error("Web Solapi SMS Error:",e),{success:!1,error:e.message}}}export{y as sendCustomerAuthSmsWeb};
