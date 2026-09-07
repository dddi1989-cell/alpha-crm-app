/**
 * Official Medical Expense & Unclaimed Indemnity PDF Report Generator
 * Generates Premium A4 Printable Report matching WLB Standard Design
 */

function generateMedicalExpenseReportHtml({ data, clientName, clientPhone, plannerInfo }) {
  const plannerName = plannerInfo?.name || 'WLB 재무설계사';
  const plannerOrg = plannerInfo?.org_name || 'WLB 재정본부';
  const plannerPhone = plannerInfo?.phone || '010-7679-7880';
  const targetName = clientName || data?.clientName || '고객';
  const targetPhone = clientPhone || data?.clientPhone || '';

  const totalExpense = data?.totalExpenseAmount || 0;
  const totalIndemnity = data?.totalIndemnityAmount || 0;
  const unclaimed = data?.unclaimedEstimatedAmount || 0;
  const claimRatio = data?.claimRatioPercent || 0;

  const expenseList = data?.expenseList || [];
  const indemnityList = data?.indemnityList || [];

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const expenseRows = expenseList.slice(0, 30).map((item, idx) => `
    <tr>
      <td style="text-align: center; color: #64748b;">${idx + 1}</td>
      <td style="text-align: center; font-weight: 600;">${item.displayDate || item.date || '-'}</td>
      <td style="text-align: center;"><span class="badge-person">${item.insuredPerson || targetName}</span></td>
      <td style="font-weight: 700; color: #0f172a;">${item.orgName || '-'}</td>
      <td style="text-align: center; color: #475569;">${item.category || '병원 진료비'}</td>
      <td style="text-align: right; font-weight: 800; color: #e11d48;">${(item.amount || 0).toLocaleString()}원</td>
    </tr>
  `).join('');

  const indemnityRows = indemnityList.map((item, idx) => `
    <tr>
      <td style="text-align: center; color: #64748b;">${idx + 1}</td>
      <td style="text-align: center; font-weight: 600;">${item.displayDate || item.date || '-'}</td>
      <td style="text-align: center;"><span class="badge-person">${item.insuredPerson || targetName}</span></td>
      <td style="font-weight: 700; color: #0284c7;">${item.companyName || '-'}</td>
      <td style="text-align: center; color: #475569;">${item.insureType || '실손의료비'}</td>
      <td style="text-align: right; font-weight: 800; color: #0284c7;">${(item.amount || 0).toLocaleString()}원</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>[WLB] 국세청 연말정산 의료비 및 숨은 실손보험금 분석 리포트</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    body {
      background-color: #ffffff;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 11px;
      line-height: 1.4;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2.5px solid #e11d48;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .header-left h1 {
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .header-left p {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }
    .header-right {
      text-align: right;
      font-size: 10px;
      color: #475569;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .kpi-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px;
      background: #f8fafc;
    }
    .kpi-card.highlight {
      background: linear-gradient(135deg, #fff1f2, #ffe4e6);
      border-color: #f43f5e;
    }
    .kpi-label {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      margin-bottom: 4px;
    }
    .kpi-card.highlight .kpi-label {
      color: #e11d48;
    }
    .kpi-value {
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
    }
    .kpi-card.highlight .kpi-value {
      color: #e11d48;
    }
    .kpi-sub {
      font-size: 9px;
      color: #94a3b8;
      margin-top: 2px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 900;
      color: #0f172a;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-left: 4px solid #e11d48;
      padding-left: 8px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 10px;
    }
    .data-table th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 800;
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
      text-align: center;
    }
    .data-table td {
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
    }
    .badge-person {
      display: inline-block;
      padding: 2px 6px;
      background: #e0e7ff;
      color: #3730a3;
      border-radius: 4px;
      font-weight: 700;
      font-size: 9px;
    }
    .advice-box {
      background: #fff7ed;
      border: 1px solid #fdba74;
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .advice-title {
      font-size: 11px;
      font-weight: 900;
      color: #c2410c;
      margin-bottom: 4px;
    }
    .advice-text {
      font-size: 10px;
      color: #7c2d12;
      line-height: 1.5;
    }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      color: #94a3b8;
      margin-top: 10px;
    }
    .planner-badge {
      font-weight: 700;
      color: #334155;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <h1>국세청 연말정산 의료비·숨은 실손보험금 정밀 분석서</h1>
      <p>국세청 홈택스 공식 실시간 2-Way 본인인증 기반 분석 보고서</p>
    </div>
    <div class="header-right">
      <div><strong>고객명:</strong> ${targetName} 님 (${targetPhone || '인증 완료'})</div>
      <div><strong>발행일자:</strong> ${today}</div>
    </div>
  </div>

  <!-- 4 Core KPIs -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">총 병의원·약국 의료비</div>
      <div class="kpi-value">${totalExpense.toLocaleString()}원</div>
      <div class="kpi-sub">총 ${expenseList.length}건 지출 원장</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">실손보험금 수령액</div>
      <div class="kpi-value" style="color: #0284c7;">${totalIndemnity.toLocaleString()}원</div>
      <div class="kpi-sub">총 ${indemnityList.length}건 지급 확인</div>
    </div>
    <div class="kpi-card highlight">
      <div class="kpi-label">★ 미청구 숨은 실손보험금</div>
      <div class="kpi-value">${unclaimed.toLocaleString()}원</div>
      <div class="kpi-sub">3년 소멸시효 내 청구 가능</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">실손보험 청구율</div>
      <div class="kpi-value" style="color: #059669;">${claimRatio}%</div>
      <div class="kpi-sub">전체 의료비 대비 청구 비중</div>
    </div>
  </div>

  <!-- Professional Advice Box -->
  <div class="advice-box">
    <div class="advice-title">💡 WLB 전문가 실손보험금 청구 솔루션</div>
    <div class="advice-text">
      고객님의 최근 의료비 총 지출액 <strong>${totalExpense.toLocaleString()}원</strong> 중 실제 보험금으로 수령하신 금액은 <strong>${totalIndemnity.toLocaleString()}원</strong>으로, 약 <strong>${unclaimed.toLocaleString()}원</strong> 상당의 미청구 숨은 실손보험금이 발굴되었습니다.<br>
      상법상 보험금 청구권 소멸시효는 <strong>진료일로부터 3년</strong>이므로, 아래 병의원 지출 내역의 진료비 세부내역서 및 영수증을 준비하여 집중 청구를 진행하시기를 적극 권장합니다.
    </div>
  </div>

  <!-- Section 1: Expenses Table -->
  <div class="section-title">
    <span>🏥 병의원 및 약국 의료비 지출 원장 (총 ${expenseList.length}건)</span>
    <span style="font-size: 10px; color: #64748b; font-weight: 500;">최신순 정렬</span>
  </div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 30px;">No</th>
        <th style="width: 70px;">지출시기</th>
        <th style="width: 60px;">대상자</th>
        <th>의료기관 / 약국명</th>
        <th style="width: 80px;">구분</th>
        <th style="width: 90px;">지출금액</th>
      </tr>
    </thead>
    <tbody>
      ${expenseRows || '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">지출 내역이 없습니다.</td></tr>'}
    </tbody>
  </table>

  <!-- Section 2: Indemnity Table -->
  ${indemnityList.length > 0 ? `
  <div class="section-title" style="margin-top: 14px;">
    <span>🛡️ 보험사 실손의료비 수령 내역 (총 ${indemnityList.length}건)</span>
  </div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 30px;">No</th>
        <th style="width: 70px;">수령시기</th>
        <th style="width: 60px;">대상자</th>
        <th>보험회사명</th>
        <th style="width: 80px;">보험종목</th>
        <th style="width: 90px;">수령금액</th>
      </tr>
    </thead>
    <tbody>
      ${indemnityRows}
    </tbody>
  </table>
  ` : ''}

  <!-- Footer -->
  <div class="footer">
    <div class="planner-badge">
      담당 재무설계사: ${plannerName} (${plannerOrg} / ${plannerPhone})
    </div>
    <div>
      © WLB Financial Planning System. 본 문서는 고객의 동의하에 국세청 연말정산 간소화 자료를 기반으로 작성되었습니다.
    </div>
  </div>

</body>
</html>
  `;
}

module.exports = {
  generateMedicalExpenseReportHtml
};
