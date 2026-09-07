/**
 * Cloudflare Pages Function: /api/confirm-auth
 * Executes CODEF Step 2 Confirmation & Multi-Years Medical Expense Retrieval
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

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function parseSingleYearData(rawNtsData, yr, clientName) {
  const expenseList = [];
  const indemnityList = [];
  let totalExpenseAmount = 0;
  let totalIndemnityAmount = 0;

  const expensesByCategory = { hospital: 0, pharmacy: 0, dental: 0, optical: 0 };

  let target = rawNtsData;
  if (target && target.data && (Array.isArray(target.data) || typeof target.data === 'object')) {
    target = target.data;
  }

  let items = [];
  if (Array.isArray(target)) {
    items = target;
  } else if (target && Array.isArray(target.resBasicList)) {
    items = [target];
  } else if (target && Array.isArray(target.resDeductibleList)) {
    items = target.resDeductibleList;
  }

  items.forEach(deductibleItem => {
    const isMedicalItem = deductibleItem.resDeductibleItem === '3' || deductibleItem.resDeductibleItem === 3 || !deductibleItem.resDeductibleItem;
    
    if (isMedicalItem && Array.isArray(deductibleItem.resBasicList)) {
      deductibleItem.resBasicList.forEach(item => {
        const rawOrgName = item.resCompanyNm || item.resUserNm || '의료기관';
        const orgName = rawOrgName.replace(/\+/g, ' ').replace(/\s+/g, ' ').trim();
        const bizNo = item.resCompanyIdentityNo || '';
        const patientName = item.resUserNm || item.resInsuredPerson || clientName;
        const rawAmt = Number(item.resAmountPayment || item.resAmount || item.resTotalAmount || 0);

        let latestDateStr = `${yr}-12-31`;
        let displayDate = `${yr}년`;
        let latestMonth = '12';
        let detailDates = [];
        let detailMonths = [];

        if (Array.isArray(item.resDetailList) && item.resDetailList.length > 0) {
          const validDates = item.resDetailList
            .filter(d => d.resDatePayment && String(d.resDatePayment).trim().length >= 8)
            .map(d => {
              const str = String(d.resDatePayment).trim();
              const y = str.substring(0, 4);
              const m = str.substring(4, 6);
              const day = str.substring(6, 8);
              const amt = Number(d.resAmount || d.resAmountPayment || 0);
              return { rawDate: str, isoDate: `${y}-${m}-${day}`, display: `${Number(m)}월 ${Number(day)}일`, amount: amt };
            })
            .sort((a, b) => b.rawDate.localeCompare(a.rawDate));

          if (validDates.length > 0) {
            const topDate = validDates[0];
            latestDateStr = topDate.isoDate;
            latestMonth = topDate.isoDate.substring(5, 7);
            displayDate = validDates.length === 1 
              ? `${topDate.isoDate.substring(0, 4)}년 ${topDate.display}` 
              : `${topDate.isoDate.substring(0, 4)}년 ${topDate.display} (외 ${validDates.length - 1}회)`;
            detailDates = validDates.map(v => `${v.display}(${v.amount.toLocaleString()}원)`);
          } else {
            const activeMonths = item.resDetailList
              .filter(d => d.resMonth && Number(d.resAmount || d.resAmountPayment || 0) > 0)
              .sort((a, b) => Number(b.resMonth) - Number(a.resMonth));

            if (activeMonths.length > 0) {
              const topMonth = String(activeMonths[0].resMonth).padStart(2, '0');
              latestMonth = topMonth;
              latestDateStr = `${yr}-${topMonth}-01`;
              displayDate = `${yr}년 ${Number(topMonth)}월`;
              detailMonths = activeMonths.map(m => `${Number(m.resMonth)}월(${Number(m.resAmount || m.resAmountPayment).toLocaleString()}원)`);
            }
          }
        }

        const dateStr = latestDateStr;
        const isIndemnity = item.resType === '1' || item.resType === 1 || item.resDeductibleItem === '14' || 
          (item.resInsureType && item.resInsureType.includes('실손')) || 
          orgName.includes('보험') || orgName.includes('해상') || orgName.includes('생명');

        if (isIndemnity) {
          totalIndemnityAmount += rawAmt;
          indemnityList.push({
            year: Number(yr),
            date: dateStr,
            displayDate,
            month: latestMonth,
            companyName: orgName,
            businessNumber: bizNo,
            insuredPerson: patientName,
            receivedAmount: rawAmt,
            detailDates,
            detailMonths
          });
        } else {
          totalExpenseAmount += rawAmt;
          let category = '병원/의원 진료비';
          if (orgName.includes('약국')) {
            category = '처방 조제비';
            expensesByCategory.pharmacy += rawAmt;
          } else if (orgName.includes('치과')) {
            category = '치과 진료비';
            expensesByCategory.dental += rawAmt;
          } else if (orgName.includes('안과') || orgName.includes('안경')) {
            category = '안과/안경비';
            expensesByCategory.optical += rawAmt;
          } else {
            expensesByCategory.hospital += rawAmt;
          }

          expenseList.push({
            year: Number(yr),
            date: dateStr,
            displayDate,
            month: latestMonth,
            hospitalName: orgName,
            businessNumber: bizNo,
            patientName,
            amount: rawAmt,
            category,
            proofType: '국세청 홈택스',
            detailDates,
            detailMonths
          });
        }
      });
    }
  });

  expenseList.sort((a, b) => b.date.localeCompare(a.date));
  indemnityList.sort((a, b) => b.date.localeCompare(a.date));

  return {
    year: Number(yr),
    totalExpenseAmount,
    totalExpenseCount: expenseList.length,
    totalIndemnityAmount,
    totalIndemnityCount: indemnityList.length,
    unclaimedEstimatedAmount: Math.max(0, totalExpenseAmount - totalIndemnityAmount),
    expensesByCategory,
    expenseList,
    indemnityList
  };
}

function parseHometaxMultiYearsData(yearsMap, clientName, clientPhone, clientBirth, authProvider) {
  const years = Object.keys(yearsMap).sort((a, b) => Number(b) - Number(a));
  const byYear = {};
  let allExpenseList = [];
  let allIndemnityList = [];
  let totalExpenseAmount = 0;
  let totalIndemnityAmount = 0;

  years.forEach(yr => {
    const rawData = yearsMap[yr];
    const parsed = parseSingleYearData(rawData, yr, clientName);
    byYear[yr] = parsed;
    allExpenseList = allExpenseList.concat(parsed.expenseList);
    allIndemnityList = allIndemnityList.concat(parsed.indemnityList);
    totalExpenseAmount += parsed.totalExpenseAmount;
    totalIndemnityAmount += parsed.totalIndemnityAmount;
  });

  allExpenseList.sort((a, b) => b.date.localeCompare(a.date));
  allIndemnityList.sort((a, b) => b.date.localeCompare(a.date));

  const unclaimedEstimatedAmount = Math.max(0, totalExpenseAmount - totalIndemnityAmount);
  const claimRatioPercent = totalExpenseAmount > 0 
    ? Math.min(100, Math.round((totalIndemnityAmount / totalExpenseAmount) * 1000) / 10) 
    : 0;

  const aggregateExpensesByCategory = { hospital: 0, pharmacy: 0, dental: 0, optical: 0 };
  allExpenseList.forEach(e => {
    if (e.category === '처방 조제비') aggregateExpensesByCategory.pharmacy += e.amount;
    else if (e.category === '치과 진료비') aggregateExpensesByCategory.dental += e.amount;
    else if (e.category === '안과/안경비') aggregateExpensesByCategory.optical += e.amount;
    else aggregateExpensesByCategory.hospital += e.amount;
  });

  return {
    success: true,
    clientName,
    clientPhone,
    clientBirth,
    years: years.map(Number),
    primaryYear: years[0] ? Number(years[0]) : 2024,
    secondaryYear: years[1] ? Number(years[1]) : 2023,
    authProvider: authProvider || 'kakao',
    authCompletedAt: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    totalExpenseAmount,
    totalExpenseCount: allExpenseList.length,
    totalIndemnityAmount,
    totalIndemnityCount: allIndemnityList.length,
    unclaimedEstimatedAmount,
    claimRatioPercent,
    expensesByCategory: aggregateExpensesByCategory,
    expenseList: allExpenseList,
    indemnityList: allIndemnityList,
    byYear
  };
}

export async function onRequestPost(context) {
  const responseHeaders = { ...CORS_HEADERS, 'Content-Type': 'application/json' };

  try {
    const body = await context.request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return new Response(JSON.stringify({ success: false, error: '세션 ID가 누락되었습니다.' }), {
        status: 400,
        headers: responseHeaders
      });
    }

    // 1. Download auth_response from Supabase Storage
    const respRes = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/auth_response_${sessionId}.json?_t=${Date.now()}`);
    if (!respRes.ok) {
      return new Response(JSON.stringify({ success: false, error: '인증 세션 정보를 찾을 수 없습니다. 다시 시도해 주세요.' }), {
        status: 404,
        headers: responseHeaders
      });
    }

    const sessionData = await respRes.json();
    const { token, basePayload, twoWayInfo, userName, phoneNo, identity, provider, targetYear } = sessionData;

    // 2. Fetch Multi-Years data from CODEF (2025, 2024, 2023)
    const targetYears = [2024, 2025, 2023];
    const yearsMap = {};

    for (let i = 0; i < targetYears.length; i++) {
      const yr = targetYears[i];
      const payload = {
        ...basePayload,
        id: sessionId,
        searchStartYear: String(yr),
        is2Way: true,
        simpleAuth: '1',
        twoWayInfo: {
          jobIndex: twoWayInfo.jobIndex ?? 0,
          threadIndex: twoWayInfo.threadIndex ?? 0,
          jti: twoWayInfo.jti || sessionId,
          twoWayTimestamp: twoWayInfo.twoWayTimestamp || Date.now()
        }
      };

      // Call CODEF Step 2
      let yearSuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const codefRes = await fetch(CODEF_CONFIG.host + CODEF_CONFIG.apiPath, {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
          const rawText = await codefRes.text();
          const decoded = decodeURIComponent(rawText);
          const codefJson = JSON.parse(decoded);

          if (codefJson.result?.code === 'CF-00000' || (codefJson.data && !codefJson.data.continue2Way)) {
            yearsMap[String(yr)] = codefJson;
            yearSuccess = true;
            break;
          } else if (codefJson.data?.continue2Way || codefJson.result?.code === 'CF-03002') {
            // Customer might not have clicked sign yet, wait 3 seconds before retry
            await new Promise(r => setTimeout(r, 3000));
          } else {
            break;
          }
        } catch (e) {
          break;
        }
      }
    }

    // 3. Parse Data
    const parsed = parseHometaxMultiYearsData(yearsMap, userName, phoneNo, identity, provider);

    // 4. Save to Supabase Storage: hometax_${sessionId}.json
    await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/hometax_${sessionId}.json`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'x-upsert': 'true'
      },
      body: JSON.stringify({
        sessionId,
        userName,
        clientPhone: phoneNo,
        yearsMap,
        parsedData: parsed,
        timestamp: new Date().toISOString()
      })
    });

    // 5. Save to Supabase Storage: auth_result_${sessionId}.json
    await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/auth_result_${sessionId}.json`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'x-upsert': 'true'
      },
      body: JSON.stringify({
        sessionId,
        success: true,
        recordsCount: parsed.totalExpenseCount,
        timestamp: new Date().toISOString()
      })
    });

    // 6. Auto-update Supabase DB customers table
    try {
      const cleanPhone = (phoneNo || '').replace(/[^0-9]/g, '');
      if (cleanPhone) {
        await fetch(`${SUPABASE_URL}/rest/v1/customers?phone=eq.${cleanPhone}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            hometax_data: JSON.stringify(parsed),
            updated_at: new Date().toISOString()
          })
        });
      }
    } catch (e) {}

    return new Response(JSON.stringify({
      success: true,
      recordsCount: parsed.totalExpenseCount,
      data: parsed
    }), { headers: responseHeaders });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || '인증 완료 처리 중 오류가 발생했습니다.'
    }), { status: 500, headers: responseHeaders });
  }
}
