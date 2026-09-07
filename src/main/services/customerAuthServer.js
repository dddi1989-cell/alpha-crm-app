/**
 * Official Hometax 2-Way Mobile Authentication Relay Engine
 * Architecture: GitHub Pages (Frontend WebApp) ↔ Supabase (Cloud Relay Bus) ↔ CRM Desktop App (CODEF API Engine)
 * 
 * High Reliability:
 * 1. Solves Telco Spam Filter: Clean, permanent URL with hash fragment (https://dddi1989-cell.github.io/alpha-crm-app/#MOB_xxx)
 * 2. Solves Browser CORS: CODEF API is called by CRM Node.js backend, not browser.
 * 3. Solves Instant Auth: Customer lands directly on simple form, clicks once, KakaoTalk/PASS alert fires immediately.
 */

const https = require('https');
const { parseHometaxMultiYearsData } = require('./hometaxDataParser');
const { sendCustomerAuthSms } = require('./solapiSmsService');
const { requestCodef2WayAuth, fetchCodefAuthenticatedData } = require('./codefNtsService');

const SUPABASE_URL = 'https://wvuwhijkwfmufnjfbefi.supabase.co';
const SUPABASE_ANON_KEY = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.', 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2dXdoaWprd2ZtdWZuamZiZWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjgyNDQsImV4cCI6MjEwMzE0NDI0NH0.', '-Vo71FsmwJNd2l1-UwD-ixGT_DymxRlcMp0wsONfCyE'].join('');
const STORAGE_BUCKET = 'wbl-board-files';

const PERMANENT_AUTH_BASE_URL = 'https://dddi1989-cell.github.io/alpha-crm-app/';

// In-Memory active session mapping
const activeSessions = new Map();
const activePollingIntervals = new Map();

function startCustomerAuthServer() {
  console.log('[CustomerAuthServer] Supabase Relay Architecture Active (GitHub Pages ↔ Supabase ↔ CRM)');
}

// ====================================================================
// Supabase Storage Communication Helpers
// ====================================================================
function supabaseUpload(fileName, data) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(data);
    const req = https.request({
      hostname: 'wvuwhijkwfmufnjfbefi.supabase.co',
      port: 443,
      path: `/storage/v1/object/${STORAGE_BUCKET}/${fileName}`,
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json; charset=utf-8',
        'x-upsert': 'true',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(res.statusCode === 200));
    });
    req.on('error', (err) => {
      console.warn(`[CustomerAuthServer] Supabase upload failed for ${fileName}:`, err.message);
      resolve(false);
    });
    req.write(payload);
    req.end();
  });
}

function supabaseDownload(fileName) {
  return new Promise((resolve) => {
    const url = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${fileName}?_t=${Date.now()}`;
    https.get(url, { headers: { 'Cache-Control': 'no-cache' } }, (res) => {
      if (res.statusCode !== 200) return resolve(null);
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// ====================================================================
// 1. Session Creation & SMS Dispatch
// ====================================================================
async function createMobileAuthSession({
  clientName,
  clientPhone,
  clientBirth,
  targetYear = 2024,
  plannerName = 'WLB 재무설계사',
  plannerPhone = '010-7679-7880'
}) {
  const sessionId = 'MOB_' + Date.now();
  const authUrl = `${PERMANENT_AUTH_BASE_URL}#${sessionId}`;

  const cleanPhone = (clientPhone || '').replace(/[^0-9]/g, '');
  const cleanBirth = (clientBirth || '').replace(/[^0-9]/g, '');

  const sessionInfo = {
    sessionId,
    clientName: clientName || '고객',
    clientPhone: cleanPhone,
    clientBirth: cleanBirth,
    targetYear,
    plannerName,
    plannerPhone,
    status: 'CREATED',
    createdAt: new Date().toISOString()
  };

  activeSessions.set(sessionId, { ...sessionInfo, createdAt: Date.now() });

  // Upload session metadata to Supabase so the WebApp can pre-fill customer info
  await supabaseUpload(`session_${sessionId}.json`, sessionInfo);

  // Send SMS via Solapi
  let smsResult = { success: false };
  if (cleanPhone) {
    try {
      smsResult = await sendCustomerAuthSms({
        clientName: clientName || '고객',
        clientPhone: cleanPhone,
        authUrl,
        plannerName,
        plannerPhone
      });
    } catch (e) {
      smsResult = { success: false, error: e.message };
    }
  }

  // Start background listener on Supabase for customer's action
  startRelayPolling(sessionId);

  return {
    success: true,
    sessionId,
    authUrl,
    smsSent: smsResult.success
  };
}

// ====================================================================
// 2. Background Relay Worker (CRM listens for WebApp actions)
// ====================================================================
function startRelayPolling(sessionId) {
  if (activePollingIntervals.has(sessionId)) {
    clearInterval(activePollingIntervals.get(sessionId));
  }

  console.log(`[CustomerAuthServer] Starting relay poller for session: ${sessionId}`);
  let pollCount = 0;
  const maxPolls = 180; // 15 minutes (5s intervals)

  const interval = setInterval(async () => {
    pollCount++;
    if (pollCount > maxPolls) {
      console.log(`[CustomerAuthServer] Poller timed out for session: ${sessionId}`);
      clearInterval(interval);
      activePollingIntervals.delete(sessionId);
      return;
    }

    try {
      // Check 1: Auth Request from Customer (Form submission)
      const authReq = await supabaseDownload(`auth_request_${sessionId}.json`);
      if (authReq && authReq.action === 'REQUEST_AUTH' && !authReq._processed) {
        if (activeProcessingSet.has('REQ_' + sessionId)) return;
        activeProcessingSet.add('REQ_' + sessionId);
        authReq._processed = true;
        await supabaseUpload(`auth_request_${sessionId}.json`, authReq);
        console.log(`[CustomerAuthServer] Step 1 Request received for session ${sessionId} (${authReq.userName})`);
        try {
          await handleAuthRequest(sessionId, authReq);
        } finally {
          activeProcessingSet.delete('REQ_' + sessionId);
        }
      }

      // Check 2: Auth Confirm from Customer (Post-KakaoTalk signing)
      const authConfirm = await supabaseDownload(`auth_confirm_${sessionId}.json`);
      if (authConfirm && authConfirm.action === 'CONFIRM_AUTH' && !authConfirm._processed) {
        if (activeProcessingSet.has('CONF_' + sessionId)) return;
        activeProcessingSet.add('CONF_' + sessionId);
        authConfirm._processed = true;
        await supabaseUpload(`auth_confirm_${sessionId}.json`, authConfirm);
        console.log(`[CustomerAuthServer] Step 2 Confirm received for session ${sessionId}`);
        try {
          await handleConfirmAuth(sessionId, authConfirm);
        } finally {
          activeProcessingSet.delete('CONF_' + sessionId);
        }
      }
    } catch (e) {
      console.warn(`[CustomerAuthServer] Relay poller tick error:`, e.message);
    }
  }, 3000);

  activePollingIntervals.set(sessionId, interval);
}

// Global in-flight lock to prevent duplicate simultaneous executions
const activeProcessingSet = new Set();

// ====================================================================
// 3. Step 1 Handler: Request CODEF 2-Way Push
// ====================================================================
async function handleAuthRequest(sessionId, authReq) {
  try {
    const memSession = activeSessions.get(sessionId) || {};
    const clientName = authReq.userName || memSession.clientName || '고객';
    const clientPhone = (authReq.phoneNo || memSession.clientPhone || '').replace(/[^0-9]/g, '');
    const clientBirth = (authReq.identity || memSession.clientBirth || '').replace(/[^0-9]/g, '');
    const provider = authReq.provider || 'kakao';
    const telecom = authReq.telecom || '0';
    const targetYear = authReq.targetYear || memSession.targetYear || 2024;

    console.log(`[CustomerAuthServer] Calling CODEF Step 1 for ${clientName} (${provider}) [Session: ${sessionId}]...`);

    const result = await requestCodef2WayAuth({
      sessionId,
      clientName,
      clientPhone,
      clientBirth,
      provider,
      telecom,
      targetYear: 2024
    });

    console.log(`[CustomerAuthServer] CODEF Step 1 Result:`, {
      success: result.success,
      is2Way: result.is2Way,
      txId: result.txId,
      code: result.code
    });

    if (result.success && result.is2Way) {
      const sessionData = {
        ...memSession,
        sessionId,
        clientName,
        clientPhone,
        clientBirth,
        provider,
        targetYear: 2024,
        txId: result.txId,
        basePayload: result.basePayload,
        twoWayData: result.data,
        twoWayInfo: result.twoWayInfo || result.data,
        status: 'WAITING_USER_SIGNATURE'
      };

      // Store in memory
      activeSessions.set(sessionId, sessionData);

      // Save response for WebApp (Including full basePayload and twoWayInfo)
      await supabaseUpload(`auth_response_${sessionId}.json`, {
        sessionId,
        is2Way: true,
        txId: result.txId,
        basePayload: result.basePayload,
        twoWayInfo: result.twoWayInfo || result.data,
        userName: clientName,
        phoneNo: clientPhone,
        identity: clientBirth,
        provider,
        message: '고객님의 카카오톡/PASS 앱으로 국세청 간편인증 알림이 전송되었습니다.',
        timestamp: new Date().toISOString()
      });
    } else if (result.error && (result.error.includes('동일한') || result.error.includes('중복') || result.code === 'CF-03003')) {
      // If previous session is already active on KakaoTalk, allow user to proceed with signing!
      console.log(`[CustomerAuthServer] Previous request still active on KakaoTalk. Reusing active session for ${sessionId}...`);
      const existingSession = activeSessions.get(sessionId);
      if (existingSession && existingSession.txId) {
        await supabaseUpload(`auth_response_${sessionId}.json`, {
          sessionId,
          is2Way: true,
          txId: existingSession.txId,
          basePayload: existingSession.basePayload,
          twoWayInfo: existingSession.twoWayInfo,
          userName: clientName,
          phoneNo: clientPhone,
          identity: clientBirth,
          provider,
          message: '이미 카카오톡으로 발송된 국세청 인증을 서명해 주세요.',
          timestamp: new Date().toISOString()
        });
      } else {
        await supabaseUpload(`auth_response_${sessionId}.json`, {
          sessionId,
          is2Way: false,
          error: '카카오톡으로 이미 발송된 인증이 진행 중입니다. 카카오톡 앱에서 서명을 진행해 주세요.',
          timestamp: new Date().toISOString()
        });
      }
    } else {
      await supabaseUpload(`auth_response_${sessionId}.json`, {
        sessionId,
        is2Way: false,
        error: result.error || result.message || '국세청 간편인증 요청에 실패했습니다.',
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error(`[CustomerAuthServer] Step 1 Exception:`, err);
    await supabaseUpload(`auth_response_${sessionId}.json`, {
      sessionId,
      is2Way: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
}

// ====================================================================
// 4. Step 2 Handler: Confirm CODEF 2-Way & Fetch Medical Data
// ====================================================================
async function handleConfirmAuth(sessionId, authConfirm) {
  try {
    let memSession = activeSessions.get(sessionId) || {};
    
    // Fallback: If memory was lost, restore from Supabase auth_response
    if (!memSession.txId || !memSession.basePayload) {
      const savedAuthResp = await supabaseDownload(`auth_response_${sessionId}.json`);
      if (savedAuthResp && savedAuthResp.txId) {
        memSession = { ...savedAuthResp, ...memSession };
      }
    }

    const txId = memSession.txId || authConfirm.txId;
    const basePayload = memSession.basePayload || authConfirm.basePayload;
    const twoWayInfo = memSession.twoWayInfo || authConfirm.twoWayInfo || memSession.data;
    const clientName = memSession.clientName || memSession.userName || authConfirm.userName || '고객';
    const clientPhone = memSession.clientPhone || memSession.phoneNo || authConfirm.phoneNo;
    const clientBirth = memSession.clientBirth || memSession.identity || authConfirm.identity;
    const provider = memSession.provider || authConfirm.provider || 'kakao';

    console.log(`[CustomerAuthServer] Calling CODEF Multi-Year Step 2 for ${clientName} (sessionId: ${sessionId}, txId: ${txId}, twoWayTimestamp: ${twoWayInfo?.twoWayTimestamp})...`);

    let yearsMap = {};
    try {
      yearsMap = await fetchCodefMultiYearsData({
        sessionId,
        txId,
        basePayload,
        twoWayInfo,
        clientName,
        clientPhone,
        clientBirth,
        provider,
        targetYears: [2024, 2025, 2023]
      });
    } catch (fetchErr) {
      console.warn(`[CustomerAuthServer] CODEF Multi-Year fetch warning:`, fetchErr.message);
    }

    const parsedData = parseHometaxMultiYearsData(yearsMap, {
      clientName,
      clientPhone,
      clientBirth,
      authProvider: provider
    });

    console.log(`[CustomerAuthServer] ✓ Parsed 3-Year (${Object.keys(yearsMap).join(',')}) total ${parsedData.totalExpenseCount || 0} expenses for ${clientName}`);

    // Auto save to local SQLite customers table
    try {
      const { getDb } = require('../database');
      const db = getDb();
      const cleanPhone = (clientPhone || '').replace(/[^0-9]/g, '');
      const hometaxJsonStr = JSON.stringify(parsedData);
      
      // Find matching customer by phone or name
      const existing = db.prepare(`
        SELECT id FROM customers 
        WHERE (REPLACE(phone, '-', '') = ? AND phone IS NOT NULL AND phone != '') 
           OR name = ?
        LIMIT 1
      `).get(cleanPhone, clientName);

      if (existing) {
        db.prepare(`UPDATE customers SET hometax_data = ?, updated_at = ? WHERE id = ?`)
          .run(hometaxJsonStr, new Date().toISOString(), existing.id);
        console.log(`[CustomerAuthServer] ✓ Saved hometax_data to customer ID: ${existing.id}`);
      } else {
        // Create new customer with hometax_data
        const now = new Date().toISOString();
        const insertRes = db.prepare(`
          INSERT INTO customers (name, phone, birth_date, status, notes, hometax_data, created_at, updated_at)
          VALUES (?, ?, ?, '가망고객', '국세청 간편인증 실시간 수신', ?, ?, ?)
        `).run(clientName, clientPhone, clientBirth, hometaxJsonStr, now, now);
        console.log(`[CustomerAuthServer] ✓ Created new customer ID ${insertRes.lastInsertRowid} with hometax_data`);
      }
    } catch (dbSaveErr) {
      console.warn('[CustomerAuthServer] Customer DB save warning:', dbSaveErr.message);
    }

    // 1. Upload result for WebApp
    await supabaseUpload(`auth_result_${sessionId}.json`, {
      sessionId,
      success: true,
      recordsCount: parsedData.totalExpenseCount || 0,
      timestamp: new Date().toISOString()
    });

    // 2. Upload full hometax session for CRM polling
    const fullSessionPayload = {
      sessionId,
      userName: clientName,
      phoneNo: clientPhone,
      identity: clientBirth,
      yearsMap,
      parsedData,
      completedAt: new Date().toISOString()
    };
    await supabaseUpload(`hometax_${sessionId}.json`, fullSessionPayload);

    // 3. Update In-Memory
    activeSessions.set(sessionId, {
      ...memSession,
      status: 'COMPLETED',
      scrapedData: parsedData,
      fullSessionPayload
    });

    // Clear poller
    if (activePollingIntervals.has(sessionId)) {
      clearInterval(activePollingIntervals.get(sessionId));
      activePollingIntervals.delete(sessionId);
    }
  } catch (err) {
    console.error(`[CustomerAuthServer] Step 2 Exception:`, err);
    await supabaseUpload(`auth_result_${sessionId}.json`, {
      sessionId,
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
}

// ====================================================================
// 5. Status Polling Handler (Called by CRM UI every 2s)
// ====================================================================
async function checkMobileAuthSessionStatus({ sessionId }) {
  if (!sessionId) return { success: false, status: 'NO_SESSION' };

  // 1. Check in-memory session first
  const memSession = activeSessions.get(sessionId);
  if (memSession && memSession.scrapedData) {
    return {
      success: true,
      sessionId,
      status: 'COMPLETED',
      clientName: memSession.clientName,
      data: memSession.scrapedData
    };
  }

  // Ensure relay poller is active for this session
  if (!activePollingIntervals.has(sessionId)) {
    startRelayPolling(sessionId);
  }

  // 2. Check Supabase for completed hometax session file
  const hometaxFile = await supabaseDownload(`hometax_${sessionId}.json`);
  if (hometaxFile) {
    let parsedData = hometaxFile.parsedData;
    if (!parsedData) {
      const rawMap = (hometaxFile.yearsMap && Object.keys(hometaxFile.yearsMap).length > 0)
        ? hometaxFile.yearsMap 
        : { 2024: hometaxFile.rawNtsData || hometaxFile };

      parsedData = parseHometaxMultiYearsData(rawMap, {
        clientName: hometaxFile.userName || hometaxFile.clientName,
        clientPhone: hometaxFile.phoneNo || hometaxFile.clientPhone,
        clientBirth: hometaxFile.identity || hometaxFile.clientBirth,
        authProvider: 'kakao'
      });
    }

    if (parsedData) {
      // Auto save to local SQLite DB
      try {
        const { getDb } = require('../database');
        const db = getDb();
        const cName = hometaxFile.userName || hometaxFile.clientName;
        const cPhone = (hometaxFile.phoneNo || hometaxFile.clientPhone || '').replace(/[^0-9]/g, '');
        const jsonStr = JSON.stringify(parsedData);
        
        const existing = db.prepare(`
          SELECT id FROM customers 
          WHERE (REPLACE(phone, '-', '') = ? AND phone IS NOT NULL AND phone != '') 
             OR name = ?
          LIMIT 1
        `).get(cPhone, cName);

        if (existing) {
          db.prepare(`UPDATE customers SET hometax_data = ?, updated_at = ? WHERE id = ?`)
            .run(jsonStr, new Date().toISOString(), existing.id);
          console.log(`[CustomerAuthServer] Auto-updated customer ${cName} (ID: ${existing.id}) with hometax data`);
        }
      } catch (dbErr) {
        console.warn('[CustomerAuthServer] DB auto-save warning:', dbErr.message);
      }

      if (memSession) {
        memSession.scrapedData = parsedData;
        memSession.status = 'COMPLETED';
        activeSessions.set(sessionId, memSession);
      }
      return {
        success: true,
        sessionId,
        status: 'COMPLETED',
        clientName: hometaxFile.userName || hometaxFile.clientName,
        data: parsedData
      };
    }
  }

  // 3. Fallback active request check in Supabase if poller missed
  const authReq = await supabaseDownload(`auth_request_${sessionId}.json`);
  if (authReq && authReq.action === 'REQUEST_AUTH' && !authReq._processed) {
    authReq._processed = true;
    await supabaseUpload(`auth_request_${sessionId}.json`, authReq);
    handleAuthRequest(sessionId, authReq).catch(console.error);
    return { success: false, status: 'PROCESSING_REQUEST' };
  }

  const authConfirm = await supabaseDownload(`auth_confirm_${sessionId}.json`);
  if (authConfirm && authConfirm.action === 'CONFIRM_AUTH' && !authConfirm._processed) {
    authConfirm._processed = true;
    await supabaseUpload(`auth_confirm_${sessionId}.json`, authConfirm);
    handleConfirmAuth(sessionId, authConfirm).catch(console.error);
    return { success: false, status: 'PROCESSING_CONFIRM' };
  }

  return {
    success: false,
    status: memSession?.status || 'WAITING_USER'
  };
}

module.exports = {
  createMobileAuthSession,
  checkMobileAuthSessionStatus,
  startCustomerAuthServer,
  activeSessions
};
