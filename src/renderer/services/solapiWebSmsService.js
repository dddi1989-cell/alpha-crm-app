/**
 * Solapi (CoolSMS) v4 SMS Web Dispatch Service
 * Compatible with Browser / Web / PWA environments using Web Crypto API (HMAC-SHA256)
 */

const SOLAPI_CONFIG = {
  apiKey: 'NCSSAJEYGIGWUDA4',
  apiSecret: 'D4XROTV8TWXBT5GEBBJALNM7W7XDZTKY',
  sender: '01076797880'
};

async function getSolapiAuthHeader() {
  const date = new Date().toISOString();
  
  // Generate 16 random hex bytes
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const salt = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  // HMAC-SHA256 signature using Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(SOLAPI_CONFIG.apiSecret);
  const messageData = encoder.encode(date + salt);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `HMAC-SHA256 apiKey=${SOLAPI_CONFIG.apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export async function sendCustomerAuthSmsWeb({
  clientName,
  clientPhone,
  authUrl,
  plannerName = 'WLB 재무설계사',
  plannerPhone = '010-7679-7880'
}) {
  const cleanTo = (clientPhone || '').replace(/[^0-9]/g, '');
  const cleanFrom = (SOLAPI_CONFIG.sender || '').replace(/[^0-9]/g, '');

  if (!cleanTo) {
    return { success: false, error: '수신자 휴대폰 번호가 없습니다.' };
  }

  const fullPublicUrl = authUrl || 'https://dddi1989-cell.github.io/alpha-crm-app/';

  const messageText = `[WLB 국세청 연말정산 안심인증]
${clientName} 고객님, 놓친 숨은 실손보험금 조회를 위한 국세청 안심 간편인증 링크입니다.

${fullPublicUrl}

위 안심 링크를 터치하여 국세청 간편인증을 완료해 주세요.
* 담당 설계사: ${plannerName} (${plannerPhone})`;

  try {
    const authHeader = await getSolapiAuthHeader();
    const payload = {
      message: {
        to: cleanTo,
        from: cleanFrom,
        text: messageText,
        subject: `[WLB] ${clientName}님 국세청 안심 간편인증`
      }
    };

    const res = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.statusCode === '2000' || data.groupId || data.messageId) {
      return { success: true, messageId: data.messageId || data.groupId };
    } else {
      return { success: false, error: data.statusMessage || 'SMS 발송 실패', details: data };
    }
  } catch (err) {
    console.error('Web Solapi SMS Error:', err);
    return { success: false, error: err.message };
  }
}
