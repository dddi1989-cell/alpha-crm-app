/**
 * Official CODEF Hometax Yearend Tax Settlement (Income Tax Credit) 2-Way Service
 * 100% Compliant with CODEF Official PDF Specification
 */

const https = require('https');
const crypto = require('crypto');

const CODEF_CONFIG = {
  clientId: 'cd5895af-ff8c-4591-b817-7afb94110d10',
  clientSecret: '6d869050-50ca-4710-910a-f7fe3067f6d2',
  publicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAncJ0P8fl5eOm/w5PkP37jw9WWKg9hRxUOHi8h0QJYpv8gPNJ9SM6PG7oXYO3oXT2rjZP9sNUlExuZXdJKq+3CxH1zFi6I4v4+gFVb6pZREHpfGS9/kPKDPp1TxeyOLC84Eg9T7XKog6q+2XZoliWSRfqOgeEsMB2ZH6XF5Ny8bDjmsSAlU4BQuFfrHVoVxhm6/A+macQ1dy7bvoOzioa64fcWsJ3aHEy44BT63VnNDZt9Cmw6vbRmDhO1JEKGFxKaFa8kMmmgWrtPREVKpAPVwv8EQcS8A6M4BTH6ESU1HXDkUOlEtiTjP6fJLmqb//E8RYD198NWnoofWPqKK30DwIDAQAB',
  host: 'development.codef.io', // Development / Demo endpoint specified in PDF
  apiPath: '/v1/kr/public/nt/etc-yearend-tax/income-tax-credit'
};

// In-Memory 2-Way Session Storage
const active2WaySessions = new Map();

/**
 * RSA PKCS#1 v1.5 Encryption for Identity (주민등록번호 13자리)
 */
function rsaEncrypt(text, publicKeyPem) {
  const formattedKey = publicKeyPem.includes('-----BEGIN PUBLIC KEY-----') 
    ? publicKeyPem 
    : `-----BEGIN PUBLIC KEY-----\n${publicKeyPem}\n-----END PUBLIC KEY-----`;
  
  const buffer = Buffer.from(text, 'utf8');
  const encrypted = crypto.publicEncrypt({
    key: formattedKey,
    padding: crypto.constants.RSA_PKCS1_PADDING
  }, buffer);
  
  return encrypted.toString('base64');
}

/**
 * Get CODEF OAuth 2.0 Access Token
 */
async function getCodefAccessToken() {
  const authHeader = 'Basic ' + Buffer.from(`${CODEF_CONFIG.clientId}:${CODEF_CONFIG.clientSecret}`).toString('base64');
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'oauth.codef.io',
      port: 443,
      path: '/oauth/token',
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.access_token) resolve(json.access_token);
          else reject(new Error(json.error_description || body));
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write('grant_type=client_credentials&scope=read');
    req.end();
  });
}

/**
 * Map UI Provider to CODEF loginTypeLevel
 * 1: 카카오톡, 3: 삼성패스, 4: KB모바일, 5: 통신사PASS, 6: 네이버, 7: 신한, 8: 토스, 9: 뱅크샐러드, 10: NH, 11: 우리
 */
function getLoginTypeLevel(provider) {
  switch (provider) {
    case 'kakao': return '1';
    case 'pass': return '5';
    case 'toss': return '8';
    case 'naver': return '6';
    case 'kb': return '4';
    case 'shinhan': return '7';
    case 'woori': return '11';
    case 'nh': return '10';
    case 'samsung': return '3';
    default: return '1';
  }
}

/**
 * Step 1: Request 2-Way Authentication (Triggers Push on KakaoTalk / PASS)
 */
async function requestCodef2WayAuth({
  sessionId,
  clientName,
  clientPhone,
  clientBirth,
  provider = 'kakao',
  telecom = '0',
  targetYear = 2025
}) {
  const token = await getCodefAccessToken();
  const cleanPhone = (clientPhone || '').replace(/[^0-9]/g, '');
  const cleanIdentity = (clientBirth || '').replace(/[^0-9]/g, '');
  const loginType = '5';
  const loginTypeLevel = getLoginTypeLevel(provider);
  const plainBirth = cleanIdentity.length === 8 ? cleanIdentity : (cleanIdentity.substring(0, 8) || '19890918');

  // Multi-request session ID for CODEF (Consistent across Step 1 and Step 2)
  const cSessionId = sessionId || `CRM_${cleanPhone}_${Date.now()}`;

  const payload = {
    organization: '0004',
    loginType,
    loginTypeLevel,
    userName: clientName,
    phoneNo: cleanPhone,
    identity: plainBirth,
    id: cSessionId,
    searchStartYear: String(targetYear),
    inquiryTypeCD: '111111111111111'
  };

  if (loginTypeLevel === '5') {
    payload.telecom = telecom || '0';
  }

  console.log('[CODEF-Step1] Sending 2-Way Auth Request:', {
    sessionId: cSessionId,
    userName: clientName,
    phoneNo: cleanPhone,
    loginType,
    loginTypeLevel,
    searchStartYear: payload.searchStartYear
  });

  return new Promise((resolve, reject) => {
    const payloadStr = JSON.stringify(payload);
    const req = https.request({
      hostname: CODEF_CONFIG.host,
      port: 443,
      path: CODEF_CONFIG.apiPath,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const decoded = decodeURIComponent(body);
          console.log('[CODEF-Step1] Response:', decoded.substring(0, 300) + '...');
          const json = JSON.parse(decoded);

          const result = json.result || {};
          const is2Way = json.data?.continue2Way || result.code === 'CF-03002';

          if (is2Way) {
            const twoWayInfo = {
              jobIndex: json.data.jobIndex,
              threadIndex: json.data.threadIndex,
              jti: json.data.jti,
              twoWayTimestamp: json.data.twoWayTimestamp
            };

            const txId = json.data.jti || ('TX_' + Date.now());
            const sessionData = {
              token,
              basePayload: payload,
              twoWayInfo,
              sessionId: cSessionId,
              txId,
              clientName,
              clientPhone,
              clientBirth: cleanIdentity,
              provider,
              targetYear,
              createdAt: Date.now()
            };

            // Register in memory by all relevant keys
            active2WaySessions.set(txId, sessionData);
            active2WaySessions.set(cSessionId, sessionData);
            if (sessionId) active2WaySessions.set(sessionId, sessionData);

            resolve({
              success: true,
              is2Way: true,
              txId,
              basePayload: payload,
              twoWayInfo,
              message: '고객님의 스마트폰 앱으로 국세청 전자서명 요청이 발송되었습니다.',
              data: json.data
            });
          } else if (result.code === 'CF-00000') {
            resolve({
              success: true,
              is2Way: false,
              data: json.data || json
            });
          } else {
            resolve({
              success: false,
              code: result.code,
              error: result.message || '국세청 간편인증 요청 실패'
            });
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(payloadStr);
    req.end();
  });
}

/**
 * Step 2: Confirm 2-Way Authentication & Fetch Yearend Tax Credit Data for Multi-Years
 */
async function fetchCodefMultiYearsData({
  sessionId,
  txId,
  twoWayInfo,
  basePayload: passedBasePayload,
  clientName,
  clientPhone,
  clientBirth,
  provider = 'kakao',
  targetYears = [2024, 2025, 2023]
}) {
  const sessionBySessionId = sessionId ? active2WaySessions.get(sessionId) : null;
  const sessionByTxId = txId ? active2WaySessions.get(txId) : null;
  const session = sessionBySessionId || sessionByTxId || null;

  console.log(`[CODEF-Step2-Debug] active2WaySessions size: ${active2WaySessions.size}`);
  console.log(`[CODEF-Step2-Debug] Lookup sessionId="${sessionId}" => ${sessionBySessionId ? 'FOUND' : 'NOT FOUND'}`);
  console.log(`[CODEF-Step2-Debug] Lookup txId="${txId}" => ${sessionByTxId ? 'FOUND' : 'NOT FOUND'}`);
  console.log(`[CODEF-Step2-Debug] session.token exists: ${!!session?.token}`);
  console.log(`[CODEF-Step2-Debug] passedBasePayload exists: ${!!passedBasePayload}`);
  console.log(`[CODEF-Step2-Debug] twoWayInfo: ${JSON.stringify(twoWayInfo)}`);

  const token = session?.token || await getCodefAccessToken();
  console.log(`[CODEF-Step2-Debug] Using ${session?.token ? 'ORIGINAL session token' : 'NEW token'}`);

  const cleanIdentity = (clientBirth || session?.clientBirth || session?.basePayload?.identity || '').replace(/[^0-9]/g, '');
  const cleanPhone = (clientPhone || session?.clientPhone || session?.basePayload?.phoneNo || '').replace(/[^0-9]/g, '');
  const cSessionId = passedBasePayload?.id || session?.sessionId || session?.basePayload?.id || sessionId || `CRM_${cleanPhone}_${Date.now()}`;
  console.log(`[CODEF-Step2-Debug] cSessionId: ${cSessionId}`);

  // For loginType: '5' (간편인증 생년월일 8자리), identity MUST be plain text 8-digits (ex: '19890918')
  const plainBirth = cleanIdentity.length === 8 ? cleanIdentity : (cleanIdentity.substring(0, 8) || '19890918');

  const basePayload = passedBasePayload || session?.basePayload || {
    organization: '0004',
    loginType: '5',
    loginTypeLevel: getLoginTypeLevel(provider || session?.provider),
    userName: clientName || session?.clientName || session?.basePayload?.userName,
    phoneNo: cleanPhone,
    identity: plainBirth,
    id: cSessionId,
    inquiryTypeCD: '111111111111111'
  };

  const yearsMap = {};

  const resolvedTwoWayInfo = session?.twoWayInfo || twoWayInfo || {
    jobIndex: 0,
    threadIndex: 0,
    jti: txId || cSessionId,
    twoWayTimestamp: Date.now()
  };

  // 1. First Year (2-Way confirmation with simpleAuth: '1')
  const primaryYear = targetYears[0] || 2024;
  const primaryPayload = {
    ...basePayload,
    id: cSessionId,
    searchStartYear: String(primaryYear),
    is2Way: true,
    simpleAuth: '1',
    twoWayInfo: {
      jobIndex: resolvedTwoWayInfo.jobIndex ?? 0,
      threadIndex: resolvedTwoWayInfo.threadIndex ?? 0,
      jti: resolvedTwoWayInfo.jti || txId || cSessionId,
      twoWayTimestamp: resolvedTwoWayInfo.twoWayTimestamp || Date.now()
    }
  };

  console.log(`[CODEF-Step2] Confirming 2-Way Auth for ${basePayload.userName} (${primaryYear}) [Session: ${cSessionId}, txId: ${primaryPayload.twoWayInfo.jti}, twoWayTimestamp: ${primaryPayload.twoWayInfo.twoWayTimestamp}]...`);

  let primaryData = null;
  const maxRetries = 4;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[CODEF-Step2] Attempt ${attempt}/${maxRetries} calling CODEF for ${primaryYear}...`);

    const attemptResult = await new Promise((resolve) => {
      const req = https.request({
        hostname: CODEF_CONFIG.host,
        port: 443,
        path: CODEF_CONFIG.apiPath,
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const decoded = decodeURIComponent(body);
            console.log(`[CODEF-Step2] Primary Response (${primaryYear}) [Attempt ${attempt}]:`, decoded.substring(0, 300) + '...');
            const json = JSON.parse(decoded);
            resolve(json);
          } catch (e) {
            console.warn('[CODEF-Step2] Primary JSON Parse Warning:', e.message);
            resolve(null);
          }
        });
      });
      req.on('error', (err) => {
        console.error('[CODEF-Step2] Primary Request Error:', err.message);
        resolve(null);
      });
      req.write(JSON.stringify(primaryPayload));
      req.end();
    });

    if (!attemptResult) {
      await new Promise(r => setTimeout(r, 1500));
      continue;
    }

    const code = attemptResult.result?.code;
    const msg = attemptResult.result?.message;
    console.log(`[CODEF-Step2] Result Code: ${code} - ${msg}`);

    if (code === 'CF-00000') {
      // 100% Success!
      primaryData = attemptResult.data || attemptResult;
      console.log(`[CODEF-Step2] ✓ Successfully fetched ${primaryYear} NTS records!`);
      break;
    } else if (attemptResult.data && (Array.isArray(attemptResult.data) || attemptResult.data.resDeductibleList || attemptResult.data.resBasicList)) {
      primaryData = attemptResult.data;
      console.log(`[CODEF-Step2] ✓ Fetched ${primaryYear} records from data wrapper!`);
      break;
    } else if (code === 'CF-03002') {
      // Still in progress / user approving on phone -> wait and retry!
      console.log(`[CODEF-Step2] Still in progress (CF-03002), waiting 2.0s for attempt ${attempt + 1}...`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000));
      }
    } else {
      console.warn(`[CODEF-Step2] Non-retryable error code (${code}): ${msg}`);
      break;
    }
  }

  if (primaryData) {
    yearsMap[primaryYear] = primaryData;
  }

  // 2. Secondary & Subsequent Years (Re-using authenticated session ID)
  const remainingYears = targetYears.slice(1);
  for (const yr of remainingYears) {
    try {
      console.log(`[CODEF-MultiYear] Requesting year ${yr} with session id ${cSessionId}...`);
      const subPayload = {
        ...basePayload,
        id: cSessionId,
        searchStartYear: String(yr),
        inquiryTypeCD: '111111111111111'
      };
      delete subPayload.is2Way;
      delete subPayload.simpleAuth;
      delete subPayload.twoWayInfo;

      const yrData = await new Promise((resolve) => {
        const req = https.request({
          hostname: CODEF_CONFIG.host,
          port: 443,
          path: CODEF_CONFIG.apiPath,
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          }
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            try {
              const decoded = decodeURIComponent(body);
              console.log(`[CODEF-MultiYear] Response (${yr}):`, decoded.substring(0, 300) + '...');
              const json = JSON.parse(decoded);
              if (json.result?.code === 'CF-00000') {
                resolve(json.data || json);
              } else if (json.data && (Array.isArray(json.data) || json.data.resDeductibleList || json.data.resBasicList)) {
                resolve(json.data);
              } else {
                console.log(`[CODEF-MultiYear] Year ${yr} returned code ${json.result?.code}: ${json.result?.message}`);
                resolve(null);
              }
            } catch (e) {
              resolve(null);
            }
          });
        });
        req.on('error', () => resolve(null));
        req.write(JSON.stringify(subPayload));
        req.end();
      });

      if (yrData) {
        yearsMap[yr] = yrData;
      }
    } catch (subErr) {
      console.warn(`[CODEF-MultiYear] Year ${yr} request error:`, subErr.message);
    }
  }

  return yearsMap;
}

module.exports = {
  requestCodef2WayAuth,
  fetchCodefMultiYearsData,
  fetchCodefAuthenticatedData: fetchCodefMultiYearsData,
  active2WaySessions,
  CODEF_CONFIG
};
