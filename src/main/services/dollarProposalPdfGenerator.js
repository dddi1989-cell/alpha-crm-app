const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');

/**
 * Generate 15-Slide 16:9 Landscape VIP High-Impact Masterpiece Presentation for Dollar Insurance
 */
function generateDollarProposalHtml({ planData, plannerInfo }) {
  const p = planData || {};
  const plannerName = plannerInfo?.name || '홍인기 GFSR';
  const plannerOrg = plannerInfo?.org_name || '인카금융서비스(주) WLB 본부';
  const plannerPhone = plannerInfo?.phone || '010-8397-0137';

  const clientName = p.clientName || '32세남';
  const clientAge = p.clientAge || 32;
  const clientGender = p.clientGender || '남';
  const companyName = p.companyName || '메트라이프생명';
  const productName = p.productName || '무배당 백만인을 위한 달러종신보험 Plus (저해약환급금형Ⅱ)';
  const payPeriodYears = p.payPeriodYears || 7;
  const monthlyPremiumUSD = p.monthlyPremiumUSD || 585.78;
  const exchangeRateKRW = p.exchangeRateKRW || 1541.70;
  const monthlyPremiumKRW = Math.round(monthlyPremiumUSD * exchangeRateKRW);
  const totalPaidUSD = Math.round(monthlyPremiumUSD * 12 * payPeriodYears * 100) / 100;
  const totalPaidKRW = Math.round(totalPaidUSD * exchangeRateKRW);
  const deathBenefitUSD = p.deathBenefitUSD || 39000;
  const deathBenefitKRW = Math.round(deathBenefitUSD * exchangeRateKRW);
  const maxDeathBenefitUSD = Math.round(deathBenefitUSD * 1.5); // 150% 체증
  const maxDeathBenefitKRW = Math.round(maxDeathBenefitUSD * exchangeRateKRW);
  const appliedRatePercent = p.appliedRatePercent || 3.25;

  // Dynamic Bonus Rates & Exact Policy Milestones
  let bonus1Rate = p.bonusRate1;
  let bonus2Rate = p.bonusRate2;
  let payCompleteRate = p.payCompleteRate;
  let payComplete1dayRate = p.payComplete1dayRate;

  if (payPeriodYears === 7) {
    if (!bonus1Rate) bonus1Rate = 22.20;
    if (!bonus2Rate) bonus2Rate = 15.90;
    if (!payCompleteRate) payCompleteRate = 38.77;
    if (!payComplete1dayRate) payComplete1dayRate = 99.75;
  } else if (payPeriodYears === 5) {
    if (!bonus1Rate) bonus1Rate = 22.50;
    if (!bonus2Rate) bonus2Rate = 11.00;
    if (!payCompleteRate) payCompleteRate = 37.91;
    if (!payComplete1dayRate) payComplete1dayRate = 98.33;
  } else {
    if (!bonus1Rate) bonus1Rate = 39.70;
    if (!bonus2Rate) bonus2Rate = 0.0;
    if (!payCompleteRate) payCompleteRate = 36.10;
    if (!payComplete1dayRate) payComplete1dayRate = 120.80;
  }

  const refundPayCompleteUSD = Math.round(totalPaidUSD * (payCompleteRate / 100));
  const refundPayComplete1dayUSD = Math.round(totalPaidUSD * (payComplete1dayRate / 100));
  const refund10yrUSD = Math.round(totalPaidUSD * 1.2489);
  const refund10yrKRW_low = (Math.round(refund10yrUSD * 1200 / 10000000) / 10).toFixed(2);
  const refund10yrKRW_mid = (Math.round(refund10yrUSD * exchangeRateKRW / 10000000) / 10).toFixed(2);
  const refund10yrKRW_high = (Math.round(refund10yrUSD * 1800 / 10000000) / 10).toFixed(2);

  const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${clientName} 고객님 달러종신 VIP 마스터 리포트</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', '맑은 고딕', sans-serif;
    }
    body {
      background-color: #080d1a;
      color: #f8fafc;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .slide {
      width: 297mm;
      height: 210mm;
      page-break-after: always;
      position: relative;
      overflow: hidden;
      padding: 14mm 20mm 12mm 20mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: radial-gradient(circle at 90% 10%, #152238 0%, #0a1120 50%, #050811 100%);
    }
    .slide:last-child {
      page-break-after: avoid;
    }

    /* Common Top Section Header */
    .slide-top-tag {
      font-size: 13px;
      font-weight: 900;
      color: #2dd4bf;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .slide-main-title {
      font-size: 27px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: -1px;
      line-height: 1.25;
    }
    .slide-sub-title {
      font-size: 13.5px;
      color: #94a3b8;
      margin-top: 4px;
      font-weight: 500;
    }

    /* Common Bottom Footer */
    .slide-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1.5px solid rgba(255, 255, 255, 0.12);
      padding-top: 8px;
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
    }

    /* Brand Logo / Badges */
    .brand-pill {
      background: linear-gradient(135deg, #fcd34d, #f59e0b);
      color: #0f172a;
      font-size: 11px;
      font-weight: 900;
      padding: 5px 14px;
      border-radius: 20px;
      display: inline-block;
      letter-spacing: 0.5px;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
    }
    .brand-pill-blue {
      background: linear-gradient(135deg, #38bdf8, #2563eb);
      color: #ffffff;
      font-size: 11px;
      font-weight: 900;
      padding: 5px 14px;
      border-radius: 20px;
      display: inline-block;
      letter-spacing: 0.5px;
    }

    /* Numbers & Metrics */
    .hero-number {
      font-size: 42px;
      font-weight: 900;
      color: #2dd4bf;
      font-family: 'Outfit', 'Pretendard', sans-serif;
      line-height: 1.05;
      letter-spacing: -1px;
    }
    .metric-sub {
      font-size: 13px;
      color: #cbd5e1;
      font-weight: 700;
      margin-top: 6px;
    }

    /* High-End Glassmorphism Cards */
    .card-dark {
      background: rgba(15, 23, 42, 0.85);
      border: 1.5px solid rgba(255, 255, 255, 0.12);
      border-radius: 18px;
      padding: 18px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .card-highlight {
      background: linear-gradient(145deg, rgba(30, 58, 138, 0.45), rgba(15, 23, 42, 0.9));
      border: 1.5px solid rgba(56, 189, 248, 0.45);
      border-radius: 18px;
      padding: 18px;
      box-shadow: 0 10px 30px rgba(56, 189, 248, 0.15);
    }
    .card-light {
      background: #f8fafc;
      color: #0f172a;
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    }

    /* Step Number Badges */
    .step-badge {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0d9488, #06b6d4);
      color: #ffffff;
      font-size: 13px;
      font-weight: 900;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-right: 8px;
      shrink: 0;
      box-shadow: 0 2px 8px rgba(6, 182, 212, 0.4);
    }
    .step-badge-red {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: linear-gradient(135deg, #dc2626, #b91c1c);
      color: #ffffff;
      font-size: 13px;
      font-weight: 900;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-right: 8px;
      shrink: 0;
    }

    /* Notice Bottom Box */
    .notice-box {
      background: rgba(15, 23, 42, 0.95);
      border-left: 4px solid #f59e0b;
      padding: 12px 18px;
      border-radius: 0 12px 12px 0;
      font-size: 12.5px;
      color: #e2e8f0;
      line-height: 1.5;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .notice-box-blue {
      background: rgba(15, 23, 42, 0.95);
      border-radius: 14px;
      padding: 13px 18px;
      font-size: 13px;
      color: #e2e8f0;
      border: 1.5px solid rgba(56, 189, 248, 0.35);
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    }

    /* Highlights & Badges */
    .badge-pill {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.2px;
    }
  </style>
</head>
<body>

  <!-- =================================================== -->
  <!-- SLIDE 01: COVER (High Impact Hero)                  -->
  <!-- =================================================== -->
  <div class="slide" style="background: radial-gradient(circle at 80% 20%, #1e3a8a 0%, #0f172a 50%, #030712 100%);">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <span class="brand-pill">CLIENT FINANCIAL PLAN</span>
      <div style="font-size: 13px; font-weight: 800; color: #94a3b8; letter-spacing: 0.5px;">
        WLB FINANCIAL PRIVATE CLIENT ADVISORY
      </div>
    </div>

    <div style="margin-top: 6mm;">
      <div style="display: inline-block; padding: 4px 14px; background: rgba(56, 189, 248, 0.2); border: 1px solid #38bdf8; border-radius: 8px; font-size: 13px; color: #38bdf8; font-weight: 800; margin-bottom: 12px;">
        미 달러(USD) 글로벌 자산관리 & 상속·비과세 VIP 전략 보고서
      </div>
      <h1 style="font-size: 48px; font-weight: 900; color: #ffffff; line-height: 1.2; letter-spacing: -2px;">
        달러를 모으는 이유 ,<br>
        <span style="color: #38bdf8; text-shadow: 0 0 30px rgba(56, 189, 248, 0.4);">10 년 이후의 선택</span>
      </h1>
      <p style="font-size: 18px; color: #94a3b8; margin-top: 14px; font-weight: 500; line-height: 1.4;">
        달러 종신보험을 장기 보장과 글로벌 기축통화 자산 설계의 관점에서 정밀 검토합니다 .
      </p>

      <div style="margin-top: 16mm; background: rgba(15, 23, 42, 0.7); border: 1.5px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 16px 24px; display: inline-flex; gap: 40px; align-items: center;">
        <div>
          <div style="font-size: 11.5px; color: #64748b; font-weight: 700;">제안 고객</div>
          <div style="font-size: 22px; font-weight: 900; color: #ffffff; margin-top: 2px;">${clientName} 고객님</div>
        </div>
        <div style="border-left: 1.5px solid rgba(255,255,255,0.1); padding-left: 40px;">
          <div style="font-size: 11.5px; color: #64748b; font-weight: 700;">추천 상품 및 플랜</div>
          <div style="font-size: 16px; font-weight: 800; color: #38bdf8; margin-top: 2px;">${productName} / ${payPeriodYears} 년납</div>
        </div>
        <div style="border-left: 1.5px solid rgba(255,255,255,0.1); padding-left: 40px;">
          <div style="font-size: 11.5px; color: #64748b; font-weight: 700;">발행 일자</div>
          <div style="font-size: 14px; font-weight: 800; color: #cbd5e1; margin-top: 2px; font-mono;">${todayStr}</div>
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <div>본 자료는 이해를 돕기 위한 요약이며 , 실제 계약은 상품설명서와 약관을 따릅니다 .</div>
      <div>01 / 15</div>
    </div>
  </div>

  <!-- =================================================== -->
  <!-- SLIDE 02: 01 / PLAN SNAPSHOT (Large & Dense)        -->
  <!-- =================================================== -->
  <div class="slide">
    <div>
      <div class="slide-top-tag">01 / PLAN SNAPSHOT</div>
      <h2 class="slide-main-title">한 장으로 보는 제안서</h2>
    </div>

    <div style="display: grid; grid-template-columns: 2.3fr 1fr; gap: 16px; margin: 10px 0; flex: 1; align-items: stretch;">
      <div class="card-dark" style="display: flex; flex-direction: column; justify-content: space-between; padding: 22px;">
        <div style="display: grid; grid-template-columns: 1.1fr 0.9fr 1.3fr; gap: 16px; border-bottom: 1.5px solid rgba(255,255,255,0.1); padding-bottom: 18px;">
          <div>
            <div class="hero-number">$${monthlyPremiumUSD.toLocaleString()}</div>
            <div class="metric-sub">월 기본보험료</div>
          </div>
          <div>
            <div class="hero-number" style="color: #fde047;">${payPeriodYears} 년</div>
            <div class="metric-sub">납입기간 / ${payPeriodYears * 12} 회</div>
          </div>
          <div>
            <div class="hero-number" style="color: #38bdf8;">$${totalPaidUSD.toLocaleString()}</div>
            <div class="metric-sub">기본보험료 총액</div>
          </div>
        </div>

        <div style="margin-top: 16px;">
          <div style="display: inline-block; padding: 4px 10px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; border-radius: 6px; font-size: 12px; font-weight: 800; margin-bottom: 6px;">
            핵심 계약 가치
          </div>
          <h3 style="font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
            계약의 중심은 저축이 아니라 <span style="color: #38bdf8;">종신 사망보장</span>입니다
          </h3>
          <div style="font-size: 14px; color: #cbd5e1; margin-top: 8px; line-height: 1.5;">
            가입금액 <strong style="color: #ffffff; font-size: 16px;">$${deathBenefitUSD.toLocaleString()} (10년 후 최대 150% 체증 $${maxDeathBenefitUSD.toLocaleString()})</strong> / 특약 없음 / 피보험자 ${clientAge} 세 ${clientGender === '남' ? '남성' : '여성'}
          </div>
        </div>
      </div>

      <div style="background: linear-gradient(160deg, #0284c7, #0369a1); border-radius: 18px; padding: 22px; color: #ffffff; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 10px 25px rgba(2, 132, 199, 0.3);">
        <div>
          <div style="font-size: 12px; font-weight: 800; color: #bae6fd; letter-spacing: 0.5px;">원화 납입 예시 (환율적용)</div>
          <div style="font-size: 32px; font-weight: 900; margin-top: 6px; letter-spacing: -1px;">약 ${(monthlyPremiumKRW/10000).toFixed(1)} 만원</div>
          <div style="font-size: 12px; color: #e0f2fe; margin-top: 4px; font-weight: 600;">설계환율 ${exchangeRateKRW.toLocaleString()} 원 적용</div>
        </div>
        <div style="border-top: 1.5px solid rgba(255,255,255,0.25); padding-top: 14px;">
          <div style="font-size: 11.5px; color: #bae6fd; font-weight: 700;">원화고정납입 신청 범위</div>
          <div style="font-size: 18px; font-weight: 900; margin-top: 4px; color: #fde047;">${Math.round(monthlyPremiumKRW*1.1/10000)} 만 ~ ${Math.round(monthlyPremiumKRW*1.3/10000)} 만원</div>
          <div style="font-size: 10.5px; color: #e0f2fe; margin-top: 2px;">환율 변동 무관하게 고정 납입</div>
        </div>
      </div>
    </div>

    <div class="notice-box">
      <strong style="color: #fbbf24;">상령일 주의 안내</strong>: 상령일(보험나이 증가일) 이후 가입 시 연령 증가로 월보험료가 상승할 수 있습니다. 원화고정납입 추가 적립분은 기본 해약환급금 표에 별도로 반영되지 않습니다.
    </div>

    <div class="slide-footer">
      <div>${clientName} 고객님 장기 달러 자산 설계 | 자료 : 가입제안서 p.10, p.17</div>
      <div>02 / 15</div>
    </div>
  </div>

  <!-- =================================================== -->
  <!-- SLIDE 03: 02 / PORTFOLIO ROLE (Venn Diagram)        -->
  <!-- =================================================== -->
  <div class="slide">
    <div>
      <div class="slide-top-tag">02 / PORTFOLIO ROLE</div>
      <h2 class="slide-main-title">이 상품의 역할은 유동자금보다 장기 보장입니다</h2>
    </div>

    <div style="display: grid; grid-template-columns: 1.25fr 1fr; gap: 24px; align-items: center; margin: 10px 0; flex: 1;">
      <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
        <div style="background: rgba(15, 23, 42, 0.85); border: 1.5px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 18px;">
          <div style="font-size: 13.5px; font-weight: 900; color: #2dd4bf; margin-bottom: 10px;">✅ 적합 (추천 목적)</div>
          
          <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
            <span class="step-badge">1</span>
            <div>
              <strong style="font-size: 15px; color: #ffffff;">달러 자산 (기축통화)</strong>
              <p style="font-size: 12.5px; color: #94a3b8; margin-top: 2px;">원화 자산 편중을 분산하고 글로벌 안전자산을 확보하는 역할</p>
            </div>
          </div>

          <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
            <span class="step-badge">2</span>
            <div>
              <strong style="font-size: 15px; color: #ffffff;">장기 계약 (10년 이상)</strong>
              <p style="font-size: 12.5px; color: #94a3b8; margin-top: 2px;">${payPeriodYears} 년 분할 납입과 10 년 이상 비과세 유지가 가능한 자금</p>
            </div>
          </div>

          <div style="display: flex; align-items: flex-start;">
            <span class="step-badge">3</span>
            <div>
              <strong style="font-size: 15px; color: #ffffff;">사망 보장 (유가족 안심)</strong>
              <p style="font-size: 12.5px; color: #94a3b8; margin-top: 2px;">가족에게 즉시 지급될 수억 원대 달러 기준 고액 보장 자산</p>
            </div>
          </div>
        </div>

        <div style="background: rgba(220, 38, 38, 0.15); border: 1.5px solid rgba(239, 68, 68, 0.4); border-radius: 14px; padding: 14px 18px; margin-top: 10px;">
          <div style="font-size: 13px; font-weight: 900; color: #ef4444; margin-bottom: 4px;">❌ 부적합 (비추천 목적)</div>
          <p style="font-size: 13.5px; color: #fecaca; font-weight: 700;">
            단기 비상자금 / 단기 목돈 마련 / 고수익만을 노린 투자 자금
          </p>
        </div>
      </div>

      <!-- Real Overlapping 3-Circle Venn Diagram -->
      <div style="position: relative; height: 100%; min-height: 240px; display: flex; align-items: center; justify-content: center;">
        <div style="position: relative; width: 250px; height: 230px;">
          <!-- Circle 1: 달러 (Top) -->
          <div style="position: absolute; top: 0; left: 50px; width: 145px; height: 145px; border-radius: 50%; background: radial-gradient(circle, rgba(13, 148, 136, 0.8), rgba(15, 118, 110, 0.55)); border: 2px solid #2dd4bf; display: flex; align-items: flex-start; justify-content: center; padding-top: 18px; font-size: 16px; font-weight: 900; color: #ffffff; box-shadow: 0 0 20px rgba(45, 212, 191, 0.25);">
            달러 자산
          </div>
          <!-- Circle 2: 보장 (Bottom Left) -->
          <div style="position: absolute; bottom: 0; left: 0; width: 145px; height: 145px; border-radius: 50%; background: radial-gradient(circle, rgba(37, 99, 235, 0.8), rgba(29, 78, 216, 0.55)); border: 2px solid #60a5fa; display: flex; align-items: flex-end; justify-content: flex-start; padding: 0 0 22px 20px; font-size: 16px; font-weight: 900; color: #ffffff; box-shadow: 0 0 20px rgba(96, 165, 250, 0.25);">
            종신 보장
          </div>
          <!-- Circle 3: 장기 (Bottom Right) -->
          <div style="position: absolute; bottom: 0; right: 0; width: 145px; height: 145px; border-radius: 50%; background: radial-gradient(circle, rgba(217, 119, 6, 0.8), rgba(180, 83, 9, 0.55)); border: 2px solid #fde047; display: flex; align-items: flex-end; justify-content: flex-end; padding: 0 20px 22px 0; font-size: 16px; font-weight: 900; color: #ffffff; box-shadow: 0 0 20px rgba(253, 224, 71, 0.25);">
            장기 비과세
          </div>
          <!-- Center Overlap Badge -->
          <div style="position: absolute; top: 78px; left: 68px; width: 110px; height: 75px; background: rgba(15, 23, 42, 0.92); border: 1.5px solid #38bdf8; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(0,0,0,0.6); z-index: 10;">
            <div style="font-size: 10.5px; color: #38bdf8; font-weight: 900;">최적의 교집합</div>
            <div style="font-size: 13px; color: #ffffff; font-weight: 900; margin-top: 2px;">달러종신 플랜</div>
          </div>
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <div>${clientName} 고객님 장기 달러 자산 설계 | 자료 : 가입제안서 p.1-p.3</div>
      <div>03 / 15</div>
    </div>
  </div>

  <!-- =================================================== -->
  <!-- SLIDE 04: 03 / FIXED KRW PAYMENT OPTION [KILLER]    -->
  <!-- =================================================== -->
  <div class="slide">
    <div>
      <div class="slide-top-tag">03 / FIXED KRW PAYMENT OPTION</div>
      <h2 class="slide-main-title">환율이 폭등해도 매월 내는 원화는 그대로 , 원화고정납입 시스템</h2>
    </div>

    <div style="display: flex; flex-direction: column; justify-content: space-between; margin: 8px 0; flex: 1;">
      <!-- Top Dynamic Cycle Graphic (제안서 p.20 완벽 시각화) -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <!-- Left: Low FX Period -->
        <div class="card-dark" style="border: 2px solid #0d9488; background: rgba(13, 148, 136, 0.15); padding: 18px; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="badge-pill" style="background:#0d9488; color:#ffffff; font-size:12px;">① 환율 하락 / 평시 구간 (달러 저가)</span>
              <span style="color:#2dd4bf; font-weight:900; font-size:13px;">달러 저가 자동 비축</span>
            </div>
            <h4 style="font-size: 16px; font-weight: 900; color: #ffffff; margin-top: 10px;">
              기본보험료 납부 후 남는 원화는 <span style="color:#2dd4bf;">달러로 추가 적립</span>
            </h4>
            <p style="font-size: 12.5px; color: #cbd5e1; line-height: 1.5; margin-top: 6px;">
              매월 정해진 원화(110%~130%)를 납입하면 기본보험료($${monthlyPremiumUSD.toLocaleString()})를 내고 남은 차액이 <strong>'원화고정납입용 추가보험료 적립액'에 달러로 자동 저축</strong>됩니다 .
            </p>
          </div>
          <div style="font-size: 11.5px; color: #2dd4bf; font-weight: 800; border-top: 1px dashed rgba(255,255,255,0.15); padding-top: 8px; margin-top: 8px;">
            ✔ 달러가 쌀 때 더 많은 달러를 저가 매수하는 효과
          </div>
        </div>

        <!-- Right: High FX Period -->
        <div class="card-dark" style="border: 2px solid #f59e0b; background: rgba(245, 158, 11, 0.15); padding: 18px; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="badge-pill" style="background:#f59e0b; color:#0f172a; font-size:12px;">② 환율 폭등 / 위기 구간 (달러 고가)</span>
              <span style="color:#fde047; font-weight:900; font-size:13px;">추가 부담 0원 완벽 방어</span>
            </div>
            <h4 style="font-size: 16px; font-weight: 900; color: #ffffff; margin-top: 10px;">
              환율이 급등해도 <span style="color:#fde047;">기존 비축 달러에서 자동 납부</span>
            </h4>
            <p style="font-size: 12.5px; color: #cbd5e1; line-height: 1.5; margin-top: 6px;">
              환율이 1,600원~1,800원으로 폭등하여 원화보험료가 고정납입액을 넘어서더라도, 고객이 돈을 더 낼 필요 없이 <strong>기존에 비축해 둔 달러 적립액에서 부족분이 자동 인출</strong>되어 납입됩니다 .
            </p>
          </div>
          <div style="font-size: 11.5px; color: #fde047; font-weight: 800; border-top: 1px dashed rgba(255,255,255,0.15); padding-top: 8px; margin-top: 8px;">
            ✔ 환율 폭등 시 고객의 원화 추가 지출 0원 완벽 방어
          </div>
        </div>
      </div>

      <!-- Middle: Dynamic Mechanism SVG Chart (가입제안서 p.20 원리 완벽 시각화) -->
      <div class="card-dark" style="border: 1.5px solid #334155; background: rgba(15, 23, 42, 0.95); padding: 14px 18px; margin: 6px 0; border-radius: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 12.5px; font-weight: 900; color: #38bdf8;">📊 원화고정납입 자동 헷지 & 달러 비축 메커니즘</span>
            <span style="font-size: 11px; color: #94a3b8;">(가입제안서 p.20 실전 예시 기준)</span>
          </div>
          <div style="display: flex; gap: 14px; font-size: 11px; font-weight: 700;">
            <span style="color: #fde047; display: flex; align-items: center; gap: 4px;">
              <span style="display:inline-block; width:12px; height:3px; background:#fde047; border-radius:2px;"></span> Ⓑ 원화고정납입액 (매월 고정)
            </span>
            <span style="color: #38bdf8; display: flex; align-items: center; gap: 4px;">
              <span style="display:inline-block; width:12px; height:3px; background:#38bdf8; border-radius:2px;"></span> Ⓐ 원화환산보험료 (환율 변동)
            </span>
            <span style="color: #2dd4bf; display: flex; align-items: center; gap: 4px;">
              <span style="display:inline-block; width:10px; height:10px; background:rgba(45, 212, 191, 0.4); border:1px solid #2dd4bf; border-radius:2px;"></span> Ⓒ 달러 자동 비축
            </span>
            <span style="color: #f87171; display: flex; align-items: center; gap: 4px;">
              <span style="display:inline-block; width:10px; height:10px; background:rgba(239, 68, 68, 0.4); border:1px solid #ef4444; border-radius:2px;"></span> Ⓓ 비축 달러 자동 인출
            </span>
          </div>
        </div>

        <!-- SVG Visual Diagram -->
        <svg viewBox="0 0 960 115" style="width: 100%; height: 110px; overflow: visible;">
          <defs>
            <linearGradient id="curveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#38bdf8" />
              <stop offset="55%" stop-color="#2dd4bf" />
              <stop offset="70%" stop-color="#f87171" />
              <stop offset="100%" stop-color="#fbbf24" />
            </linearGradient>
            <linearGradient id="saveAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="rgba(45, 212, 191, 0.35)" />
              <stop offset="100%" stop-color="rgba(45, 212, 191, 0.02)" />
            </linearGradient>
            <linearGradient id="deficitAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="rgba(239, 68, 68, 0.45)" />
              <stop offset="100%" stop-color="rgba(239, 68, 68, 0.05)" />
            </linearGradient>
          </defs>

          <!-- Background Grid Lines -->
          <line x1="60" y1="15" x2="940" y2="15" stroke="#1e293b" stroke-width="1" stroke-dasharray="3,3" />
          <line x1="60" y1="55" x2="940" y2="55" stroke="#1e293b" stroke-width="1" />
          <line x1="60" y1="95" x2="940" y2="95" stroke="#1e293b" stroke-width="1" stroke-dasharray="3,3" />

          <!-- Fixed KRW Baseline (Yellow Solid Line y=55) -->
          <line x1="60" y1="55" x2="940" y2="55" stroke="#fde047" stroke-width="2.5" />
          <text x="65" y="48" fill="#fde047" font-size="11" font-weight="900">Ⓑ 고정납입액 (매월 일정 납부)</text>

          <!-- Filled Areas -->
          <!-- Save Area 1~6 months (Under the line) -->
          <path d="M 120 55 L 120 75 Q 220 85 300 70 T 480 88 T 600 55 Z" fill="url(#saveAreaGrad)" />
          <!-- Deficit Area 7~10 months (Above the line) -->
          <path d="M 600 55 Q 670 15 740 22 Q 810 30 880 55 Z" fill="url(#deficitAreaGrad)" />

          <!-- FX Fluctuating Curve (A) -->
          <path d="M 60 78 Q 120 75 180 72 T 300 70 T 420 88 T 540 68 T 600 55 Q 670 15 740 22 Q 810 30 880 55 T 940 48" 
                fill="none" stroke="url(#curveGrad)" stroke-width="3.5" stroke-linecap="round" />

          <!-- Key Data Nodes & Labels -->
          <!-- Node 1: 1차월 (1,160원) -->
          <circle cx="120" cy="75" r="4.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" />
          <text x="120" y="98" fill="#94a3b8" font-size="9.5" text-anchor="middle">1차월 (1,160원)</text>
          
          <!-- Node 3: 4차월 (1,050원 - 환율 최저점) -->
          <circle cx="420" cy="88" r="5" fill="#2dd4bf" stroke="#ffffff" stroke-width="2" />
          <text x="420" y="108" fill="#2dd4bf" font-size="10" font-weight="900" text-anchor="middle">4차월 (1,050원) Ⓒ 달러 대량 비축</text>

          <!-- Node 5: 7차월 (1,500원 - 환율 급등 피크) -->
          <circle cx="700" cy="18" r="6" fill="#ef4444" stroke="#ffffff" stroke-width="2" />
          <rect x="630" y="0" width="145" height="17" rx="4" fill="#ef4444" opacity="0.9" />
          <text x="702" y="12" fill="#ffffff" font-size="10" font-weight="900" text-anchor="middle">7차월 (1,500원) Ⓓ 비축 달러로 납부</text>
          <text x="700" y="38" fill="#fca5a5" font-size="9.5" font-weight="800" text-anchor="middle">고객 추가부담 0원 방어!</text>

          <!-- Node 6: 10차월 (1,400원) -->
          <circle cx="880" cy="55" r="4.5" fill="#fde047" stroke="#ffffff" stroke-width="1.5" />
          <text x="880" y="75" fill="#94a3b8" font-size="9.5" text-anchor="middle">10차월 (1,400원)</text>
        </svg>
      </div>

      <!-- Bottom 3 Core Advantages Cards -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 4px;">
        <div class="card-dark" style="border-top: 3px solid #38bdf8; padding: 14px 16px;">
          <strong style="color: #38bdf8; font-size: 14px; font-weight: 900;">1. 완벽한 가계 지출 예측</strong>
          <p style="font-size: 12px; color: #cbd5e1; line-height: 1.45; margin-top: 4px;">
            환율 등락에 흔들리지 않고 매월 약 <strong>${Math.round(monthlyPremiumKRW*1.1/10000)}만 ~ ${Math.round(monthlyPremiumKRW*1.3/10000)}만원</strong>으로 일정하게 통장 지출 관리
          </p>
        </div>

        <div class="card-dark" style="border-top: 3px solid #2dd4bf; padding: 14px 16px;">
          <strong style="color: #2dd4bf; font-size: 14px; font-weight: 900;">2. 달러 코스트 에버리징</strong>
          <p style="font-size: 12px; color: #cbd5e1; line-height: 1.45; margin-top: 4px;">
            환율이 쌀 때 많이 사고 비쌀 때 덜 사는 스마트 분할 매수 메커니즘을 시스템이 스스로 자동 실행
          </p>
        </div>

        <div class="card-dark" style="border-top: 3px solid #fde047; padding: 14px 16px;">
          <strong style="color: #fde047; font-size: 14px; font-weight: 900;">3. 만기 추가 목돈 수령</strong>
          <p style="font-size: 12px; color: #cbd5e1; line-height: 1.45; margin-top: 4px;">
            차곡차곡 쌓인 추가 적립금은 사라지는 비용이 아니라, 나중에 해약환급금 및 사망보험금에 고스란히 증액 지급
          </p>
        </div>
      </div>
    </div>

    <div class="notice-box">
      <strong>실전 어필</strong>: 외화통장 개설 불필요, 외환 거래 수수료 0원! 일반 국내 원화 통장에서 자동이체 1회로 간편하게 처리됩니다 . (제안서 p.19, p.20)
    </div>

    <div class="slide-footer">
      <div>${clientName} 고객님 장기 달러 자산 설계 | 자료 : 가입제안서 p.9, p.10, p.19, p.20</div>
      <div>04 / 15</div>
    </div>
  </div>

  <!-- =================================================== -->
  <!-- SLIDE 04: 03 / WHY USD (Double Size Cards & Fonts)  -->
  <!-- =================================================== -->
  <div class="slide">
    <div>
      <div class="slide-top-tag">03 / WHY USD</div>
      <h2 class="slide-main-title">달러를 모으는 이유는 환율 예상보다 통화 분산입니다</h2>
    </div>

    <div style="margin: 8px 0; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
      <!-- IMF Chart Header Card -->
      <div style="display: grid; grid-template-columns: 1fr 2.2fr; gap: 20px; align-items: center; background: rgba(15,23,42,0.85); border-radius: 18px; padding: 18px 22px; border: 1.5px solid rgba(255,255,255,0.12);">
        <div>
          <div class="hero-number" style="font-size: 48px; color: #2dd4bf;">56.77%</div>
          <div style="font-size: 13.5px; color: #cbd5e1; font-weight: 800; margin-top: 2px;">전 세계 공식 외환보유액 중 달러 비중</div>
          <div style="font-size: 11px; color: #64748b;">2025 년 4 분기 IMF 공식 기준 (COFER)</div>
        </div>

        <div>
          <div style="display: flex; height: 36px; border-radius: 10px; overflow: hidden; font-size: 12px; font-weight: 900; text-align: center; line-height: 36px; color: #ffffff; box-shadow: 0 4px 15px rgba(0,0,0,0.4);">
            <div style="width: 56.77%; background: #0d9488;">USD 56.77%</div>
            <div style="width: 20.25%; background: #2563eb;">EUR 20.25%</div>
            <div style="width: 21.03%; background: #d97706;">기타 21.03%</div>
            <div style="width: 1.95%; background: #e11d48;">CNY</div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; color: #94a3b8; font-weight: 700; margin-top: 6px;">
            <span>■ USD 56.77% (압도적 1위 기축통화)</span>
            <span>■ EUR 20.25%</span>
            <span>■ 엔·파운드 등 21.03%</span>
            <span>■ 위안 1.95%</span>
          </div>
        </div>
      </div>

      <!-- 2X Expanded 3 Core Cards with Larger Fonts -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 8px 0;">
        <div class="card-dark" style="border-top: 4px solid #0d9488; padding: 22px 18px; display: flex; flex-direction: column; justify-content: space-between; min-height: 150px;">
          <div>
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
              <span class="step-badge" style="width: 32px; height: 32px; font-size: 16px;">1</span>
              <strong style="color: #ffffff; font-size: 18px; font-weight: 900;">통화 분산</strong>
            </div>
            <p style="font-size: 13.5px; color: #cbd5e1; line-height: 1.6; margin-top: 6px;">
              원화만 보유할 때 발생하는 국내 경제 위기 및 원화 가치 급락 리스크를 완벽하게 방어하고 안전자산을 구축합니다 .
            </p>
          </div>
          <div style="font-size: 11.5px; color: #2dd4bf; font-weight: 800; margin-top: 10px;">✔ 대한민국 국가 리스크 헷지</div>
        </div>

        <div class="card-dark" style="border-top: 4px solid #2563eb; padding: 22px 18px; display: flex; flex-direction: column; justify-content: space-between; min-height: 150px;">
          <div>
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
              <span class="step-badge" style="width: 32px; height: 32px; font-size: 16px; background: linear-gradient(135deg, #2563eb, #38bdf8);">2</span>
              <strong style="color: #ffffff; font-size: 18px; font-weight: 900;">달러 직접 지출</strong>
            </div>
            <p style="font-size: 13.5px; color: #cbd5e1; line-height: 1.6; margin-top: 6px;">
              자녀 해외 유학 , 해외 여행 , 글로벌 결제 자금을 환전 수수료와 환율 급등 걱정 없이 달러 그대로 직접 지출합니다 .
            </p>
          </div>
          <div style="font-size: 11.5px; color: #60a5fa; font-weight: 800; margin-top: 10px;">✔ 글로벌 실물 지출 완벽 대비</div>
        </div>

        <div class="card-dark" style="border-top: 4px solid #d97706; padding: 22px 18px; display: flex; flex-direction: column; justify-content: space-between; min-height: 150px;">
          <div>
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
              <span class="step-badge" style="width: 32px; height: 32px; font-size: 16px; background: linear-gradient(135deg, #d97706, #fde047);">3</span>
              <strong style="color: #ffffff; font-size: 18px; font-weight: 900;">지급 시점 선택</strong>
            </div>
            <p style="font-size: 13.5px; color: #cbd5e1; line-height: 1.6; margin-top: 6px;">
              환율이 고점일 때 필요한 만큼 원화로 환전 수령하거나 , 평생 달러로 거치하며 연복리 이자를 누릴 수 있습니다 .
            </p>
          </div>
          <div style="font-size: 11.5px; color: #fde047; font-weight: 800; margin-top: 10px;">✔ 환율 타이밍 고객 주도권 확보</div>
        </div>
      </div>
    </div>

    <div class="notice-box-blue" style="text-align: center;">
      달러도 물가와 환율에 따라 가치가 변합니다 . 달러 보유 자체가 수익을 보장하지는 않습니다 .
    </div>

    <div class="slide-footer">
      <div>${clientName} 고객님 장기 달러 자산 설계 | 자료 : 국제통화기금 (IMF), 2025 년 4 분기</div>
      <div>04 / 15</div>
    </div>
  </div>

  <!-- =================================================== -->
  <!-- SLIDE 05: 04 / CRISIS WEALTH TRANSFER (KOSPI/부동산) -->
  <!-- =================================================== -->
  <div class="slide">
    <div>
      <div class="slide-top-tag">04 / CRISIS & WEALTH TRANSFER</div>
      <h2 class="slide-main-title">위기 때 원화 자산은 폭락하지만 , 달러는 기회가 됩니다</h2>
    </div>

    <div style="display: grid; grid-template-columns: 1.45fr 1fr; gap: 18px; margin: 10px 0; flex: 1; align-items: stretch;">
      <!-- Crisis History Table with Housing & KOSPI Drop -->
      <div class="card-dark" style="padding: 18px; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="font-size: 14px; font-weight: 900; color: #38bdf8; margin-bottom: 8px;">대한민국 역대 경제 위기 시 국내 자산 폭락 vs 달러 폭등 실증</div>
        <table style="width: 100%; font-size: 12px; border-collapse: collapse; text-align: center;">
          <thead>
            <tr style="border-bottom: 2px solid #334155; color: #94a3b8;">
              <th style="padding: 6px 3px;">위기 구간</th>
              <th style="color: #f87171;">국내 부동산 (아파트)</th>
              <th style="color: #f87171;">코스피 (KOSPI)</th>
              <th style="color: #2dd4bf;">달러 환율 폭등</th>
            </tr>
          </thead>
          <tbody style="color: #cbd5e1;">
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">
              <td style="padding: 9px 3px; font-weight: 800; color: #ffffff;">1997 IMF 외환위기</td>
              <td style="color: #fca5a5; font-weight: 800;">-28.0% 급락<br><span style="font-size:10px; color:#94a3b8;">(전국 부동산 폭락)</span></td>
              <td style="color: #fca5a5; font-weight: 800;">-60.0% 폭락<br><span style="font-size:10px; color:#94a3b8;">(700p ➔ 280p)</span></td>
              <td style="color: #2dd4bf; font-weight: 900; font-size: 15px;">+149% 폭등<br><span style="font-size:10px; color:#fde047;">(800원 ➔ 1,995원)</span></td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">
              <td style="padding: 9px 3px; font-weight: 800; color: #ffffff;">2008 글로벌 금융위기</td>
              <td style="color: #fca5a5; font-weight: 800;">-20.5% 급락<br><span style="font-size:10px; color:#94a3b8;">(수도권 급매 속출)</span></td>
              <td style="color: #fca5a5; font-weight: 800;">-53.1% 반토막<br><span style="font-size:10px; color:#94a3b8;">(2,000p ➔ 938p)</span></td>
              <td style="color: #2dd4bf; font-weight: 900; font-size: 15px;">+74% 폭등<br><span style="font-size:10px; color:#fde047;">(900원 ➔ 1,570원)</span></td>
            </tr>
            <tr>
              <td style="padding: 9px 3px; font-weight: 800; color: #ffffff;">2022 레고랜드 사태</td>
              <td style="color: #fca5a5; font-weight: 800;">-22.0% 하락<br><span style="font-size:10px; color:#94a3b8;">(실거래지수 급락)</span></td>
              <td style="color: #fca5a5; font-weight: 800;">-28.9% 급락<br><span style="font-size:10px; color:#94a3b8;">(3,000p ➔ 2,134p)</span></td>
              <td style="color: #2dd4bf; font-weight: 900; font-size: 15px;">+25% 상승<br><span style="font-size:10px; color:#fde047;">(1,150원 ➔ 1,440원)</span></td>
            </tr>
          </tbody>
        </table>
        <div style="font-size: 10.5px; color: #94a3b8; margin-top: 6px;">
          * 자료 : 한국은행 ECOS, 한국부동산원 전국주택가격동향조사, 한국거래소(KRX)
        </div>
      </div>

      <!-- Opportunity Logic Card -->
      <div style="background: linear-gradient(145deg, rgba(30, 58, 138, 0.6), rgba(15, 23, 42, 0.95)); border: 2px solid #38bdf8; border-radius: 18px; padding: 20px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 10px 30px rgba(56, 189, 248, 0.25);">
        <div>
          <span class="brand-pill" style="background:#38bdf8; color:#0f172a;">부의 이전 (Wealth Transfer)</span>
          <h4 style="font-size: 16.5px; font-weight: 900; color: #ffffff; margin-top: 12px; line-height: 1.35;">
            "달러는 자산의 방패이자 , 위기 시 알짜 자산을 쓸어담는 공격용 무기입니다"
          </h4>
          <p style="font-size: 12.5px; color: #e2e8f0; line-height: 1.5; margin-top: 10px;">
            원화 자산만 보유한 가계는 부동산과 주식이 반토막 나며 자산이 축소되지만, 달러를 쥐고 있던 1% 자산가는 헐값에 나온 강남 빌딩과 우량 자산을 사들여 거부가 되었습니다 .
          </p>
        </div>
        <div style="font-size: 11.5px; color: #38bdf8; font-weight: 800; border-top: 1.5px solid rgba(255,255,255,0.15); padding-top: 10px;">
          💡 환차익 100% 비과세로 세금 한 푼 없이 자산 방어
        </div>
      </div>
    </div>

    <div class="notice-box">
      <strong>실전 어필</strong>: 원화 편중 자산 구조는 대한민국 국가 리스크에 100% 노출되어 있습니다. 미 달러 자산 편입은 위기 시 부자가 되는 역발상 기회입니다.
    </div>

    <div class="slide-footer">
      <div>${clientName} 고객님 장기 달러 자산 설계 | 자료 : 한국은행, 한국부동산원, KRX</div>
      <div>05 / 15</div>
    </div>
  </div>

  <!-- =================================================== -->
  <!-- SLIDE 06: 05 / INFLATION (Maximized Density)        -->
  <!-- =================================================== -->
  <div class="slide">
    <div>
      <div class="slide-top-tag">05 / INFLATION</div>
      <h2 class="slide-main-title">물가 2% 가 누적되면 원화 1 억원의 실질가치는 감소합니다</h2>
    </div>

    <div style="display: grid; grid-template-columns: 1.8fr 1.2fr; gap: 20px; align-items: stretch; margin: 10px 0; flex: 1;">
      <!-- Chart Card Filled -->
      <div class="card-dark" style="padding: 24px; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="font-size: 14px; font-weight: 900; color: #38bdf8;">시간 경과에 따른 원화 1억원의 실질 구매력 감가 추이</div>
        
        <div style="display: flex; justify-content: space-between; align-items: flex-end; height: 160px; border-bottom: 2px solid #334155; padding-bottom: 10px; margin: 10px 0;">
          <div style="text-align: center; width: 17%;">
            <div style="color: #2dd4bf; font-weight: 900; font-size: 15px;">100.0</div>
            <div style="height: 125px; background: linear-gradient(to top, #0d9488, #2dd4bf); border-radius: 8px; margin-top: 6px; box-shadow: 0 4px 12px rgba(45, 212, 191, 0.3);"></div>
            <div style="font-size: 13px; color: #cbd5e1; font-weight: 800; margin-top: 8px;">현재 (0년)</div>
          </div>
          <div style="text-align: center; width: 17%;">
            <div style="color: #2dd4bf; font-weight: 900; font-size: 15px;">90.6</div>
            <div style="height: 113px; background: linear-gradient(to top, #0d9488, #2dd4bf); border-radius: 8px; margin-top: 6px;"></div>
            <div style="font-size: 13px; color: #cbd5e1; font-weight: 800; margin-top: 8px;">5 년 후</div>
          </div>
          <div style="text-align: center; width: 17%;">
            <div style="color: #fde047; font-weight: 900; font-size: 16px;">82.0</div>
            <div style="height: 102px; background: linear-gradient(to top, #d97706, #fde047); border-radius: 8px; margin-top: 6px; box-shadow: 0 4px 12px rgba(253, 224, 71, 0.3);"></div>
            <div style="font-size: 13px; color: #fde047; font-weight: 900; margin-top: 8px;">10 년 후</div>
          </div>
          <div style="text-align: center; width: 17%;">
            <div style="color: #2dd4bf; font-weight: 900; font-size: 15px;">74.3</div>
            <div style="height: 92px; background: linear-gradient(to top, #0d9488, #2dd4bf); border-radius: 8px; margin-top: 6px;"></div>
            <div style="font-size: 13px; color: #cbd5e1; font-weight: 800; margin-top: 8px;">15 년 후</div>
          </div>
          <div style="text-align: center; width: 17%;">
            <div style="color: #ef4444; font-weight: 900; font-size: 16px;">67.3</div>
            <div style="height: 84px; background: linear-gradient(to top, #dc2626, #f87171); border-radius: 8px; margin-top: 6px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);"></div>
            <div style="font-size: 13px; color: #fca5a5; font-weight: 900; margin-top: 8px;">20 년 후</div>
          </div>
        </div>

        <div style="font-size: 11.5px; color: #94a3b8; text-align: right;">
          * 물가상승률 연 2.0% 복리 기준 실질 구매력 지수 (100 기준)
        </div>
      </div>

      <!-- Right Summary Metric Cards Filled -->
      <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
        <div class="card-dark" style="border-left: 5px solid #38bdf8; padding: 20px;">
          <div style="font-size: 13px; color: #94a3b8; font-weight: 800;">10 년 후 1 억원의 실질 구매력</div>
          <div style="font-size: 32px; font-weight: 900; color: #ffffff; margin-top: 6px;">
            약 8,203 만원 <span style="font-size: 16px; color: #ef4444;">(-18.0%)</span>
          </div>
          <p style="font-size: 12px; color: #cbd5e1; margin-top: 6px; line-height: 1.4;">
            가만히 현금으로 두는 것만으로도 10년 뒤 약 1,800만원의 가치가 소리 없이 증발합니다 .
          </p>
        </div>

        <div class="card-dark" style="border-left: 5px solid #f59e0b; padding: 20px; margin-top: 12px;">
          <div style="font-size: 13px; color: #94a3b8; font-weight: 800;">20 년 후 1 억원의 실질 구매력</div>
          <div style="font-size: 32px; font-weight: 900; color: #ffffff; margin-top: 6px;">
            약 6,730 만원 <span style="font-size: 16px; color: #ef4444;">(-32.7%)</span>
          </div>
          <p style="font-size: 12px; color: #cbd5e1; margin-top: 6px; line-height: 1.4;">
            20년 뒤에는 자산의 1/3이 사라지므로, 달러 기축통화 복리 및 비과세 헷지가 필수적입니다 .
          </p>
        </div>
      </div>
    </div>

    <div class="notice-box">
      2% 는 미래 물가의 예상 수치가 아니라 이해를 위한 가정입니다 . 달러만 보유하는 것보다 비용을 차감한 이후의 장기 가치가 중요합니다 .
    </div>

    <div class="slide-footer">
      <div>${clientName} 고객님 장기 달러 자산 설계 | 가정 : 한국은행 물가안정목표 2%</div>
      <div>06 / 15</div>
    </div>
  </div>

  <!-- =================================================== -->
  <!-- SLIDE 07: 06 / INTEREST                             -->
  <!-- =================================================== -->
  <div class="slide">
    <div>
      <div class="slide-top-tag">06 / INTEREST</div>
      <h2 class="slide-main-title">이율은 예금금리와 같은 의미로 이해하면 안 됩니다</h2>
    </div>

    <div style="margin: 10px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; flex: 1;">
      <div class="card-dark" style="border: 2px solid #0d9488; padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
        <span class="brand-pill" style="background:#0d9488; color:#ffffff;">주계약 산출 적용이율</span>
        <div style="margin: 14px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 14px; color: #cbd5e1; font-weight: 700;">10 년 이내 확정</span>
            <span style="font-size: 36px; font-weight: 900; color: #2dd4bf;">3.25%</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1.5px solid rgba(255,255,255,0.1); padding-top: 8px; margin-top: 8px;">
            <span style="font-size: 14px; color: #cbd5e1; font-weight: 700;">10 년 이후</span>
            <span style="font-size: 26px; font-weight: 800; color: #fde047;">1.00%</span>
          </div>
        </div>
        <div style="font-size: 11.5px; color: #94a3b8;">주계약 사망보장 및 해약환급금 산출 기준</div>
      </div>

      <div class="card-dark" style="border: 2px solid #f59e0b; padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
        <span class="brand-pill" style="background:#f59e0b; color:#0f172a;">저축전환 이후 공시이율</span>
        <div style="margin: 14px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 14px; color: #cbd5e1; font-weight: 700;">최신 공시이율 기준</span>
            <span style="font-size: 36px; font-weight: 900; color: #fde047;">4.3%</span>
          </div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">
            최저보증 : 5 년 이내 1.0% / 5 년초과 0.7% (매월 변동)
          </div>
        </div>
        <div style="font-size: 11.5px; color: #94a3b8;">저축전환특약 선택 시 적용 이율</div>
      </div>
    </div>

    <div style="margin: 6px 0;">
      <div style="font-size: 12px; font-weight: 800; color: #94a3b8; margin-bottom: 6px;">실제 해약환급금에 반영되는 5대 핵심 요소</div>
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; text-align: center;">
        <div style="background: #0d9488; padding: 10px; border-radius: 10px; font-size: 13px; font-weight: 900;">적용이율</div>
        <div style="background: #e11d48; padding: 10px; border-radius: 10px; font-size: 13px; font-weight: 900;">위험보험료</div>
        <div style="background: #ea580c; padding: 10px; border-radius: 10px; font-size: 13px; font-weight: 900;">사업비</div>
        <div style="background: #d97706; padding: 10px; border-radius: 10px; font-size: 13px; font-weight: 900;">유지보너스</div>
        <div style="background: #2563eb; padding: 10px; border-radius: 10px; font-size: 13px; font-weight: 900;">계약변경</div>
      </div>
    </div>

    <div class="notice-box-blue">
      따라서 3.25% 는 고객의 납입금 전체가 매년 3.25% 로 불어나는 예금 수익률이 아닙니다 . 실제 결과는 제안서의 해약환급금 표로 확인해야 합니다 .
    </div>

    <div class="slide-footer">
      <div>${clientName} 고객님 장기 달러 자산 설계 | 자료 : 가입제안서 p.17, p.19-p.20</div>
      <div>07 / 15</div>
    </div>
  </div>

  <!-- =================================================== -->
  <!-- SLIDE 08: 07 / STEPPED DEATH BENEFIT (150% 체증)     -->
  <!-- =================================================== -->
  <div class="slide">
    <div>
      <div class="slide-top-tag">07 / STEPPED COVERAGE & BONUS</div>
      <h2 class="slide-main-title">사망보험금은 150% 체증되고 , 유지보너스가 더해집니다</h2>
    </div>

    <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 18px; margin: 10px 0; flex: 1; align-items: stretch;">
      <!-- 체증형 구조 박스 -->
      <div class="card-dark" style="padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <span class="badge-pill" style="background:#1e3a8a; color:#93c5fd;">체증형 사망보험금 (제안서 p.13, p.14)</span>
          <h4 style="font-size: 16px; font-weight: 900; color: #ffffff; margin-top: 8px;">
            가입 2 년 후부터 매년 5% 씩 정액 체증 ➔ <span style="color:#fbbf24;">최대 150%</span>
          </h4>

          <div style="margin-top: 14px; background: rgba(0,0,0,0.35); border-radius: 12px; padding: 14px; font-size: 13px; space-y: 8px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #94a3b8;">가입 시점 (2 년 이내):</span>
              <strong style="color: #ffffff;">$${deathBenefitUSD.toLocaleString()} (가입금액 100%)</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px dashed rgba(255,255,255,0.12); padding-top: 6px; margin-top: 6px;">
              <span style="color: #94a3b8;">2 년 ~ 12 년 구간:</span>
              <strong style="color: #38bdf8;">매년 가입금액의 5% 씩 체증</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px dashed rgba(255,255,255,0.12); padding-top: 6px; margin-top: 6px;">
              <span style="color: #fbbf24; font-weight: 900;">12 년 경과 후 종신:</span>
              <strong style="color: #fbbf24; font-size: 15px;">$${maxDeathBenefitUSD.toLocaleString()} (가입금액 150% 확정)</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- 유지보너스 박스 -->
      <div class="card-dark" style="border: 2px solid #d97706; padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <span class="badge-pill" style="background:#78350f; color:#fde68a;">유지보너스 지급률 (제안서 p.12)</span>
          <h4 style="font-size: 16px; font-weight: 900; color: #ffffff; margin-top: 8px;">
            납입 완료 시점과 10 년 시점에 계약자적립액 추가 가산
          </h4>

          <div style="margin-top: 14px; space-y: 8px; font-size: 13px;">
            <div style="background: rgba(217, 119, 6, 0.2); border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between;">
              <span>${payPeriodYears} 년 납입완료 시점:</span>
              <strong style="color: #fde047; font-size: 14px;">보너스 지급률 ${bonus1Rate.toFixed(2)}% 가산</strong>
            </div>
            <div style="background: rgba(217, 119, 6, 0.2); border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; margin-top: 8px;">
              <span>10 년 경과 시점:</span>
              <strong style="color: #fde047; font-size: 14px;">보너스 지급률 ${bonus2Rate > 0 ? bonus2Rate.toFixed(2) + '% 추가 가산' : '해당없음'}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="notice-box-blue">
      체증형 구조와 2차에 걸친 유지보너스가 결합되어, 10년 시점 환급률이 <strong>124.89% ($${refund10yrUSD.toLocaleString()})</strong>로 강력하게 점프합니다 .
    </div>

    <div class="slide-footer">
      <div>${clientName} 고객님 장기 달러 자산 설계 | 자료 : 가입제안서 p.12, p.14, p.17</div>
      <div>08 / 15</div>
    </div>
  </div>

  <!-- =================================================== -->
  <!-- SLIDE 09: 08 / CASH VALUE                           -->
  <!-- =================================================== -->
  <div class="slide">
    <div>
      <div class="slide-top-tag">08 / CASH VALUE</div>
      <h2 class="slide-main-title">${payPeriodYears} 년 납입 완료 이후 , 10 년까지가 가장 중요한 구간입니다</h2>
    </div>

    <div style="display: grid; grid-template-columns: 2.2fr 1fr; gap: 18px; align-items: center; margin: 10px 0; flex: 1;">
      <div class="card-dark" style="padding: 22px;">
        <div style="display: flex; justify-content: space-between; font-size: 11.5px; color: #94a3b8; border-bottom: 1px dashed rgba(255,255,255,0.15); padding-bottom: 6px;">
          <span>1 차 유지보너스 (${payPeriodYears} 년)</span>
          <span>2 차 유지보너스 (10 년)</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: flex-end; height: 120px; padding-top: 14px;">
          <div style="text-align: center;">
            <div style="color: #94a3b8; font-size: 11px;">${payPeriodYears === 7 ? '36.64%' : (payPeriodYears === 5 ? '37.91%' : '30.29%')}</div>
            <div style="font-size: 12px; color: #cbd5e1; font-weight: 700; margin-top: 45px;">5 년</div>
          </div>
          <div style="text-align: center;">
            <div style="color: #2dd4bf; font-weight: 900; font-size: 13px;">${payComplete1dayRate.toFixed(2)}%</div>
            <div style="font-size: 12px; color: #2dd4bf; font-weight: 800; margin-top: 15px;">${payPeriodYears} 년+1일</div>
          </div>
          <div style="text-align: center;">
            <div style="color: #60a5fa; font-weight: 900; font-size: 13px;">${payPeriodYears === 7 ? '108.99%' : (payPeriodYears === 5 ? '113.89%' : '105.00%')}</div>
            <div style="font-size: 12px; color: #cbd5e1; font-weight: 700; margin-top: 8px;">10 년</div>
          </div>
          <div style="text-align: center;">
            <div style="color: #fde047; font-weight: 900; font-size: 16px;">124.89%</div>
            <div style="font-size: 13px; color: #fde047; font-weight: 900; margin-top: 0px;">10 년+1일</div>
          </div>
          <div style="text-align: center;">
            <div style="color: #60a5fa; font-size: 12px;">135.12%</div>
            <div style="font-size: 12px; color: #cbd5e1; font-weight: 700; margin-top: 6px;">20 년</div>
          </div>
          <div style="text-align: center;">
            <div style="color: #2dd4bf; font-size: 12px;">146.12%</div>
            <div style="font-size: 12px; color: #cbd5e1; font-weight: 700; margin-top: 8px;">30 년</div>
          </div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
        <div class="card-dark" style="padding: 16px;">
          <div style="font-size: 11.5px; color: #94a3b8; font-weight: 700;">기본보험료 총액</div>
          <div style="font-size: 24px; font-weight: 900; color: #ffffff; margin-top: 2px;">$${totalPaidUSD.toLocaleString()}</div>
        </div>
        <div class="card-dark" style="border: 2px solid #0d9488; background: rgba(13,148,136,0.2); padding: 16px; margin-top: 10px;">
          <div style="font-size: 11.5px; color: #2dd4bf; font-weight: 800;">10 년 + 1 일 환급금 (124.89%)</div>
          <div style="font-size: 28px; font-weight: 900; color: #2dd4bf; margin-top: 2px;">$${refund10yrUSD.toLocaleString()}</div>
        </div>
        <div style="font-size: 11px; color: #ef4444; font-weight: 800; margin-top: 6px;">
          ⚠ 납입 중 해지 시 큰 손실 (${payPeriodYears} 년 시점 환급률 ${payCompleteRate.toFixed(2)}%)
        </div>
      </div>
    </div>

    <div class="slide-footer">
      <div>${clientName} 고객님 장기 달러 자산 설계 | 자료 : 가입제안서 p.16, p.17</div>
      <div>09 / 15</div>
    </div>
  </div>

  <!-- =================================================== -->
  <!-- SLIDE 10: 09 / 10-YEAR USD VALUE                    -->
  <!-- =================================================== -->
  <div class="slide">
    <div>
      <div class="slide-top-tag">09 / 10-YEAR USD VALUE</div>
      <h2 class="slide-main-title">10 년 후 원화 가치는 달러 금액 x 지급시점 환율입니다</h2>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 20px; align-items: center; margin: 10px 0; flex: 1;">
      <div>
        <div style="font-size: 13px; color: #94a3b8; font-weight: 700;">10 년 + 1 일 해약환급금</div>
        <div class="hero-number" style="font-size: 48px; margin-top: 4px;">$${refund10yrUSD.toLocaleString()}</div>
        <div style="font-size: 13px; color: #cbd5e1; margin-top: 12px; line-height: 1.5;">
          같은 달러 금액이라도 원화로 받는 날의 환율에 따라 최종 원화 가치가 크게 달라집니다 .
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; align-items: flex-end;">
        <div class="card-dark" style="text-align: center; border-top: 4px solid #0d9488; padding: 18px 12px;">
          <div style="font-size: 22px; font-weight: 900; color: #ffffff;">${refund10yrKRW_low} 억원</div>
          <div style="font-size: 13px; color: #2dd4bf; font-weight: 900; margin-top: 6px;">1,200 원</div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">확인용 시나리오</div>
        </div>

        <div class="card-dark" style="text-align: center; border: 2px solid #f59e0b; background: rgba(245,158,11,0.2); padding: 22px 12px;">
          <div style="font-size: 26px; font-weight: 900; color: #fde047;">${refund10yrKRW_mid} 억원</div>
          <div style="font-size: 14px; color: #fde047; font-weight: 900; margin-top: 6px;">${exchangeRateKRW.toLocaleString()} 원</div>
          <div style="font-size: 11px; color: #fde047; font-weight: 700; margin-top: 2px;">제안서 기준환율</div>
        </div>

        <div class="card-dark" style="text-align: center; border-top: 4px solid #38bdf8; padding: 18px 12px;">
          <div style="font-size: 22px; font-weight: 900; color: #ffffff;">${refund10yrKRW_high} 억원</div>
          <div style="font-size: 13px; color: #38bdf8; font-weight: 900; margin-top: 6px;">1,800 원</div>
          <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">확인용 시나리오</div>
        </div>
      </div>
    </div>

    <div class="notice-box-blue" style="text-align: center;">
      1,200 원과 1,800 원은 미래 환율 예상이 아닙니다 . 환율 변동에 따른 자산 규모를 확인하기 위한 시나리오입니다 .
    </div>

    <div class="slide-footer">
      <div>${clientName} 고객님 장기 달러 자산 설계 | 자료 : 가입제안서 p.17, p.21 / 환율 시나리오</div>
      <div>10 / 15</div>
    </div>
  </div>

  <!-- =================================================== -->
  <!-- SLIDE 11: 10 / REAL LIQUIDITY SOLUTIONS [EXACT]     -->
  <!-- =================================================== -->
  <div class="slide">
    <div>
      <div class="slide-top-tag">10 / POLICY LIQUIDITY & RETIREMENT</div>
      <h2 class="slide-main-title">나중에 자금이 필요할 때 , 3대 공식 활용 솔루션</h2>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 10px 0; flex: 1;">
      <!-- Solution 1: 생활자금 선지급 -->
      <div class="card-dark" style="border-top: 4px solid #0d9488; padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <span class="badge-pill" style="background:#0d9488; color:#ffffff;">① 생활자금 선지급 서비스</span>
          <h4 style="font-size: 15px; font-weight: 900; color: #ffffff; margin-top: 10px;">사망보험금 감액 생활비 수령</h4>
          <p style="font-size: 12px; color: #cbd5e1; line-height: 1.5; margin-top: 8px;">
            납입 완료 후(55세~100세), <strong>5년~25년간 매년 가입금액을 자동 감액하여 해약환급금을 생활비로 지급</strong>받으면서 잔존 사망보장도 종신 유지합니다 . (제안서 p.15)
          </p>
        </div>
        <div style="font-size: 11px; color: #2dd4bf; font-weight: 800;">✔ 은퇴 후 평생 생활비 연금 대체 효과</div>
      </div>

      <!-- Solution 2: 달러저축전환특약 -->
      <div class="card-dark" style="border-top: 4px solid #f59e0b; padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <span class="badge-pill" style="background:#78350f; color:#fde68a;">② (무)달러저축전환특약</span>
          <h4 style="font-size: 15px; font-weight: 900; color: #ffffff; margin-top: 10px;">공시이율 4.3% + 중도인출</h4>
          <p style="font-size: 12px; color: #cbd5e1; line-height: 1.5; margin-top: 8px;">
            7년 경과 후 저축으로 전환 시 <strong>공시이율 4.3% 연복리 적용</strong> + <strong>연 12회 자유 중도인출(연 4회 수수료 면제)</strong> + <strong>기본보험료 200% 추가납입</strong>이 가능합니다 . (제안서 p.18, 20)
          </p>
        </div>
        <div style="font-size: 11px; color: #fde047; font-weight: 800;">✔ 자녀 유학자금 / 목적자금 자유 인출 통장</div>
      </div>

      <!-- Solution 3: 원화환산지급서비스 -->
      <div class="card-dark" style="border-top: 4px solid #38bdf8; padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <span class="badge-pill" style="background:#1e3a8a; color:#93c5fd;">③ 원화환산지급서비스특약</span>
          <h4 style="font-size: 15px; font-weight: 900; color: #ffffff; margin-top: 10px;">원화 계좌 즉시 수령</h4>
          <p style="font-size: 12px; color: #cbd5e1; line-height: 1.5; margin-top: 8px;">
            외화통장이 없어도 필요 시 <strong>원화환산지급서비스특약(무료)</strong>을 통해 접수일 환율로 고객의 국내 원화 통장에 즉시 환전 입금받을 수 있습니다 . (제안서 p.21)
          </p>
        </div>
        <div style="font-size: 11px; color: #38bdf8; font-weight: 800;">✔ 복잡한 외환 환전 절차 완전 면제</div>
      </div>
    </div>

    <div class="notice-box">
      <strong>약관 팩트 안내</strong>: 종신보험은 일반 연금보험 대비 사업비가 높아 단순 연금전환은 불리하므로, 상기 <strong>생활자금 선지급</strong> 또는 <strong>달러저축전환특약(공시이율 4.3%)</strong>을 활용하는 것이 가장 유리합니다 .
    </div>

    <div class="slide-footer">
      <div>${clientName} 고객님 장기 달러 자산 설계 | 자료 : 가입제안서 p.2, p.15, p.18-p.21</div>
      <div>11 / 15</div>
    </div>
  </div>

  <!-- =================================================== -->
  <!-- SLIDE 12: 11 / TAX SAVING COMPARISON [KILLER]       -->
  <!-- =================================================== -->
  <div class="slide">
    <div>
      <div class="slide-top-tag">11 / TAX & HEALTH INSURANCE SHIELD</div>
      <h2 class="slide-main-title">일반 금융상품 대비 세금과 건보료를 3,500 만원 지켜냅니다</h2>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 10px 0; flex: 1;">
      <!-- 일반 금융상품 -->
      <div class="card-dark" style="border-left: 5px solid #ef4444; padding: 22px; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="font-size: 14.5px; font-weight: 900; color: #ef4444; margin-bottom: 8px;">일반 예적금 / 펀드 / 채권 (1 억원 수익 발생 시)</div>
        <div style="space-y: 10px; font-size: 13px; color: #cbd5e1;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px;">
            <span>이자소득세 (15.4%):</span>
            <strong style="color: #ef4444; font-size: 14px;">-1,540 만원 증발</strong>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px; margin-top: 6px;">
            <span>금융소득종합과세 (2천초과 누진과세):</span>
            <strong style="color: #ef4444; font-size: 14px;">-1,200 만원 추가 과세</strong>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px; margin-top: 6px;">
            <span>건강보험료 피부양자 박탈/지역 건보료:</span>
            <strong style="color: #ef4444; font-size: 14px;">-800 만원 추가 부과</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding-top: 8px; margin-top: 8px; font-weight: 900; color: #fca5a5; font-size: 15px;">
            <span>총 세금·준조세 손실:</span>
            <span>-3,540 만원 (실수령 6,460 만원)</span>
          </div>
        </div>
      </div>

      <!-- WLB 달러종신 -->
      <div class="card-dark" style="border-left: 5px solid #2dd4bf; background: rgba(13, 148, 136, 0.2); padding: 22px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 10px 30px rgba(45, 212, 191, 0.2);">
        <div style="font-size: 14.5px; font-weight: 900; color: #2dd4bf; margin-bottom: 8px;">WLB 달러종신 플랜 (소득세법 제16조 충족)</div>
        <div style="space-y: 10px; font-size: 13px; color: #cbd5e1;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px;">
            <span>이자소득세 (10년 이상 유지):</span>
            <strong style="color: #2dd4bf; font-size: 14px;">0 원 (100% 전액 비과세)</strong>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px; margin-top: 6px;">
            <span>금융소득종합과세 합산:</span>
            <strong style="color: #2dd4bf; font-size: 14px;">0 원 (합산 대상 완전 배제)</strong>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px; margin-top: 6px;">
            <span>건강보험료 인상 영향:</span>
            <strong style="color: #2dd4bf; font-size: 14px;">0 원 (건보료 인상 없음)</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding-top: 8px; margin-top: 8px; font-weight: 900; color: #5eead4; font-size: 16px;">
            <span>고객 최종 순수령액:</span>
            <span>1 억원 전액 온전히 수령!</span>
          </div>
        </div>
      </div>
    </div>

    <div class="notice-box">
      <strong>자산가 핵심 결론</strong>: 수익률 1~2% 따지는 것보다, 확정된 세금과 건강보험료 3,500만원을 아끼는 것이 가장 완벽한 금융 승리입니다 .
    </div>

    <div class="slide-footer">
      <div>${clientName} 고객님 장기 달러 자산 설계 | 자료 : 소득세법 제16조, 국민건강보험법 시행령</div>
      <div>12 / 15</div>
    </div>
  </div>

  <!-- =================================================== -->
  <!-- SLIDE 13: 12 / TAX & INHERITANCE                    -->
  <!-- =================================================== -->
  <div class="slide">
    <div>
      <div class="slide-top-tag">12 / INHERITANCE & TAX STRATEGY</div>
      <h2 class="slide-main-title">10 년 경과는 비과세의 시작점 입니다 , 상속세 비과세 황금구조</h2>
    </div>

    <div style="margin: 8px 0; flex: 1; display: flex; flex-direction: column; justify-content: space-around;">
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; text-align: center;">
        <div class="card-light">
          <span class="step-badge" style="background:#0d9488; color:#ffffff;">1</span>
          <div style="font-size: 16px; font-weight: 900; margin-top: 4px;">10 년 이상</div>
          <div style="font-size: 11.5px; color: #64748b; font-weight: 700;">계약 유지</div>
        </div>
        <div class="card-light">
          <span class="step-badge" style="background:#0d9488; color:#ffffff;">2</span>
          <div style="font-size: 16px; font-weight: 900; margin-top: 4px;">5 년 이상</div>
          <div style="font-size: 11.5px; color: #64748b; font-weight: 700;">월납 기간</div>
        </div>
        <div class="card-light">
          <span class="step-badge" style="background:#0d9488; color:#ffffff;">3</span>
          <div style="font-size: 16px; font-weight: 900; margin-top: 4px;">균등 월납</div>
          <div style="font-size: 11.5px; color: #64748b; font-weight: 700;">기본보험료</div>
        </div>
        <div class="card-light">
          <span class="step-badge" style="background:#0d9488; color:#ffffff;">4</span>
          <div style="font-size: 16px; font-weight: 900; margin-top: 4px;">월 150 만원</div>
          <div style="font-size: 11.5px; color: #64748b; font-weight: 700;">다른 계약 합산</div>
        </div>
      </div>

      <!-- 상속세 3자 설정 황금구조 -->
      <div class="card-dark" style="padding: 16px; border: 2px solid #a855f7;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 13.5px; font-weight: 900; color: #e9d5ff;">상증세법 제8조 기준 상속세 과세 제외(비과세) 황금 구조</span>
          <span class="brand-pill" style="background:#581c87; color:#f3e8ff;">상속세 0원</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center; font-size: 12px;">
          <div style="background: rgba(0,0,0,0.5); padding: 10px; border-radius: 10px;">
            <div style="color: #94a3b8; font-weight: 700;">계약자</div>
            <strong style="color: #38bdf8; font-size: 14px;">자녀 (소득원 증빙)</strong>
          </div>
          <div style="background: rgba(0,0,0,0.5); padding: 10px; border-radius: 10px;">
            <div style="color: #94a3b8; font-weight: 700;">피보험자</div>
            <strong style="color: #fbbf24; font-size: 14px;">부모 (${clientName})</strong>
          </div>
          <div style="background: rgba(0,0,0,0.5); padding: 10px; border-radius: 10px;">
            <div style="color: #94a3b8; font-weight: 700;">수익자</div>
            <strong style="color: #34d399; font-size: 14px;">자녀</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="notice-box-blue">
      상속세는 6개월 이내 현금 납부가 원칙입니다 . 달러 사망보험금 $${deathBenefitUSD.toLocaleString()}은 부동산 급매나 물납 없이 상속세를 해결하는 최고의 재원이 됩니다 .
    </div>

    <div class="slide-footer">
      <div>${clientName} 고객님 장기 달러 자산 설계 | 자료 : 소득세법 16 조, 상속세및증여세법 제8조</div>
      <div>13 / 15</div>
    </div>
  </div>

  <!-- =================================================== -->
  <!-- SLIDE 14: 13 / DECISION (Pull-Up Top Alignment)     -->
  <!-- =================================================== -->
  <div class="slide">
    <div>
      <div class="slide-top-tag">13 / DECISION</div>
      <h2 class="slide-main-title">장기 보장과 달러 분산이 동시에 필요할 때 유리합니다</h2>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin: 10px 0; flex: 1;">
      <!-- 유리한 조건 -->
      <div class="card-dark" style="border-left: 5px solid #2dd4bf; padding: 22px; display: flex; flex-direction: column; justify-content: flex-start;">
        <div style="font-size: 16px; font-weight: 900; color: #2dd4bf; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
          ✅ 유리한 조건 (가입 적극 권장)
        </div>
        <div style="display: flex; flex-direction: column; gap: 12px; font-size: 14px; color: #cbd5e1;">
          <div style="display: flex; align-items: center;">
            <span class="step-badge" style="width:28px; height:28px;">1</span>
            <span style="font-weight: 600;">10 년 이상 중도해지 없이 안정적 유지 가능</span>
          </div>
          <div style="display: flex; align-items: center;">
            <span class="step-badge" style="width:28px; height:28px;">2</span>
            <span style="font-weight: 600;">원화 자산 외에 글로벌 달러 자산 편입 필요</span>
          </div>
          <div style="display: flex; align-items: center;">
            <span class="step-badge" style="width:28px; height:28px;">3</span>
            <span style="font-weight: 600;">가족을 위한 실질적인 종신 사망보장 필요</span>
          </div>
          <div style="display: flex; align-items: center;">
            <span class="step-badge" style="width:28px; height:28px;">4</span>
            <span style="font-weight: 600;">비상자금이 별도 통장에 충분히 준비되어 있음</span>
          </div>
        </div>
      </div>

      <!-- 맞지 않는 경우 -->
      <div class="card-dark" style="border-left: 5px solid #ef4444; padding: 22px; display: flex; flex-direction: column; justify-content: flex-start;">
        <div style="font-size: 16px; font-weight: 900; color: #ef4444; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
          ❌ 맞지 않는 경우 (가입 재검토)
        </div>
        <div style="display: flex; flex-direction: column; gap: 12px; font-size: 14px; color: #cbd5e1;">
          <div style="display: flex; align-items: center;">
            <span class="step-badge-red" style="width:28px; height:28px;">1</span>
            <span style="font-weight: 600;">${payPeriodYears} 년 안에 찾아 써야 하는 단기 자금</span>
          </div>
          <div style="display: flex; align-items: center;">
            <span class="step-badge-red" style="width:28px; height:28px;">2</span>
            <span style="font-weight: 600;">원화 기준 원금 변동을 절대 원하지 않음</span>
          </div>
          <div style="display: flex; align-items: center;">
            <span class="step-badge-red" style="width:28px; height:28px;">3</span>
            <span style="font-weight: 600;">환율 하락에 따른 평가액 변동을 감당하기 어려움</span>
          </div>
          <div style="display: flex; align-items: center;">
            <span class="step-badge-red" style="width:28px; height:28px;">4</span>
            <span style="font-weight: 600;">보장 기능보다 높은 주식형 투자수익만 원함</span>
          </div>
        </div>
      </div>
    </div>

    <div class="notice-box">
      <strong>가입 전 4 가지 확인</strong>: 150 만원 기준 초과 가능성 / 기존 보험 합산 / 환전비용 / 계약자 - 납부자 - 수익자 세금 관계
    </div>

    <div class="slide-footer">
      <div>${clientName} 고객님 장기 달러 자산 설계 | 최종 판단은 납입여력과 세금 확인 후 결정</div>
      <div>14 / 15</div>
    </div>
  </div>

  <!-- =================================================== -->
  <!-- SLIDE 15: 14 / SOURCES & ADVISORY                   -->
  <!-- =================================================== -->
  <div class="slide">
    <div>
      <div class="slide-top-tag">14 / SOURCES & ADVISORY</div>
      <h2 class="slide-main-title">자료와 계산 기준 & 담당 전문가</h2>
    </div>

    <div style="margin: 10px 0; display: grid; grid-template-columns: 2fr 1.1fr; gap: 18px; flex: 1;">
      <div class="card-dark" style="display: flex; flex-direction: column; justify-content: space-between; padding: 20px; font-size: 12.5px;">
        <div>
          <strong style="color: #38bdf8; font-size: 13.5px;">1. 가입제안서 및 상품설명서</strong>
          <p style="color: #cbd5e1; margin-top: 2px;">${productName} / p.1-p.23</p>
        </div>
        <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px;">
          <strong style="color: #38bdf8; font-size: 13.5px;">2. 소득세법 제 16 조와 시행령 제 25 조</strong>
          <p style="color: #cbd5e1; margin-top: 2px;">보험차익 비과세 요건 및 이자소득세 15.4% 감면 규정</p>
        </div>
        <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px;">
          <strong style="color: #38bdf8; font-size: 13.5px;">3. 한국은행 경제통계시스템 (ECOS)</strong>
          <p style="color: #cbd5e1; margin-top: 2px;">소비자물가 상승률 2% 및 대한민국 역대 위기별 환율 통계</p>
        </div>
        <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px;">
          <strong style="color: #38bdf8; font-size: 13.5px;">4. 국제통화기금 (IMF) 외환보유액 통계</strong>
          <p style="color: #cbd5e1; margin-top: 2px;">전 세계 공식 외환보유액 중 달러 비중 56.77% (2025 Q4)</p>
        </div>
        <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px;">
          <strong style="color: #38bdf8; font-size: 13.5px;">5. 상속세 및 증여세법 제 8 조와 제 34 조</strong>
          <p style="color: #cbd5e1; margin-top: 2px;">사망보험금 상속재산 불산입 및 사전증여 세무 가이드</p>
        </div>
      </div>

      <!-- Planner Card -->
      <div style="background: linear-gradient(145deg, #1e3a8a, #0f172a); border: 2px solid #38bdf8; border-radius: 18px; padding: 22px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 10px 30px rgba(56, 189, 248, 0.3);">
        <div>
          <span class="brand-pill" style="background: #38bdf8; color: #0f172a;">WLB VIP ADVISOR</span>
          <div style="font-size: 22px; font-weight: 900; color: #ffffff; margin-top: 14px;">${plannerName}</div>
          <div style="font-size: 13px; color: #93c5fd; font-weight: 700; margin-top: 4px;">${plannerOrg}</div>
          <div style="font-size: 16px; color: #fde047; font-weight: 900; margin-top: 14px; font-mono; letter-spacing: 0.5px;">${plannerPhone}</div>
        </div>

        <div style="font-size: 11px; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 10px;">
          WLB All Rights Reserved. Confidential.
        </div>
      </div>
    </div>

    <div class="notice-box">
      <strong>계산 기준</strong>: 물가: 100 / (1.02^경과년수) | 환율: $${refund10yrUSD.toLocaleString()} x 시나리오 환율 | 모든 수치는 이해를 돕기 위한 시뮬레이션입니다 .
    </div>

    <div class="slide-footer">
      <div>${clientName} 고객님 장기 달러 자산 설계 | 작성 기준 : ${todayStr}</div>
      <div>16 / 16</div>
    </div>
  </div>

</body>
</html>`;
}

/**
 * Export Presentation PDF
 */
async function exportDollarProposalPdf({ planData, plannerInfo, defaultPath }) {
  const htmlContent = generateDollarProposalHtml({ planData, plannerInfo });

  const printWin = new BrowserWindow({
    show: false,
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  try {
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    await new Promise(r => setTimeout(r, 600));

    const pdfBuffer = await printWin.webContents.printToPDF({
      printBackground: true,
      landscape: true,
      pageSize: 'A4',
      margins: { marginType: 'none' }
    });

    printWin.close();

    const targetFilePath = defaultPath || path.join(
      process.env.USERPROFILE || 'C:\\',
      'Downloads',
      `WLB_달러종신_VIP전략제안서_${planData?.clientName || '고객'}.pdf`
    );

    fs.writeFileSync(targetFilePath, pdfBuffer);
    return { success: true, filePath: targetFilePath };
  } catch (err) {
    if (!printWin.isDestroyed()) printWin.close();
    console.error('Error generating Dollar Proposal PDF:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  generateDollarProposalHtml,
  exportDollarProposalPdf
};