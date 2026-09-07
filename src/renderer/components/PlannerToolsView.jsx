import React, { useState, useEffect, useMemo } from 'react';
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
  CheckCheck,
  RefreshCw,
  Edit3,
  Save,
  X,
  ShieldAlert
} from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';
import { api } from '../utils/api';
import { simulatePensionComparison, calculateAge } from '../utils/pensionEngine';
import DollarUniversalPlannerView from './tools/DollarUniversalPlannerView';
import MedicalExpenseAnalyzerView from './tools/MedicalExpenseAnalyzerView';

export default function PlannerToolsView() {
  const plannerSubTab = useCrmStore((state) => state.plannerSubTab);
  const setPlannerSubTab = useCrmStore((state) => state.setPlannerSubTab);
  const [activeSubTab, setActiveSubTab] = useState(plannerSubTab || 'pension'); // 'pension' | 'dollar' | 'medical'

  useEffect(() => {
    if (plannerSubTab) {
      setActiveSubTab(plannerSubTab);
    }
  }, [plannerSubTab]);

  const handleSubTabChange = (tab) => {
    setActiveSubTab(tab);
    if (setPlannerSubTab) setPlannerSubTab(tab);
  };
  const customers = useCrmStore((state) => state.customers);
  const currentUser = useCrmStore((state) => state.currentUser);

  // Is Top Admin
  const isAdmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'admin' || currentUser.username === 'admin');

  // Dynamic Catalog State
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [effectiveMonthLabel, setEffectiveMonthLabel] = useState(`${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월`);
  const [isSyncingCatalog, setIsSyncingCatalog] = useState(false);

  // Load Pension Catalog
  const loadCatalog = async () => {
    try {
      if (api.tools?.getPensionCatalog) {
        const res = await api.tools.getPensionCatalog();
        if (res?.success && Array.isArray(res.products)) {
          setCatalogProducts(res.products);
          if (res.monthLabel) setEffectiveMonthLabel(res.monthLabel);
        }
      }
    } catch (e) {
      console.log('Catalog load error:', e);
    }
  };

  const handleManualSyncCatalog = async () => {
    setIsSyncingCatalog(true);
    try {
      if (api.tools?.syncPensionCatalog) {
        const res = await api.tools.syncPensionCatalog();
        if (res?.success && Array.isArray(res.products)) {
          setCatalogProducts(res.products);
          if (res.monthLabel) setEffectiveMonthLabel(res.monthLabel);
          setExportSuccessMsg('클라우드로부터 최신 연금 상품 및 공시이율 정보가 동기화되었습니다!');
          setTimeout(() => setExportSuccessMsg(''), 3000);
        }
      }
    } catch (e) {
      setExportErrorMsg('동기화 실패: ' + e.message);
    } finally {
      setIsSyncingCatalog(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

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

  // Admin Product Edit Modal
  const [editingProduct, setEditingProduct] = useState(null);
  const [editFormData, setEditFormData] = useState({
    id: '',
    name: '',
    product_name: '',
    company_name: '',
    rate_text: '',
    guaranteed_rate: 0.055,
    annual_rate: 0.031,
    tax_benefit: ''
  });

  const handleOpenEditProduct = (prod) => {
    setEditingProduct(prod);
    setEditFormData({
      id: prod.id,
      name: prod.name,
      product_name: prod.productName || prod.product_name,
      company_name: prod.companyName || prod.company_name,
      rate_text: prod.rateText || prod.rate_text,
      guaranteed_rate: prod.guaranteed_rate !== undefined ? prod.guaranteed_rate : 0.055,
      annual_rate: prod.annual_rate !== undefined ? prod.annual_rate : 0.031,
      tax_benefit: prod.taxBenefit || prod.tax_benefit || ''
    });
  };

  const handleSaveProductEdit = async (e) => {
    e.preventDefault();
    try {
      if (api.tools?.updatePensionProduct) {
        const res = await api.tools.updatePensionProduct(editFormData);
        if (res?.success) {
          setExportSuccessMsg('연금 상품 정보가 클라우드에 성공적으로 갱신되었습니다!');
          setTimeout(() => setExportSuccessMsg(''), 3000);
          setEditingProduct(null);
          loadCatalog();
        } else {
          alert('수정 실패: ' + (res?.error || '알 수 없는 오류'));
        }
      }
    } catch (err) {
      alert('오류 발생: ' + err.message);
    }
  };

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

  // Run Simulation with Dynamic Catalog
  const simulationResult = useMemo(() => {
    return simulatePensionComparison({
      currentAge,
      gender,
      monthlyPay: monthlyPayManwon * 10000,
      payYears,
      startAge: effectiveStartAge,
      pensionType,
      catalogProducts
    });
  }, [currentAge, gender, monthlyPayManwon, payYears, effectiveStartAge, pensionType, catalogProducts]);

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
              <div className="flex items-center space-x-2.5">
                <h2 className="text-xl font-extrabold text-white">
                  설계사 도구
                </h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/80 font-bold flex items-center space-x-1 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>{effectiveMonthLabel} 최신 이율 자동 적용</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                국내 주요 금융사·보험사 연금 상품 매월 최신 공시이율 자동 반영 & 고객 프레젠테이션 제안서 PDF 생성
              </p>
            </div>
          </div>
        </div>

        {/* Top Sub Tabs & PDF Export Button (Pension Calculator ONLY) */}
        {activeSubTab === 'pension' && (
          <div className="flex items-center space-x-2.5">
            <button
              onClick={handleManualSyncCatalog}
              disabled={isSyncingCatalog}
              title="클라우드에서 최신 이율 및 상품 정보를 즉시 갱신합니다."
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-800 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={'w-3.5 h-3.5 text-sky-400 ' + (isSyncingCatalog ? 'animate-spin' : '')} />
              <span>{isSyncingCatalog ? '동기화 중...' : '최신 이율 갱신'}</span>
            </button>

            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="hidden md:flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-extrabold text-xs rounded-2xl shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
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
        )}
      </div>

      {/* 2. Sub-Tab Switcher */}
      <div className="flex items-center space-x-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 w-full md:w-fit overflow-x-auto custom-scrollbar no-scrollbar flex-nowrap shadow-md">
        <button
          onClick={() => handleSubTabChange('pension')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 whitespace-nowrap shrink-0 ${
            activeSubTab === 'pension'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20 scale-105'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Calculator className="w-4 h-4 shrink-0" />
          <span>💰 노후 연금 계산기</span>
        </button>

        <button
          onClick={() => handleSubTabChange('dollar')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 whitespace-nowrap shrink-0 ${
            activeSubTab === 'dollar'
              ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/30 scale-105'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <DollarSign className="w-4 h-4 text-cyan-300 shrink-0" />
          <span>💵 달러종신 VIP 플래너</span>
        </button>

        <button
          onClick={() => handleSubTabChange('medical')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 whitespace-nowrap shrink-0 ${
            activeSubTab === 'medical'
              ? 'bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 text-white shadow-lg shadow-rose-500/30 scale-105'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-300 shrink-0" />
          <span className="flex items-center space-x-1">
            <span>🔍 숨은 보험금 찾기</span>
            <span className="px-1.5 py-0.2 bg-rose-500 text-[9px] font-black rounded-full animate-pulse text-white">HOT</span>
          </span>
        </button>
      </div>

      {/* Render Active View */}
      {activeSubTab === 'dollar' ? (
        <DollarUniversalPlannerView />
      ) : activeSubTab === 'medical' ? (
        <MedicalExpenseAnalyzerView />
      ) : (
        <>
          {/* Success/Error Alerts */}
          {exportSuccessMsg && (
            <div className="p-3.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 rounded-2xl text-xs font-bold flex items-center justify-between animate-fadeIn shadow-lg">
              <span className="flex items-center space-x-2">
                <CheckCheck className="w-4 h-4 text-emerald-400" />
                <span>{exportSuccessMsg}</span>
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

          {/* 3. Main 2-Column Grid (Pension Calculator) */}
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
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 font-bold"
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
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-xs text-indigo-400 font-extrabold">만 {currentAge}세</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">성별</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGender('male')}
                    className={'py-2.5 rounded-xl text-xs font-extrabold border transition-all ' + 
                      (gender === 'male' 
                        ? 'bg-blue-950 text-blue-300 border-blue-600 shadow-sm' 
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800')}
                  >
                    남성
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('female')}
                    className={'py-2.5 rounded-xl text-xs font-extrabold border transition-all ' + 
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
                  <DollarSign className="w-4 h-4 text-amber-400" />
                  <span>월 납입 금액</span>
                </label>
                <span className="text-base font-black text-amber-300 font-mono">
                  {monthlyPayManwon.toLocaleString()}만원
                </span>
              </div>

              {/* Quick Select Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[20, 30, 50, 70, 100, 150, 200, 300].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setMonthlyPayManwon(amt)}
                    className={'py-2 rounded-xl text-xs font-black border transition-all ' + 
                      (monthlyPayManwon === amt 
                        ? 'bg-amber-600 text-white border-amber-500 shadow-md' 
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white hover:bg-slate-800')}
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
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <span>납입 기간</span>
                </label>
                <span className="text-sm font-black text-indigo-300 font-mono">
                  {payYears}년납
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {[5, 7, 10, 15, 20].map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setPayYears(yr)}
                    className={'py-2 rounded-xl text-xs font-black border transition-all ' + 
                      (payYears === yr 
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md' 
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white hover:bg-slate-800')}
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
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>국내 주요 보험사 대면 정규 연금 라인업 실시간 대조 (4개 선택지)</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-500">
                {effectiveMonthLabel} 기준
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {simulationResult.products.map((prod) => {
                const isGuaranteed = prod.id === 'guaranteed';
                const isTax = prod.id === 'tax_deduct';

                return (
                  <div
                    key={prod.id}
                    className={'p-5 rounded-3xl border transition-all flex flex-col justify-between space-y-4 shadow-xl relative ' + 
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

                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-extrabold text-sky-400 font-sans flex items-center space-x-1">
                            <Building className="w-3.5 h-3.5" />
                            <span>{prod.companyName}</span>
                          </span>
                          {isAdmin && (
                            <button
                              onClick={() => handleOpenEditProduct(prod)}
                              title="관리자: 이율 및 상품 정보 수정"
                              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-300 transition-colors"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
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
              <span>보험사별 대표 연금 상품 정밀 대조표</span>
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

      {/* ======================================================== */}
      {/* ADMIN EDIT PRODUCT MODAL                                 */}
      {/* ======================================================== */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0f172a] border border-amber-500/50 rounded-3xl p-6 w-full max-w-lg space-y-5 shadow-2xl shadow-amber-950/80">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <span>[관리자 전용] 연금 상품 & 이율 수정</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProductEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">보험사명</label>
                <input
                  type="text"
                  value={editFormData.company_name}
                  onChange={(e) => setEditFormData({ ...editFormData, company_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">대표 상품명</label>
                <input
                  type="text"
                  value={editFormData.product_name}
                  onChange={(e) => setEditFormData({ ...editFormData, product_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">이율 표기 텍스트</label>
                  <input
                    type="text"
                    value={editFormData.rate_text}
                    onChange={(e) => setEditFormData({ ...editFormData, rate_text: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">연산용 이율 (예: 0.055 = 5.5%)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={editFormData.id === 'guaranteed' ? editFormData.guaranteed_rate : editFormData.annual_rate}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (editFormData.id === 'guaranteed') {
                        setEditFormData({ ...editFormData, guaranteed_rate: val });
                      } else {
                        setEditFormData({ ...editFormData, annual_rate: val });
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">세제 혜택 설명</label>
                <input
                  type="text"
                  value={editFormData.tax_benefit}
                  onChange={(e) => setEditFormData({ ...editFormData, tax_benefit: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-300 space-y-1">
                <p className="font-bold">⚠️ 클라우드 실시간 전파 안내</p>
                <p>수정 후 저장 시 Supabase 클라우드에 자동 동기화되어 모든 설계사의 WLB CRM 프로그램에 즉시 반영됩니다.</p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-extrabold shadow-lg shadow-amber-600/30"
                >
                  클라우드 저장 및 배포
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
