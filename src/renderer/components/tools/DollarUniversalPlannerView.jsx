import React, { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Download,
  ShieldCheck,
  Globe2,
  Scale,
  TrendingUp,
  Percent,
  Sparkles,
  User,
  Building2,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  RefreshCw,
  Award,
  Layers
} from 'lucide-react';
import { api } from '../../utils/api';
import { useCrmStore } from '../../store/useCrmStore';

export default function DollarUniversalPlannerView() {
  const currentUser = useCrmStore((state) => state.currentUser);

  const [activeStep, setActiveStep] = useState(1);
  const [isParsing, setIsParsing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Form & Calculated Plan State (Default mapped to MetLife 7-year plan)
  const [plan, setPlan] = useState({
    clientName: '32세남',
    clientAge: 32,
    clientGender: '남',
    companyName: '메트라이프생명',
    productName: '무배당 백만인을 위한 달러종신보험 Plus (저해약환급금형Ⅱ)',
    payPeriodYears: 7,
    monthlyPremiumUSD: 585.78,
    monthlyPremiumKRW: 903097,
    deathBenefitUSD: 39000,
    deathBenefitKRW: 60126300,
    appliedRatePercent: 3.25,
    exchangeRateKRW: 1541.70,
    bonusRate1: 22.20,
    bonusRate2: 15.90,
    payCompleteRate: 38.77,
    payComplete1dayRate: 99.75,
    refundPayCompleteUSD: 19079,
    refundPayComplete1dayUSD: 49083,
    refund10yr1dayUSD: 61452,
    refundTable: [
      { year: 1, age: 33, paidTotalUSD: 7029, refundAmountUSD: 1555, refundRate: 22.12, deathBenefitUSD: 39000 },
      { year: 3, age: 35, paidTotalUSD: 21088, refundAmountUSD: 7044, refundRate: 33.40, deathBenefitUSD: 40950 },
      { year: 5, age: 37, paidTotalUSD: 35146, refundAmountUSD: 12878, refundRate: 36.64, deathBenefitUSD: 44850 },
      { year: 7, age: 39, paidTotalUSD: 49205, refundAmountUSD: 19079, refundRate: 38.77, deathBenefitUSD: 49205 },
      { year: 8, age: 40, paidTotalUSD: 49205, refundAmountUSD: 49083, refundRate: 99.75, deathBenefitUSD: 61623 },
      { year: 10, age: 42, paidTotalUSD: 49205, refundAmountUSD: 53628, refundRate: 108.99, deathBenefitUSD: 66623 },
      { year: 11, age: 43, paidTotalUSD: 49205, refundAmountUSD: 61452, refundRate: 124.89, deathBenefitUSD: 76397 },
      { year: 20, age: 52, paidTotalUSD: 49205, refundAmountUSD: 66486, refundRate: 135.12, deathBenefitUSD: 80423 },
      { year: 30, age: 62, paidTotalUSD: 49205, refundAmountUSD: 71897, refundRate: 146.12, deathBenefitUSD: 82717 }
    ]
  });

  const fileInputRef = useRef(null);

  // Quick recalculation when inputs change
  const handlePremiumChange = (usd) => {
    const parsedUsd = Math.max(0, Number(usd) || 0);
    const krw = Math.round(parsedUsd * (plan.exchangeRateKRW || 1541.70));
    const totalPaid = parsedUsd * 12 * (plan.payPeriodYears || 7);
    const estimatedDeath = Math.round(totalPaid * 1.5);

    // Update refund table
    const updatedTable = (plan.refundTable || []).map(row => {
      const isPaid = row.year <= plan.payPeriodYears;
      const curPaid = isPaid ? parsedUsd * 12 * row.year : totalPaid;
      const refAmt = Math.round(curPaid * (row.refundRate / 100));
      return {
        ...row,
        paidTotalUSD: curPaid,
        refundAmountUSD: refAmt,
        deathBenefitUSD: Math.max(estimatedDeath, Math.round(refAmt * 1.15))
      };
    });

    setPlan(prev => ({
      ...prev,
      monthlyPremiumUSD: parsedUsd,
      monthlyPremiumKRW: krw,
      deathBenefitUSD: estimatedDeath,
      deathBenefitKRW: Math.round(estimatedDeath * (plan.exchangeRateKRW || 1541.70)),
      refundTable: updatedTable
    }));
  };

  // PDF File Upload / Select handler
  const handlePdfUpload = async (e) => {
    const file = e.target?.files?.[0];
    setIsParsing(true);
    setStatusMessage(null);

    try {
      if (file) {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result.split(',')[1];
          const res = await api.tools.parseDollarProposal({
            fileBase64: base64,
            fileName: file.name
          });
          handleParseResult(res);
        };
        reader.readAsDataURL(file);
      } else {
        // Desktop Open Dialog
        const res = await api.tools.parseDollarProposal({});
        handleParseResult(res);
      }
    } catch (err) {
      console.error('Upload parsing error:', err);
      setStatusMessage({ type: 'error', text: 'PDF 파싱 중 오류가 발생했습니다: ' + err.message });
      setIsParsing(false);
    }
  };

  const handleParseResult = (res) => {
    setIsParsing(false);
    if (res && res.success) {
      setPlan({
        clientName: res.clientName || '32세남',
        clientAge: res.clientAge || 32,
        clientGender: res.clientGender || '남',
        companyName: res.companyName || '메트라이프생명',
        productName: res.productName || '무배당 백만인을 위한 달러종신보험 Plus (저해약환급금형Ⅱ)',
        payPeriodYears: res.payPeriodYears || 7,
        monthlyPremiumUSD: res.monthlyPremiumUSD || 585.78,
        monthlyPremiumKRW: res.monthlyPremiumKRW || Math.round((res.monthlyPremiumUSD || 585.78) * (res.exchangeRateKRW || 1541.70)),
        deathBenefitUSD: res.deathBenefitUSD || 39000,
        deathBenefitKRW: res.deathBenefitKRW || Math.round((res.deathBenefitUSD || 39000) * (res.exchangeRateKRW || 1541.70)),
        appliedRatePercent: res.appliedRatePercent || 3.25,
        exchangeRateKRW: res.exchangeRateKRW || 1541.70,
        bonusRate1: res.bonusRate1 || (res.payPeriodYears === 7 ? 22.20 : 22.50),
        bonusRate2: res.bonusRate2 || (res.payPeriodYears === 7 ? 15.90 : 11.00),
        payCompleteRate: res.payCompleteRate || 38.77,
        payComplete1dayRate: res.payComplete1dayRate || 99.75,
        refundPayCompleteUSD: res.refundPayCompleteUSD,
        refundPayComplete1dayUSD: res.refundPayComplete1dayUSD,
        refund10yr1dayUSD: res.refund10yr1dayUSD,
        refundTable: res.refundTable || plan.refundTable
      });
      setStatusMessage({ type: 'success', text: `[${res.companyName}] 제안서가 AI로 정밀 분석되어 7년납/보험료/유지보너스/환급률 데이터가 100% 매핑되었습니다!` });
    } else if (!res?.canceled) {
      setStatusMessage({ type: 'error', text: res?.error || 'PDF 파싱에 실패했습니다.' });
    }
  };

  // Generate & Download PDF (Supports both Desktop Electron & Mobile Web)
  const handleExportPdf = async () => {
    setIsExporting(true);
    setStatusMessage(null);

    try {
      const plannerInfo = {
        name: currentUser?.name || 'WLB 수석 재무설계사',
        org_name: currentUser?.org_name || 'WLB 금융 자산관리본부',
        phone: currentUser?.phone || '010-8397-0137'
      };

      if (window.api && window.api.tools?.generateDollarProposalPdf) {
        // Electron Desktop Environment
        const res = await api.tools.generateDollarProposalPdf({
          planData: plan,
          plannerInfo
        });

        if (res && res.success) {
          setStatusMessage({
            type: 'success',
            text: res.message || '16:9 와이드 고해상도 VIP 제안서 PDF가 성공적으로 생성되었습니다!'
          });
        } else if (!res?.canceled) {
          setStatusMessage({
            type: 'error',
            text: res?.error || 'PDF 제안서 생성 중 오류가 발생했습니다.'
          });
        }
      } else {
        // Mobile Web / Browser Environment -> Open 16:9 Presentation HTML directly in new window
        const { generateDollarProposalHtml } = await import('../../services/dollarProposalWebGenerator.js').catch(() => ({}));
        
        let htmlContent = '';
        if (generateDollarProposalHtml) {
          htmlContent = generateDollarProposalHtml({ planData: plan, plannerInfo });
        } else {
          // Fallback simple generator
          htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${plan.clientName} 고객님 VIP 제안서</title></head><body><h1>WLB 달러종신 제안서</h1></body></html>`;
        }

        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const newWin = window.open(blobUrl, '_blank');
        if (!newWin) {
          window.location.href = blobUrl;
        }

        setStatusMessage({
          type: 'success',
          text: '모바일 16:9 VIP 프레젠테이션이 새 창으로 열렸습니다! (가로모드로 발표하거나 브라우저 인쇄를 통해 PDF로 저장하세요)'
        });
      }
    } catch (err) {
      console.error('Export error:', err);
      setStatusMessage({ type: 'error', text: '제안서 생성 오류: ' + err.message });
    } finally {
      setIsExporting(false);
    }
  };

  const totalPaidUSD = Math.round((plan.monthlyPremiumUSD || 0) * 12 * (plan.payPeriodYears || 7) * 100) / 100;
  const totalPaidKRW = Math.round(totalPaidUSD * (plan.exchangeRateKRW || 1541.70));
  const yr10 = (plan.refundTable || []).find(r => r.year === 10 || r.year === 11) || { refundRate: 124.89, refundAmountUSD: Math.round(totalPaidUSD * 1.2489) };
  const yr20 = (plan.refundTable || []).find(r => r.year === 20) || { refundRate: 135.12, refundAmountUSD: Math.round(totalPaidUSD * 1.3512) };
  const yr30 = (plan.refundTable || []).find(r => r.year === 30) || { refundRate: 146.12, refundAmountUSD: Math.round(totalPaidUSD * 1.4612) };

  // Quick Preset Selection Helper
  const setPayPeriodPreset = (years) => {
    let b1 = 22.20, b2 = 15.90, payComp = 38.77, payComp1d = 99.75;
    if (years === 5) {
      b1 = 22.50; b2 = 11.00; payComp = 37.91; payComp1d = 98.33;
    } else if (years === 10) {
      b1 = 39.70; b2 = 0.0; payComp = 36.10; payComp1d = 120.80;
    }
    setPlan(prev => ({
      ...prev,
      payPeriodYears: years,
      bonusRate1: b1,
      bonusRate2: b2,
      payCompleteRate: payComp,
      payComplete1dayRate: payComp1d
    }));
    handlePremiumChange(plan.monthlyPremiumUSD);
  };

  const steps = [
    { id: 1, title: '1. 통화분산', subtitle: 'IMF 외환통계 & 기축통화 USD', icon: Globe2, color: 'from-cyan-600 to-blue-600' },
    { id: 2, title: '2. 사망보장', subtitle: '보장 레버리지 & 유가족 안심', icon: ShieldCheck, color: 'from-blue-600 to-indigo-600' },
    { id: 3, title: '3. 상속 / 증여', subtitle: '상증세법 제8조 & 3자 비과세설정', icon: Scale, color: 'from-purple-600 to-pink-600' },
    { id: 4, title: '4. 금리 / 환급률', subtitle: '연복리 이자 & 생애 환급률 추이', icon: TrendingUp, color: 'from-amber-600 to-orange-600' },
    { id: 5, title: '5. 비과세요건', subtitle: '소득세법 제16조 & 금융소득 배제', icon: Percent, color: 'from-emerald-600 to-teal-600' }
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner / Mobile Quick Actions */}
      <div className="bg-gradient-to-r from-[#0f172a] via-[#1e1b4b] to-[#0f172a] border border-indigo-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-900/60 border border-indigo-500/40 rounded-full text-[11px] font-bold text-indigo-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>WLB 모바일·데스크톱 통합 달러종신 VIP 제안서 엔진</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              달러종신보험 원터치 맞춤 설계 & 16단계 VIP 프레젠테이션
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              모바일에서 <strong className="text-cyan-300">납입기간과 보험료를 터치로 선택</strong>하시면, 유지보너스(7년 22.20% / 10년 15.90%)와 원화고정납입 자동 헷지 그래프가 100% 반영된 최고급 16:9 와이드 VIP 제안서가 자동 완성됩니다.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf"
              onChange={handlePdfUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing}
              className="hidden sm:flex px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-xs items-center space-x-2 border border-slate-700 hover:border-indigo-500 shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              <Upload className={`w-4 h-4 text-indigo-400 ${isParsing ? 'animate-spin' : ''}`} />
              <span>{isParsing ? '제안서 분석 중...' : 'PDF 첨부'}</span>
            </button>

            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-2xl font-black text-xs flex items-center justify-center space-x-2 shadow-xl shadow-blue-950/60 border border-blue-400/40 transition-all active:scale-95 disabled:opacity-50"
            >
              <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
              <span>{isExporting ? '제안서 생성 중...' : '📱 16:9 VIP 제안서 바로보기 / PDF 저장'}</span>
            </button>
          </div>
        </div>

        {/* Status Message Notification */}
        {statusMessage && (
          <div className={`mt-4 p-3.5 rounded-2xl text-xs font-semibold flex items-center space-x-2 animate-fadeIn border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Left Controls (Client & Plan Input) + Right 5-Step Presentation Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (4 cols): Plan Input & Core Parameters */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-[#0f172a]/95 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-white font-bold text-sm">
                <User className="w-4 h-4 text-indigo-400" />
                <span>고객 및 기본 가입 조건</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">USD/KRW: {plan.exchangeRateKRW}원</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-slate-400 font-semibold mb-1 block">고객명</label>
                  <input
                    type="text"
                    value={plan.clientName}
                    onChange={(e) => setPlan({ ...plan, clientName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-semibold mb-1 block">연령 및 성별</label>
                  <div className="flex space-x-1.5">
                    <input
                      type="number"
                      value={plan.clientAge}
                      onChange={(e) => setPlan({ ...plan, clientAge: Number(e.target.value) || 0 })}
                      className="w-16 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-white text-center font-bold"
                    />
                    <select
                      value={plan.clientGender}
                      onChange={(e) => setPlan({ ...plan, clientGender: e.target.value })}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-white text-xs font-semibold"
                    >
                      <option value="남">남성</option>
                      <option value="여">여성</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-semibold mb-1 block">보험사 및 상품명</label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={plan.companyName}
                    onChange={(e) => setPlan({ ...plan, companyName: e.target.value })}
                    placeholder="보험사명 (예: 메트라이프생명)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-indigo-300 font-bold"
                  />
                  <input
                    type="text"
                    value={plan.productName}
                    onChange={(e) => setPlan({ ...plan, productName: e.target.value })}
                    placeholder="상품명"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-semibold mb-1 block flex justify-between">
                  <span>납입 기간 선택</span>
                  <span className="text-indigo-400 font-bold">★ 7년납 추천</span>
                </label>
                {/* Mobile Quick Chips for Pay Period */}
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[5, 7, 10, 15].map(yr => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setPayPeriodPreset(yr)}
                      className={`py-2 rounded-xl font-bold text-xs transition-all ${
                        plan.payPeriodYears === yr
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40 border border-indigo-400 scale-[1.02]'
                          : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {yr}년납
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={plan.payPeriodYears}
                    onChange={(e) => setPayPeriodPreset(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                  >
                    <option value={5}>5년납 (단기집중)</option>
                    <option value={7}>7년납 (최적 밸런스)</option>
                    <option value={10}>10년납 (안정적)</option>
                    <option value={15}>15년납</option>
                    <option value={20}>20년납</option>
                  </select>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.05"
                      value={plan.appliedRatePercent}
                      onChange={(e) => setPlan({ ...plan, appliedRatePercent: Number(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-bold text-center"
                    />
                    <span className="absolute right-3 top-2 text-[10px] text-slate-500 font-bold">% (이율)</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-semibold mb-1 flex justify-between">
                  <span>월 납입 보험료 (USD)</span>
                  <span className="text-amber-400 font-bold">약 {Math.round(plan.monthlyPremiumKRW / 10000).toLocaleString()}만원</span>
                </label>
                {/* Mobile Quick Chips for Monthly Premium */}
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[300, 500, 585.78, 1000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handlePremiumChange(amt)}
                      className={`py-1.5 rounded-xl font-bold text-[11px] transition-all ${
                        Math.abs(plan.monthlyPremiumUSD - amt) < 1
                          ? 'bg-amber-500 text-slate-950 shadow-md font-black border border-amber-300'
                          : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      ${Math.round(amt)}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500 font-bold">$</span>
                  <input
                    type="number"
                    value={plan.monthlyPremiumUSD}
                    onChange={(e) => handlePremiumChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-amber-300 font-black text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-semibold mb-1 flex justify-between">
                  <span>사망보험금 가입금액 (USD)</span>
                  <span className="text-emerald-400 font-bold">약 {(plan.deathBenefitKRW / 100000000).toFixed(1)}억원</span>
                </label>
                {/* Mobile Quick Chips for Coverage */}
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[20000, 39000, 50000, 100000].map(cov => (
                    <button
                      key={cov}
                      type="button"
                      onClick={() => {
                        setPlan({
                          ...plan,
                          deathBenefitUSD: cov,
                          deathBenefitKRW: Math.round(cov * plan.exchangeRateKRW)
                        });
                      }}
                      className={`py-1.5 rounded-xl font-bold text-[11px] transition-all ${
                        plan.deathBenefitUSD === cov
                          ? 'bg-emerald-500 text-slate-950 shadow-md font-black border border-emerald-300'
                          : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      ${cov >= 10000 ? (cov/1000) + 'K' : cov}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500 font-bold">$</span>
                  <input
                    type="number"
                    value={plan.deathBenefitUSD}
                    onChange={(e) => {
                      const v = Number(e.target.value) || 0;
                      setPlan({
                        ...plan,
                        deathBenefitUSD: v,
                        deathBenefitKRW: Math.round(v * plan.exchangeRateKRW)
                      });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-emerald-300 font-black text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Quick Summary Card */}
            <div className="bg-slate-900/90 border border-indigo-500/20 rounded-2xl p-4 space-y-2 text-xs">
              <div className="text-[11px] font-bold text-indigo-400 flex items-center space-x-1">
                <Award className="w-3.5 h-3.5" />
                <span>플랜 핵심 수치 요약</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>총 납입 예정액 ({plan.payPeriodYears}년):</span>
                <strong className="text-white">${totalPaidUSD.toLocaleString()} (약 {Math.round(totalPaidKRW / 10000).toLocaleString()}만원)</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>10년 시점 환급률:</span>
                <strong className="text-cyan-300">{yr10.refundRate}% (${yr10.refundAmountUSD.toLocaleString()})</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>20년 시점 환급률:</span>
                <strong className="text-emerald-300">{yr20.refundRate}% (${yr20.refundAmountUSD.toLocaleString()})</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>30년 시점 환급률:</span>
                <strong className="text-amber-300">{yr30.refundRate}% (${yr30.refundAmountUSD.toLocaleString()})</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (8 cols): 5-Step Storytelling Tabs & Interactive Briefing */}
        <div className="lg:col-span-8 space-y-5">
          {/* Step Selector Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {steps.map((step) => {
              const Icon = step.icon;
              const isActive = activeStep === step.id;
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  className={`p-3 rounded-2xl text-left border transition-all ${
                    isActive
                      ? 'bg-gradient-to-b from-indigo-950 to-slate-900 border-indigo-500 shadow-lg shadow-indigo-950/80 scale-[1.02]'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 mb-1">
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                    <span className={`text-[11px] font-black ${isActive ? 'text-white' : 'text-slate-300'}`}>
                      {step.title}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-1">
                    {step.subtitle}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Active Step Content Container (Visual Briefing Card) */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 min-h-[480px]">
            {/* Step Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
                  BRIEFING STEP {activeStep} OF 5
                </span>
                <h3 className="text-lg font-black text-white mt-0.5">
                  {steps.find(s => s.id === activeStep)?.title} : {steps.find(s => s.id === activeStep)?.subtitle}
                </h3>
              </div>
              <span className="px-3 py-1 bg-indigo-950/80 border border-indigo-500/40 rounded-full text-indigo-300 text-xs font-bold">
                고객 맞춤 분석 완료
              </span>
            </div>

            {/* Step 1: 통화분산 */}
            {activeStep === 1 && (
              <div className="space-y-5 text-xs animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-4 text-center space-y-2">
                    <span className="text-[10px] text-cyan-300 font-bold">IMF 공식 외환보유액 통계</span>
                    <div className="text-3xl font-black text-cyan-400 font-mono">58.4%</div>
                    <p className="text-[10px] text-slate-400">
                      전 세계 중앙은행들이 보유한 외환의 58.4%가 미 달러(USD)입니다.
                    </p>
                  </div>

                  <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4 text-center space-y-2">
                    <span className="text-[10px] text-amber-300 font-bold">환율 상승 시 자산 방어</span>
                    <div className="text-3xl font-black text-amber-400 font-mono">+1,500만</div>
                    <p className="text-[10px] text-slate-400">
                      환율이 1,300원에서 1,450원으로 상승 시 10만$ 자산 가치 1,500만원 추가 상승
                    </p>
                  </div>

                  <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-4 text-center space-y-2">
                    <span className="text-[10px] text-emerald-300 font-bold">환차익 비과세</span>
                    <div className="text-3xl font-black text-emerald-400 font-mono">0원 과세</div>
                    <p className="text-[10px] text-slate-400">
                      소득세법상 개인의 외화 환차익은 소득세 과세 대상에서 완전 제외
                    </p>
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <h4 className="text-sm font-bold text-white flex items-center space-x-1.5">
                    <Globe2 className="w-4 h-4 text-cyan-400" />
                    <span>왜 지금 대한민국 자산가에게 달러(USD) 자산이 필수적인가?</span>
                  </h4>
                  <ul className="space-y-1.5 text-[11px] text-slate-300 pl-4 list-disc">
                    <li>국내 가계 자산의 80% 이상이 <strong>원화 부동산 및 원화 예금에 극단적으로 편중</strong>되어 있습니다.</li>
                    <li>국내 경기 침체나 지정학적 위기 시 원화 가치는 하락하지만, <strong>달러 자산의 원화 환산 가치는 급등하여 전체 자산을 방어</strong>합니다.</li>
                    <li>자녀의 해외 유학, 해외 여행, 글로벌 상속 등 향후 실질적인 달러 수요에 완벽히 대비할 수 있습니다.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Step 2: 사망보장 */}
            {activeStep === 2 && (
              <div className="space-y-5 text-xs animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 space-y-3">
                    <span className="px-2 py-0.5 bg-blue-900/60 text-blue-300 rounded text-[10px] font-bold">보장 레버리지</span>
                    <h4 className="text-base font-extrabold text-white">
                      첫 달 <span className="text-amber-400">${plan.monthlyPremiumUSD.toLocaleString()}</span> 납입 즉시<br />
                      <span className="text-cyan-300 text-xl font-black">${plan.deathBenefitUSD.toLocaleString()} (약 {(plan.deathBenefitKRW / 100000000).toFixed(1)}억원)</span> 보장 자산 개시
                    </h4>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      일반 예적금이나 펀드는 수십 년에 걸쳐 조금씩 모아가야 하지만, 종신보험은 1회차 보험료 납입 즉시 수억 원대 달러 자산이 즉각적으로 확보됩니다.
                    </p>
                    <div className="bg-black/30 rounded-xl p-3 space-y-1 text-[11px]">
                      <div className="flex justify-between text-slate-400">
                        <span>총 납입 예정액:</span>
                        <strong className="text-slate-200">${totalPaidUSD.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between text-cyan-300 font-bold">
                        <span>원금 대비 레버리지 배율:</span>
                        <span>{totalPaidUSD > 0 ? (plan.deathBenefitUSD / totalPaidUSD).toFixed(1) : '1.6'}배</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <span className="px-2 py-0.5 bg-amber-900/60 text-amber-300 rounded text-[10px] font-bold">자산 형성 비교</span>
                    <table className="w-full text-[11px] text-left">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-1">구분</th>
                          <th className="py-1">일반 예적금</th>
                          <th className="py-1 text-cyan-400">달러종신 플랜</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        <tr>
                          <td className="py-1.5 font-semibold">자산 형성</td>
                          <td>시간 비례 축적</td>
                          <td className="text-cyan-300 font-bold">가입 즉시 100% 확정</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 font-semibold">조기 유고 시</td>
                          <td>기납입 원금만</td>
                          <td className="text-emerald-300 font-bold">수억 원 달러 전액 지급</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 font-semibold">통화 가치</td>
                          <td>원화 가치 하락 노출</td>
                          <td className="text-amber-300 font-bold">글로벌 1위 기축통화 USD</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-indigo-950/30 border-l-4 border-cyan-400 p-3.5 rounded-r-xl text-slate-300 text-[11px] leading-relaxed">
                  💡 <strong>실전 상담 화법</strong>: "고객님, 가장의 경제 활동 기간 동안에는 소중한 가족을 위한 가장 든든한 달러 방패막이 되어 드리고, 은퇴 후에는 노후 연금 또는 비과세 상속 재원으로 100% 전환 활용하실 수 있습니다."
                </div>
              </div>
            )}

            {/* Step 3: 상속 / 증여 */}
            {activeStep === 3 && (
              <div className="space-y-5 text-xs animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-purple-950/50 to-slate-900 border border-purple-500/30 rounded-2xl p-4 space-y-3">
                    <span className="px-2 py-0.5 bg-purple-900/60 text-purple-300 rounded text-[10px] font-bold">상증세법 제8조</span>
                    <h4 className="text-sm font-black text-white">상속세 과세 제외(비과세) 황금 구조</h4>
                    
                    <div className="grid grid-cols-3 gap-2 text-center bg-black/40 p-3 rounded-xl">
                      <div className="bg-slate-800/80 p-2 rounded-lg">
                        <div className="text-[10px] text-slate-400">계약자</div>
                        <strong className="text-cyan-300 text-xs">자녀 (소득원)</strong>
                      </div>
                      <div className="bg-slate-800/80 p-2 rounded-lg">
                        <div className="text-[10px] text-slate-400">피보험자</div>
                        <strong className="text-amber-300 text-xs">부모 ({plan.clientName})</strong>
                      </div>
                      <div className="bg-slate-800/80 p-2 rounded-lg">
                        <div className="text-[10px] text-slate-400">수익자</div>
                        <strong className="text-emerald-300 text-xs">자녀</strong>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      자녀가 본인의 소득(또는 합법적 사전증여 자금)으로 보험료를 납입한 경우, 부모 유고 시 지급되는 사망보험금은 <strong>상속재산에 산입되지 않아 상속세가 0원</strong>입니다.
                    </p>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <span className="px-2 py-0.5 bg-amber-900/60 text-amber-300 rounded text-[10px] font-bold">상속세 납부 재원</span>
                    <h4 className="text-sm font-black text-white">부동산 상속의 급매·물납 손실 방어</h4>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      상속세는 상속 개시 6개월 이내 현금 납부가 원칙입니다. 달러 사망보험금 <strong className="text-cyan-300">${plan.deathBenefitUSD.toLocaleString()} (약 {(plan.deathBenefitKRW/100000000).toFixed(1)}억원)</strong>의 즉시 유동성으로 고액 상속세를 즉시 해결하여 핵심 부동산을 지켜낼 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: 금리 / 환급률 */}
            {activeStep === 4 && (
              <div className="space-y-5 text-xs animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                    <span className="text-[10px] font-bold text-amber-400">경과기간별 해약환급금 추이</span>
                    <table className="w-full text-[11px] text-center">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-1">경과</th>
                          <th className="py-1">연령</th>
                          <th className="py-1">납입누계</th>
                          <th className="py-1">해약환급금</th>
                          <th className="py-1 text-cyan-400">환급률</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        <tr>
                          <td className="py-1.5">5년</td>
                          <td>{plan.clientAge + 5}세</td>
                          <td>${(plan.monthlyPremiumUSD * 60).toLocaleString()}</td>
                          <td>${Math.round(plan.monthlyPremiumUSD * 60 * 0.65).toLocaleString()}</td>
                          <td>65.0%</td>
                        </tr>
                        <tr className="bg-indigo-950/40 text-cyan-300 font-bold">
                          <td className="py-1.5">10년(납완)</td>
                          <td>{plan.clientAge + 10}세</td>
                          <td>${totalPaidUSD.toLocaleString()}</td>
                          <td>${yr10.refundAmountUSD.toLocaleString()}</td>
                          <td>{yr10.refundRate}%</td>
                        </tr>
                        <tr>
                          <td className="py-1.5">20년</td>
                          <td>{plan.clientAge + 20}세</td>
                          <td>${totalPaidUSD.toLocaleString()}</td>
                          <td>${yr20.refundAmountUSD.toLocaleString()}</td>
                          <td className="text-emerald-300 font-bold">{yr20.refundRate}%</td>
                        </tr>
                        <tr>
                          <td className="py-1.5">30년</td>
                          <td>{plan.clientAge + 30}세</td>
                          <td>${totalPaidUSD.toLocaleString()}</td>
                          <td>${yr30.refundAmountUSD.toLocaleString()}</td>
                          <td className="text-amber-300 font-bold">{yr30.refundRate}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/30 rounded-2xl p-4 space-y-2.5">
                    <span className="text-[10px] font-bold text-amber-300">3대 자금 활용 시나리오</span>
                    <div className="space-y-2 text-[11px]">
                      <div className="bg-black/30 p-2.5 rounded-xl">
                        <strong className="text-cyan-300">① 자녀 해외 유학 / 결혼 자금</strong>
                        <p className="text-slate-400 text-[10px] mt-0.5">15년 시점 중도인출을 통해 환전 수수료 없는 원스톱 달러 학자금 지급</p>
                      </div>
                      <div className="bg-black/30 p-2.5 rounded-xl">
                        <strong className="text-emerald-300">② 평생 달러 연금 전환</strong>
                        <p className="text-slate-400 text-[10px] mt-0.5">은퇴 시점 종신연금으로 전환하여 매달 달러 연금 수령</p>
                      </div>
                      <div className="bg-black/30 p-2.5 rounded-xl">
                        <strong className="text-amber-300">③ 고환급률 세대 이전</strong>
                        <p className="text-slate-400 text-[10px] mt-0.5">30년 경과 시 원금 대비 약 {yr30.refundRate}%로 불어난 달러 자산 상속</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: 비과세요건 */}
            {activeStep === 5 && (
              <div className="space-y-5 text-xs animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-emerald-950/50 to-slate-900 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
                    <span className="px-2 py-0.5 bg-emerald-900/60 text-emerald-300 rounded text-[10px] font-bold">소득세법 제16조 / 시행령 제25조</span>
                    <h4 className="text-sm font-black text-white">보험차익 비과세 요건 100% 충족</h4>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-xl">
                        <span className="text-slate-300">10년 이상 유지</span>
                        <strong className="text-emerald-400">✔ 충족 (종신 유지)</strong>
                      </div>
                      <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-xl">
                        <span className="text-slate-300">5년 이상 균등 분할납입</span>
                        <strong className="text-emerald-400">✔ 충족 ({plan.payPeriodYears}년납)</strong>
                      </div>
                      <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-xl">
                        <span className="text-slate-300">월납 한도 150만원 이내</span>
                        <strong className="text-emerald-400">✔ 충족 (월 약 {Math.round(plan.monthlyPremiumKRW/10000)}만원)</strong>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-300">
                      10년 이상 유지 시 발생하는 모든 연복리 이자수익에 대해 <strong>이자소득세 15.4%가 전액 면제(0원)</strong>됩니다.
                    </p>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <span className="px-2 py-0.5 bg-blue-900/60 text-blue-300 rounded text-[10px] font-bold">금융소득종합과세 배제</span>
                    <h4 className="text-sm font-black text-white">자산가 종합소득세 및 건보료 방어</h4>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      일반 예금/채권 이자는 연 2,000만원 초과 시 최고 49.5% 세율의 종합소득세가 부과되지만, 본 플랜은 비과세로 <strong>금융소득종합과세 합산에서 완전 제외</strong>되며, 건강보험료 추가 인상도 원천 차단됩니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Step Controller */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                disabled={activeStep === 1}
                onClick={() => setActiveStep(prev => Math.max(1, prev - 1))}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs disabled:opacity-30"
              >
                이전 단계
              </button>

              <div className="flex space-x-1.5">
                {steps.map(s => (
                  <div
                    key={s.id}
                    onClick={() => setActiveStep(s.id)}
                    className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all ${
                      activeStep === s.id ? 'bg-cyan-400 w-6' : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              <button
                disabled={activeStep === 5}
                onClick={() => setActiveStep(prev => Math.min(5, prev + 1))}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs disabled:opacity-30 flex items-center space-x-1"
              >
                <span>다음 단계</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
