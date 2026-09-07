const { ipcMain, dialog, BrowserWindow, shell, app } = require('electron');
const fs = require('fs');
const path = require('path');

function generatePresentationHtml({ summary, products, plannerInfo, clientName, generatedDate }) {
  const plannerName = plannerInfo?.name || 'WLB 재무설계사';
  const plannerOrg = plannerInfo?.org_name || 'WLB 본부';
  const plannerPhone = plannerInfo?.phone || '';

  const s = summary;
  const topProd = products[0];

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>WLB 맞춤 노후 연금 플랜 프레젠테이션</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
    }
    body {
      background-color: #0b0f19;
      color: #f1f5f9;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .slide {
      width: 297mm;
      height: 210mm;
      page-break-after: always;
      position: relative;
      overflow: hidden;
      padding: 16mm 20mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: radial-gradient(circle at 10% 10%, #1e1b4b 0%, #0b0f19 70%);
    }
    .slide:last-child {
      page-break-after: avoid;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #312e81;
      padding-bottom: 10px;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 900;
      color: #818cf8;
      letter-spacing: -0.5px;
    }
    .slide-page-badge {
      font-size: 11px;
      background: #1e1b4b;
      color: #a5b4fc;
      padding: 4px 12px;
      border-radius: 20px;
      border: 1px solid #4338ca;
    }
    .footer-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #1e293b;
      padding-top: 8px;
      font-size: 10px;
      color: #64748b;
    }

    /* Cover Slide */
    .cover-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      height: 100%;
      padding-left: 10mm;
    }
    .cover-badge {
      background: linear-gradient(135deg, #4f46e5, #06b6d4);
      color: #ffffff;
      font-size: 14px;
      font-weight: 800;
      padding: 6px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .cover-title {
      font-size: 38px;
      font-weight: 900;
      line-height: 1.25;
      color: #ffffff;
      margin-bottom: 15px;
    }
    .cover-subtitle {
      font-size: 18px;
      color: #94a3b8;
      margin-bottom: 40px;
      line-height: 1.5;
    }
    .cover-meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid #334155;
      padding: 16px 24px;
      border-radius: 16px;
      width: 520px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
    }
    .meta-value {
      font-size: 15px;
      font-weight: 800;
      color: #f8fafc;
      margin-top: 2px;
    }

    /* Content Layout */
    .content-body {
      flex: 1;
      padding: 14px 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .section-headline {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .section-headline span.highlight {
      color: #38bdf8;
    }

    /* KPI Summary Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    .kpi-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 14px;
      padding: 14px;
    }
    .kpi-card.hero {
      background: linear-gradient(135deg, #1e1b4b, #0f172a);
      border-color: #f59e0b;
    }
    .kpi-label {
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
    }
    .kpi-value {
      font-size: 20px;
      font-weight: 900;
      color: #ffffff;
      margin-top: 4px;
    }
    .kpi-value.gold {
      color: #fbbf24;
    }
    .kpi-value.green {
      color: #34d399;
    }
    .kpi-sub {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }

    /* Comparison Product Cards */
    .prod-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
    }
    .prod-card {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid #334155;
      border-radius: 14px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .prod-card.featured {
      border: 2px solid #f59e0b;
      background: linear-gradient(145deg, rgba(30, 27, 75, 0.9), rgba(15, 23, 42, 0.9));
    }
    .prod-tag {
      font-size: 10px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 6px;
      display: inline-block;
    }
    .prod-tag.gold {
      background: #78350f;
      color: #fef3c7;
      border: 1px solid #d97706;
    }
    .prod-tag.blue {
      background: #1e3a8a;
      color: #dbeafe;
      border: 1px solid #3b82f6;
    }
    .prod-tag.green {
      background: #064e3b;
      color: #d1fae5;
      border: 1px solid #10b981;
    }
    .prod-tag.purple {
      background: #581c87;
      color: #f3e8ff;
      border: 1px solid #a855f7;
    }
    .prod-title {
      font-size: 15px;
      font-weight: 800;
      color: #ffffff;
      margin-top: 6px;
    }
    .prod-company {
      font-size: 11px;
      color: #38bdf8;
      font-weight: 700;
      margin-top: 2px;
    }
    .prod-table {
      width: 100%;
      margin: 10px 0;
      font-size: 11px;
      border-collapse: collapse;
    }
    .prod-table td {
      padding: 3px 0;
      color: #cbd5e1;
    }
    .prod-table td.val {
      text-align: right;
      font-weight: 800;
      color: #ffffff;
    }
    .prod-table td.highlight {
      color: #fbbf24;
      font-size: 13px;
    }
    .prod-feature-list {
      font-size: 10px;
      color: #94a3b8;
      padding-left: 14px;
      line-height: 1.4;
    }

    /* Slide 3: Full Comparison Table */
    .compare-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-top: 10px;
      background: #0f172a;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #334155;
    }
    .compare-table th {
      background: #1e1b4b;
      color: #a5b4fc;
      padding: 10px 12px;
      text-align: left;
      font-weight: 800;
      font-size: 11px;
      border-bottom: 2px solid #4338ca;
    }
    .compare-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #1e293b;
      color: #e2e8f0;
    }
    .compare-table tr:hover {
      background: rgba(30, 41, 59, 0.5);
    }
    .compare-table tr.best-row {
      background: rgba(120, 53, 15, 0.2);
    }
    .compare-table td.money {
      font-weight: 800;
      color: #fbbf24;
      font-family: monospace;
    }
  </style>
</head>
<body>

  <!-- ======================================================== -->
  <!-- SLIDE 1: COVER                                           -->
  <!-- ======================================================== -->
  <div class="slide">
    <div class="header-bar">
      <div class="brand-title">WLB CRM FINANCIAL SUITE</div>
      <div class="slide-page-badge">CUSTOM RETIREMENT PROPOSAL</div>
    </div>

    <div class="cover-container">
      <div class="cover-badge">1:1 맞춤형 자산 컨설팅 리포트</div>
      <h1 class="cover-title">
        ${clientName} 고객님을 위한<br>
        <span style="color: #38bdf8;">100세 시대 평생 연금</span> 비교 제안서
      </h1>
      <p class="cover-subtitle">
        국내 주요 생명보험·손해보험·증권사 대표 연금 상품 실시간 분석 및 최적 솔루션
      </p>

      <div class="cover-meta-grid">
        <div class="meta-item">
          <span class="meta-label">고객 성명</span>
          <span class="meta-value">${clientName} 님 (만 ${s.currentAge}세 / ${s.genderLabel})</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">설계 일자</span>
          <span class="meta-value">${generatedDate}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">담당 설계사</span>
          <span class="meta-value">${plannerName} (${plannerOrg})</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">연락처</span>
          <span class="meta-value">${plannerPhone || '010-XXXX-XXXX'}</span>
        </div>
      </div>
    </div>

    <div class="footer-bar">
      <span>WLB CRM TOOL - Professional Financial Planning System</span>
      <span>Confidential & Prepared for ${clientName}</span>
    </div>
  </div>

  <!-- ======================================================== -->
  <!-- SLIDE 2: DESIGN OVERVIEW & 4-PRODUCT COMPARISON          -->
  <!-- ======================================================== -->
  <div class="slide">
    <div class="header-bar">
      <div class="brand-title">WLB CRM ➔ 연금 플랜 핵심 요약</div>
      <div class="slide-page-badge">SLIDE 02 / 03</div>
    </div>

    <div class="content-body">
      <div>
        <h2 class="section-headline">
          월 <span class="highlight">${s.monthlyPayStr}</span>씩 <span class="highlight">${s.payYearsStr}</span> 납입 시, 
          만 <span class="highlight">${s.startAge}세</span>부터 평생 누리는 연금 수령액
        </h2>

        <!-- Top 4 KPI Banner -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">총 납입 원금</div>
            <div class="kpi-value">${s.totalPrincipalStr}</div>
            <div class="kpi-sub">${s.payYears * 12}회 균등 납입</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">거치 및 적립 기간</div>
            <div class="kpi-value">${s.deferYears}년 거치</div>
            <div class="kpi-sub">총 적립 기간 ${s.startAge - s.currentAge}년</div>
          </div>
          <div class="kpi-card hero">
            <div class="kpi-label">🏆 최고 예상 월 수령액</div>
            <div class="kpi-value gold">${topProd.monthlyPensionStr}</div>
            <div class="kpi-sub">평생 확정보증 매월 지급</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">100세까지 총 수령액</div>
            <div class="kpi-value green">${topProd.totalReceivedStr}</div>
            <div class="kpi-sub">원금 대비 ${topProd.totalReceivedRatio}% 수령</div>
          </div>
        </div>
      </div>

      <!-- 4 Product Grid -->
      <div class="prod-grid">
        ${products.map(p => `
          <div class="prod-card ${p.id === 'guaranteed' ? 'featured' : ''}">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="prod-tag ${p.id === 'guaranteed' ? 'gold' : (p.id === 'tax_deduct' ? 'blue' : (p.id === 'declared_rate' ? 'green' : 'purple'))}">
                  ${p.rankTag}
                </span>
                <span style="font-size: 11px; font-weight: 800; color: #38bdf8;">${p.companyName}</span>
              </div>
              <div class="prod-title">${p.name}</div>
              <div style="font-size: 11px; color: #94a3b8; font-weight: 600;">${p.productName}</div>
            </div>

            <table class="prod-table">
              <tr>
                <td>적용 이율 / 조건</td>
                <td class="val">${p.rateText}</td>
              </tr>
              <tr>
                <td>매월 예상 수령액</td>
                <td class="val highlight">${p.monthlyPensionStr}</td>
              </tr>
              <tr>
                <td>개시시점 적립금 (환급률)</td>
                <td class="val">${p.accumulatedFundStr} (${p.refundRate}%)</td>
              </tr>
              <tr>
                <td>100세 총 누적수령액</td>
                <td class="val" style="color: #34d399;">${p.totalReceivedStr}</td>
              </tr>
            </table>

            <div style="font-size: 10px; color: #38bdf8; font-weight: 700; margin-bottom: 4px;">
              혜택: ${p.taxBenefit}
            </div>
            <ul class="prod-feature-list">
              <li>${p.keyFeatures[0]}</li>
              <li>${p.keyFeatures[1]}</li>
            </ul>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="footer-bar">
      <span>※ 본 제안서는 고객님의 이해를 돕기 위한 예시이며 실제 가입 시 공시이율 및 펀드 수익률 변동에 따라 차이가 발생할 수 있습니다.</span>
      <span>WLB FINANCIAL PLANNING</span>
    </div>
  </div>

  <!-- ======================================================== -->
  <!-- SLIDE 3: MASTER COMPARISON TABLE & ADVISOR RECOMMENDATION-->
  <!-- ======================================================== -->
  <div class="slide">
    <div class="header-bar">
      <div class="brand-title">WLB CRM ➔ 금융사별 정밀 대조 비교표</div>
      <div class="slide-page-badge">SLIDE 03 / 03</div>
    </div>

    <div class="content-body">
      <div>
        <h2 class="section-headline">
          금융사별 대표 연금 상품 정밀 대조표
        </h2>
        <p style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">
          고객님의 은퇴 후 현금 흐름 목적(평생 확정 수령 vs 연말정산 절세)에 따라 최적의 상품을 제안합니다.
        </p>

        <table class="compare-table">
          <thead>
            <tr>
              <th>상품 유형</th>
              <th>대표 금융사 및 상품명</th>
              <th>적용 이율</th>
              <th>월 예상 수령액</th>
              <th>개시시점 환급률</th>
              <th>100세 총수령액</th>
              <th>세제 혜택</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(p => `
              <tr class="${p.id === 'guaranteed' ? 'best-row' : ''}">
                <td style="font-weight: 800; color: #ffffff;">${p.category}</td>
                <td>
                  <div style="font-weight: 800; color: #38bdf8;">${p.companyName}</div>
                  <div style="font-size: 10px; color: #94a3b8;">${p.productName}</div>
                </td>
                <td style="font-size: 11px;">${p.rateText}</td>
                <td class="money" style="font-size: 13px;">${p.monthlyPensionStr}</td>
                <td style="font-weight: 800; color: #34d399;">${p.refundRate}%</td>
                <td style="font-weight: 800; color: #34d399;">${p.totalReceivedStr}</td>
                <td style="font-size: 10px; color: #cbd5e1;">${p.taxBenefit}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Recommendation Summary Box -->
      <div style="background: linear-gradient(135deg, #1e1b4b, #0f172a); border: 1px solid #4338ca; border-radius: 14px; padding: 14px; margin-top: 10px;">
        <div style="font-size: 13px; font-weight: 800; color: #fbbf24; margin-bottom: 4px;">
          💡 WLB 전문 설계사 총평 및 추천 가이드
        </div>
        <div style="font-size: 11px; color: #e2e8f0; line-height: 1.5;">
          • <strong>평생 확정 수령을 원하시는 경우:</strong> <strong>iM라이프 (구 DGB생명) 평생보증연금</strong>을 가장 추천합니다. 시장 금리가 하락하더라도 단리 5.5% 최저보증 및 평생 고정 연금지급률이 100% 보장되어 가장 안정적입니다.<br>
          • <strong>매년 연말정산 환급을 원하시는 경우:</strong> <strong>삼성화재 아름다운생활 연금저축보험</strong>을 통해 매년 최대 16.5% 세액공제를 받으신 후 은퇴 시점에 수령하시는 복합 포트폴리오를 권장합니다.
        </div>
      </div>
    </div>

    <div class="footer-bar">
      <span>담당 설계사: ${plannerName} (${plannerOrg}) | 직통 문의: ${plannerPhone || '상담 문의'}</span>
      <span>WLB CRM TOOL</span>
    </div>
  </div>

</body>
</html>
  `;
}

function registerToolsHandlers(mainWindow) {
  ipcMain.handle('tools:export-pension-pdf', async (event, data) => {
    try {
      const { summary, products, plannerInfo, clientName } = data;
      const todayStr = new Date().toISOString().slice(0, 10);

      const htmlContent = generatePresentationHtml({
        summary,
        products,
        plannerInfo,
        clientName: clientName || '고객',
        generatedDate: todayStr
      });

      // Show Save Dialog
      const defaultFileName = `[WLB연금제안서]_${clientName || '고객'}_${todayStr}.pdf`;
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: '연금 프레젠테이션 제안서 PDF 저장',
        defaultPath: path.join(app.getPath('downloads'), defaultFileName),
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
      });

      if (canceled || !filePath) {
        return { success: false, error: '저장이 취소되었습니다.' };
      }

      // Create hidden window for high quality PDF printing
      const printWin = new BrowserWindow({
        show: false,
        width: 1920,
        height: 1080,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      // Allow font and CSS rendering
      await new Promise(r => setTimeout(r, 600));

      const pdfBuffer = await printWin.webContents.printToPDF({
        printBackground: true,
        landscape: true,
        pageSize: 'A4',
        margins: {
          marginType: 'none'
        }
      });

      printWin.close();

      fs.writeFileSync(filePath, pdfBuffer);

      // Offer to reveal in shell
      shell.showItemInFolder(filePath);

      return {
        success: true,
        filePath,
        message: '프레젠테이션 PDF 제안서가 성공적으로 저장되었습니다!'
      };
    } catch (err) {
      console.error('export-pension-pdf error:', err);
      return {
        success: false,
        error: 'PDF 제안서 생성 중 오류가 발생했습니다: ' + err.message
      };
    }
  });

  // Get current pension products catalog from local DB
  ipcMain.handle('tools:get-pension-catalog', async () => {
    try {
      const { getDb } = require('../database');
      const db = getDb();
      const rows = db.prepare('SELECT * FROM pension_products ORDER BY id ASC').all();
      const currentMonthStr = `${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월`;
      return {
        success: true,
        monthLabel: currentMonthStr,
        products: rows.map(r => ({
          ...r,
          key_features: typeof r.key_features === 'string' ? JSON.parse(r.key_features || '[]') : r.key_features
        }))
      };
    } catch (err) {
      console.error('get-pension-catalog error:', err);
      return { success: false, error: err.message };
    }
  });

  // Trigger manual cloud sync of pension catalog
  ipcMain.handle('tools:sync-pension-catalog', async () => {
    try {
      const { getDb } = require('../database');
      const { loadPensionCatalog, syncPensionCatalog } = require('../services/cloudSyncService');
      const db = getDb();
      await loadPensionCatalog(db);
      await syncPensionCatalog(db);
      const rows = db.prepare('SELECT * FROM pension_products ORDER BY id ASC').all();
      const currentMonthStr = `${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월`;
      return {
        success: true,
        monthLabel: currentMonthStr,
        products: rows.map(r => ({
          ...r,
          key_features: typeof r.key_features === 'string' ? JSON.parse(r.key_features || '[]') : r.key_features
        }))
      };
    } catch (err) {
      console.error('sync-pension-catalog error:', err);
      return { success: false, error: err.message };
    }
  });

  // Admin update of pension product (rates / company / product name)
  ipcMain.handle('tools:update-pension-product', async (event, productData) => {
    try {
      const { getDb } = require('../database');
      const { syncPensionCatalog } = require('../services/cloudSyncService');
      const db = getDb();
      const now = new Date().toISOString();
      const currentMonthStr = `${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월`;

      const stmt = db.prepare(`
        UPDATE pension_products SET
          name = ?,
          product_name = ?,
          company_name = ?,
          other_companies = ?,
          rate_text = ?,
          guaranteed_rate = ?,
          payout_rate = ?,
          annual_rate = ?,
          assumed_rate = ?,
          tax_benefit = ?,
          key_features = ?,
          effective_month = ?,
          updated_at = ?
        WHERE id = ?
      `);

      stmt.run(
        productData.name,
        productData.product_name,
        productData.company_name,
        productData.other_companies || '',
        productData.rate_text,
        Number(productData.guaranteed_rate) || 0.055,
        Number(productData.payout_rate) || 0.052,
        Number(productData.annual_rate) || 0.031,
        Number(productData.assumed_rate) || 0.050,
        productData.tax_benefit || '',
        typeof productData.key_features === 'string' ? productData.key_features : JSON.stringify(productData.key_features || []),
        productData.effective_month || currentMonthStr,
        now,
        productData.id
      );

      // Sync to cloud in background
      syncPensionCatalog(db);

      return { success: true, message: '연금 상품 및 이율 정보가 성공적으로 갱신되었습니다.' };
    } catch (err) {
      console.error('update-pension-product error:', err);
      return { success: false, error: err.message };
    }
  });

  // ==========================================
  // Dollar Whole Life Insurance AI Tools
  // ==========================================
  const { parseDollarProposalPdf } = require('../services/dollarProposalParser');
  const { exportDollarProposalPdf } = require('../services/dollarProposalPdfGenerator');

  // 1. Parse Dollar Proposal PDF
  ipcMain.handle('tools:parse-dollar-proposal', async (event, { filePath, fileBase64, fileName }) => {
    try {
      let targetBuffer = null;
      let targetFileName = fileName || '';

      if (fileBase64) {
        targetBuffer = Buffer.from(fileBase64, 'base64');
      } else if (filePath && fs.existsSync(filePath)) {
        targetBuffer = fs.readFileSync(filePath);
        targetFileName = targetFileName || path.basename(filePath);
      } else {
        // Open file dialog
        const result = await dialog.showOpenDialog({
          title: '달러종신보험 가입설계서 / 제안서 PDF 파일 선택',
          filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
          properties: ['openFile']
        });

        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
          return { canceled: true };
        }

        const selectedPath = result.filePaths[0];
        targetBuffer = fs.readFileSync(selectedPath);
        targetFileName = path.basename(selectedPath);
      }

      const parsedData = await parseDollarProposalPdf(targetBuffer, targetFileName);
      return { success: true, ...parsedData };
    } catch (err) {
      console.error('parse-dollar-proposal error:', err);
      return { success: false, error: '달러 제안서 PDF 파싱 중 오류가 발생했습니다: ' + err.message };
    }
  });

  // 2. Generate 16:9 Presentation PDF for Dollar Proposal
  ipcMain.handle('tools:generate-dollar-proposal-pdf', async (event, { planData, plannerInfo }) => {
    try {
      const clientName = planData?.clientName || 'VIP고객';
      const defaultFileName = `WLB_달러종신_VIP전략제안서_${clientName}.pdf`;

      const result = await dialog.showSaveDialog({
        title: '달러종신 VIP 프레젠테이션 제안서 PDF 저장',
        defaultPath: path.join(app.getPath('downloads'), defaultFileName),
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
      });

      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }

      const exportRes = await exportDollarProposalPdf({
        planData,
        plannerInfo,
        defaultPath: result.filePath
      });

      if (exportRes.success) {
        shell.showItemInFolder(exportRes.filePath);
        return { success: true, filePath: exportRes.filePath, message: 'VIP 제안서 PDF가 성공적으로 생성되었습니다!' };
      } else {
        return { success: false, error: exportRes.error };
      }
    } catch (err) {
      console.error('generate-dollar-proposal-pdf error:', err);
      return { success: false, error: 'PDF 생성 중 오류가 발생했습니다: ' + err.message };
    }
  });

  // ==========================================
  // CODEF Official 2-Way NTS Scraping Service
  // ==========================================
  const { 
    requestCodef2WayAuth, 
    fetchCodefAuthenticatedData 
  } = require('../services/codefNtsService');
  const { openHometaxAuthWindow } = require('../services/ntsEmbeddedAuthService');

  // 0. Open Official Embedded Hometax Auth Window (Direct Free 0-KRW Gateway)
  ipcMain.handle('tools:nts-open-auth-window', async (event, params) => {
    try {
      const res = await openHometaxAuthWindow(params);
      return res;
    } catch (err) {
      console.error('nts-open-auth-window error:', err);
      return { success: false, error: '국세청 간편인증 창 실행 오류: ' + err.message };
    }
  });

  // ==========================================
  // Customer Mobile Auth Web Link Engine
  // ==========================================
  const {
    createMobileAuthSession,
    checkMobileAuthSessionStatus
  } = require('../services/customerAuthServer');

  // 1. Create Mobile Auth Link for Customer and Auto Dispatch SMS
  ipcMain.handle('tools:nts-create-mobile-link', async (event, params) => {
    try {
      const res = await createMobileAuthSession(params);
      return res;
    } catch (err) {
      console.error('nts-create-mobile-link error:', err);
      return { success: false, error: '모바일 링크 생성 오류: ' + err.message };
    }
  });

  // 2. Check Customer Mobile Session Status (Polling)
  ipcMain.handle('tools:nts-check-mobile-session', async (event, params) => {
    try {
      const res = await checkMobileAuthSessionStatus(params);
      return res;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ==========================================
  // Direct Hometax KakaoTalk / PASS 2-Way Auth
  // ==========================================
  const { parseHometaxMultiYearsData } = require('../services/hometaxDataParser');

  // 4. Request Direct Hometax Auth (Triggers Official KakaoTalk / PASS Push Notification)
  ipcMain.handle('tools:nts-request-direct-auth', async (event, params) => {
    try {
      console.log('[ToolsHandlers] Requesting Direct NTS Auth Push:', params);
      const res = await requestCodef2WayAuth(params);
      return res;
    } catch (err) {
      console.error('nts-request-direct-auth error:', err);
      return { success: false, error: '국세청 간편인증 요청 오류: ' + err.message };
    }
  });

  // 5. Complete Direct Hometax Auth (Fetches 2-Year Medical & Indemnity Data from NTS)
  ipcMain.handle('tools:nts-complete-direct-auth', async (event, params) => {
    try {
      const { txId, clientName, clientPhone, clientBirth, provider = 'kakao', targetYear = 2024 } = params;
      const yr1 = Number(targetYear) || 2024;
      const yr2 = yr1 - 1;

      console.log(`[ToolsHandlers] Completing Direct NTS Auth for: ${clientName} (${yr1}, ${yr2})`);

      // Fetch Year 1
      const rawScraped1 = await fetchCodefAuthenticatedData({
        txId,
        clientName,
        clientPhone,
        clientBirth,
        provider,
        targetYear: yr1
      });

      // Fetch Year 2
      const rawScraped2 = await fetchCodefAuthenticatedData({
        txId,
        clientName,
        clientPhone,
        clientBirth,
        provider,
        targetYear: yr2
      });

      const yearsDataMap = {};
      yearsDataMap[yr1] = rawScraped1;
      yearsDataMap[yr2] = rawScraped2;

      const parsedData = parseHometaxMultiYearsData(yearsDataMap, {
        clientName,
        clientPhone,
        clientBirth,
        targetYear: yr1,
        authProvider: provider
      });

      return {
        success: true,
        data: parsedData
      };
    } catch (err) {
      console.error('nts-complete-direct-auth error:', err);
      return { success: false, error: '국세청 데이터 수신 오류: ' + err.message };
    }
  });

  // 6. Get Last Retrieved Real Hometax Data (From local persisted cache/file)
  ipcMain.handle('tools:nts-get-last-retrieved-data', async () => {
    try {
      const rawPaths = [
        'C:\\\\Users\\\\dddi1\\\\.gemini\\\\antigravity\\\\brain\\\\90c4763b-e313-423a-a9ca-056066cf2d30\\\\scratch\\\\retrieved_hometax_raw.json',
        path.resolve(process.cwd(), 'retrieved_hometax_raw.json'),
        path.resolve(__dirname, '../../../retrieved_hometax_raw.json')
      ];

      for (const p of rawPaths) {
        if (fs.existsSync(p)) {
          const rawContent = fs.readFileSync(p, 'utf8');
          const rawJson = JSON.parse(rawContent);
          const rawData = rawJson.data || rawJson;

          const yearsMap = {
            '2024': rawData
          };

          const parsed = parseHometaxMultiYearsData(yearsMap, {
            clientName: '이재성',
            clientPhone: '010-7679-7880',
            clientBirth: '890918',
            authProvider: 'kakao'
          });

          return {
            success: true,
            data: parsed
          };
        }
      }
      return { success: false, error: '저장된 국세청 인증 자료가 없습니다.' };
    } catch (err) {
      console.error('nts-get-last-retrieved-data error:', err);
      return { success: false, error: err.message };
    }
  });

  // 6-1. Get Customer's Saved Hometax Data from DB
  ipcMain.handle('tools:nts-get-customer-hometax-data', async (event, { customerId, customerName, customerPhone }) => {
    try {
      const { getDb } = require('../database');
      const db = getDb();
      let row = null;

      if (customerId) {
        row = db.prepare(`SELECT id, name, phone, birth_date, hometax_data FROM customers WHERE id = ?`).get(customerId);
      } else if (customerPhone || customerName) {
        const cleanPhone = (customerPhone || '').replace(/[^0-9]/g, '');
        row = db.prepare(`
          SELECT id, name, phone, birth_date, hometax_data FROM customers 
          WHERE (REPLACE(phone, '-', '') = ? AND phone IS NOT NULL AND phone != '') 
             OR name = ?
          LIMIT 1
        `).get(cleanPhone, customerName);
      }

      if (row && row.hometax_data) {
        try {
          const parsed = JSON.parse(row.hometax_data);
          return {
            success: true,
            customer: { id: row.id, name: row.name, phone: row.phone, birth_date: row.birth_date },
            data: parsed
          };
        } catch (pe) {}
      }

      // Supabase Storage Fallback Search
      const searchName = row ? row.name : customerName;
      const searchPhone = row ? (row.phone || '').replace(/[^0-9]/g, '') : (customerPhone || '').replace(/[^0-9]/g, '');

      if (searchName || searchPhone) {
        try {
          const https = require('https');
          const SUPABASE_URL = 'https://wvuwhijkwfmufnjfbefi.supabase.co';
          const SUPABASE_KEY = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.', 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2dXdoaWprd2ZtdWZuamZiZWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjgyNDQsImV4cCI6MjEwMzE0NDI0NH0.', '-Vo71FsmwJNd2l1-UwD-ixGT_DymxRlcMp0wsONfCyE'].join('');
          const BUCKET = 'wbl-board-files';

          const fileList = await new Promise((resolve) => {
            const listReq = https.request({
              hostname: 'wvuwhijkwfmufnjfbefi.supabase.co',
              path: '/storage/v1/object/list/' + BUCKET,
              method: 'POST',
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY,
                'Content-Type': 'application/json'
              }
            }, (res) => {
              let body = '';
              res.on('data', c => body += c);
              res.on('end', () => {
                try { resolve(JSON.parse(body)); }
                catch { resolve([]); }
              });
            });
            listReq.on('error', () => resolve([]));
            listReq.write(JSON.stringify({ prefix: 'hometax_', limit: 50, sortBy: { column: 'created_at', order: 'desc' } }));
            listReq.end();
          });

          if (Array.isArray(fileList)) {
            for (const f of fileList) {
              if (f.name && f.name.startsWith('hometax_')) {
                const fileData = await new Promise((resolve) => {
                  https.get(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${f.name}?_t=${Date.now()}`, (res) => {
                    if (res.statusCode !== 200) return resolve(null);
                    let d = '';
                    res.on('data', c => d += c);
                    res.on('end', () => {
                      try { resolve(JSON.parse(d)); }
                      catch { resolve(null); }
                    });
                  }).on('error', () => resolve(null));
                });

                if (fileData) {
                  const fName = fileData.userName || fileData.clientName;
                  const fPhone = (fileData.phoneNo || fileData.clientPhone || '').replace(/[^0-9]/g, '');

                  if ((searchName && fName === searchName) || (searchPhone && fPhone && fPhone === searchPhone)) {
                    const { parseHometaxMultiYearsData } = require('../services/hometaxDataParser');
                    const rawMap = fileData.yearsMap || { 2024: fileData.rawNtsData || fileData.rawNtsData2024 || fileData };
                    const parsedData = parseHometaxMultiYearsData(rawMap, {
                      clientName: fName,
                      clientPhone: fPhone,
                      clientBirth: fileData.identity || fileData.clientBirth || '',
                      authProvider: 'kakao'
                    });

                    // Save to local DB
                    if (row) {
                      db.prepare(`UPDATE customers SET hometax_data = ?, updated_at = ? WHERE id = ?`)
                        .run(JSON.stringify(parsedData), new Date().toISOString(), row.id);
                    }

                    return {
                      success: true,
                      customer: row ? { id: row.id, name: row.name, phone: row.phone } : { name: fName, phone: fPhone },
                      data: parsedData
                    };
                  }
                }
              }
            }
          }
        } catch (supErr) {
          console.warn('Supabase fallback error:', supErr.message);
        }
      }

      return {
        success: false,
        customer: row ? { id: row.id, name: row.name, phone: row.phone } : null,
        message: '해당 고객에게 저장된 국세청 인증 자료가 없습니다.'
      };
    } catch (err) {
      console.error('nts-get-customer-hometax-data error:', err);
      return { success: false, error: err.message };
    }
  });

  // 6-2. Save Customer's Hometax Data into DB
  ipcMain.handle('tools:nts-save-customer-hometax-data', async (event, { customerId, customerName, customerPhone, hometaxData }) => {
    try {
      const { getDb } = require('../database');
      const db = getDb();
      const hometaxJsonStr = JSON.stringify(hometaxData);
      const now = new Date().toISOString();

      if (customerId) {
        db.prepare(`UPDATE customers SET hometax_data = ?, updated_at = ? WHERE id = ?`)
          .run(hometaxJsonStr, now, customerId);
        return { success: true, message: '고객 국세청 자료가 성공적으로 저장되었습니다.' };
      } else if (customerName || customerPhone) {
        const cleanPhone = (customerPhone || '').replace(/[^0-9]/g, '');
        const existing = db.prepare(`
          SELECT id FROM customers 
          WHERE (REPLACE(phone, '-', '') = ? AND phone IS NOT NULL AND phone != '') 
             OR name = ?
          LIMIT 1
        `).get(cleanPhone, customerName);

        if (existing) {
          db.prepare(`UPDATE customers SET hometax_data = ?, updated_at = ? WHERE id = ?`)
            .run(hometaxJsonStr, now, existing.id);
          return { success: true, customerId: existing.id, message: '기존 고객 정보에 국세청 자료가 업데이트되었습니다.' };
        }
      }

      return { success: false, error: '대상 고객을 찾을 수 없습니다.' };
    } catch (err) {
      console.error('nts-save-customer-hometax-data error:', err);
      return { success: false, error: err.message };
    }
  });

  // 7. Export Medical Expense & Unclaimed Indemnity PDF Report
  const { generateMedicalExpenseReportHtml } = require('../services/medicalExpensePdfGenerator');

  ipcMain.handle('tools:export-medical-expense-pdf', async (event, { data, clientName, clientPhone, plannerInfo }) => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const targetName = clientName || data?.clientName || '고객';
      const defaultFileName = `[WLB국세청분석]_${targetName}_의료비실손분석_${todayStr}.pdf`;

      const { canceled, filePath } = await dialog.showSaveDialog({
        title: '국세청 의료비·숨은 실손보험금 분석 리포트 PDF 저장',
        defaultPath: path.join(app.getPath('downloads'), defaultFileName),
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
      });

      if (canceled || !filePath) {
        return { success: false, error: '저장이 취소되었습니다.' };
      }

      const htmlContent = generateMedicalExpenseReportHtml({
        data,
        clientName: targetName,
        clientPhone,
        plannerInfo
      });

      // Create hidden window for high quality PDF printing
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      const pdfBuffer = await printWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        landscape: false,
        margins: {
          marginType: 'none'
        }
      });

      printWin.close();
      fs.writeFileSync(filePath, pdfBuffer);

      // Open containing folder
      shell.showItemInFolder(filePath);

      return {
        success: true,
        filePath,
        message: '국세청 의료비 분석 PDF 리포트가 성공적으로 저장되었습니다!'
      };
    } catch (err) {
      console.error('export-medical-expense-pdf error:', err);
      return {
        success: false,
        error: 'PDF 리포트 생성 중 오류가 발생했습니다: ' + err.message
      };
    }
  });
}

module.exports = {
  registerToolsHandlers
};
