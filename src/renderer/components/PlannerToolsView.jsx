import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  Sparkles, 
  TrendingUp, 
  ShieldCheck, 
  Copy, 
  Check, 
  User, 
  DollarSign, 
  Calendar, 
  Award, 
  Info, 
  Layers, 
  ArrowRight,
  Clock,
  Briefcase,
  ChevronRight,
  FileText,
  Percent,
  CheckCircle2,
  PieChart
} from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';
import { simulatePensionComparison, calculateAge } from '../utils/pensionEngine';

export default function PlannerToolsView() {
  const [activeSubTab, setActiveSubTab] = useState('pension'); // 'pension' (추후 'tax', 'needs' 등 확장 가능)
  const customers = useCrmStore((state) => state.customers);

  // ----------------------------------------------------
  // Pension Calculator Input States
  // ----------------------------------------------------
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [birthDate, setBirthDate] = useState('1985-05-15');
  const [gender, setGender] = useState('male');
  const [monthlyPayManwon, setMonthlyPayManwon] = useState(50); // 50만원
  const [payYears, setPayYears] = useState(10); // 10년납
  const [startAge, setStartAge] = useState(65); // 65세 개시
  const [pensionType, setPensionType] = useState('life100'); // 'life100' | 'fixed20' | 'fixed10'

  // Copy state
  const [copied, setCopied] = useState(false);

  // Auto-fill when customer is selected
  const handleSelectCustomer = (custId) => {
    setSelectedCustomerId(custId);
    if (!custId) return;
    const cust = customers.find((c) => String(c.id) === String(custId));
    if (cust) {
      if (cust.birth_date) setBirthDate(cust.birth_date);
      if (cust.gender) setGender(cust.gender === '여성' || cust.gender === 'female' ? 'female' : 'male');
    }
  };

  // Current Age calculation
  const currentAge = useMemo(() => {
    return calculateAge(birthDate);
  }, [birthDate]);

  // Ensure startAge > currentAge + payYears
  const minStartAge = Math.max(55, currentAge + payYears);
  const effectiveStartAge = Math.max(startAge, minStartAge);

  // Run Simulation
  const simulationResult = useMemo(() => {
    return simulatePensionComparison({
      currentAge,
      gender,
      monthlyPay: monthlyPayManwon * 10000,
      payYears,
      startAge: effectiveStartAge,
      pensionType
    });
  }, [currentAge, gender, monthlyPayManwon, payYears, effectiveStartAge, pensionType]);

  // Copy Proposal Summary
  const handleCopyProposal = () => {
    const s = simulationResult.inputSummary;
    const topProd = simulationResult.products[0];

    const text = `[📋 맞춤 노후 연금 플랜 비교 제안서]
━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 기본 설계 조건
- 가입연령: 현재 만 ${s.currentAge}세 (${s.genderLabel})
- 월 납입액: ${s.monthlyPayStr} (${s.payYearsStr})
- 총 납입원금: ${s.totalPrincipalStr}
- 연금 개시: 만 ${s.startAge}세 (${s.deferYears > 0 ? `거치기간 ${s.deferYears}년` : '즉시연계'})
- 수령 형태: ${s.pensionTypeLabel}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 주요 금융사 연금 상품별 비교 결과
1. [강력추천] ${topProd.name}
   - 개시시점 적립금: ${topProd.accumulatedFundStr} (환급률 ${topProd.refundRate}%)
   - 매월 예상 수령액: ${topProd.monthlyPensionStr} (연 ${topProd.annualPensionStr})
   - 100세까지 총수령액: ${topProd.totalReceivedStr} (원금대비 ${topProd.totalReceivedRatio}%)
   - 혜택: ${topProd.taxBenefit}

2. ${simulationResult.products[1].name}
   - 매월 예상 수령액: ${simulationResult.products[1].monthlyPensionStr}
   - 100세까지 총수령액: ${simulationResult.products[1].totalReceivedStr}

3. ${simulationResult.products[2].name}
   - 매년 세액공제: ${simulationResult.products[2].taxBenefit}
   - 매월 예상 수령액: ${simulationResult.products[2].monthlyPensionStr}

4. ${simulationResult.products[3].name}
   - 매월 예상 수령액: ${simulationResult.products[3].monthlyPensionStr} (투자수익형)

━━━━━━━━━━━━━━━━━━━━━━━━━━━
※ 고객님의 재정 상황과 목적(평생 확정보장 vs 연말정산 절세)에 가장 적합한 상품을 상담해 드립니다.
- WLB CRM 연금 솔루션 -`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none animate-fadeIn">
      {/* 1. Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white flex items-center space-x-2">
                <span>설계사 도구</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/60 font-mono">
                  FA Pro Suite
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                고객 맞춤형 연금 시뮬레이션 및 국내 주요 금융사·보험사 상품별 수령액/이율 실시간 비교
              </p>
            </div>
          </div>
        </div>

        {/* Top Sub Tabs */}
        <div className="flex items-center space-x-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveSubTab('pension')}
            className={'flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ' + 
              (activeSubTab === 'pension' 
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/30' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800')}
          >
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span>💰 연금계산기 (금융사비교)</span>
          </button>
        </div>
      </div>

      {/* 2. Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ========================================== */}
        {/* LEFT COLUMN: Input Parameters (4 cols) */}
        {/* ========================================== */}
        <div className="lg:col-span-4 space-y-5">
          <div className="glass-panel p-5 rounded-3xl border border-slate-800/90 shadow-xl space-y-5 bg-slate-900/80">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>연금 시뮬레이션 조건 설정</span>
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">실시간 자동계산</span>
            </div>

            {/* 1. Customer Auto-fill Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span className="flex items-center space-x-1">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  <span>등록 고객 불러오기 (선택)</span>
                </span>
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="">직접 정보 입력</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.birth_date || '생일미등록'} / {c.gender || '성별미지정'})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Birth Date & Gender */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">생년월일</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-[11px] text-indigo-400 font-bold">만 {currentAge}세</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">성별</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setGender('male')}
                    className={'py-2 rounded-xl text-xs font-bold border transition-all ' + 
                      (gender === 'male' 
                        ? 'bg-blue-950 text-blue-300 border-blue-600 shadow-sm' 
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800')}
                  >
                    남성
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('female')}
                    className={'py-2 rounded-xl text-xs font-bold border transition-all ' + 
                      (gender === 'female' 
                        ? 'bg-pink-950 text-pink-300 border-pink-600 shadow-sm' 
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800')}
                  >
                    여성
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Monthly Pay Amount */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center space-x-1">
                  <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                  <span>월 납입 금액</span>
                </label>
                <span className="text-sm font-extrabold text-amber-300 font-mono">
                  {monthlyPayManwon.toLocaleString()}만원
                </span>
              </div>

              {/* Quick Select Buttons */}
              <div className="grid grid-cols-4 gap-1.5">
                {[20, 30, 50, 70, 100, 150, 200, 300].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setMonthlyPayManwon(amt)}
                    className={'py-1.5 rounded-lg text-xs font-bold border transition-all ' + 
                      (monthlyPayManwon === amt 
                        ? 'bg-amber-600 text-white border-amber-500 shadow-md' 
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800')}
                  >
                    {amt}만
                  </button>
                ))}
              </div>

              {/* Slider */}
              <input
                type="range"
                min="10"
                max="500"
                step="5"
                value={monthlyPayManwon}
                onChange={(e) => setMonthlyPayManwon(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer mt-1"
              />
            </div>

            {/* 4. Pay Years */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>납입 기간</span>
                </label>
                <span className="text-xs font-extrabold text-indigo-300 font-mono">
                  {payYears}년납
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {[5, 7, 10, 15, 20].map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setPayYears(yr)}
                    className={'py-1.5 rounded-lg text-xs font-bold border transition-all ' + 
                      (payYears === yr 
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md' 
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800')}
                  >
                    {yr}년
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Start Age */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>연금 개시 연령</span>
                </label>
                <span className="text-xs font-extrabold text-emerald-300 font-mono">
                  만 {effectiveStartAge}세 개시
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {[55, 60, 65, 70].map((age) => (
                  <button
                    key={age}
                    type="button"
                    disabled={age < minStartAge}
                    onClick={() => setStartAge(age)}
                    className={'py-1.5 rounded-lg text-xs font-bold border transition-all ' + 
                      (effectiveStartAge === age 
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md' 
                        : (age < minStartAge 
                          ? 'bg-slate-950 text-slate-600 border-slate-900 cursor-not-allowed' 
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'))}
                  >
                    {age}세
                  </button>
                ))}
              </div>
            </div>

            {/* 6. Pension Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">연금 수령 형태</label>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <button
                  type="button"
                  onClick={() => setPensionType('life100')}
                  className={'py-2 rounded-xl text-xs font-bold border transition-all ' + 
                    (pensionType === 'life100' 
                      ? 'bg-indigo-950 text-indigo-300 border-indigo-600 shadow-sm' 
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800')}
                >
                  종신 100세형
                </button>
                <button
                  type="button"
                  onClick={() => setPensionType('fixed20')}
                  className={'py-2 rounded-xl text-xs font-bold border transition-all ' + 
                    (pensionType === 'fixed20' 
                      ? 'bg-indigo-950 text-indigo-300 border-indigo-600 shadow-sm' 
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800')}
                >
                  20년 확정형
                </button>
                <button
                  type="button"
                  onClick={() => setPensionType('fixed10')}
                  className={'py-2 rounded-xl text-xs font-bold border transition-all ' + 
                    (pensionType === 'fixed10' 
                      ? 'bg-indigo-950 text-indigo-300 border-indigo-600 shadow-sm' 
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800')}
                >
                  10년 확정형
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* RIGHT COLUMN: Comparison Dashboard (8 cols) */}
        {/* ========================================== */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Top Key Metrics Banner */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-950/90 via-slate-900 to-slate-950 border border-indigo-500/40 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-900/50 pb-3">
              <div className="flex items-center space-x-2">
                <Award className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm text-white">
                  설계 요약: 만 {simulationResult.inputSummary.currentAge}세 / {simulationResult.inputSummary.monthlyPayStr}씩 {simulationResult.inputSummary.payYearsStr}
                </h3>
              </div>
              <button
                onClick={handleCopyProposal}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 active:scale-95 shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '제안서 복사완료!' : '고객 상담용 제안서 복사'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                <p className="text-[10px] font-bold text-slate-400">총 납입 원금</p>
                <p className="text-base font-extrabold text-white font-mono">
                  {simulationResult.inputSummary.totalPrincipalStr}
                </p>
                <p className="text-[10px] text-slate-500">{simulationResult.inputSummary.payYears * 12}회 납입</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                <p className="text-[10px] font-bold text-slate-400">개시 시점 거치기간</p>
                <p className="text-base font-extrabold text-indigo-300 font-mono">
                  {simulationResult.inputSummary.deferYears}년 거치
                </p>
                <p className="text-[10px] text-slate-500">{simulationResult.inputSummary.startAge}세부터 수령</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 space-y-1">
                <p className="text-[10px] font-bold text-amber-300">최고 예상 월 수령액</p>
                <p className="text-lg font-black text-amber-400 font-mono">
                  {simulationResult.products[0].monthlyPensionStr}
                </p>
                <p className="text-[10px] text-amber-300/80">평생보증 매월 지급</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-1">
                <p className="text-[10px] font-bold text-emerald-300">100세 총 누적수령</p>
                <p className="text-lg font-black text-emerald-400 font-mono">
                  {simulationResult.products[0].totalReceivedStr}
                </p>
                <p className="text-[10px] text-emerald-300/80">원금 대비 {simulationResult.products[0].totalReceivedRatio}%</p>
              </div>
            </div>
          </div>

          {/* 4 Product Comparison Cards */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-white flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>국내 주요 금융사·보험사 연금 상품군 비교 (4개 선택지)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {simulationResult.products.map((prod) => {
                const isGuaranteed = prod.id === 'guaranteed';
                const isTax = prod.id === 'tax_deduct';

                return (
                  <div
                    key={prod.id}
                    className={'p-5 rounded-3xl border transition-all flex flex-col justify-between space-y-4 shadow-xl ' + 
                      (isGuaranteed 
                        ? 'bg-slate-900/90 border-amber-500/50 shadow-amber-950/20' 
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700')}
                  >
                    <div className="space-y-3">
                      {/* Top Rank Badge */}
                      <div className="flex items-center justify-between">
                        <span className={'text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ' + 
                          (isGuaranteed 
                            ? 'bg-amber-950 text-amber-300 border-amber-800/80' 
                            : (isTax 
                              ? 'bg-blue-950 text-blue-300 border-blue-800/80' 
                              : 'bg-slate-950 text-slate-300 border-slate-800'))}>
                          {prod.rankTag}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">{prod.companies}</span>
                      </div>

                      {/* Name & Category */}
                      <div>
                        <h4 className="text-base font-extrabold text-white">
                          {prod.name}
                        </h4>
                        <p className="text-xs text-indigo-400 font-medium mt-0.5">
                          {prod.rateText}
                        </p>
                      </div>

                      {/* Main Pension Amount Box */}
                      <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">매월 예상 수령액</span>
                          <span className="text-base font-black text-amber-400 font-mono">
                            {prod.monthlyPensionStr}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800/60">
                          <span className="text-slate-400">연간 수령액</span>
                          <span className="font-bold text-white font-mono">{prod.annualPensionStr}</span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">개시시점 적립금 (환급률)</span>
                          <span className="font-bold text-white font-mono">
                            {prod.accumulatedFundStr} <span className="text-emerald-400 font-bold">({prod.refundRate}%)</span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">100세 총 누적수령</span>
                          <span className="font-extrabold text-emerald-300 font-mono">
                            {prod.totalReceivedStr}
                          </span>
                        </div>
                      </div>

                      {/* Tax Benefit */}
                      <div className="p-2.5 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs flex items-center space-x-2">
                        <Percent className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="text-slate-300 font-medium">{prod.taxBenefit}</span>
                      </div>

                      {/* Key Features List */}
                      <ul className="space-y-1 text-[11px] text-slate-400 pl-4 list-disc">
                        {prod.keyFeatures.map((feat, idx) => (
                          <li key={idx} className="leading-snug">{feat}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comparison Table */}
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 bg-slate-900/80 shadow-xl overflow-x-auto custom-scrollbar">
            <h4 className="text-xs font-bold text-white flex items-center space-x-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>연금 상품별 핵심 비교표 (요약)</span>
            </h4>

            <table className="w-full text-left text-xs border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400 bg-slate-950/60">
                  <th className="p-2.5 font-bold">상품 구분</th>
                  <th className="p-2.5 font-bold">적용 이율</th>
                  <th className="p-2.5 font-bold">월 예상 수령액</th>
                  <th className="p-2.5 font-bold">100세 총 수령액</th>
                  <th className="p-2.5 font-bold">세제 혜택</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {simulationResult.products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-850/40 transition-colors">
                    <td className="p-2.5 font-bold text-white font-sans">{p.category}</td>
                    <td className="p-2.5 text-indigo-300">{p.rateText.split(' ')[0]} {p.rateText.split(' ')[1]}</td>
                    <td className="p-2.5 font-extrabold text-amber-400">{p.monthlyPensionStr}</td>
                    <td className="p-2.5 font-bold text-emerald-400">{p.totalReceivedStr}</td>
                    <td className="p-2.5 text-slate-300 font-sans text-[11px]">{p.taxBenefit.slice(0, 15)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}
