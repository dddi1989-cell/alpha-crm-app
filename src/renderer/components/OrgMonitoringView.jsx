import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Calendar,
  Clock,
  Shield,
  Phone,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Building2,
  UserCheck,
  Filter,
  Flame,
  CalendarDays
} from 'lucide-react';
import { api } from '../utils/api';
import { useCrmStore } from '../store/useCrmStore';

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

export default function OrgMonitoringView() {
  const currentUser = useCrmStore((state) => state.currentUser);
  const openCustomerDetailModal = useCrmStore((state) => state.openCustomerDetailModal);

  const [accessibleUsers, setAccessibleUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Target Subordinate Data State
  const [subordinateData, setSubordinateData] = useState(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('longtouch'); // 'longtouch' | 'schedules' | 'all-customers'

  // Calendar state for schedules tab
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date());
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState('');
  const [customerSearchFilter, setCustomerSearchFilter] = useState('');

  // 1. Load accessible subordinates on mount
  const loadSubordinates = async () => {
    if (!currentUser?.id) return;
    setIsLoadingUsers(true);
    try {
      const res = await api.users.getAccessibleSubordinates(currentUser.id);
      if (res?.success && Array.isArray(res.users)) {
        setAccessibleUsers(res.users);
        // Default to first non-self subordinate or self if none
        if (res.users.length > 0) {
          const defaultUser = res.users.find(u => !u.isSelf) || res.users[0];
          setSelectedUserId(defaultUser.id);
        }
      }
    } catch (err) {
      console.error('Error loading accessible subordinates:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadSubordinates();
  }, [currentUser]);

  // 2. Load target subordinate CRM data when selectedUserId changes
  const loadTargetData = async (userId, forceSync = false) => {
    if (!userId || !currentUser?.id) return;
    setIsLoadingData(true);
    try {
      const res = await api.org.getSubordinateData({
        currentUserId: currentUser.id,
        targetUserId: userId,
        forceSync
      });
      if (res?.success) {
        setSubordinateData(res);
      } else {
        console.error('Failed to load subordinate data:', res?.error);
      }
    } catch (err) {
      console.error('Error loading subordinate data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (selectedUserId) {
      loadTargetData(selectedUserId);
    }
  }, [selectedUserId]);

  // Handle Manual Cloud Sync
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await api.system.syncCloudData();
      await loadSubordinates();
      if (selectedUserId) {
        await loadTargetData(selectedUserId, true);
      }
    } catch (err) {
      console.error('Manual sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter accessible users list
  const filteredUsers = useMemo(() => {
    return accessibleUsers.filter(u => {
      const matchesSearch = !userSearchQuery ||
        u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        (u.phone && u.phone.includes(userSearchQuery));

      const matchesRole = !roleFilter || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [accessibleUsers, userSearchQuery, roleFilter]);

  const targetUser = subordinateData?.targetUser;
  const stats = subordinateData?.stats || {
    totalCustomers: 0,
    longTouchCustomers: 0,
    activeCustomers: 0,
    leadCustomers: 0,
    totalSchedules: 0,
    pendingSchedules: 0,
    completedSchedules: 0,
    upcomingThisMonth: 0
  };

  // Filtered Long-touch Customers
  const filteredLongTouchCustomers = useMemo(() => {
    if (!subordinateData?.longTouchList) return [];
    if (!customerSearchFilter) return subordinateData.longTouchList;
    const term = customerSearchFilter.toLowerCase();
    return subordinateData.longTouchList.filter(c =>
      c.name.toLowerCase().includes(term) ||
      (c.phone && c.phone.includes(term)) ||
      (c.notes && c.notes.toLowerCase().includes(term)) ||
      (c.insurance_provider && c.insurance_provider.toLowerCase().includes(term))
    );
  }, [subordinateData?.longTouchList, customerSearchFilter]);

  // Filtered All Customers
  const filteredAllCustomers = useMemo(() => {
    if (!subordinateData?.customers) return [];
    if (!customerSearchFilter) return subordinateData.customers;
    const term = customerSearchFilter.toLowerCase();
    return subordinateData.customers.filter(c =>
      c.name.toLowerCase().includes(term) ||
      (c.phone && c.phone.includes(term)) ||
      (c.notes && c.notes.toLowerCase().includes(term))
    );
  }, [subordinateData?.customers, customerSearchFilter]);

  // Calendar Calculations
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

  const isSelectedDay = (day) => {
    return selectedCalendarDate.getFullYear() === year && selectedCalendarDate.getMonth() === month && selectedCalendarDate.getDate() === day;
  };

  const getSchedulesForDay = (day) => {
    if (!subordinateData?.schedules) return [];
    return subordinateData.schedules.filter((s) => {
      const d = new Date(s.scheduled_at);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  const selectedDaySchedules = useMemo(() => {
    if (!subordinateData?.schedules) return [];
    return subordinateData.schedules.filter((s) => {
      const d = new Date(s.scheduled_at);
      const isSameDay = d.getFullYear() === selectedCalendarDate.getFullYear() &&
        d.getMonth() === selectedCalendarDate.getMonth() &&
        d.getDate() === selectedCalendarDate.getDate();

      if (!isSameDay) return false;
      if (scheduleStatusFilter && s.status !== scheduleStatusFilter) return false;
      return true;
    });
  }, [subordinateData?.schedules, selectedCalendarDate, scheduleStatusFilter]);

  const allSchedulesList = useMemo(() => {
    if (!subordinateData?.schedules) return [];
    if (!scheduleStatusFilter) return subordinateData.schedules;
    return subordinateData.schedules.filter(s => s.status === scheduleStatusFilter);
  }, [subordinateData?.schedules, scheduleStatusFilter]);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
      case 'Admin':
        return { label: '👑 Admin (L7)', style: 'bg-purple-950/80 text-purple-300 border-purple-800' };
      case 'CEO':
        return { label: '🏢 CEO (L6)', style: 'bg-rose-950/80 text-rose-300 border-rose-800' };
      case 'COO':
        return { label: '🏛️ COO (L5)', style: 'bg-orange-950/80 text-orange-300 border-orange-800' };
      case 'RM':
        return { label: '🏬 RM (L4)', style: 'bg-amber-950/80 text-amber-300 border-amber-800' };
      case 'BM':
        return { label: '🏢 BM (L3)', style: 'bg-emerald-950/80 text-emerald-300 border-emerald-800' };
      case 'SM':
      case 'Manager':
        return { label: '👔 SM (L2)', style: 'bg-cyan-950/80 text-cyan-300 border-cyan-800' };
      case 'FA':
      case 'Agent':
      default:
        return { label: '👤 FA (L1)', style: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  return (
    <div className="p-8 space-y-6 animate-fadeIn font-['Inter',sans-serif]">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-['Outfit',sans-serif] text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Building2 className="w-6 h-6 text-indigo-400" />
            <span>조직원 일정 & 장기미터치 고객 모니터링</span>
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            조직도상 상위 직급자 권한으로 하위 직급자의 실시간 일정 및 6개월 이상 미접촉된 장기미터치 고객을 조회하고 집중 관리합니다.
          </p>
        </div>

        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          className="px-4 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center space-x-2 shrink-0 self-start md:self-auto active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-indigo-400' : ''}`} />
          <span>{isSyncing ? '클라우드 동기화 중...' : '서버 실시간 데이터 갱신'}</span>
        </button>
      </div>

      {/* 1. Subordinate Search & Selection Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="조직원 성명(이름), 사번, 연락처 검색..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          <div className="flex items-center space-x-2 w-full md:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">전체 직급</option>
              <option value="FA">FA (자산관리사)</option>
              <option value="SM">SM (팀장)</option>
              <option value="BM">BM (지점장)</option>
              <option value="RM">RM (본부장)</option>
              <option value="COO">COO (총괄이사)</option>
              <option value="CEO">CEO (대표이사)</option>
              <option value="Admin">Admin (최고관리자)</option>
            </select>

            <span className="text-xs text-slate-400 font-medium ml-2">
              조회 가능 조직원: <strong className="text-indigo-400">{filteredUsers.length}명</strong>
            </span>
          </div>
        </div>

        {/* User Selection Chips */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 custom-scrollbar pt-1">
          {filteredUsers.length === 0 ? (
            <div className="text-xs text-slate-500 py-2">검색 조건에 일치하는 조직원이 없습니다.</div>
          ) : (
            filteredUsers.map((u) => {
              const isSelected = selectedUserId === u.id;
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className={`flex items-center space-x-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-950/60 scale-[1.02]'
                      : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-indigo-500/20 text-indigo-300'
                  }`}>
                    {u.name ? u.name.charAt(0) : 'U'}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center space-x-1">
                      <span>{u.name}</span>
                      {u.isSelf && <span className="text-[9px] opacity-75 font-normal">(본인)</span>}
                    </div>
                    <div className={`text-[10px] ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                      {u.role} · {u.username}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {isLoadingData ? (
        <div className="glass-panel p-16 rounded-2xl border border-slate-800 text-center space-y-3">
          <RefreshCw className="w-8 h-8 mx-auto text-indigo-400 animate-spin" />
          <p className="text-sm font-semibold text-slate-300">조직원의 실시간 일정 및 고객 데이터를 불러오는 중입니다...</p>
        </div>
      ) : targetUser ? (
        <>
          {/* 2. Target Subordinate Profile & Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Target Profile Card */}
            <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-3 bg-gradient-to-br from-slate-900/90 to-indigo-950/40">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 text-indigo-300 flex items-center justify-center font-bold text-base shadow-inner">
                    {targetUser.name ? targetUser.name.charAt(0) : 'U'}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center space-x-1.5">
                      <span>{targetUser.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${getRoleBadge(targetUser.role).style}`}>
                        {getRoleBadge(targetUser.role).label}
                      </span>
                    </h3>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      사번: {targetUser.username} {targetUser.phone ? `· ${targetUser.phone}` : ''}
                    </div>
                  </div>
                </div>
              </div>

              {targetUser.orgPath && (
                <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 text-[11px] text-slate-400">
                  <span className="text-slate-500 font-semibold block text-[10px] mb-0.5">조직 계층 경로:</span>
                  <span className="text-indigo-300 font-medium">{targetUser.orgPath}</span>
                </div>
              )}
            </div>

            {/* KPI 1: Long-touch Customers (Warning High Priority) */}
            <div className="glass-panel p-4 rounded-2xl border border-rose-900/40 bg-rose-950/20 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-rose-300 flex items-center space-x-1">
                  <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                  <span>장기미터치 고객 (6개월)</span>
                </span>
                <h4 className="text-3xl font-extrabold text-rose-400 tracking-tight">
                  {stats.longTouchCustomers}
                  <span className="text-sm font-medium text-rose-300/80 ml-1">명</span>
                </h4>
                <p className="text-[10px] text-rose-400/80">최근 6개월간 상담/일정이 없는 고객</p>
              </div>
              <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-400 border border-rose-500/20">
                <AlertTriangle className="w-7 h-7" />
              </div>
            </div>

            {/* KPI 2: Total Customers */}
            <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400">총 관리 고객수</span>
                <h4 className="text-3xl font-extrabold text-white tracking-tight">
                  {stats.totalCustomers}
                  <span className="text-sm font-medium text-slate-400 ml-1">명</span>
                </h4>
                <p className="text-[10px] text-slate-500">
                  보유고객 {stats.activeCustomers}명 · 가망고객 {stats.leadCustomers}명
                </p>
              </div>
              <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/20">
                <Users className="w-7 h-7" />
              </div>
            </div>

            {/* KPI 3: Schedules */}
            <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400">이번 달 등록 일정</span>
                <h4 className="text-3xl font-extrabold text-emerald-400 tracking-tight">
                  {stats.upcomingThisMonth}
                  <span className="text-sm font-medium text-emerald-400/80 ml-1">건</span>
                </h4>
                <p className="text-[10px] text-slate-500">
                  전체 {stats.totalSchedules}건 (진행중 {stats.pendingSchedules} / 완료 {stats.completedSchedules})
                </p>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20">
                <CalendarDays className="w-7 h-7" />
              </div>
            </div>
          </div>

          {/* 3. Navigation Tabs */}
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
            <button
              onClick={() => setActiveSubTab('longtouch')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
                activeSubTab === 'longtouch'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/60'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>🚨 장기미터치 고객 현황 ({stats.longTouchCustomers}명)</span>
            </button>

            <button
              onClick={() => setActiveSubTab('schedules')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
                activeSubTab === 'schedules'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/60'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>📅 월간 일정 관리 ({stats.totalSchedules}건)</span>
            </button>

            <button
              onClick={() => setActiveSubTab('all-customers')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
                activeSubTab === 'all-customers'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/60'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>👥 전체 고객 목록 ({stats.totalCustomers}명)</span>
            </button>
          </div>

          {/* 4. Tab Contents */}

          {/* TAB 1: Long-Touch Customers (Primary Focus) */}
          {activeSubTab === 'longtouch' && (
            <div className="space-y-4">
              <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="미터치 고객명, 연락처, 메모 검색..."
                    value={customerSearchFilter}
                    onChange={(e) => setCustomerSearchFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="text-xs text-rose-300 bg-rose-950/60 border border-rose-800/60 px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    <strong>{targetUser.name}</strong> 님의 장기 미접촉 고객입니다. 조속한 안부 연락 및 증권 분석 상담 터치를 권장합니다.
                  </span>
                </div>
              </div>

              <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                {filteredLongTouchCustomers.length === 0 ? (
                  <div className="p-16 text-center space-y-3">
                    <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400" />
                    <h4 className="text-base font-semibold text-slate-200">장기미터치 고객이 없습니다!</h4>
                    <p className="text-xs text-slate-400">
                      현재 모든 고객과 최근 6개월 이내 원활하게 상담 및 일정이 진행되고 있습니다.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="px-5 py-3.5">고객명 & 소개자</th>
                          <th className="px-5 py-3.5">연락처 & 생년월일</th>
                          <th className="px-5 py-3.5">가입 보험 내역 (경과월수)</th>
                          <th className="px-5 py-3.5">마지막 접촉 / 미터치 기간</th>
                          <th className="px-5 py-3.5">메모 / 특이사항</th>
                          <th className="px-5 py-3.5 text-right">상세조회</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {filteredLongTouchCustomers.map((cust) => {
                          const insurances = Array.isArray(cust.insurances) ? cust.insurances : [];
                          return (
                            <tr key={cust.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="px-5 py-4">
                                <div className="space-y-1">
                                  <div className="font-bold text-white text-sm flex items-center space-x-1.5">
                                    <span>{cust.name}</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-950 text-rose-300 border border-rose-800/60">
                                      미터치
                                    </span>
                                  </div>
                                  {cust.referrer_name && (
                                    <div className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-[9px] font-medium">
                                      <UserCheck className="w-3 h-3 text-emerald-400" />
                                      <span>소개자: {cust.referrer_name}</span>
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td className="px-5 py-4">
                                <div className="space-y-1">
                                  {cust.phone && (
                                    <div className="flex items-center space-x-1 text-slate-300 font-mono">
                                      <Phone className="w-3 h-3 text-slate-500" />
                                      <span>{cust.phone}</span>
                                    </div>
                                  )}
                                  {cust.birth_date && (
                                    <div className="text-[10px] text-indigo-300">
                                      🎂 {cust.birth_date}
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td className="px-5 py-4">
                                <div className="space-y-1 max-w-xs">
                                  {insurances.length > 0 ? (
                                    insurances.map((ins, idx) => {
                                      const startStr = ins.startDate || ins.start_date;
                                      const elapsed = calculateElapsedMonths(startStr);
                                      return (
                                        <div key={idx} className="bg-slate-900 p-2 rounded-lg border border-slate-800 space-y-0.5">
                                          <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-300">
                                            <span className="flex items-center space-x-1">
                                              <Shield className="w-3 h-3 text-indigo-400" />
                                              <span>{ins.provider || cust.insurance_provider || '보험사'}</span>
                                            </span>
                                            {elapsed && (
                                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                                                {elapsed}개월차
                                              </span>
                                            )}
                                          </div>
                                          {ins.details && (
                                            <p className="text-[10px] text-slate-400 line-clamp-1">{ins.details}</p>
                                          )}
                                        </div>
                                      );
                                    })
                                  ) : cust.insurance_provider || cust.insurance_details ? (
                                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-[11px]">
                                      <span className="font-semibold text-indigo-300">{cust.insurance_provider}</span>
                                      <p className="text-[10px] text-slate-400 line-clamp-1">{cust.insurance_details}</p>
                                    </div>
                                  ) : (
                                    <span className="text-slate-600">-</span>
                                  )}
                                </div>
                              </td>

                              <td className="px-5 py-4">
                                <div className="space-y-1">
                                  <div className="text-rose-400 font-extrabold text-xs flex items-center space-x-1">
                                    <Clock className="w-3.5 h-3.5 text-rose-400" />
                                    <span>
                                      {cust.untouched_days !== null ? `${cust.untouched_days}일째 미접촉` : '일정 기록 없음'}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    최종 접촉: {cust.last_touched_at ? cust.last_touched_at.slice(0, 10) : '등록 시점'}
                                  </div>
                                </div>
                              </td>

                              <td className="px-5 py-4 max-w-xs">
                                <p className="text-[11px] text-slate-400 line-clamp-2">
                                  {cust.notes || '-'}
                                </p>
                              </td>

                              <td className="px-5 py-4 text-right">
                                <button
                                  onClick={() => openCustomerDetailModal(cust)}
                                  className="p-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-300 transition-all inline-flex items-center space-x-1 text-xs font-semibold"
                                  title="고객 상세 정보 및 3개년 일정 조회"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>상세</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Subordinate Schedule Calendar & List */}
          {activeSubTab === 'schedules' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Calendar (5 cols) */}
              <div className="lg:col-span-5 glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-white">
                    {year}년 {month + 1}월 일정 캘린더
                  </h4>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={handlePrevMonth}
                      className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleNextMonth}
                      className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-500">
                  {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                    <div key={i} className={i === 0 ? 'text-rose-400' : i === 6 ? 'text-blue-400' : ''}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-10 rounded-lg bg-slate-950/20" />
                  ))}

                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const daySchedules = getSchedulesForDay(day);
                    const selected = isSelectedDay(day);
                    const today = isToday(day);

                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedCalendarDate(new Date(year, month, day))}
                        className={`h-11 p-1 rounded-xl flex flex-col justify-between items-center transition-all border ${
                          selected
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-950/60 font-bold'
                            : today
                            ? 'bg-indigo-950/40 text-indigo-300 border-indigo-500/40 font-bold'
                            : 'bg-slate-900/60 hover:bg-slate-800 text-slate-300 border-slate-800/60'
                        }`}
                      >
                        <span className="text-[11px]">{day}</span>
                        {daySchedules.length > 0 && (
                          <span className={`text-[9px] px-1 rounded-full font-extrabold ${
                            selected ? 'bg-white text-indigo-900' : 'bg-indigo-500 text-white'
                          }`}>
                            {daySchedules.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Schedules List (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold text-xs text-white">
                      {selectedCalendarDate.getFullYear()}년 {selectedCalendarDate.getMonth() + 1}월 {selectedCalendarDate.getDate()}일 일정 목록
                    </span>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                      {selectedDaySchedules.length}건
                    </span>
                  </div>

                  <select
                    value={scheduleStatusFilter}
                    onChange={(e) => setScheduleStatusFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                  >
                    <option value="">전체 상태</option>
                    <option value="Pending">진행중 (예정)</option>
                    <option value="Completed">완료됨</option>
                  </select>
                </div>

                <div className="space-y-2.5">
                  {selectedDaySchedules.length === 0 ? (
                    <div className="glass-panel p-10 rounded-2xl border border-slate-800 text-center space-y-2">
                      <Clock className="w-8 h-8 mx-auto text-slate-600" />
                      <p className="text-xs text-slate-400 font-medium">선택된 날짜에 등록된 일정이 없습니다.</p>
                    </div>
                  ) : (
                    selectedDaySchedules.map((s) => (
                      <div
                        key={s.id}
                        className={`glass-panel p-3.5 rounded-2xl border transition-all ${
                          s.status === 'Completed'
                            ? 'border-slate-800/80 bg-slate-950/40 opacity-75'
                            : 'border-indigo-900/50 bg-slate-900/80'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                s.status === 'Completed'
                                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                                  : 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60'
                              }`}>
                                {s.status === 'Completed' ? '완료' : '진행중'}
                              </span>
                              <h5 className="font-bold text-sm text-white">{s.title}</h5>
                            </div>

                            {s.description && (
                              <p className="text-xs text-slate-400 pl-1">{s.description}</p>
                            )}

                            {s.customer_name && (
                              <div className="text-[11px] text-indigo-300 font-medium pl-1 flex items-center space-x-1">
                                <UserCheck className="w-3 h-3 text-indigo-400" />
                                <span>연동 고객: {s.customer_name} ({s.customer_phone || '-'})</span>
                              </div>
                            )}
                          </div>

                          <div className="text-right text-[11px] text-slate-400 font-mono">
                            <Clock className="w-3.5 h-3.5 text-slate-500 inline mr-1" />
                            {s.scheduled_at?.slice(11, 16) || '시간 미지정'}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: All Customers */}
          {activeSubTab === 'all-customers' && (
            <div className="space-y-4">
              <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div className="relative w-80">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="고객명, 연락처 검색..."
                    value={customerSearchFilter}
                    onChange={(e) => setCustomerSearchFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <span className="text-xs text-slate-400">
                  총 <strong className="text-white">{filteredAllCustomers.length}명</strong>의 고객 관리 중
                </span>
              </div>

              <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="px-5 py-3.5">고객명</th>
                        <th className="px-5 py-3.5">연락처</th>
                        <th className="px-5 py-3.5">생년월일</th>
                        <th className="px-5 py-3.5">주요 가입 보험사</th>
                        <th className="px-5 py-3.5">상태</th>
                        <th className="px-5 py-3.5 text-right">상세조회</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredAllCustomers.map((cust) => (
                        <tr key={cust.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-3.5 font-bold text-white">{cust.name}</td>
                          <td className="px-5 py-3.5 font-mono">{cust.phone || '-'}</td>
                          <td className="px-5 py-3.5 text-indigo-300">{cust.birth_date || '-'}</td>
                          <td className="px-5 py-3.5 font-semibold text-slate-300">{cust.insurance_provider || '-'}</td>
                          <td className="px-5 py-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              cust.status === 'Active' && !cust.is_long_touch
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : cust.status === 'Lead' && !cust.is_long_touch
                                ? 'bg-blue-950 text-blue-300 border-blue-800'
                                : 'bg-rose-950 text-rose-300 border-rose-800'
                            }`}>
                              {cust.is_long_touch ? '장기미터치고객' : cust.status === 'Active' ? '보유고객' : '가망고객'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => openCustomerDetailModal(cust)}
                              className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="glass-panel p-16 rounded-2xl border border-slate-800 text-center space-y-2">
          <Users className="w-12 h-12 mx-auto text-slate-600" />
          <p className="text-sm font-semibold text-slate-300">상단에서 조회할 하위 조직원을 선택해 주세요.</p>
        </div>
      )}
    </div>
  );
}
