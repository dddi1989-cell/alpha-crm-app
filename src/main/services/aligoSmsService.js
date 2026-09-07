/**
 * Aligo SMS / LMS Auto Dispatch Service
 * Sends automated SMS with secure Hometax auth link to customer mobile phones.
 */

const https = require('https');
const querystring = require('querystring');

const ALIGO_CONFIG = {
  key: 'b018nv1tk1jkv7f1ex4mrq5gaghkketl',
  user_id: 'dddi1989',
  sender: '01076797880'
};

/**
 * Send Customer Hometax Auth Link via Aligo SMS/LMS
 */
async function sendCustomerAuthSms({ clientName, clientPhone, authUrl, plannerName = 'WLB 재무설계사', plannerPhone = '010-7679-7880' }) {
  console.log('[Aligo-SMS] Sending Auth Link SMS to:', { clientName, clientPhone });

  const cleanPhone = (clientPhone || '').replace(/[^0-9]/g, '');
  if (!cleanPhone) {
    return { success: false, error: '수신자 휴대폰 번호가 없습니다.' };
  }

  const messageText = `[WLB 금융컨설팅 - 숨은 보험금 찾기]
${clientName} 고객님, 1년간 지출하신 병원비 중 청구하지 않고 놓친 숨은 실손보험금을 조회하기 위한 국세청 안심 본인인증 링크입니다.

▶ 안심 인증 링크:
${authUrl}

* 담당 설계사: ${plannerName} (${plannerPhone})
* 금융보안원 256bit 암호화 보호`;

  const postData = querystring.stringify({
    key: ALIGO_CONFIG.key,
    user_id: ALIGO_CONFIG.user_id,
    sender: ALIGO_CONFIG.sender,
    receiver: cleanPhone,
    msg: messageText,
    title: `[WLB] ${clientName}님 숨은 보험금 찾기 본인인증`
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'apis.aligo.in',
      port: 443,
      path: '/send/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const resJson = JSON.parse(body);
          console.log('[Aligo-SMS] API Response:', resJson);
          if (resJson.result_code === 1 || resJson.result_code === '1') {
            resolve({
              success: true,
              msgId: resJson.msg_id,
              message: `${cleanPhone} 번호로 국세청 안심 인증 문자가 성공적으로 발송되었습니다.`
            });
          } else {
            console.warn('[Aligo-SMS] Failed with code:', resJson.result_code, resJson.message);
            resolve({
              success: false,
              code: resJson.result_code,
              error: resJson.message || '문자 발송 실패'
            });
          }
        } catch (e) {
          resolve({ success: false, error: e.message });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[Aligo-SMS] Request error:', err);
      resolve({ success: false, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

module.exports = {
  sendCustomerAuthSms,
  ALIGO_CONFIG
};
