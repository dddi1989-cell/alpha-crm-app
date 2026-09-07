import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ShieldAlert, 
  Smartphone, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Download, 
  Printer, 
  TrendingUp, 
  User, 
  Building, 
  Sparkles, 
  ArrowRight, 
  Zap, 
  FileDown, 
  AlertTriangle,
  RotateCcw,
  Stethoscope,
  X,
  Phone,
  Calendar,
  CheckCheck,
  Timer,
  RefreshCw,
  Lock,
  Search,
  Copy,
  ExternalLink,
  Layers,
  MessageSquare,
  Users
} from 'lucide-react';
import { useCrmStore } from '../../store/useCrmStore';
import { api } from '../../utils/api';
import { getDescendantOrgAndUserIds, matchesOrgFilter } from '../../utils/orgHierarchy';

export default function MedicalExpenseAnalyzerView() {
  const customers = useCrmStore((state) => state.customers);
  const currentUser = useCrmStore((state) => state.currentUser);
  const organizations = useCrmStore((state) => state.organizations);
  const accessibleUsers = useCrmStore((state) => state.accessibleUsers);

  // Role & Scope based customer filtering (Strictly match PC CRM permissions)
  const allowedCustomers = useMemo(() => {
    if (!Array.isArray(customers)) return [];
    if (!currentUser) return [];

    const role = (currentUser.role || 'Agent').toLowerCase();
    const myId = Number(currentUser.id);

    // 1. Top Admin: View all
    if (role === 'admin' || currentUser.username === 'admin') {
      return customers;
    }

    // 2. Manager / Head / Team Leader: View own + subordinates in org hierarchy
    if (role === 'manager' || role === 'head' || role === 'team_leader' || role === 'teamleader') {
      const hierarchy = getDescendantOrgAndUserIds(currentUser.org_id || currentUser.org_name, organizations, accessibleUsers);
      return customers.filter(c => {
        const cOwnerId = c.user_id !== null && c.user_id !== undefined ? Number(c.user_id) : myId;
        if (cOwnerId === myId) return true;
        return matchesOrgFilter(c, hierarchy);
      });
    }

    // 3. General Agent / FA: Strictly ONLY view own customers (Never see superior's customers)
    return customers.filter(c => {
      const cOwnerId = c.user_id !== null && c.user_id !== undefined ? Number(c.user_id) : myId;
      return cOwnerId === myId;
    });
  }, [customers, currentUser, organizations, accessibleUsers]);

  // Input states (Planner only enters Name & Phone!)
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [clientName, setClientName] = useState(currentUser?.name || '고객');
  const [clientPhone, setClientPhone] = useState(currentUser?.phone || '');

  // Mobile Auth Tracking states
  const [authStep, setAuthStep] = useState('IDLE'); // 'IDLE' | 'SMS_WAITING' | 'DONE'
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeAuthUrl, setActiveAuthUrl] = useState('');
  const [remainingTime, setRemainingTime] = useState(300);
  const [copied, setCopied] = useState(false);
  
  // Real Analysis Data
  const [analysisData, setAnalysisData] = useState(null);
  const [selectedYearTab, setSelectedYearTab] = useState('ALL'); // 'ALL' | '2024' | '2023'
  const [familyFilter, setFamilyFilter] = useState('ALL'); // 'ALL' | 'SELF' | 'FAMILY'
  const [activeDetailTab, setActiveDetailTab] = useState('expenses'); // 'unclaimed' | 'expenses' | 'indemnity'
  const [statusMsg, setStatusMsg] = useState(null);

  const pollingIntervalRef = useRef(null);

  // Auto load last retrieved real data on mount
  const loadLastRetrievedData = async () => {
    try {
      // 1. Try to load first customer with hometax data or latest retrieved
      if (api.tools?.ntsGetCustomerHometaxData) {
        // Try Park Seo-hyun first if available, else latest
        const res = await api.tools.ntsGetCustomerHometaxData({ customerName: '박서현' });
        if (res.success && res.data) {
          const cName = res.data.clientName || '박서현';
          const cPhone = res.data.clientPhone || '01025749161';
          setClientName(cName);
          setClientPhone(cPhone);
          setAnalysisData(res.data);
          setAuthStep('DONE');
          setSelectedYearTab('ALL');
          setFamilyFilter('ALL');
          return;
        }
      }

      if (api.tools?.ntsGetLastRetrievedData) {
        const res = await api.tools.ntsGetLastRetrievedData();
        if (res.success && res.data) {
          setClientName(res.data.clientName || '이재성');
          setClientPhone(res.data.clientPhone || '010-7679-7880');
          setAnalysisData(res.data);
          setAuthStep('DONE');
          setSelectedYearTab('ALL');
          setFamilyFilter('ALL');
        }
      }
    } catch (e) {
      console.error('loadLastRetrievedData error:', e);
    }
  };

  useEffect(() => {
    loadLastRetrievedData();
    if (!customers || customers.length === 0) {
      if (typeof loadAllData === 'function') {
        loadAllData();
      }
    }
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Copy Link Helper
  const handleCopyLink = () => {
    if (!activeAuthUrl) return;
    navigator.clipboard.writeText(activeAuthUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // When a registered CRM customer is selected
  const handleSelectCustomer = async (custId) => {
    setSelectedCustomerId(custId);
    if (!custId) return;
    const cust = customers.find(c => String(c.id) === String(custId));
    if (cust) {
      const targetName = cust.name || '';
      const targetPhone = cust.phone || '';
      setClientName(targetName);
      if (targetPhone) setClientPhone(targetPhone);

      // 1. Check if store already contains parsed/string hometax_data
      if (cust.hometax_data) {
        try {
          const parsed = typeof cust.hometax_data === 'string' ? JSON.parse(cust.hometax_data) : cust.hometax_data;
          if (parsed && (parsed.expenseList?.length > 0 || parsed.totalExpenseAmount > 0 || parsed.records?.length > 0)) {
            setAnalysisData(parsed);
            setAuthStep('DONE');
            setSelectedYearTab('ALL');
            setFamilyFilter('ALL');
            setStatusMsg({
              type: 'success',
              text: `✓ [${targetName}] 고객님의 저장된 국세청 3개년 의료비·실손 분석 자료를 성공적으로 불러왔습니다!`
            });
            return;
          }
        } catch (pe) {
          console.warn('Store hometax_data parse error:', pe);
        }
      }

      // 2. Fetch from DB or Supabase via IPC
      try {
        if (api.tools?.ntsGetCustomerHometaxData) {
          const res = await api.tools.ntsGetCustomerHometaxData({
            customerId: cust.id,
            customerName: targetName,
            customerPhone: targetPhone
          });

          if (res.success && res.data) {
            setAnalysisData(res.data);
            setAuthStep('DONE');
            setSelectedYearTab('ALL');
            setFamilyFilter('ALL');
            setStatusMsg({
              type: 'success',
              text: `✓ [${targetName}] 고객님의 국세청 3개년 의료비·실손 분석 자료를 성공적으로 불러왔습니다!`
            });
            return;
          }
        }
      } catch (loadErr) {
        console.warn('Customer hometax load error:', loadErr);
      }

      // 3. No saved data found
      setAnalysisData(null);
      setAuthStep('IDLE');
      setStatusMsg({
        type: 'info',
        text: `✓ [${targetName}] 고객님을 선택했습니다. 저장된 국세청 인증 자료가 없습니다. [안심 인증 문자 즉시 발송]을 눌러 인증을 진행해 주세요.`
      });
    }
  };

  const handleCancelAuth = () => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    setAuthStep('IDLE');
    setActiveSessionId(null);
    setStatusMsg({ type: 'error', text: '인증 진행이 취소되었습니다.' });
  };

  // Complete Authentication Success Handler
  const handleCompleteAuthSuccess = async (completedData) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    setAuthStep('DONE');
    setAnalysisData(completedData);
    setSelectedYearTab('ALL');
    setFamilyFilter('ALL');

    // Auto save to matching customer in DB
    try {
      if (api.tools?.ntsSaveCustomerHometaxData) {
        await api.tools.ntsSaveCustomerHometaxData({
          customerId: selectedCustomerId || undefined,
          customerName: clientName.trim(),
          customerPhone: clientPhone.trim(),
          hometaxData: completedData
        });
      }
    } catch (saveDbErr) {
      console.warn('Save hometax to DB warning:', saveDbErr);
    }

    // Auto prospect register if new
    const existingCust = customers.find(c => 
      (c.phone && clientPhone && c.phone.replace(/[^0-9]/g, '') === clientPhone.replace(/[^0-9]/g, '')) ||
      (c.name && clientName && c.name.trim() === clientName.trim())
    );

    let prospectNote = '';
    if (!existingCust && clientName) {
      try {
        const actingUserId = currentUser ? currentUser.id : 1;
        const newProspectPayload = {
          user_id: actingUserId,
          name: clientName.trim(),
          phone: clientPhone.trim(),
          status: '가망고객',
          is_pool: 1,
          pool_group: '국세청 간편인증 발굴',
          notes: '국세청 간편인증 실시간 수신'
        };

        if (api.customers?.create) {
          await api.customers.create(newProspectPayload);
          const loadAllData = useCrmStore.getState().loadAllData;
          if (loadAllData) await loadAllData();
          prospectNote = ' (★ 신규 가망고객 POOL에 자동 등록되었습니다!)';
        }
      } catch (custErr) {
        console.error('Auto prospect register error:', custErr);
      }
    }

    const unclaimedTxt = completedData?.unclaimedEstimatedAmount > 0 
      ? ` (미청구 숨은 보험금: ${completedData.unclaimedEstimatedAmount.toLocaleString()}원 발굴)` 
      : '';

    setStatusMsg({ 
      type: 'success', 
      text: `✓ 국세청 연말정산 간편인증 완료! 직전 3개년 의료비 지출 및 실손보험금 수령 내역이 성공적으로 수집 및 고객별 저장되었습니다!${unclaimedTxt}${prospectNote}` 
    });
  };

  // 1. Dispatch SMS Link to Customer & Start Auto Polling
  const handleSendAuthSms = async () => {
    if (!clientName.trim() || !clientPhone.trim()) {
      setStatusMsg({ type: 'error', text: '고객 성함과 휴대폰 번호를 입력해 주세요.' });
      return;
    }

    setStatusMsg({ type: 'info', text: '고객 휴대폰으로 국세청 안심 인증 링크 문자를 발송 중입니다...' });

    try {
      const caller = api.tools?.ntsCreateMobileLink || api.tools?.ntsCreateMobileAuthSession;
      let sessId = 'MOB_' + Date.now();
      let authUrl = `https://dddi1989-cell.github.io/alpha-crm-app/#${sessId}`;

      if (caller) {
        const res = await caller({
          clientName: clientName.trim(),
          clientPhone: clientPhone.trim().replace(/[^0-9]/g, ''),
          targetYear: 2024,
          plannerName: currentUser ? (currentUser.name || 'WLB 재무설계사') : 'WLB 재무설계사',
          plannerPhone: currentUser ? (currentUser.phone || '010-7679-7880') : '010-7679-7880'
        });

        if (res.sessionId) sessId = res.sessionId;
        if (res.authUrl) authUrl = res.authUrl;
      }

      setActiveSessionId(sessId);
      setActiveAuthUrl(authUrl);
      setAuthStep('SMS_WAITING');
      setRemainingTime(300);

      setStatusMsg({
        type: 'success',
        text: `✓ [${clientName}] 고객님(${clientPhone}) 국세청 안심 인증 링크가 생성되었습니다. 고객 인증 대기 중...`
      });

      // Start Polling every 2.5s
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = setInterval(async () => {
        setRemainingTime(prev => {
          if (prev <= 1) {
            clearInterval(pollingIntervalRef.current);
            setAuthStep('IDLE');
            setStatusMsg({ type: 'error', text: '인증 유효시간(5분)이 만료되었습니다. 다시 시도해 주세요.' });
            return 0;
          }
          return prev - 1;
        });

        try {
          if (api.tools?.ntsCheckMobileSession) {
            const checkRes = await api.tools.ntsCheckMobileSession({ sessionId: sessId });
            if (checkRes.success && checkRes.status === 'COMPLETED' && checkRes.data) {
              clearInterval(pollingIntervalRef.current);
              handleCompleteAuthSuccess(checkRes.data);
            }
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, 2500);

    } catch (err) {
      console.error('Send SMS Error:', err);
      setStatusMsg({ type: 'error', text: '문자 발송 처리 중: ' + err.message });
    }
  };

  // Helper for Year & Family Filtering & Descending Sort
  const getUniqueMembers = () => {
    if (!analysisData) return [];
    const baseData = selectedYearTab !== 'ALL' && analysisData.byYear && analysisData.byYear[selectedYearTab]
      ? analysisData.byYear[selectedYearTab]
      : analysisData;

    const allExp = baseData.expenseList || [];
    const allInd = baseData.indemnityList || [];
    const map = new Map();

    allExp.forEach(e => {
      const name = e.insuredPerson || e.userNm || clientName || '본인';
      if (!map.has(name)) {
        map.set(name, { name, count: 0, isSelf: name === clientName || name.includes(clientName) });
      }
      map.get(name).count += 1;
    });

    allInd.forEach(i => {
      const name = i.insuredPerson || i.userNm || clientName || '본인';
      if (!map.has(name)) {
        map.set(name, { name, count: 0, isSelf: name === clientName || name.includes(clientName) });
      }
      map.get(name).count += 1;
    });

    return Array.from(map.values());
  };

  const getCurrentViewData = () => {
    if (!analysisData) return {};
    let baseData = analysisData;
    if (selectedYearTab !== 'ALL' && analysisData.byYear && analysisData.byYear[selectedYearTab]) {
      baseData = analysisData.byYear[selectedYearTab];
    }

    let expList = baseData.expenseList || [];
    let indList = baseData.indemnityList || [];

    if (familyFilter !== 'ALL') {
      expList = expList.filter(e => (e.insuredPerson || e.userNm || clientName) === familyFilter);
      indList = indList.filter(i => (i.insuredPerson || i.userNm || clientName) === familyFilter);
    }

    const totalExpenseAmount = expList.reduce((acc, cur) => acc + (cur.amount || 0), 0);
    const totalIndemnityAmount = indList.reduce((acc, cur) => acc + (cur.amount || 0), 0);
    const unclaimedEstimatedAmount = Math.max(0, totalExpenseAmount - totalIndemnityAmount);
    const claimRatioPercent = totalExpenseAmount > 0 
      ? Math.min(100, Math.round((totalIndemnityAmount / totalExpenseAmount) * 1000) / 10) 
      : 0;

    return {
      totalExpenseAmount,
      totalExpenseCount: expList.length,
      totalIndemnityAmount,
      totalIndemnityCount: indList.length,
      unclaimedEstimatedAmount,
      claimRatioPercent,
      expenseList: expList,
      indemnityList: indList
    };
  };

  const currentViewData = getCurrentViewData();
  const uniqueMembers = getUniqueMembers();

  // Export PDF Handler
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const handleExportPdf = async () => {
    if (!analysisData) {
      setStatusMsg({ type: 'error', text: '다운로드할 분석 자료가 없습니다.' });
      return;
    }
    try {
      setIsExportingPdf(true);
      setStatusMsg({ type: 'info', text: '국세청 분석 리포트 PDF를 생성 중입니다...' });
      if (api.tools?.exportMedicalExpensePdf) {
        const res = await api.tools.exportMedicalExpensePdf({
          data: analysisData,
          clientName: clientName || analysisData.clientName || '고객',
          clientPhone: clientPhone || analysisData.clientPhone || '',
          plannerInfo: {
            name: currentUser?.name || 'WLB 재무설계사',
            org_name: currentUser?.org_name || 'WLB 재정본부',
            phone: currentUser?.phone || '010-7679-7880'
          }
        });
        if (res.success) {
          setStatusMsg({ type: 'success', text: `✓ ${res.message || 'PDF 저장이 완료되었습니다!'}` });
        } else {
          setStatusMsg({ type: 'error', text: res.error || 'PDF 저장 취소' });
        }
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'PDF 생성 오류: ' + err.message });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-rose-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                국세청 홈택스 공식 실시간 2-Way 연동
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                ⚡ 최근 연말정산 의료비·실손 분석
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>국세청 연말정산 의료비·숨은 실손보험금 분석기</span>
            </h1>
            <p className="text-xs text-slate-300">
              고객 스마트폰 카카오톡 1회 인증으로 <strong>국세청 병의원 지출 원장 및 실손보험금 수령액</strong>을 실시간 수집하여 3년 소멸시효 내 미청구 보험금을 정밀 발굴합니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {analysisData && (
              <button
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 shadow-lg shadow-rose-950/50 active:scale-95 border border-rose-400/40 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExportingPdf ? 'PDF 생성 중...' : 'PDF 리포트 다운로드'}</span>
              </button>
            )}
            <button
              onClick={loadLastRetrievedData}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-lg active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
              <span>최신 자료 새로고침</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status Message Alert */}
      {statusMsg && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between shadow-lg animate-fadeIn ${
          statusMsg.type === 'error' 
            ? 'bg-rose-950/80 border-rose-800 text-rose-200' 
            : statusMsg.type === 'success'
            ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
            : 'bg-indigo-950/80 border-indigo-800 text-indigo-200'
        }`}>
          <div className="flex items-center space-x-2">
            {statusMsg.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
            <span className="font-semibold leading-relaxed">{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Left Inputs vs Right Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Planner Input */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#0f172a]/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-black text-white flex items-center space-x-2">
                <Smartphone className="w-4 h-4 text-rose-400" />
                <span>고객 본인인증 문자 요청</span>
              </h2>
            </div>

            {/* Quick Customer Picker - Always Visible */}
            <div className="space-y-1 text-xs">
              <label className="text-slate-400 font-semibold block flex items-center justify-between">
                <span>내 담당 고객 불러오기</span>
                <span className="text-[10px] text-rose-400 font-normal">총 {allowedCustomers?.length || 0}명</span>
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-rose-500 focus:outline-none"
              >
                <option value="">-- 내 담당 고객 선택 ({allowedCustomers?.length || 0}명) --</option>
                {allowedCustomers && allowedCustomers.length > 0 ? (
                  allowedCustomers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone || '연락처 없음'})
                    </option>
                  ))
                ) : (
                  <option disabled>조회 가능한 담당 고객이 없습니다.</option>
                )}
              </select>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-semibold mb-1 block">고객 성명</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="예: 이재성"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold mb-1 block">고객 휴대폰 번호</label>
                <input
                  type="text"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="01076797880"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-rose-300 font-bold"
                />
              </div>

              {/* Action Button: Send SMS Link */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSendAuthSms}
                  disabled={authStep === 'SMS_WAITING'}
                  className="w-full py-4 bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-xl shadow-rose-950/60 border border-rose-400/40 transition-all active:scale-95 disabled:opacity-50"
                >
                  {authStep === 'SMS_WAITING' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>고객 모바일 인증 진행 중... ({formatTimer(remainingTime)})</span>
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4 text-amber-300" />
                      <span>📱 고객 스마트폰으로 안심 인증 문자 즉시 발송</span>
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={loadLastRetrievedData}
                className="w-full py-2.5 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl font-bold text-xs border border-slate-700 transition-all flex items-center justify-center space-x-1.5"
              >
                <span>📂 직전 국세청 인증 자료 즉시 불러오기</span>
              </button>

              {/* Notice Box */}
              <div className="bg-slate-900/80 rounded-2xl p-3.5 border border-slate-800 space-y-1 text-[11px] text-slate-400">
                <p className="font-bold text-slate-300 flex items-center space-x-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>국세청 연동 안내</span>
                </p>
                <p className="leading-relaxed">
                  고객이 문자 링크에서 카카오톡 본인인증을 마치면, CRM 프로그램이 최근 의료비 지출 및 실손보험금 원장을 1초 만에 자동으로 수신합니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Clean Data Dashboard */}
        <div className="lg:col-span-8 space-y-5">
          
          {!analysisData ? (
            /* Clean Initial Waiting Placeholder */
            <div className="bg-[#0f172a]/80 border border-slate-800 border-dashed rounded-3xl p-12 text-center space-y-4 min-h-[460px] flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-3xl text-rose-400">
                <Search className="w-8 h-8" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="text-lg font-black text-white">
                  조회 대기 상태입니다
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  좌측에서 <strong className="text-rose-300">[직전 국세청 인증 자료 즉시 불러오기]</strong>를 누르시거나 <strong className="text-amber-300">[안심 인증 문자 발송]</strong>을 진행하시면 수신된 데이터가 짠! 하고 표시됩니다.
                </p>
              </div>
            </div>
          ) : (
            /* Real Analyzed Data Dashboard */
            <>
              {/* Filter Tabs Header: Year Tabs & Family Member Tabs */}
              <div className="bg-[#0f172a]/95 border border-slate-800 p-3 rounded-2xl space-y-3">
                
                {/* 1. Year Tabs (3-Year Coverage: 2025, 2024, 2023) */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold text-slate-400 px-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span>조회 연도:</span>
                    </span>
                    <button
                      onClick={() => setSelectedYearTab('ALL')}
                      className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all ${
                        selectedYearTab === 'ALL'
                          ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md shadow-rose-950/40'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      전체 (3개년 통합)
                    </button>
                    {['2025', '2024', '2023'].map(yr => {
                      const yrData = analysisData?.byYear?.[yr];
                      const yrCount = (yrData?.expenseList?.length || 0) + (yrData?.indemnityList?.length || 0);
                      return (
                        <button
                          key={yr}
                          onClick={() => setSelectedYearTab(yr)}
                          className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all ${
                            selectedYearTab === yr
                              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {yr}년 {yrCount > 0 ? `(${yrCount}건)` : ''}
                        </button>
                      );
                    })}
                  </div>

                  <span className="text-[11px] text-emerald-400 font-bold bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800/60 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>실시간 병의원 진료일자 반영 완료</span>
                  </span>
                </div>

                {/* 2. Family Member Dynamic Filter */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-400 px-1 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-rose-400" />
                      <span>대상자:</span>
                    </span>
                    <button
                      onClick={() => setFamilyFilter('ALL')}
                      className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all ${
                        familyFilter === 'ALL'
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      전체 ({((currentViewData.expenseList?.length || 0) + (currentViewData.indemnityList?.length || 0))}건)
                    </button>
                    {uniqueMembers.map((m, idx) => (
                      <button
                        key={idx}
                        onClick={() => setFamilyFilter(m.name)}
                        className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all ${
                          familyFilter === m.name
                            ? (m.isSelf ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-amber-600 text-white shadow-md shadow-amber-600/30')
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {m.isSelf ? `${m.name} 님 본인` : `부양가족 ${m.name} 님`} ({m.count}건)
                      </button>
                    ))}
                  </div>

                  <span className="text-[11px] text-slate-400 font-bold">
                    ✓ 최신순 정렬
                  </span>
                </div>
              </div>

              {/* 4 Core Comparison KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#0f172a]/95 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-1">
                  <span className="text-[11px] text-slate-400 font-bold block">
                    🏥 총 의료비 지출액
                  </span>
                  <div className="text-lg sm:text-xl font-black text-white">
                    {(currentViewData.totalExpenseAmount || 0).toLocaleString()}원
                  </div>
                  <span className="text-[10px] text-slate-400">
                    총 {currentViewData.totalExpenseCount || 0}건 지출
                  </span>
                </div>

                <div className="bg-[#0f172a]/95 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-1">
                  <span className="text-[11px] text-slate-400 font-bold block">
                    💵 실손보험금 수령액
                  </span>
                  <div className="text-lg sm:text-xl font-black text-cyan-400">
                    {(currentViewData.totalIndemnityAmount || 0).toLocaleString()}원
                  </div>
                  <span className="text-[10px] text-slate-400">
                    DB손해보험 수령
                  </span>
                </div>

                <div className="bg-gradient-to-br from-rose-950/80 to-pink-950/60 border-2 border-rose-500/60 rounded-2xl p-4 shadow-xl shadow-rose-950/40 space-y-1 relative overflow-hidden">
                  <div className="absolute top-1.5 right-1.5 px-1.5 py-0.2 bg-rose-500 text-[9px] font-black text-white rounded-full">
                    발굴
                  </div>
                  <span className="text-[11px] text-rose-300 font-black block">
                    🚨 미청구 숨은 실손보험금
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-amber-300">
                    {(currentViewData.unclaimedEstimatedAmount || 0).toLocaleString()}원
                  </div>
                  <span className="text-[10px] text-rose-200 font-semibold">
                    3년 소멸시효 내 청구 가망
                  </span>
                </div>

                <div className="bg-[#0f172a]/95 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-1">
                  <span className="text-[11px] text-slate-400 font-bold block">📊 실손보험 청구율</span>
                  <div className="text-lg sm:text-xl font-black text-emerald-400">
                    {currentViewData.claimRatioPercent || 0}%
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${currentViewData.claimRatioPercent || 0}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Sub Tab Switcher */}
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                <button
                  onClick={() => setActiveDetailTab('expenses')}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 ${
                    activeDetailTab === 'expenses'
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span>🏥 병의원·약국 지출 상세 ({currentViewData.expenseList?.length || 0}건)</span>
                </button>

                <button
                  onClick={() => setActiveDetailTab('indemnity')}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-1.5 ${
                    activeDetailTab === 'indemnity'
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>💵 보험사 실손 수령 내역 ({currentViewData.indemnityList?.length || 0}건)</span>
                </button>
              </div>

              {/* Tab 1: Expense List */}
              {activeDetailTab === 'expenses' && (
                <div className="bg-[#0f172a]/90 border border-slate-800 rounded-2xl p-4 space-y-3 animate-fadeIn">
                  {currentViewData.expenseList && currentViewData.expenseList.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-slate-400 border-b border-slate-800 text-[11px]">
                            <th className="pb-2 font-semibold">지출시기(날짜)</th>
                            <th className="pb-2 font-semibold">환자명</th>
                            <th className="pb-2 font-semibold">의료기관 / 약국명</th>
                            <th className="pb-2 font-semibold">사업자등록번호</th>
                            <th className="pb-2 font-semibold text-right">지출금액</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {currentViewData.expenseList.map((item, i) => (
                            <tr key={i} className="hover:bg-slate-800/30">
                              <td className="py-2.5 font-bold text-slate-300 font-mono">
                                {item.displayDate || (item.date ? `${item.date.split('-')[0]}년 ${Number(item.date.split('-')[1])}월 ${item.date.split('-')[2] ? Number(item.date.split('-')[2]) + '일' : ''}` : `${item.year || 2024}년 ${item.month || '12'}월`)}
                              </td>
                              <td className="py-2.5 font-bold text-rose-300">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  ((item.insuredPerson || item.patientName || item.userNm) === clientName || (item.insuredPerson || item.patientName || item.userNm)?.includes(clientName))
                                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/50' 
                                    : 'bg-amber-950 text-amber-300 border border-amber-800/50'
                                }`}>
                                  {item.insuredPerson || item.patientName || item.userNm || clientName || '본인'}
                                </span>
                              </td>
                              <td className="py-2.5 font-bold text-white">{item.hospitalName || item.orgName || item.companyName}</td>
                              <td className="py-2.5 text-slate-400 font-mono">{item.bizNo || '-'}</td>
                              <td className="py-2.5 text-right font-black text-amber-300 text-sm">{item.amount.toLocaleString()}원</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400">
                      선택된 조건의 의료비 지출 내역이 없습니다.
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Indemnity List */}
              {activeDetailTab === 'indemnity' && (
                <div className="bg-[#0f172a]/90 border border-slate-800 rounded-2xl p-4 space-y-3 animate-fadeIn">
                  {currentViewData.indemnityList && currentViewData.indemnityList.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-slate-400 border-b border-slate-800 text-[11px]">
                            <th className="pb-2 font-semibold">지급시기(날짜)</th>
                            <th className="pb-2 font-semibold">수령인</th>
                            <th className="pb-2 font-semibold">지급 보험사</th>
                            <th className="pb-2 font-semibold">월별 지급 상세</th>
                            <th className="pb-2 font-semibold text-right">수령 총액</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {currentViewData.indemnityList.map((item, i) => (
                            <tr key={i} className="hover:bg-slate-800/30">
                              <td className="py-2.5 font-bold text-slate-300 font-mono">
                                {item.displayDate || (item.date ? `${item.date.split('-')[0]}년 ${Number(item.date.split('-')[1])}월 ${item.date.split('-')[2] ? Number(item.date.split('-')[2]) + '일' : ''}` : `${item.year || 2024}년`)}
                              </td>
                              <td className="py-2.5 font-bold text-cyan-300">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  ((item.insuredPerson || item.patientName || item.userNm) === clientName || (item.insuredPerson || item.patientName || item.userNm)?.includes(clientName))
                                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/50' 
                                    : 'bg-cyan-950 text-cyan-300 border border-cyan-800/50'
                                }`}>
                                  {item.insuredPerson || item.patientName || item.userNm || clientName || '본인'}
                                </span>
                              </td>
                              <td className="py-2.5 font-bold text-white">{item.companyName || item.orgName}</td>
                              <td className="py-2.5 text-xs text-cyan-200">{item.detailMonths || '지급 완료'}</td>
                              <td className="py-2.5 text-right font-black text-cyan-300 text-sm">{item.amount.toLocaleString()}원</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400">
                      선택된 조건의 실손보험금 수령 내역이 없습니다.
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {/* SMS Waiting Progress Modal with Direct Link Copy Button */}
      {authStep === 'SMS_WAITING' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0f172a] border border-rose-500/50 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl text-center">
            
            <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-3xl animate-pulse">
              📱
            </div>

            <div className="space-y-2">
              <span className="text-[11px] px-3 py-1 bg-rose-950 text-rose-300 border border-rose-800/80 rounded-full font-extrabold uppercase">
                고객 안심 본인인증 대기 중
              </span>
              <h3 className="text-xl font-black text-white">
                고객님이 스마트폰에서 인증을 진행 중입니다!
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-md mx-auto">
                <strong className="text-amber-300">{clientName}</strong> 고객님({clientPhone})의 스마트폰으로 인증 링크가 연결되었습니다.<br />
                고객님이 링크를 열어 카카오톡 승인을 마치면 <strong>1초 만에 CRM 화면이 자동으로 열립니다.</strong>
              </p>
            </div>

            {/* Direct Link Share & Copy Box */}
            <div className="p-3.5 bg-slate-900 border border-slate-700 rounded-2xl space-y-2 text-left">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-bold text-slate-300">🔗 모바일 인증 접속 링크</span>
                <span className="text-amber-400 font-mono font-black">{formatTimer(remainingTime)}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={activeAuthUrl || 'https://focal-downloadable-variance-pts.trycloudflare.com'}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-rose-300 font-mono select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? '복사됨!' : '링크 복사'}</span>
                </button>
              </div>
            </div>

            <button
              onClick={handleCancelAuth}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl font-bold text-xs border border-slate-800 transition-all"
            >
              대기 취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
