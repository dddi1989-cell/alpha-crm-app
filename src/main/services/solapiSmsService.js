/**
 * Solapi (CoolSMS) v4 SMS / LMS Auto Dispatch Service
 * Uses Direct Full Supabase HTTPS URL (Bypasses Telco Shortener Blacklists & 100% Clickable on iPhone/Android)
 */

const https = require('https');
const crypto = require('crypto');

const SOLAPI_CONFIG = {
  apiKey: 'NCSSAJEYGIGWUDA4',
  apiSecret: 'D4XROTV8TWXBT5GEBBJALNM7W7XDZTKY',
  sender: '01076797880'
};

function getSolapiAuthHeader() {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha256', SOLAPI_CONFIG.apiSecret)
    .update(date + salt)
    .digest('hex');
  return `HMAC-SHA256 apiKey=${SOLAPI_CONFIG.apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

async function sendCustomerAuthSms({ clientName, clientPhone, authUrl, plannerName = 'WLB 재무설계사', plannerPhone = '010-7679-7880' }) {
  const cleanTo = (clientPhone || '').replace(/[^0-9]/g, '');
  const cleanFrom = (SOLAPI_CONFIG.sender || '').replace(/[^0-9]/g, '');

  if (!cleanTo) {
    return { success: false, error: '수신자 휴대폰 번호가 없습니다.' };
  }

  // authUrl = clean hash-based URL from customerAuthServer (e.g., https://.../#MOB_123)
  // No query params (?&%) = guaranteed SMS hyperlink activation
  const fullPublicUrl = authUrl || 'https://dddi1989-cell.github.io/alpha-crm-app/';

  const messageText = `[WLB 국세청 연말정산 안심인증]
${clientName} 고객님, 놓친 숨은 실손보험금 조회를 위한 국세청 안심 간편인증 링크입니다.

${fullPublicUrl}

위 안심 링크를 터치하여 국세청 간편인증을 완료해 주세요.
* 담당 설계사: ${plannerName} (${plannerPhone})`;

  console.log('[Solapi-SMS] Dispatching to:', cleanTo, 'URL:', fullPublicUrl);

  const authHeader = getSolapiAuthHeader();
  const payload = JSON.stringify({
    message: {
      to: cleanTo,
      from: cleanFrom,
      text: messageText,
      subject: `[WLB] ${clientName}님 국세청 안심 간편인증`
    }
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.solapi.com',
      port: 443,
      path: '/messages/v4/send',
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          console.log('[Solapi-SMS] Response:', json);
          if (res.statusCode === 200 && (json.statusCode === '2000' || json.groupId)) {
            resolve({
              success: true,
              groupId: json.groupId,
              messageId: json.messageId,
              message: `${cleanTo} 번호로 국세청 안심 인증 문자가 성공적으로 발송되었습니다.`
            });
          } else {
            console.warn('[Solapi-SMS] Error response:', json);
            resolve({
              success: false,
              code: json.statusCode,
              error: json.statusMessage || json.errorMessage || json.message || '문자 발송 실패'
            });
          }
        } catch (e) {
          resolve({ success: false, error: e.message });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[Solapi-SMS] Request error:', err);
      resolve({ success: false, error: err.message });
    });

    req.write(payload);
    req.end();
  });
}

module.exports = {
  sendCustomerAuthSms
};
