/**
 * Cloudflare Pages Function: /api/request-auth
 * Executes CODEF Step 1 2-Way Authentication
 * Triggers KakaoTalk / PASS push notification directly on customer's phone
 */

const CODEF_CONFIG = {
  clientId: 'cd5895af-ff8c-4591-b817-7afb94110d10',
  clientSecret: '6d869050-50ca-4710-910a-f7fe3067f6d2',
  host: 'https://development.codef.io',
  apiPath: '/v1/kr/public/nt/etc-yearend-tax/income-tax-credit'
};

const SUPABASE_URL = 'https://wvuwhijkwfmufnjfbefi.supabase.co';
const SUPABASE_ANON_KEY = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.', 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2dXdoaWprd2ZtdWZuamZiZWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjgyNDQsImV4cCI6MjEwMzE0NDI0NH0.', '-Vo71FsmwJNd2l1-UwD-ixGT_DymxRlcMp0wsONfCyE'].join('');
const STORAGE_BUCKET = 'wbl-board-files';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

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

async function getCodefAccessToken() {
  const authHeader = 'Basic ' + btoa(`${CODEF_CONFIG.clientId}:${CODEF_CONFIG.clientSecret}`);
  const tokenRes = await fetch('https://oauth.codef.io/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials&scope=read'
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(tokenData.error_description || 'CODEF 토큰 발급 실패');
  }
  return tokenData.access_token;
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

export async function onRequestPost(context) {
  const responseHeaders = {
    ...CORS_HEADERS,
    'Content-Type': 'application/json'
  };

  try {
    const body = await context.request.json();
    const {
      sessionId,
      userName,
      identity,
      phoneNo,
      provider = 'kakao',
      telecom = '0',
      targetYear = 2024
    } = body;

    if (!sessionId || !userName || !identity || !phoneNo) {
      return new Response(JSON.stringify({
        success: false,
        error: '필수 입력 정보(이름, 생년월일, 휴대폰 번호)가 누락되었습니다.'
      }), { status: 400, headers: responseHeaders });
    }

    const cleanPhone = String(phoneNo).replace(/[^0-9]/g, '');
    let cleanIdentity = String(identity).replace(/[^0-9]/g, '');
    if (cleanIdentity.length === 6) {
      const prefix = parseInt(cleanIdentity.substring(0, 2), 10) > 30 ? '19' : '20';
      cleanIdentity = prefix + cleanIdentity;
    }
    const plainBirth = cleanIdentity.length === 8 ? cleanIdentity : (cleanIdentity.substring(0, 8) || '19890918');

    // 1. Get CODEF OAuth Token
    const token = await getCodefAccessToken();

    // 2. Prepare Step 1 Payload
    const loginTypeLevel = getLoginTypeLevel(provider);
    const codefPayload = {
      organization: '0004',
      loginType: '5',
      loginTypeLevel,
      userName,
      phoneNo: cleanPhone,
      identity: plainBirth,
      id: sessionId,
      searchStartYear: String(targetYear || 2024),
      inquiryTypeCD: '111111111111111'
    };

    if (loginTypeLevel === '5') {
      codefPayload.telecom = telecom || '0';
    }

    // 3. Request 2-Way Auth from CODEF (Triggers KakaoTalk push immediately!)
    const codefRes = await fetch(CODEF_CONFIG.host + CODEF_CONFIG.apiPath, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(codefPayload)
    });

    const rawBody = await codefRes.text();
    const decoded = decodeURIComponent(rawBody);
    const codefJson = JSON.parse(decoded);

    const result = codefJson.result || {};
    const is2Way = codefJson.data?.continue2Way || result.code === 'CF-03002';

    if (is2Way) {
      const twoWayInfo = {
        jobIndex: codefJson.data?.jobIndex ?? 0,
        threadIndex: codefJson.data?.threadIndex ?? 0,
        jti: codefJson.data?.jti || sessionId,
        twoWayTimestamp: codefJson.data?.twoWayTimestamp || Date.now()
      };

      const sessionResponseData = {
        sessionId,
        is2Way: true,
        token,
        txId: twoWayInfo.jti,
        basePayload: codefPayload,
        twoWayInfo,
        userName,
        phoneNo: cleanPhone,
        identity: plainBirth,
        provider,
        targetYear: Number(targetYear) || 2024,
        message: '고객님의 카카오톡/PASS 앱으로 국세청 간편인증 알림이 전송되었습니다.',
        timestamp: new Date().toISOString()
      };

      // Upload auth_response to Supabase Storage
      await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/auth_response_${sessionId}.json`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'x-upsert': 'true'
        },
        body: JSON.stringify(sessionResponseData)
      });

      return new Response(JSON.stringify({
        success: true,
        is2Way: true,
        sessionId,
        txId: twoWayInfo.jti,
        message: sessionResponseData.message
      }), { headers: responseHeaders });

    } else {
      return new Response(JSON.stringify({
        success: false,
        is2Way: false,
        code: result.code,
        error: result.message || '국세청 간편인증 요청에 실패했습니다.'
      }), { headers: responseHeaders });
    }

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || '인증 요청 처리 중 오류가 발생했습니다.'
    }), { status: 500, headers: responseHeaders });
  }
}
