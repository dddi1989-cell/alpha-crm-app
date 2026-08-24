import React, { useState, useMemo } from 'react';
import { Users, User, Calendar, Clock, UserPlus, CalendarPlus, Bell, CheckCircle2, ArrowRight, ChevronLeft, ChevronRight, UserCheck, Shield, Plus, Eye, Mail, Phone, AlertTriangle, Building2, Filter } from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';
import { getDescendantOrgAndUserIds, matchesOrgFilter } from '../utils/orgHierarchy';
import { isCustomerBirthdayOnDate, getSolarBirthdayInYear } from '../utils/lunarSolar';

function calculateElapsedMonths(startDateStr) {
  if (!startDateStr) return null;
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return null;

  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  
  let totalMonths = years * 12 + months + 1;
  return totalMonths > 0 ? totalMonths : 1;
}

function checkIsLongTouchCustomer(customer, schedules) {
  if (customer.status === 'Inactive') return true;

  const now = new Date();
  const past6Months = new Date(now);
  past6Months.setMonth(past6Months.getMonth() - 6);
  past6Months.setHours(0, 0, 0, 0);
  const past6MonthsTime = past6Months.getTime();

  const future1Month = new Date(now);
  future1Month.setMonth(future1Month.getMonth() + 1);
  future1Month.setHours(23, 59, 59, 999);
  const future1MonthTime = future1Month.getTime();

  // Find all schedules matching this customer by customer_id or customer name
  const custSchedules = schedules.filter((s) => {
    if (s.customer_id && String(s.customer_id) === String(customer.id)) return true;
    if (s.title && customer.name && s.title.includes(customer.name)) return true;
    if (s.description && customer.name && s.description.includes(customer.name)) return true;
    return false;
  });

  const hasScheduleInWindow = custSchedules.some((s) => {
    if (!s.scheduled_at) return false;
    const stTime = new Date(s.scheduled_at).getTime();
    return !isNaN(stTime) && stTime >= past6MonthsTime && stTime <= future1MonthTime;
  });

  return !hasScheduleInWindow;
}

export default function DashboardView() {
  const customers = useCrmStore((state) => state.customers);
  const schedules = useCrmStore((state) => state.schedules);

  const openCustomerModal = useCrmStore((state) => state.openCustomerModal);
  const openCustomerDetailModal = useCrmStore((state) => state.openCustomerDetailModal);
  const openScheduleModal = useCrmStore((state) => state.openScheduleModal);
  const toggleScheduleStatus = useCrmStore((state) => state.toggleScheduleStatus);
  const setActiveTab = useCrmStore((state) => state.setActiveTab);

  const currentUser = useCrmStore((state) => state.currentUser);
  const organizations = useCrmStore((state) => state.organizations);
  const accessibleUsers = useCrmStore((state) => state.accessibleUsers);

  // Dashboard Scope: 'personal' (사용자 본인) | 'org' (소속 조직 전체)
  const [dashboardScope, setDashboardScope] = useState('personal');
  const [selectedSubOrgFilter, setSelectedSubOrgFilter] = useState('');

  const myId = useMemo(() => (currentUser ? Number(currentUser.id) : 1), [currentUser]);
  const userName = currentUser?.name || '사용자';
  const orgName = currentUser?.org_name || '소속 조직';

  // Resolved hierarchy for current selected sub-org filter
  const hierarchyInfo = useMemo(() => {
    if (dashboardScope === 'personal') return null;
    return getDescendantOrgAndUserIds(selectedSubOrgFilter, organizations, accessibleUsers);
  }, [dashboardScope, selectedSubOrgFilter, organizations, accessibleUsers]);

  // Client-side Strict Schedule Filter Guard
  const visibleSchedules = useMemo(() => {
    if (!Array.isArray(schedules)) return [];

    if (dashboardScope === 'personal') {
      return schedules.filter((s) => {
        const sOwnerId = s.user_id !== null && s.user_id !== undefined ? Number(s.user_id) : 1;
        if (sOwnerId === myId) return true;
        if (s.is_broadcast === 1) return true;
        return false;
      });
    }

    // Organization Scope (Includes all recursive descendants and broadcast notices)
    return schedules.filter((s) => matchesOrgFilter(s, hierarchyInfo) || s.is_broadcast === 1);
  }, [schedules, dashboardScope, hierarchyInfo, myId]);

  // Client-side Strict Customer Filter Guard
  const visibleCustomers = useMemo(() => {
    if (!Array.isArray(customers)) return [];

    if (dashboardScope === 'personal') {
      return customers.filter((c) => {
        const cOwnerId = c.user_id !== null && c.user_id !== undefined ? Number(c.user_id) : 1;
        return cOwnerId === myId;
      });
    }

    // Organization Scope (Includes all recursive descendants)
    return customers.filter((c) => matchesOrgFilter(c, hierarchyInfo));
  }, [customers, dashboardScope, hierarchyInfo, myId]);

  // Calendar State for the right panel
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const totalCustomers = visibleCustomers.length;
  const longTouchCustomers = visibleCustomers.filter(c => checkIsLongTouchCustomer(c, visibleSchedules));
  const activeCustomers = visibleCustomers.filter(c => c.status === 'Active' && !checkIsLongTouchCustomer(c, visibleSchedules)).length;
  const leadCustomers = visibleCustomers.filter(c => c.status === 'Lead' && !checkIsLongTouchCustomer(c, visibleSchedules)).length;

  const pendingSchedules = visibleSchedules.filter(s => s.status === 'Pending');
  const completedSchedules = visibleSchedules.filter(s => s.status === 'Completed').length;

  // Calendar date logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const isToday = (day) => {
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  };

  const isSelected = (day) => {
    return selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === day;
  };

  const getSchedulesForDay = (day) => {
    return visibleSchedules.filter((s) => {
      const d = new Date(s.scheduled_at);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  const getBirthdaysForDay = (day) => {
    return visibleCustomers.filter((c) => isCustomerBirthdayOnDate(c, year, month, day));
  };

  const selectedDaySchedules = visibleSchedules.filter((s) => {
    const d = new Date(s.scheduled_at);
    return (
      d.getFullYear() === selectedDate.getFullYear() &&
      d.getMonth() === selectedDate.getMonth() &&
      d.getDate() === selectedDate.getDate()
    );
  });

  const selectedDayBirthdays = visibleCustomers.filter((c) => {
    if (!c.birth_date) return false;
    const parts = c.birth_date.split('-');
    if (parts.length >= 3) {
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return m === selectedDate.getMonth() && d === selectedDate.getDate();
    }
    const bd = new Date(c.birth_date);
    if (isNaN(bd.getTime())) return false;
    return bd.getMonth() === selectedDate.getMonth() && bd.getDate() === selectedDate.getDate();
  });

  return (
    <div className="p-8 space-y-8 animate-fadeIn font-['Inter',sans-serif]">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-['Outfit',sans-serif] text-2xl font-bold text-white tracking-tight">
              대시보드 개요
            </h2>

            {/* Scope Switcher: User Name vs Org Name */}
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold shadow-sm">
              <button
                onClick={() => setDashboardScope('personal')}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                  dashboardScope === 'personal'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="본인 개인 정보 조회"
              >
                <User className="w-3.5 h-3.5" />
                <span>{userName}</span>
              </button>

              <button
                onClick={() => setDashboardScope('org')}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                  dashboardScope === 'org'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="소속 조직 및 하부조직 전체 정보 조회"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>{orgName}</span>
              </button>
            </div>

            {/* Sub-Org & Subordinate Selector (Visible when Org Scope is Active) */}
            {dashboardScope === 'org' && (
              <div className="flex items-center space-x-2 animate-fadeIn">
                <select
                  value={selectedSubOrgFilter}
                  onChange={(e) => setSelectedSubOrgFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium shadow-inner"
                >
                  <option value="">🏢 {orgName} 전체 (하위 조직 및 전원 포함)</option>
                  {organizations.length > 0 && (
                    <optgroup label="하위 조직(팀/지점/본부) 단위">
                      {organizations.map((o) => (
                        <option key={`org-${o.id}`} value={o.id}>
                          📁 {o.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {accessibleUsers.length > 0 && (
                    <optgroup label="개별 조직원">
                      {accessibleUsers.map((u) => (
                        <option key={`user-${u.id}`} value={`user:${u.id}`}>
                          👤 {u.name} ({u.role || 'FA'}) {u.org_name ? `· ${u.org_name}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            )}
          </div>

          <p className="text-slate-400 text-sm mt-1">
            {dashboardScope === 'personal'
              ? `[${userName}] 님의 개인 고객 및 일정, 6개월 장기미터치 현황입니다.`
              : `[${orgName}] 소속 조직의 통합 고객 및 일정, 장기미터치 모니터링 현황입니다.`}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => openCustomerModal()}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/25 flex items-center space-x-2 transition-all hover:scale-[1.02]"
          >
            <UserPlus className="w-4 h-4" />
            <span>새 고객 추가</span>
          </button>
          <button
            onClick={() => openScheduleModal()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/25 flex items-center space-x-2 transition-all hover:scale-[1.02]"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>새 일정 등록</span>
          </button>
        </div>
      </div>

      {/* Interactive Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* Total Customers Card */}
        <div
          onClick={() => setActiveTab('customers')}
          className="glass-panel p-5 rounded-2xl border border-slate-800/80 hover:border-blue-500/50 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-950/30 group"
          title="고객 관리 메뉴로 이동"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider group-hover:text-blue-400 transition-colors">
              총 고객 수
            </span>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-white font-['Outfit']">{totalCustomers}</span>
            <span className="text-xs text-blue-400 font-medium flex items-center space-x-1">
              <span>보유 {activeCustomers}명</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </span>
          </div>
        </div>

        {/* Lead Customers Card */}
        <div
          onClick={() => setActiveTab('customers')}
          className="glass-panel p-5 rounded-2xl border border-slate-800/80 hover:border-blue-500/50 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-950/30 group"
          title="고객 관리 메뉴로 이동"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider group-hover:text-blue-400 transition-colors">
              가망고객
            </span>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
              <UserPlus className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-white font-['Outfit']">{leadCustomers}</span>
            <span className="text-xs text-blue-400 font-medium flex items-center space-x-1">
              <span>영업 파이프라인</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </span>
          </div>
        </div>

        {/* Active Customers Card */}
        <div
          onClick={() => setActiveTab('customers')}
          className="glass-panel p-5 rounded-2xl border border-slate-800/80 hover:border-emerald-500/50 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-950/30 group"
          title="고객 관리 메뉴로 이동"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider group-hover:text-emerald-400 transition-colors">
              보유고객
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-white font-['Outfit']">{activeCustomers}</span>
            <span className="text-xs text-emerald-400 font-medium flex items-center space-x-1">
              <span>계약 유지 고객</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </span>
          </div>
        </div>

        {/* Long Touch Customers Card */}
        <div
          onClick={() => setActiveTab('customers')}
          className="glass-panel p-5 rounded-2xl border border-rose-500/30 hover:border-rose-500/60 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-rose-950/30 group bg-rose-950/10"
          title="고객 관리 메뉴로 이동"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider group-hover:text-rose-300 transition-colors">
              장기미터치고객
            </span>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition-all">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-rose-300 font-['Outfit']">{longTouchCustomers.length}</span>
            <span className="text-xs text-rose-400 font-medium flex items-center space-x-1">
              <span>6개월 미터치</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </span>
          </div>
        </div>
      </div>

      {/* 장기미터치 고객 현황 Alert Section */}
      <div className="glass-panel p-5 rounded-2xl border border-rose-500/30 bg-rose-950/20 space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>🚨 장기미터치 고객 관리 현황 (최근 6개월 일정 미존재)</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                  총 {longTouchCustomers.length}명
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                최근 과거 6개월 이내 미팅/전화 상담 일정이 없는 고객입니다. 클릭하여 바로 터치 일정을 추가해 주세요.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('customers')}
            className="text-xs text-rose-300 hover:text-white font-bold flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-rose-900/60 border border-rose-700/60 hover:bg-rose-800 transition-all shrink-0"
          >
            <span>고객 디렉토리 이동</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {longTouchCustomers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {longTouchCustomers.slice(0, 6).map((c) => (
              <div key={c.id} className="bg-slate-900/90 p-3.5 rounded-xl border border-rose-900/40 flex items-center justify-between hover:border-rose-700/60 transition-all">
                <div className="space-y-0.5 min-w-0 pr-2">
                  <div className="flex items-center space-x-1.5 truncate">
                    <span className="font-bold text-xs text-white truncate">{c.name}</span>
                    {c.user_name && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold shrink-0">
                        {c.user_name} ({c.user_role || 'FA'})
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center space-x-1">
                    <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="truncate">{c.phone || '연락처 미등록'}</span>
                  </div>
                </div>
                <button
                  onClick={() => openScheduleModal(null, { customer_id: c.id, title: `${c.name} 터치 미팅` })}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] transition-all shadow shrink-0 active:scale-95"
                >
                  + 일정 등록
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-emerald-400 py-1 font-semibold flex items-center space-x-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" />
            <span>모든 고객과 최근 6개월 이내 소통하고 계십니다! 장기미터치 고객이 0명입니다.</span>
          </p>
        )}
      </div>

      {/* Main Grid: Customer List (Left) + Schedule Calendar (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ========================================================================= */}
        {/* LEFT PANEL: CUSTOMER LIST (고객 목록 노출) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-base text-white">고객 목록</h3>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800/60">
                {totalCustomers}명
              </span>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-xs text-slate-400 font-medium">
                {dashboardScope === 'personal' ? `[${userName}] 님의 고객` : `[${orgName}] 조직 고객`}
              </span>
              <button
                onClick={() => setActiveTab('customers')}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1 font-medium group ml-1"
              >
                <span>전체 관리</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {visibleCustomers.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Users className="w-10 h-10 mx-auto text-slate-600 stroke-[1.5]" />
              <p className="text-sm font-medium">조회 조건에 일치하는 고객 정보가 없습니다.</p>
              <button
                onClick={() => openCustomerModal()}
                className="text-xs text-blue-400 hover:underline inline-block mt-1"
              >
                + 첫 고객 등록하기
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleCustomers.slice(0, 6).map((customer) => {
                const insurancesList = Array.isArray(customer.insurances) ? customer.insurances : [];
                const isLongTouch = checkIsLongTouchCustomer(customer, visibleSchedules);

                return (
                  <div
                    key={customer.id}
                    onClick={() => openCustomerDetailModal(customer)}
                    className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 flex items-center justify-between hover:border-blue-500/50 hover:bg-slate-800/40 cursor-pointer transition-all group"
                    title="클릭하여 고객 상세 정보 및 최근 3년 일정 보기"
                  >
                    {/* Left Customer Basic Info */}
                    <div className="flex items-center space-x-3.5 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-sm group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                        {customer.name ? customer.name.charAt(0).toUpperCase() : 'C'}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center flex-wrap gap-2 min-w-0">
                          {/* Customer Name */}
                          <span className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors shrink-0">
                            {customer.name}
                          </span>

                          {/* Phone Number */}
                          {customer.phone && (
                            <span className="inline-flex items-center text-xs text-slate-300 bg-slate-950/60 px-2 py-0.5 rounded-md border border-slate-800/80">
                              <Phone className="w-3 h-3 mr-1 text-slate-500" />
                              {customer.phone}
                            </span>
                          )}

                          {/* Birth Date */}
                          {customer.birth_date && (
                            <span className="inline-flex items-center text-xs text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-800/60 font-medium">
                              <span className="mr-1">🎂</span>
                              {customer.birth_type === 'lunar' ? `[음력] ${customer.birth_date}` : customer.birth_date}
                            </span>
                          )}
                        </div>

                        {/* Manager Badge (담당 조직원 이름과 직급) */}
                        {customer.user_name && (
                          <div className="flex items-center space-x-1 text-[10px] text-indigo-300 font-semibold mt-1">
                            <User className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span>담당: {customer.user_name} ({customer.user_role || 'FA'})</span>
                            {customer.user_org_name && (
                              <span className="text-slate-400 font-normal"> · {customer.user_org_name}</span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center space-x-2 mt-1.5">
                          {/* Status Badge */}
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            isLongTouch
                              ? 'bg-rose-950/80 text-rose-300 border-rose-800/60'
                              : customer.status === 'Lead'
                              ? 'bg-blue-950/80 text-blue-400 border-blue-800/60'
                              : 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                          }`}>
                            {isLongTouch ? '장기미터치고객' : customer.status === 'Lead' ? '가망고객' : '보유고객'}
                          </span>

                          {/* Referrer Badge */}
                          {customer.referrer_name && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 text-[10px] font-medium">
                              <UserCheck className="w-3 h-3 text-emerald-400" />
                              <span>소개: {customer.referrer_name}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Insurance Cards & Action */}
                    <div className="flex items-center space-x-3 shrink-0">
                      {insurancesList.length > 0 ? (
                        <div className="flex items-center space-x-1.5">
                          {insurancesList.slice(0, 2).map((ins, idx) => {
                            const months = calculateElapsedMonths(ins.startDate || ins.start_date);
                            return (
                              <div
                                key={idx}
                                className="bg-slate-950/90 px-2.5 py-1 rounded-lg border border-slate-800 flex items-center space-x-1 text-xs"
                              >
                                <Shield className="w-3 h-3 text-blue-400" />
                                <span className="text-slate-200 font-medium">{ins.provider}</span>
                                {months && (
                                  <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 px-1 py-0.2 rounded border border-amber-800/50">
                                    {months}개월차
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          {insurancesList.length > 2 && (
                            <span className="text-[10px] font-bold text-slate-500 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                              +{insurancesList.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600">가입 보험 미등록</span>
                      )}

                      <Eye className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors ml-2 shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* RIGHT PANEL: SCHEDULE MANAGEMENT CALENDAR (일정관리 캘린더 위치) */}
        {/* ========================================================================= */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-base text-white">일정관리 캘린더</h3>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-medium">
                  {dashboardScope === 'personal' ? `[${userName}] 님의 일정` : `[${orgName}] 조직 일정`}
                </span>
                <button
                  onClick={() => setActiveTab('schedules')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 font-medium group ml-1"
                >
                  <span>전체 캘린더</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* Month Nav */}
            <div className="flex items-center justify-between px-1">
              <span className="text-sm font-bold text-white">
                {year}년 {month + 1}월
              </span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={handlePrevMonth}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Weekdays Header */}
            <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-500 pb-1">
              <span className="text-red-400">일</span>
              <span>월</span>
              <span>화</span>
              <span>수</span>
              <span>목</span>
              <span>금</span>
              <span className="text-blue-400">토</span>
            </div>

            {/* Mini Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-9 rounded-lg bg-slate-900/30" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const daySchedules = getSchedulesForDay(day);
                const dayBirthdays = getBirthdaysForDay(day);
                const isTodayDay = isToday(day);
                const isSelectedDay = isSelected(day);

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(new Date(year, month, day))}
                    className={`h-9 rounded-lg flex flex-col items-center justify-center relative transition-all ${
                      isSelectedDay
                        ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                        : isTodayDay
                        ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                        : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-xs">{day}</span>
                    <div className="flex items-center space-x-0.5 mt-0.5">
                      {daySchedules.length > 0 && (
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isSelectedDay ? 'bg-white' : 'bg-amber-400'
                        }`} />
                      )}
                      {dayBirthdays.length > 0 && (
                        <span className="text-[9px] leading-none" title={`${dayBirthdays.map(b => b.name).join(', ')} 생일`}>🎂</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Day Schedule Detail List */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-400">
                  {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 일정 ({selectedDaySchedules.length + selectedDayBirthdays.length}건)
                </span>
                <button
                  onClick={() => openScheduleModal({ scheduled_at: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}T09:00` })}
                  className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>일정 추가</span>
                </button>
              </div>

              {/* Birthday Banner Cards for Selected Date */}
              {selectedDayBirthdays.map((c) => (
                <div key={`bday-${c.id}`} className="bg-gradient-to-r from-pink-950/80 to-purple-950/80 p-2.5 rounded-xl border border-pink-500/40 flex items-center justify-between shadow-lg">
                  <div className="flex items-center space-x-2 min-w-0 pr-2">
                    <span className="text-base">🎂</span>
                    <div className="space-y-0.5 min-w-0">
                      <span className="font-bold text-xs text-pink-200 block truncate">[생일] {c.name} 고객님 생일</span>
                      <span className="text-[10px] text-pink-300/80 block">생년월일: {c.birth_date}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => openScheduleModal(null, { customer_id: c.id, title: `🎂 ${c.name} 고객 생일 축하 전화/선물` })}
                    className="px-2 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-[10px] shrink-0 active:scale-95"
                  >
                    + 축하 일정
                  </button>
                </div>
              ))}

              {selectedDaySchedules.length === 0 && selectedDayBirthdays.length === 0 ? (
                <p className="text-xs text-slate-500 py-1">선택한 날짜에 등록된 일정이 없습니다.</p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                  {selectedDaySchedules.map((s) => (
                    <div
                      key={s.id}
                      className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <button
                          onClick={() => toggleScheduleStatus(s)}
                          className={`p-0.5 rounded border shrink-0 ${
                            s.status === 'Completed'
                              ? 'bg-emerald-950 border-emerald-700 text-emerald-400'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5 truncate">
                            {s.user_name && (
                              <span className="text-[10px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold shrink-0">
                                {s.user_name}
                              </span>
                            )}
                            <span className={`font-semibold truncate ${s.status === 'Completed' ? 'line-through text-slate-500' : 'text-white'}`}>
                              {s.title}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-amber-400 font-medium shrink-0 ml-2">
                        {new Date(s.scheduled_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action to Full Schedule View */}
          <button
            onClick={() => setActiveTab('schedules')}
            className="w-full mt-4 py-2.5 px-4 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-semibold rounded-xl border border-indigo-500/30 transition-all flex items-center justify-center space-x-1.5"
          >
            <span>전체 일정 관리 메뉴 이동</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
}
