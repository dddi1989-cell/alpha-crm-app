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
  PieChart,
  Download,
  FileDown,
  Building,
  CheckCheck
} from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';
import { api } from '../utils/api';
import { simulatePensionComparison, calculateAge } from '../utils/pensionEngine';

export default function PlannerToolsView() {
  const [activeSubTab, setActiveSubTab] = useState('pension'); // 'pension'
  const customers = useCrmStore((state) => state.customers);
  const currentUser = useCrmStore((state) => state.currentUser);

  // ----------------------------------------------------
  // Pension Calculator Input States
  // ----------------------------------------------------
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [clientName, setClientName] = useState('고객');
  const [birthDate, setBirthDate] = useState('1985-05-15');
  const [gender, setGender] = useState('male');
  const [monthlyPayManwon, setMonthlyPayManwon] = useState(50); // 50만원
  const [payYears, setPayYears] = useState(10); // 10년납
  const [startAge, setStartAge] = useState(65); // 65세 개시
  const [pensionType, setPensionType] = useState('life100'); // 'life100' | 'fixed20' | 'fixed10'

  // PDF Export state
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState('');
  const [exportErrorMsg, setExportErrorMsg] = useState('');

  // Auto-fill when customer is selected
  const handleSelectCustomer = (custId) => {
    setSelectedCustomerId(custId);
    if (!custId) {
      setClientName('고객');
      return;
    }
    const cust = customers.find((c) => String(c.id) === String(custId));
    if (cust) {
      setClientName(cust.name || '고객');
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

  // Export Presentation PDF Handler
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    setExportSuccessMsg('');
    setExportErrorMsg('');

    try {
      const res = await api.tools.exportPensionPdf({
        summary: simulationResult.inputSummary,
        products: simulationResult.products,
        plannerInfo: {
          name: currentUser?.name || 'WLB 재무설계사',
          org_name: currentUser?.org_name || 'WLB 본부',
          phone: currentUser?.phone || ''
        },
        clientName: clientName.trim() || '고객'
      });

      if (res?.success) {
        setExportSuccessMsg(res.message || '프레젠테이션 PDF 제안서 저장이 완료되었습니다!');
        setTimeout(() => setExportSuccessMsg(''), 4000);
      } else if (res?.error && res.error !== '저장이 취소되었습니다.') {
        setExportErrorMsg(res.error);
      }
    } catch (err) {
      setExportErrorMsg('PDF 생성 실패: ' + err.message);
    } finally {
      setIsExportingPdf(false);
    }
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
                국내 주요 금융사·생손보사 연금 상품 실시간 비교 & 고객 프레젠테이션 제안서 PDF 자동 생성
              </p>
            </div>
          </div>
        </div>

        {/* Top Sub Tabs & PDF Export Button */}
        <div className="flex items-center space-x-3">
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

          <button
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-extrabold text-xs rounded-2xl shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {isExportingPdf ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>PDF 생성 중...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                <span>📊 프레젠테이션 PDF 제안서 다운로드</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success/Error Alerts */}
      {exportSuccessMsg && (
        <div className="p-3.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 rounded-2xl text-xs font-bold flex items-center justify-between animate-fadeIn shadow-lg">
          <span className="flex items-center space-x-2">
            <CheckCheck className="w-4 h-4 text-emerald-400" />
            <span>{exportSuccessMsg} (저장된 폴더가 자동으로 열렸습니다)</span>
          </span>
          <button onClick={() => setExportSuccessMsg('')} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {exportErrorMsg && (
        <div className="p-3.5 bg-red-950/80 border border-red-500/50 text-red-300 rounded-2xl text-xs font-bold flex items-center justify-between animate-fadeIn shadow-lg">
          <span>⚠️ {exportErrorMsg}</span>
          <button onClick={() => setExportErrorMsg('')} className="text-red-400 hover:text-white">✕</button>
        </div>
      )}

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
                  <span>고객 선택 (자동 채움)</span>
                </span>
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="">직접 정보 입력 (기본 고객)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.birth_date || '생일미등록'} / {c.gender || '성별미지정'})
                  </option>
                ))}
              </select>
            </div>

            {/* Client Name Direct Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">고객 성명 (제안서 표기용)</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="예: 홍길동"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
              />
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
                  [{clientName} 고객님 플랜] 만 {simulationResult.inputSummary.currentAge}세 / {simulationResult.inputSummary.monthlyPayStr}씩 {simulationResult.inputSummary.payYearsStr}
                </h3>
              </div>
              <span className="text-xs font-mono text-sky-400 bg-sky-950/60 px-3 py-1 rounded-full border border-sky-800/50">
                담당 설계사: {currentUser?.name || 'WLB 재무설계사'}
              </span>
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
              <span>국내 주요 금융사·보험사 연금 상품군 실시간 대조 (4개 선택지)</span>
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
                      {/* Top Rank Badge & Exact Company Name */}
                      <div className="flex items-center justify-between">
                        <span className={'text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ' + 
                          (isGuaranteed 
                            ? 'bg-amber-950 text-amber-300 border-amber-800/80' 
                            : (isTax 
                              ? 'bg-blue-950 text-blue-300 border-blue-800/80' 
                              : 'bg-slate-950 text-slate-300 border-slate-800'))}>
                          {prod.rankTag}
                        </span>
                        <span className="text-xs font-extrabold text-sky-400 font-sans flex items-center space-x-1">
                          <Building className="w-3.5 h-3.5" />
                          <span>{prod.companyName}</span>
                        </span>
                      </div>

                      {/* Name & Product Full Name */}
                      <div>
                        <h4 className="text-base font-extrabold text-white">
                          {prod.name}
                        </h4>
                        <p className="text-xs text-slate-300 font-medium mt-0.5">
                          대표상품: <span className="text-amber-300 font-bold">{prod.productName}</span>
                        </p>
                        <p className="text-[11px] text-indigo-400 font-medium mt-0.5">
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
              <span>금융사별 대표 연금 상품 정밀 대조표</span>
            </h4>

            <table className="w-full text-left text-xs border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400 bg-slate-950/60">
                  <th className="p-2.5 font-bold">대표 금융사 & 상품명</th>
                  <th className="p-2.5 font-bold">적용 이율</th>
                  <th className="p-2.5 font-bold">월 예상 수령액</th>
                  <th className="p-2.5 font-bold">개시시점 환급률</th>
                  <th className="p-2.5 font-bold">100세 총 수령액</th>
                  <th className="p-2.5 font-bold">세제 혜택</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {simulationResult.products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-850/40 transition-colors">
                    <td className="p-2.5 font-bold text-white font-sans">
                      <div className="text-sky-400 font-bold">{p.companyName}</div>
                      <div className="text-[11px] text-slate-300 font-normal">{p.productName}</div>
                    </td>
                    <td className="p-2.5 text-indigo-300">{p.rateText.split(' ')[0]} {p.rateText.split(' ')[1]}</td>
                    <td className="p-2.5 font-extrabold text-amber-400">{p.monthlyPensionStr}</td>
                    <td className="p-2.5 font-bold text-emerald-400">{p.refundRate}%</td>
                    <td className="p-2.5 font-bold text-emerald-400">{p.totalReceivedStr}</td>
                    <td className="p-2.5 text-slate-300 font-sans text-[11px]">{p.taxBenefit.slice(0, 18)}...</td>
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
