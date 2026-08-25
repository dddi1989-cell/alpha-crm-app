/**
 * Pension Calculation & Comparison Engine
 * Simulates domestic life insurance, non-life insurance, and financial pension products
 */

// Approximate Life Expectancy table based on 10th Korean Empirical Life Table
export function getLifeExpectancy(age, gender = 'male') {
  const baseExpectancy = gender === 'female' ? 86.6 : 80.6;
  if (age < baseExpectancy) {
    return Math.max(85, Math.round(baseExpectancy + (age * 0.15)));
  }
  return age + 5;
}

/**
 * Calculate age from birth date string (YYYY-MM-DD)
 */
export function calculateAge(birthDateStr, targetDate = new Date()) {
  if (!birthDateStr) return 40; // default 40
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return 40;
  
  let age = targetDate.getFullYear() - birth.getFullYear();
  const m = targetDate.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && targetDate.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

/**
 * Main Pension Comparison Simulator
 * @param {object} params
 * @param {number} params.currentAge - Current age of client
 * @param {string} params.gender - 'male' | 'female'
 * @param {number} params.monthlyPay - Monthly payment in Won (e.g. 500000)
 * @param {number} params.payYears - Payment period in years (e.g. 10)
 * @param {number} params.startAge - Pension start age (e.g. 65)
 * @param {string} params.pensionType - 'life100' (종신100세보증) | 'fixed20' (확정20년) | 'fixed10' (확정10년) | 'inherited' (상속형)
 */
export function simulatePensionComparison({
  currentAge = 40,
  gender = 'male',
  monthlyPay = 500000,
  payYears = 10,
  startAge = 65,
  pensionType = 'life100'
}) {
  const totalPayMonths = payYears * 12;
  const totalPrincipal = monthlyPay * totalPayMonths; // 총 납입 원금
  const deferYears = Math.max(0, startAge - currentAge - payYears); // 거치 기간(년)
  const totalAccumulationYears = Math.max(1, startAge - currentAge); // 총 적립 기간(년)
  const lifeSpan = 100; // 100세 기준
  const receivingYears = Math.max(1, lifeSpan - startAge + 1); // 100세까지 수령 기간

  // ----------------------------------------------------
  // Product 1: 평생 최저보증 연금 (단리 5~7% 보증형) - 예: D사/I사/K사 평생보증연금
  // 납입기간 및 거치기간 동안 단리 5.0%~7.0% 최저보증 후 연금전환 시 고정 연금지급률 적용
  // ----------------------------------------------------
  const p1GuaranteedRate = 0.055; // 연 5.5% 단리 최저보증 가정
  const p1InterestFactor = (payYears / 2 + deferYears) * p1GuaranteedRate;
  const p1AccumulatedFund = Math.round(totalPrincipal * (1 + p1InterestFactor));
  const p1RefundRate = ((p1AccumulatedFund / totalPrincipal) * 100).toFixed(1);

  // 평생보증 연금지급률 (성별 및 개시연령별 지급률)
  const p1PayoutRate = (0.038 + (startAge - 55) * 0.0014 + (gender === 'male' ? 0.002 : 0));
  const p1AnnualPension = Math.round(p1AccumulatedFund * p1PayoutRate);
  const p1MonthlyPension = Math.round(p1AnnualPension / 12);
  const p1TotalReceived = Math.round(p1AnnualPension * receivingYears);

  // ----------------------------------------------------
  // Product 2: 공시이율형 비과세 연금보험 (안정적 복리 이율형) - 예: S생명/H생명 비과세 연금
  // ----------------------------------------------------
  const p2AnnualRate = 0.031; // 연 3.1% 공시이율
  const p2MonthlyRate = p2AnnualRate / 12;
  let p2Fund = 0;
  for (let m = 0; m < totalPayMonths; m++) {
    p2Fund = (p2Fund + monthlyPay) * (1 + p2MonthlyRate);
  }
  for (let m = 0; m < deferYears * 12; m++) {
    p2Fund = p2Fund * (1 + p2MonthlyRate);
  }
  const p2AccumulatedFund = Math.round(p2Fund);
  const p2RefundRate = ((p2AccumulatedFund / totalPrincipal) * 100).toFixed(1);

  let p2MonthlyPension = 0;
  if (pensionType === 'fixed10') {
    p2MonthlyPension = Math.round(p2AccumulatedFund / 120 * 1.08);
  } else if (pensionType === 'fixed20') {
    p2MonthlyPension = Math.round(p2AccumulatedFund / 240 * 1.15);
  } else {
    const months = receivingYears * 12;
    p2MonthlyPension = Math.round((p2AccumulatedFund / months) * 1.25);
  }
  const p2AnnualPension = p2MonthlyPension * 12;
  const p2TotalReceived = Math.round(p2AnnualPension * receivingYears);

  // ----------------------------------------------------
  // Product 3: 세액공제 연금저축 (연말정산 특화) - 예: 금융사 연금저축
  // ----------------------------------------------------
  const p3AnnualRate = 0.035; // 연 3.5%
  const p3MonthlyRate = p3AnnualRate / 12;
  let p3Fund = 0;
  for (let m = 0; m < totalPayMonths; m++) {
    p3Fund = (p3Fund + monthlyPay) * (1 + p3MonthlyRate);
  }
  for (let m = 0; m < deferYears * 12; m++) {
    p3Fund = p3Fund * (1 + p3MonthlyRate);
  }
  const p3AccumulatedFund = Math.round(p3Fund);
  const p3RefundRate = ((p3AccumulatedFund / totalPrincipal) * 100).toFixed(1);

  const annualPay = Math.min(6000000, monthlyPay * 12);
  const annualTaxRefund = Math.round(annualPay * 0.132);
  const totalTaxRefund = annualTaxRefund * payYears;

  const p3Months = (pensionType === 'fixed10' ? 120 : (pensionType === 'fixed20' ? 240 : receivingYears * 12));
  const p3GrossMonthly = Math.round((p3AccumulatedFund / p3Months) * 1.2);
  const p3MonthlyPension = Math.round(p3GrossMonthly * (1 - 0.055));
  const p3AnnualPension = p3MonthlyPension * 12;
  const p3TotalReceived = Math.round(p3AnnualPension * receivingYears) + totalTaxRefund;

  // ----------------------------------------------------
  // Product 4: 변액/투자형 연금보험 (원금보장형) - 예: M사/P사 변액연금
  // ----------------------------------------------------
  const p4AssumedRate = 0.050; // 연 5.0% 가정수익률
  const p4MonthlyRate = p4AssumedRate / 12;
  let p4Fund = 0;
  for (let m = 0; m < totalPayMonths; m++) {
    p4Fund = (p4Fund + monthlyPay * 0.95) * (1 + p4MonthlyRate);
  }
  for (let m = 0; m < deferYears * 12; m++) {
    p4Fund = p4Fund * (1 + p4MonthlyRate);
  }
  const p4AccumulatedFund = Math.round(Math.max(totalPrincipal * 1.05, p4Fund));
  const p4RefundRate = ((p4AccumulatedFund / totalPrincipal) * 100).toFixed(1);

  const p4MonthlyPension = Math.round((p4AccumulatedFund / (receivingYears * 12)) * 1.3);
  const p4AnnualPension = p4MonthlyPension * 12;
  const p4TotalReceived = Math.round(p4AnnualPension * receivingYears);

  return {
    inputSummary: {
      currentAge,
      gender,
      genderLabel: gender === 'female' ? '여성' : '남성',
      monthlyPay,
      monthlyPayStr: `${(monthlyPay / 10000).toLocaleString()}만원`,
      payYears,
      payYearsStr: `${payYears}년납`,
      startAge,
      startAgeStr: `${startAge}세 개시`,
      deferYears,
      totalPrincipal,
      totalPrincipalStr: `${Math.round(totalPrincipal / 10000).toLocaleString()}만원`,
      receivingYears,
      pensionType,
      pensionTypeLabel: pensionType === 'fixed10' ? '10년 확정지급형' : (pensionType === 'fixed20' ? '20년 확정지급형' : '100세 보증 종신연금형')
    },
    products: [
      {
        id: 'guaranteed',
        rankTag: '🏆 안정수익 1위 (강력추천)',
        name: '평생 최저보증 연금 (단리 5.5% 보증)',
        category: '최저보증형 종신연금',
        companies: 'D생명, I생명, K생명 등',
        badgeColor: 'amber',
        rateText: '연 5.5% 단리 평생보증',
        accumulatedFund: p1AccumulatedFund,
        accumulatedFundStr: `${Math.round(p1AccumulatedFund / 10000).toLocaleString()}만원`,
        refundRate: p1RefundRate,
        monthlyPension: p1MonthlyPension,
        monthlyPensionStr: `${Math.round(p1MonthlyPension / 10000).toLocaleString()}만원`,
        annualPension: p1AnnualPension,
        annualPensionStr: `${Math.round(p1AnnualPension / 10000).toLocaleString()}만원`,
        totalReceived: p1TotalReceived,
        totalReceivedStr: `${Math.round(p1TotalReceived / 10000).toLocaleString()}만원`,
        totalReceivedRatio: ((p1TotalReceived / totalPrincipal) * 100).toFixed(1),
        taxBenefit: '10년 유지 시 비과세 (이자소득세 0원)',
        keyFeatures: [
          '투자 수익률과 상관없이 계약 시점의 최저보증 연금액 100% 보증',
          '살아있는 동안 평생 매월 동일한 확정 연금 지급',
          '금리 하락기에도 원금 손실 없는 가장 안전한 노후 준비'
        ]
      },
      {
        id: 'declared_rate',
        rankTag: '⭐ 안정 복리형',
        name: '공시이율형 비과세 연금보험',
        category: '공시이율 복리 연금',
        companies: 'S생명, H생명, K손보 등',
        badgeColor: 'emerald',
        rateText: '공시이율 3.1% (최저보증 1.0%)',
        accumulatedFund: p2AccumulatedFund,
        accumulatedFundStr: `${Math.round(p2AccumulatedFund / 10000).toLocaleString()}만원`,
        refundRate: p2RefundRate,
        monthlyPension: p2MonthlyPension,
        monthlyPensionStr: `${Math.round(p2MonthlyPension / 10000).toLocaleString()}만원`,
        annualPension: p2AnnualPension,
        annualPensionStr: `${Math.round(p2AnnualPension / 10000).toLocaleString()}만원`,
        totalReceived: p2TotalReceived,
        totalReceivedStr: `${Math.round(p2TotalReceived / 10000).toLocaleString()}만원`,
        totalReceivedRatio: ((p2TotalReceived / totalPrincipal) * 100).toFixed(1),
        taxBenefit: '10년 이상 유지 시 전액 비과세',
        keyFeatures: [
          '안정적인 복리 이자 증식 및 최저보증이율 안전망',
          '목돈 필요 시 중도인출 및 추가납입 기능 활용 가능',
          '금융소득종합과세 제외되는 완벽한 비과세 혜택'
        ]
      },
      {
        id: 'tax_deduct',
        rankTag: '💰 세금환급 1위',
        name: '세액공제 연금저축 (연말정산 특화)',
        category: '세제적격 연금저축',
        companies: '은행, 증권사, 생손보사',
        badgeColor: 'blue',
        rateText: '연 3.5% + 연말정산 최대 16.5% 환급',
        accumulatedFund: p3AccumulatedFund,
        accumulatedFundStr: `${Math.round(p3AccumulatedFund / 10000).toLocaleString()}만원`,
        refundRate: p3RefundRate,
        monthlyPension: p3MonthlyPension,
        monthlyPensionStr: `${Math.round(p3MonthlyPension / 10000).toLocaleString()}만원 (세후)`,
        annualPension: p3AnnualPension,
        annualPensionStr: `${Math.round(p3AnnualPension / 10000).toLocaleString()}만원 (세후)`,
        totalReceived: p3TotalReceived,
        totalReceivedStr: `${Math.round(p3TotalReceived / 10000).toLocaleString()}만원 (환급세금 포함)`,
        totalReceivedRatio: ((p3TotalReceived / totalPrincipal) * 100).toFixed(1),
        taxBenefit: `매년 최대 ${Math.round(annualTaxRefund/10000)}만원 세액공제 (총 ${Math.round(totalTaxRefund/10000)}만원 환급)`,
        keyFeatures: [
          '근로소득자/자영업자 매년 연말정산 시 막강한 세금 환급',
          '연금 수령 시 3.3%~5.5%의 저율 연금소득세만 부과',
          '직장인 절세 재테크 1순위 필수 상품'
        ]
      },
      {
        id: 'variable',
        rankTag: '📈 고수익 추구형',
        name: '변액/투자형 연금보험 (펀드운용형)',
        category: '변액투자 연금',
        companies: 'M생명, P생명, F생명 등',
        badgeColor: 'purple',
        rateText: '가정수익률 연 5.0% (원금보장형)',
        accumulatedFund: p4AccumulatedFund,
        accumulatedFundStr: `${Math.round(p4AccumulatedFund / 10000).toLocaleString()}만원`,
        refundRate: p4RefundRate,
        monthlyPension: p4MonthlyPension,
        monthlyPensionStr: `${Math.round(p4MonthlyPension / 10000).toLocaleString()}만원`,
        annualPension: p4AnnualPension,
        annualPensionStr: `${Math.round(p4AnnualPension / 10000).toLocaleString()}만원`,
        totalReceived: p4TotalReceived,
        totalReceivedStr: `${Math.round(p4TotalReceived / 10000).toLocaleString()}만원`,
        totalReceivedRatio: ((p4TotalReceived / totalPrincipal) * 100).toFixed(1),
        taxBenefit: '10년 이상 유지 시 비과세',
        keyFeatures: [
          '글로벌 주식/채권 분산투자로 인플레이션 헷지 및 초과수익 추구',
          '연금개시 시점 납입원금 100%~130% 최저보증 기능 탑재',
          '시장 상승기 높은 연금 수령액 기대 가능'
        ]
      }
    ]
  };
}
