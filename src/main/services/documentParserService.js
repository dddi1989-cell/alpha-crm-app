const path = require('path');
const fs = require('fs');
const { BrowserWindow } = require('electron');

function normalizeCustomerInsurances(customer) {
  if (!customer) return customer;
  let insurances = [];
  if (customer.insurances) {
    try {
      insurances = typeof customer.insurances === 'string' ? JSON.parse(customer.insurances) : customer.insurances;
    } catch (e) {
      insurances = [];
    }
  } else if (customer.insurance_provider || customer.insurance_details) {
    insurances = [{ provider: customer.insurance_provider || '', details: customer.insurance_details || '' }];
  }
  return {
    ...customer,
    insurances: Array.isArray(insurances) ? insurances : []
  };
}

function getExistingUploadedPdf(company) {
  const devDir = path.join(__dirname, '../../../claim_forms');
  const prodDir = process.resourcesPath ? path.join(process.resourcesPath, 'claim_forms') : devDir;
  const searchDirs = [prodDir, devDir];

  const companyId = typeof company === 'object' ? (company.id || '') : String(company || '');
  const companyName = typeof company === 'object' ? (company.name || '') : String(company || '');

  const uploadedFilesMap = {
    'abl_life': 'abl_life.pdf',
    'ABL생명': 'abl_life.pdf',
    'db_life': 'db_life.pdf',
    'DB생명': 'db_life.pdf',
    'im_life': 'im_life.pdf',
    'IM라이프': 'im_life.pdf',
    'kb_life': 'kb_life.pdf',
    'KB라이프': 'kb_life.pdf',
    'kdb_life': 'kdb_life.pdf',
    'KDB생명': 'kdb_life.pdf',
    'kyobo_life': 'kyobo_life.pdf',
    '교보생명': 'kyobo_life.pdf',
    'nh_life': 'nh_life.pdf',
    '농협생명': 'nh_life.pdf',
    'dongyang_life': 'dongyang_life.pdf',
    '동양생명': 'dongyang_life.pdf',
    'lina_life': 'lina_life.pdf',
    '라이나생명': 'lina_life.pdf',
    'metlife': 'metlife.pdf',
    '메트라이프': 'metlife.pdf',
    'mirae_asset_life': 'mirae_asset_life.pdf',
    '미래에셋생명': 'mirae_asset_life.pdf',
    'samsung_life': 'samsung_life.pdf',
    '삼성생명': 'samsung_life.pdf',
    'shinhan_life': 'shinhan_life.pdf',
    '신한라이프': 'shinhan_life.pdf',
    'chubb_life': 'chubb_life.pdf',
    '처브라이프': 'chubb_life.pdf',
    'aia_life': 'aia_life.pdf',
    'AIA생명': 'aia_life.pdf',
    'epost_life': 'epost_life.pdf',
    '우체국보험': 'epost_life.pdf',
    '우체국생명': 'epost_life.pdf',
    'cardif_life': 'cardif_life.pdf',
    '카디프생명': 'cardif_life.pdf',
    'fubon_hyundai': 'fubon_hyundai.pdf',
    '푸본현대생명': 'fubon_hyundai.pdf',
    'hana_life': 'hana_life.pdf',
    '하나생명': 'hana_life.pdf',
    'hanwha_life': 'hanwha_life.pdf',
    '한화생명': 'hanwha_life.pdf',
    'heungkuk_life': 'heungkuk_life.pdf',
    '흥국생명': 'heungkuk_life.pdf',
    'aig_insurance': 'aig_insurance.pdf',
    'AIG손해보험': 'aig_insurance.pdf',
    'db_promy': 'db_promy.pdf',
    'DB손해보험': 'db_promy.pdf',
    'kb_insurance': 'kb_insurance.pdf',
    'KB손해보험': 'kb_insurance.pdf',
    'mg_insurance': 'mg_insurance.pdf',
    'MG(예별)손해보험': 'mg_insurance.pdf',
    'nh_fire': 'nh_fire.pdf',
    '농협손해보험': 'nh_fire.pdf',
    'lina_fire': 'lina_fire.pdf',
    '라이나손해보험': 'lina_fire.pdf',
    'lotte_insurance': 'lotte_insurance.pdf',
    '롯데손해보험': 'lotte_insurance.pdf',
    'meritz_fire': 'meritz_fire.pdf',
    '메리츠화재': 'meritz_fire.pdf',
    'samsung_fire': 'samsung_fire.pdf',
    '삼성화재': 'samsung_fire.pdf',
    'hana_insurance': 'hana_insurance.pdf',
    '하나손해보험': 'hana_insurance.pdf',
    'hanwha_general': 'hanwha_general.pdf',
    '한화손해보험': 'hanwha_general.pdf',
    'hyundai_marine': 'hyundai_marine.pdf',
    '현대해상': 'hyundai_marine.pdf',
    'heungkuk_fire': 'heungkuk_fire.pdf',
    '흥국화재': 'heungkuk_fire.pdf'
  };

  const matchedFile = uploadedFilesMap[companyId] || uploadedFilesMap[companyName];
  if (!matchedFile) return null;

  for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
      const fullPath = path.join(dir, matchedFile);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
  }
  return null;
}

async function generatePdfForCompany(company, outputPath) {
  const htmlContent = '<!DOCTYPE html>' +
'<html lang="ko">' +
'<head>' +
'  <meta charset="UTF-8">' +
'  <title>' + company.name + ' 공식 보험금 청구서</title>' +
'  <style>' +
'    @page { size: A4; margin: 12mm; }' +
'    body { font-family: "Malgun Gothic", "맑은 고딕", sans-serif; color: #0f172a; line-height: 1.5; padding: 10px; }' +
'    .header { text-align: center; border-bottom: 3px solid #1e40af; padding-bottom: 12px; margin-bottom: 20px; }' +
'    .header h1 { font-size: 22px; margin: 0; color: #1e40af; font-weight: bold; }' +
'    .info-box { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 12px 18px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; }' +
'    .info-box p { margin: 4px 0; }' +
'    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }' +
'    th, td { border: 1px solid #94a3b8; padding: 8px 10px; text-align: left; }' +
'    th { background: #e2e8f0; font-weight: bold; width: 22%; color: #0f172a; }' +
'    .section-title { font-size: 14px; font-weight: bold; margin-top: 18px; margin-bottom: 8px; border-left: 4px solid #2563eb; padding-left: 8px; color: #0f172a; }' +
'    .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 12px; }' +
'  </style>' +
'</head>' +
'<body>' +
'  <div class="header">' +
'    <h1>[' + company.name + '] 공식 사고보험금 청구서 및 개인정보 동의서</h1>' +
'  </div>' +
'  <div class="info-box">' +
'    <p><strong>보험사명:</strong> ' + company.name + ' (' + company.type + ')</p>' +
'    <p><strong>보험금 청구 접수 FAX:</strong> <span style="color:#d97706; font-weight:bold; font-size:15px;">' + company.fax + '</span></p>' +
'    <p><strong>고객센터 (콜센터):</strong> ' + company.tel + '</p>' +
(company.url ? '    <p><strong>공식 홈페이지:</strong> ' + company.url + '</p>' : '') +
'  </div>' +
'  <div class="section-title">1. 피보험자 / 청구인 인적사항</div>' +
'  <table>' +
'    <tr><th>성명 (피보험자)</th><td></td><th>주민등록번호</th><td>-</td></tr>' +
'    <tr><th>휴대폰 번호</th><td></td><th>이메일 주소</th><td></td></tr>' +
'    <tr><th>청구인과의 관계</th><td colspan="3">[ ] 본인 &nbsp;&nbsp;&nbsp; [ ] 배우자 &nbsp;&nbsp;&nbsp; [ ] 자녀 &nbsp;&nbsp;&nbsp; [ ] 기타</td></tr>' +
'  </table>' +
'  <div class="section-title">2. 사고 / 질병 내용</div>' +
'  <table>' +
'    <tr><th>사고/진단 일시</th><td>202 &nbsp;년 &nbsp;&nbsp;월 &nbsp;&nbsp;일</td><th>청구 구분</th><td>[ ] 실손 &nbsp; [ ] 수술 &nbsp; [ ] 입원 &nbsp; [ ] 진단 &nbsp; [ ] 기타</td></tr>' +
'    <tr><th>진단명 / 질병명</th><td colspan="3"></td></tr>' +
'    <tr><th>사고 및 경위 상세</th><td colspan="3" style="height: 55px;"></td></tr>' +
'  </table>' +
'  <div class="section-title">3. 보험금 수령 계좌 정보</div>' +
'  <table>' +
'    <tr><th>입금 은행</th><td></td><th>예금주 성명</th><td></td></tr>' +
'    <tr><th>계좌 번호</th><td colspan="3"></td></tr>' +
'  </table>' +
'  <div class="section-title">4. 개인(신용)정보 수집·이용 및 제공 동의</div>' +
'  <div style="font-size: 11px; border: 1px solid #cbd5e1; padding: 10px; background: #f8fafc; border-radius: 6px;">' +
'    본인은 ' + company.name + '에 보험금 청구 및 심사를 목적으로 개인(신용)정보를 수집·이용 및 제공하는 것에 동의합니다.<br>' +
'    동의일자: 202 &nbsp;&nbsp;년 &nbsp;&nbsp;&nbsp;&nbsp;월 &nbsp;&nbsp;&nbsp;&nbsp;일<br><br>' +
'    <strong>청구인 (서명/인): __________________________________________________</strong>' +
'  </div>' +
'  <div class="footer">' +
'    위 청구서를 작성하신 후 팩스(FAX: <strong>' + company.fax + '</strong>)로 접수하시거나 고객센터(<strong>' + company.tel + '</strong>)로 문의 바랍니다.' +
'  </div>' +
'</body>' +
'</html>';

  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false }
  });

  try {
    await pdfWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
    const pdfData = await pdfWindow.webContents.printToPDF({
      margins: { marginType: 'none' },
      pageSize: 'A4',
      printBackground: true
    });
    pdfWindow.destroy();
    fs.writeFileSync(outputPath, pdfData);
    return outputPath;
  } catch (err) {
    if (!pdfWindow.isDestroyed()) pdfWindow.destroy();
    throw err;
  }
}

async function extractTextFromPdfBuffer(pdfBuffer) {
  let textContent = '';
  try {
    const pdfModule = require('pdf-parse');
    if (pdfModule && pdfModule.PDFParse) {
      const uint8Array = new Uint8Array(pdfBuffer);
      const parser = new pdfModule.PDFParse(uint8Array);
      const res = await parser.getText();
      if (typeof res === 'string') textContent = res;
      else if (res && res.text) textContent = res.text;
    } else if (typeof pdfModule === 'function') {
      const data = await pdfModule(pdfBuffer);
      textContent = data.text || '';
    } else if (pdfModule && typeof pdfModule.default === 'function') {
      const data = await pdfModule.default(pdfBuffer);
      textContent = data.text || '';
    }
  } catch (e) {
    console.error('PDF text extraction error:', e);
  }
  return (textContent || '').replace(/\x00/g, '');
}

function parseCustomerNameFromFileName(filePath) {
  if (!filePath) return '';
  const baseName = path.basename(filePath, path.extname(filePath)).trim();
  const cleanName = baseName.replace(/(보장분석|프로보장분석|프로|분석|리포트|보고서|보험|고객|제안서|_|\-|\(|\)|\[|\]|\s)/g, '').trim();
  if (cleanName && /^[가-힣]{2,5}$/.test(cleanName)) {
    return cleanName;
  }
  return '';
}

const reportInsuranceCompanies = [
  { key: '메리츠', name: '메리츠화재' },
  { key: '신한', name: '신한라이프' },
  { key: '흥국생명', name: '흥국생명' },
  { key: '흥국화재', name: '흥국화재' },
  { key: '흥국', name: '흥국화재' },
  { key: 'KB손보', name: 'KB손해보험' },
  { key: 'KB손해', name: 'KB손해보험' },
  { key: 'KB라이프', name: 'KB라이프' },
  { key: 'KB생명', name: 'KB라이프' },
  { key: 'KB', name: 'KB손해보험' },
  { key: '삼성화재', name: '삼성화재' },
  { key: '삼성생명', name: '삼성생명' },
  { key: '삼성', name: '삼성화재' },
  { key: 'DB손해', name: 'DB손해보험' },
  { key: 'DB생명', name: 'DB생명' },
  { key: 'DB프로미', name: 'DB손해보험' },
  { key: 'DB', name: 'DB손해보험' },
  { key: '현대해상', name: '현대해상' },
  { key: '현대', name: '현대해상' },
  { key: '교보생명', name: '교보생명' },
  { key: '교보', name: '교보생명' },
  { key: '농협생명', name: '농협생명' },
  { key: '농협손해', name: '농협손해보험' },
  { key: '농협', name: '농협손해보험' },
  { key: 'NH', name: '농협손해보험' },
  { key: '동양', name: '동양생명' },
  { key: '라이나', name: '라이나생명' },
  { key: '메트라이프', name: '메트라이프' },
  { key: '미래에셋', name: '미래에셋생명' },
  { key: '처브', name: '처브라이프' },
  { key: '푸본', name: '푸본현대생명' },
  { key: '하나', name: '하나손해보험' },
  { key: '한화생명', name: '한화생명' },
  { key: '한화손해', name: '한화손해보험' },
  { key: '한화', name: '한화손해보험' },
  { key: 'AIG', name: 'AIG손해보험' },
  { key: 'MG', name: 'MG손해보험' },
  { key: '롯데', name: '롯데손해보험' },
  { key: 'ABL', name: 'ABL생명' },
  { key: 'IM', name: 'IM라이프' },
  { key: 'KDB', name: 'KDB생명' }
];

function detectCompany(text) {
  if (!text) return '';
  const str = String(text);
  for (const c of reportInsuranceCompanies) {
    if (str.includes(c.key)) return c.name;
  }
  return '';
}

function formatDate(dStr) {
  if (!dStr || dStr.includes('종신') || dStr === '-') return '';
  const clean = String(dStr).replace(/\([^\)]*\)/g, '').replace(/\./g, '-').trim();
  const parts = clean.split('-');
  if (parts.length === 2) return parts[0] + '-' + parts[1].padStart(2, '0') + '-01';
  if (parts.length === 3) return parts[0] + '-' + parts[1].padStart(2, '0') + '-' + parts[2].padStart(2, '0');
  return clean;
}

function parseInsurancesFromReportText(textContent, filePath = '') {
  let customerName = parseCustomerNameFromFileName(filePath);
  const fullText = (textContent || '').replace(/\x00/g, '');
  const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  if (!customerName) {
    const nameMatch = fullText.match(/([가-힣\*]{2,5})\s*를\s*위한/) ||
                      fullText.match(/([가-힣\*]{2,5})님을\s*위한/) ||
                      fullText.match(/계약자\s*주피보험자\s*([가-힣\*]{2,5})/) ||
                      fullText.match(/주피보험자\s*[:\s]*([가-힣\*]{2,5})/) ||
                      fullText.match(/피보험자\s*[:\s]*([가-힣\*]{2,5})/) ||
                      fullText.match(/고객명\s*[:\s]*([가-힣\*]{2,5})/);
    if (nameMatch && nameMatch[1]) {
      customerName = nameMatch[1].trim().replace(/\*/g, '');
    }
  }

  const extractedPolicies = [];
  const seenSignatures = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rowMatch = line.match(/^(?:[\(\[\#]?\d{1,2}[\)\.\s\]]?\s*)?(.+?)[\s\t]+([\d,]+)\s*원$/);
    if (rowMatch) {
      const rawTitle = rowMatch[1].trim();
      const premStr = rowMatch[2].replace(/,/g, '');

      if (!rawTitle.includes('보험료') && !rawTitle.includes('합계') && !rawTitle.includes('총액') && !rawTitle.includes('환급금')) {
        let comp = detectCompany(rawTitle);
        let sDate = '';
        let eDate = '';
        for (let j = Math.max(0, i - 4); j <= Math.min(lines.length - 1, i + 4); j++) {
          const dateMatch = lines[j].match(/(\d{4}[-.]\d{2}(?:[-.]\d{2})?)/);
          const endDateMatch = lines[j].match(/보장만기\s*(\d{4}[-.]\d{2}|종신)/) || lines[j].match(/~(\d{4}[-.]\d{2}|종신)/);
          if (dateMatch && !sDate) sDate = formatDate(dateMatch[1]);
          if (endDateMatch && !eDate) eDate = endDateMatch[1] === '종신' ? '' : formatDate(endDateMatch[1]);
          if (!comp) comp = detectCompany(lines[j]);
        }

        if (!comp) comp = '기타보험사';
        const sig = rawTitle + '|' + premStr + '|' + sDate.slice(0, 7);
        if (!seenSignatures.has(sig)) {
          seenSignatures.add(sig);
          const details = rawTitle + (premStr ? ' (월 ' + Number(premStr).toLocaleString() + '원)' : '');
          extractedPolicies.push({
            id: Date.now() + Math.random() + i,
            provider: comp,
            details,
            startDate: sDate,
            endDate: eDate
          });
        }
      }
    }
  }

  if (extractedPolicies.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const comp = detectCompany(lines[i]);
      if (comp) {
        let productName = '';
        let premStr = '';
        let sDate = '';
        let eDate = '';
        for (let j = i; j <= Math.min(lines.length - 1, i + 5); j++) {
          const candidate = lines[j];
          const premMatch = candidate.match(/([\d,]+)\s*원/);
          if (premMatch && !premStr) premStr = premMatch[1].replace(/,/g, '');
          const dateMatch = candidate.match(/(\d{4}[-.]\d{2}(?:[-.]\d{2})?)/);
          const endDateMatch = candidate.match(/보장만기\s*(\d{4}[-.]\d{2}|종신)/) || candidate.match(/~(\d{4}[-.]\d{2}|종신)/);
          if (dateMatch && !sDate) sDate = formatDate(dateMatch[1]);
          if (endDateMatch && !eDate) eDate = endDateMatch[1] === '종신' ? '' : formatDate(endDateMatch[1]);
          if (!productName && candidate.length >= 4 && !candidate.includes(comp) && !candidate.includes('원') && !candidate.includes('보장') && !candidate.includes('분석')) {
            productName = candidate;
          }
        }
        const title = productName || (comp + ' 가입보험');
        const sig = title + '|' + premStr + '|' + sDate.slice(0, 7);
        if (!seenSignatures.has(sig)) {
          seenSignatures.add(sig);
          const details = title + (premStr ? ' (월 ' + Number(premStr).toLocaleString() + '원)' : '');
          extractedPolicies.push({
            id: Date.now() + Math.random() + i,
            provider: comp,
            details,
            startDate: sDate,
            endDate: eDate
          });
        }
      }
    }
  }

  return { customerName, insurances: extractedPolicies };
}

function parseInsurancesFromExcelBuffer(excelBuffer, filePath = '') {
  const XLSX = require('xlsx');
  const workbook = XLSX.read(excelBuffer, { type: 'buffer', cellDates: true });
  let customerName = parseCustomerNameFromFileName(filePath);
  const extractedInsurances = [];
  const seenSignatures = new Set();
  const sheetNames = workbook.SheetNames;
  if (!sheetNames || sheetNames.length === 0) return { customerName, insurances: [] };

  const firstSheetName = sheetNames[0];
  const targetSheets = firstSheetName ? [firstSheetName] : [];

  for (const sheetName of targetSheets) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rows || rows.length === 0) continue;

    if (!customerName) {
      for (const row of rows) {
        for (const cell of row) {
          const str = String(cell || '').trim();
          const nm = str.match(/([가-힣\*]{2,5})\s*를\s*위한/) ||
                     str.match(/([가-힣\*]{2,5})님/) ||
                     str.match(/고객명\s*[:\s]*([가-힣\*]{2,5})/);
          if (nm && nm[1]) {
            customerName = nm[1].replace(/\*/g, '');
            break;
          }
        }
        if (customerName) break;
      }
    }

    let headerRowIdx = -1;
    let colMap = { provider: -1, product: -1, startDate: -1, endDate: -1, premium: -1 };

    for (let r = 0; r < Math.min(rows.length, 30); r++) {
      const row = rows[r].map(c => String(c || '').trim());
      for (let c = 0; c < row.length; c++) {
        const val = row[c];
        if (!val) continue;
        if (/회사명|보험사|보험회사|원수사/.test(val) && colMap.provider === -1) colMap.provider = c;
        if (/상품명|보험명|상품|보장내용/.test(val) && colMap.product === -1) colMap.product = c;
        if (/계약년월|가입일|계약일|가입년월/.test(val) && colMap.startDate === -1) colMap.startDate = c;
        if (/보장만기/.test(val)) {
          colMap.endDate = c;
        } else if (/만기일|납입만기/.test(val) && colMap.endDate === -1) {
          colMap.endDate = c;
        }
        if (/보험료|월보험료|납입금/.test(val) && colMap.premium === -1) colMap.premium = c;
      }
      if (colMap.provider !== -1 || colMap.product !== -1) {
        headerRowIdx = r;
        break;
      }
    }

    if (headerRowIdx !== -1) {
      for (let r = headerRowIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;

        const providerVal = colMap.provider !== -1 ? String(row[colMap.provider] || '').trim() : '';
        const productVal = colMap.product !== -1 ? String(row[colMap.product] || '').trim() : '';
        const startVal = colMap.startDate !== -1 ? String(row[colMap.startDate] || '').trim() : '';
        const endVal = colMap.endDate !== -1 ? String(row[colMap.endDate] || '').trim() : '';
        const premVal = colMap.premium !== -1 ? String(row[colMap.premium] || '').trim() : '';

        const comp = detectCompany(providerVal || productVal);
        const rawTitle = productVal || providerVal;

        if (!rawTitle || rawTitle.length < 2) continue;
        if (/합계|소계|총계|계약건수|월보험료/.test(rawTitle)) continue;

        const cleanPrem = premVal.replace(/[^\d]/g, '');
        const details = rawTitle + (cleanPrem && Number(cleanPrem) > 0 ? ' (월 ' + Number(cleanPrem).toLocaleString() + '원)' : '');
        const sDate = formatDate(startVal);
        const eDate = endVal.includes('종신') ? '' : formatDate(endVal);

        const sig = rawTitle + '|' + cleanPrem + '|' + sDate;
        if (!seenSignatures.has(sig)) {
          seenSignatures.add(sig);
          extractedInsurances.push({
            id: Date.now() + Math.random() + r,
            provider: comp || '기타보험사',
            details,
            startDate: sDate,
            endDate: eDate
          });
        }
      }
    }
  }

  return { customerName, insurances: extractedInsurances };
}

module.exports = {
  normalizeCustomerInsurances,
  getExistingUploadedPdf,
  generatePdfForCompany,
  extractTextFromPdfBuffer,
  parseCustomerNameFromFileName,
  detectCompany,
  formatDate,
  parseInsurancesFromReportText,
  parseInsurancesFromExcelBuffer
};
