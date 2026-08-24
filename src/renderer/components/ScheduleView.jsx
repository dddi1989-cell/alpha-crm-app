import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  flexRender,
  createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel
} from '@tanstack/react-table';
import {
  Calendar,
  CalendarDays,
  List,
  Search,
  Plus,
  Edit2,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Bell,
  Filter,
  User,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CalendarCheck
} from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';

const columnHelper = createColumnHelper();

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function ScheduleView() {
  const schedules = useCrmStore((state) => state.schedules);
  const openScheduleModal = useCrmStore((state) => state.openScheduleModal);
  const deleteSchedule = useCrmStore((state) => state.deleteSchedule);
  const toggleScheduleStatus = useCrmStore((state) => state.toggleScheduleStatus);

  const currentUser = useCrmStore((state) => state.currentUser);
  const scheduleViewScope = useCrmStore((state) => state.scheduleViewScope);
  const setScheduleViewScope = useCrmStore((state) => state.setScheduleViewScope);
  const selectedOrgFilter = useCrmStore((state) => state.selectedOrgFilter);
  const setSelectedOrgFilter = useCrmStore((state) => state.setSelectedOrgFilter);
  const organizations = useCrmStore((state) => state.organizations);
  const accessibleUsers = useCrmStore((state) => state.accessibleUsers);

  // View Mode: 'calendar' (기본 달력형) | 'list' (목록형)
  const [viewMode, setViewMode] = useState('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(formatDateKey(new Date()));

  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sorting, setSorting] = useState([]);

  // Client-side Strict Filter Guard
  const visibleSchedules = useMemo(() => {
    if (!Array.isArray(schedules)) return [];

    if (scheduleViewScope === 'personal') {
      const myId = currentUser ? Number(currentUser.id) : 1;
      return schedules.filter((s) => {
        const sOwnerId = s.user_id !== null && s.user_id !== undefined ? Number(s.user_id) : 1;
        return sOwnerId === myId;
      });
    }

    // Organization Scope
    if (!selectedOrgFilter) {
      return schedules; // 전체 하위 조직 포함
    }

    // User-specific Filter (e.g. 'user:3')
    if (selectedOrgFilter.startsWith('user:')) {
      const targetUid = Number(selectedOrgFilter.replace('user:', ''));
      return schedules.filter((s) => Number(s.user_id) === targetUid);
    }

    // Sub-Organization Filter
    return schedules.filter((s) => {
      if (s.org_id && String(s.org_id) === String(selectedOrgFilter)) return true;
      if (s.user_org_name && String(s.user_org_name) === String(selectedOrgFilter)) return true;
      return false;
    });
  }, [schedules, scheduleViewScope, selectedOrgFilter, currentUser]);

  const filteredData = useMemo(() => {
    let list = visibleSchedules;
    if (statusFilter) {
      list = list.filter(s => s.status === statusFilter);
    }
    if (globalFilter) {
      const term = globalFilter.toLowerCase();
      list = list.filter(s =>
        (s.title && s.title.toLowerCase().includes(term)) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(term)) ||
        (s.user_name && s.user_name.toLowerCase().includes(term)) ||
        (s.description && s.description.toLowerCase().includes(term))
      );
    }
    return list;
  }, [visibleSchedules, statusFilter, globalFilter]);

  // ----------------------------------------------------
  // Calendar Calculations
  // ----------------------------------------------------
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday

  const prevMonthDays = new Date(year, month, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  const handleToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDateStr(formatDateKey(today));
  };

  // Group schedules by date key (YYYY-MM-DD)
  const schedulesByDate = useMemo(() => {
    const map = new Map();
    visibleSchedules.forEach((s) => {
      let dateKey = '';
      if (s.date) {
        dateKey = s.date.slice(0, 10);
      } else if (s.scheduled_at) {
        const d = new Date(s.scheduled_at);
        if (!isNaN(d.getTime())) {
          dateKey = formatDateKey(d);
        }
      }
      if (dateKey) {
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey).push(s);
      }
    });

    // Sort schedules inside each date by time
    map.forEach((list) => {
      list.sort((a, b) => {
        const tA = a.time || (a.scheduled_at ? a.scheduled_at.slice(11, 16) : '00:00');
        const tB = b.time || (b.scheduled_at ? b.scheduled_at.slice(11, 16) : '00:00');
        return tA.localeCompare(tB);
      });
    });

    return map;
  }, [visibleSchedules]);

  // Selected date schedule list
  const selectedDateSchedules = useMemo(() => {
    return schedulesByDate.get(selectedDateStr) || [];
  }, [schedulesByDate, selectedDateStr]);

  // Total this month stats
  const monthStats = useMemo(() => {
    let total = 0;
    let pending = 0;
    let completed = 0;
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;

    visibleSchedules.forEach(s => {
      const sDate = s.date || (s.scheduled_at ? s.scheduled_at.slice(0, 10) : '');
      if (sDate.startsWith(prefix)) {
        total++;
        if (s.status === 'Completed') completed++;
        else if (s.status === 'Pending') pending++;
      }
    });

    return { total, pending, completed };
  }, [visibleSchedules, year, month]);

  // ----------------------------------------------------
  // TanStack Table Setup for List Mode
  // ----------------------------------------------------
  const columns = useMemo(
    () => [
      columnHelper.accessor('status', {
        header: '상태',
        cell: (info) => {
          const schedule = info.row.original;
          const isOwner = !currentUser || !schedule.user_id || Number(schedule.user_id) === Number(currentUser.id) || Number(currentUser.id) === 1;
          const eventTime = new Date(schedule.scheduled_at);
          const isPast = eventTime < new Date() && schedule.status === 'Pending';

          return (
            <button
              onClick={() => {
                if (!isOwner) {
                  alert('본인이 등록한 일정만 상태를 변경할 수 있습니다.');
                  return;
                }
                toggleScheduleStatus(schedule);
              }}
              className={`p-2 rounded-xl border transition-all ${
                schedule.status === 'Completed'
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60'
                  : schedule.status === 'Cancelled'
                  ? 'bg-slate-900 text-slate-500 border-slate-800'
                  : isPast
                  ? 'bg-amber-950/80 text-amber-400 border-amber-700/60 animate-pulse'
                  : 'bg-indigo-950/80 text-indigo-400 border-indigo-700/60 hover:bg-indigo-600 hover:text-white'
              }`}
              title={isOwner ? "상태 전환 (완료 / 대기)" : "타 조직원 일정 (조회 전용)"}
            >
              {schedule.status === 'Completed' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : schedule.status === 'Cancelled' ? (
                <XCircle className="w-4 h-4" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
            </button>
          );
        }
      }),
      columnHelper.accessor('title', {
        header: '일정 제목 & 대상',
        cell: (info) => {
          const schedule = info.row.original;
          return (
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                {schedule.user_name && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold flex items-center space-x-1">
                    <User className="w-3 h-3 text-indigo-400" />
                    <span>{schedule.user_name}</span>
                  </span>
                )}
                <span className={`font-semibold text-sm ${
                  schedule.status === 'Completed' ? 'line-through text-slate-500' : 'text-white'
                }`}>
                  {schedule.title}
                </span>
                {schedule.customer_name && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center space-x-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>{schedule.customer_name}</span>
                  </span>
                )}
              </div>
              {schedule.description && (
                <p className="text-xs text-slate-400 max-w-lg line-clamp-1">{schedule.description}</p>
              )}
            </div>
          );
        }
      }),
      columnHelper.accessor('scheduled_at', {
        header: '일시 및 미리 알림',
        cell: (info) => {
          const schedule = info.row.original;
          const eventTime = new Date(schedule.scheduled_at);
          const offset = Number(schedule.reminder_offset_minutes) || 0;

          return (
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-sm text-slate-200 font-medium">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>
                  {isNaN(eventTime.getTime()) ? schedule.scheduled_at : eventTime.toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  })}
                </span>
              </div>
              {schedule.reminder_enabled ? (
                <div className="flex items-center space-x-1 text-xs text-indigo-300">
                  <Bell className="w-3 h-3" />
                  <span>
                    {offset === 0 ? '정시 알림' : offset < 60 ? `${offset}분 전` : `${Math.floor(offset / 60)}시간 전`} 알림 예약됨
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-600">알림 꺼짐</span>
              )}
            </div>
          );
        }
      }),
      columnHelper.display({
        id: 'actions',
        header: '관리',
        cell: (info) => {
          const schedule = info.row.original;
          const isOwner = !currentUser || !schedule.user_id || Number(schedule.user_id) === Number(currentUser.id) || Number(currentUser.id) === 1;

          if (!isOwner) {
            return (
              <span className="text-xs text-slate-500 italic">조회 전용</span>
            );
          }

          return (
            <div className="flex items-center space-x-1">
              <button
                onClick={() => openScheduleModal(schedule)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="일정 수정"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => deleteSchedule(schedule.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                title="일정 삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        }
      })
    ],
    [currentUser, deleteSchedule, openScheduleModal, toggleScheduleStatus]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      globalFilter,
      sorting
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10
      }
    }
  });

  const todayStr = formatDateKey(new Date());

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-['Outfit',sans-serif] text-2xl font-bold tracking-tight text-white flex items-center space-x-2.5">
            <Calendar className="w-7 h-7 text-indigo-400" />
            <span>일정 관리</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            월간 캘린더를 통해 상담 및 미팅 일정을 확인하고 체계적으로 관리하세요.
          </p>
        </div>

        {/* Right Controls: View Switcher & New Button */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle: Calendar vs List */}
          <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center text-xs font-semibold">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'calendar'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>캘린더 뷰</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'list'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
              <span>리스트 뷰</span>
            </button>
          </div>

          {/* Scope Selector: Personal vs Org */}
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setScheduleViewScope('personal')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                scheduleViewScope === 'personal'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              내 일정
            </button>
            <button
              onClick={() => setScheduleViewScope('org')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                scheduleViewScope === 'org'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              조직 전체 일정
            </button>
          </div>

          {scheduleViewScope === 'org' && (
            <div className="flex items-center space-x-2">
              <select
                value={selectedOrgFilter}
                onChange={(e) => setSelectedOrgFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="">전체 하위 조직 및 조직원</option>
                {organizations.length > 0 && (
                  <optgroup label="조직 단위">
                    {organizations.map((o) => (
                      <option key={`org-${o.id}`} value={o.id}>
                        🏢 {o.name}
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

          <button
            onClick={() => openScheduleModal(null, { date: selectedDateStr })}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-lg shadow-indigo-600/25 flex items-center space-x-2 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>새 일정 등록</span>
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 1. CALENDAR VIEW (기본 달력 형태) */}
      {/* ==================================================== */}
      {viewMode === 'calendar' && (
        <div className="space-y-6">
          {/* Monthly Navigation & Quick Stats */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
                title="이전 달"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="font-['Outfit',sans-serif] text-xl font-bold text-white tracking-tight min-w-[140px] text-center">
                {year}년 {month + 1}월
              </h3>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
                title="다음 달"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={handleToday}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-indigo-400 font-bold text-xs border border-slate-800 transition-colors"
              >
                오늘
              </button>
            </div>

            {/* Monthly KPI */}
            <div className="flex items-center space-x-4 text-xs font-semibold">
              <span className="text-slate-400">
                이번 달 총 일정: <strong className="text-white text-sm">{monthStats.total}</strong>건
              </span>
              <span className="text-indigo-400">
                진행 대기: <strong className="text-indigo-300 text-sm">{monthStats.pending}</strong>건
              </span>
              <span className="text-emerald-400">
                완료: <strong className="text-emerald-300 text-sm">{monthStats.completed}</strong>건
              </span>
            </div>
          </div>

          {/* Calendar Grid & Selected Day Schedule Panel (Grid layout) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Monthly Calendar Grid */}
            <div className="lg:col-span-2 glass-panel rounded-2xl border border-slate-800 p-4 shadow-xl flex flex-col">
              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs py-2 border-b border-slate-800 text-slate-400 mb-2">
                <div className="text-rose-400">일</div>
                <div>월</div>
                <div>화</div>
                <div>수</div>
                <div>목</div>
                <div>금</div>
                <div className="text-blue-400">토</div>
              </div>

              {/* Day Cells Grid */}
              <div className="grid grid-cols-7 gap-1.5 flex-1 auto-rows-fr">
                {/* Empty slots for previous month */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => {
                  const prevDayNum = prevMonthDays - firstDayOfWeek + i + 1;
                  return (
                    <div
                      key={`prev-${i}`}
                      className="min-h-[85px] p-1.5 rounded-xl bg-slate-950/30 border border-slate-900 text-slate-600 text-xs flex flex-col opacity-40 select-none"
                    >
                      <span className="font-medium text-[11px]">{prevDayNum}</span>
                    </div>
                  );
                })}

                {/* Days of current month */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateObj = new Date(year, month, dayNum);
                  const dayOfWeek = dateObj.getDay();
                  const dateStr = formatDateKey(dateObj);
                  const daySchedules = schedulesByDate.get(dateStr) || [];
                  const isCurrentDay = dateStr === todayStr;
                  const isSelected = dateStr === selectedDateStr;

                  return (
                    <div
                      key={`day-${dayNum}`}
                      onClick={() => setSelectedDateStr(dateStr)}
                      className={`min-h-[90px] p-1.5 rounded-xl border flex flex-col justify-between transition-all cursor-pointer select-none group relative ${
                        isSelected
                          ? 'bg-indigo-950/50 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                          : isCurrentDay
                          ? 'bg-slate-900/90 border-indigo-600/80'
                          : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Date Header */}
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                            isCurrentDay
                              ? 'bg-indigo-600 text-white font-extrabold shadow'
                              : dayOfWeek === 0
                              ? 'text-rose-400'
                              : dayOfWeek === 6
                              ? 'text-blue-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {dayNum}
                        </span>

                        {daySchedules.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                            {daySchedules.length}
                          </span>
                        )}
                      </div>

                      {/* Schedule Chips inside cell */}
                      <div className="space-y-1 overflow-hidden flex-1">
                        {daySchedules.slice(0, 2).map((s) => {
                          const isCompleted = s.status === 'Completed';
                          const timeStr = s.time || (s.scheduled_at ? s.scheduled_at.slice(11, 16) : '');

                          return (
                            <div
                              key={s.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                openScheduleModal(s);
                              }}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium truncate flex items-center space-x-1 border transition-transform hover:scale-[1.02] ${
                                isCompleted
                                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60 line-through opacity-70'
                                  : 'bg-indigo-950/90 text-indigo-200 border-indigo-800/70 hover:bg-indigo-900'
                              }`}
                              title={`${timeStr ? `[${timeStr}] ` : ''}${s.customer_name ? `(${s.customer_name}) ` : ''}${s.title}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-current"></span>
                              {timeStr && <span className="font-mono text-[9px] opacity-80">{timeStr}</span>}
                              <span className="truncate">{s.customer_name ? `${s.customer_name}: ` : ''}{s.title}</span>
                            </div>
                          );
                        })}

                        {daySchedules.length > 2 && (
                          <div className="text-[9px] text-slate-400 font-bold pl-1">
                            +{daySchedules.length - 2}개 더보기
                          </div>
                        )}
                      </div>

                      {/* Quick Add Button on Hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openScheduleModal(null, { date: dateStr });
                        }}
                        className="absolute right-1 bottom-1 opacity-0 group-hover:opacity-100 p-1 rounded bg-indigo-600 text-white hover:bg-indigo-500 transition-opacity shadow"
                        title="이 날짜에 새 일정 추가"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 1 Col: Selected Date Schedule Detail Panel */}
            <div className="glass-panel rounded-2xl border border-slate-800 p-5 shadow-xl flex flex-col justify-between space-y-4 bg-gradient-to-b from-slate-900/90 to-slate-950/90">
              <div className="space-y-4 flex-1">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">선택된 일자</span>
                    <h4 className="text-lg font-extrabold text-white flex items-center space-x-2 mt-0.5">
                      <CalendarCheck className="w-5 h-5 text-indigo-400" />
                      <span>{selectedDateStr}</span>
                    </h4>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    총 {selectedDateSchedules.length}건
                  </span>
                </div>

                {/* Schedule Items for Selected Date */}
                {selectedDateSchedules.length === 0 ? (
                  <div className="p-8 text-center space-y-3 my-auto">
                    <Clock className="w-10 h-10 mx-auto text-slate-600" />
                    <p className="text-sm font-semibold text-slate-300">이 날짜에 등록된 일정이 없습니다</p>
                    <p className="text-xs text-slate-500">
                      고객 미팅, 증권 전달, 상담 일정 등을 추가하여 관리해 보세요.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                    {selectedDateSchedules.map((s) => {
                      const isCompleted = s.status === 'Completed';
                      const isOwner = !currentUser || !s.user_id || Number(s.user_id) === Number(currentUser.id) || Number(currentUser.id) === 1;
                      const timeStr = s.time || (s.scheduled_at ? s.scheduled_at.slice(11, 16) : '');

                      return (
                        <div
                          key={s.id}
                          className={`p-3 rounded-xl border transition-all space-y-2 ${
                            isCompleted
                              ? 'bg-slate-950/60 border-slate-800/80 opacity-75'
                              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start space-x-2">
                              <button
                                onClick={() => {
                                  if (!isOwner) {
                                    alert('본인이 등록한 일정만 상태를 변경할 수 있습니다.');
                                    return;
                                  }
                                  toggleScheduleStatus(s);
                                }}
                                className={`mt-0.5 p-1 rounded-lg border transition-colors ${
                                  isCompleted
                                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-indigo-600 hover:text-white'
                                }`}
                                title={isCompleted ? "완료됨 (클릭 시 대기 전환)" : "대기 중 (클릭 시 완료 전환)"}
                              >
                                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                              </button>

                              <div>
                                <h5 className={`text-sm font-bold ${isCompleted ? 'line-through text-slate-500' : 'text-white'}`}>
                                  {s.title}
                                </h5>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-slate-400">
                                  {timeStr && (
                                    <span className="font-mono text-indigo-300 font-semibold bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/60">
                                      ⏰ {timeStr}
                                    </span>
                                  )}
                                  {s.customer_name && (
                                    <span className="text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                                      👤 {s.customer_name}
                                    </span>
                                  )}
                                  {s.user_name && (
                                    <span className="text-indigo-400 text-[11px]">
                                      (담당: {s.user_name})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {isOwner && (
                              <div className="flex items-center space-x-1 shrink-0">
                                <button
                                  onClick={() => openScheduleModal(s)}
                                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                                  title="수정"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteSchedule(s.id)}
                                  className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                                  title="삭제"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          {s.description && (
                            <p className="text-xs text-slate-400 bg-slate-950/40 p-2 rounded-lg border border-slate-800/60 line-clamp-2">
                              {s.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom Action: Add for this date */}
              <button
                onClick={() => openScheduleModal(null, { date: selectedDateStr })}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-indigo-950 transition-all hover:scale-[1.01]"
              >
                <Plus className="w-4 h-4" />
                <span>+ 이 날짜({selectedDateStr})에 일정 추가</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. LIST VIEW (목록형 뷰) */}
      {/* ==================================================== */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="일정 제목 또는 고객 이름 검색..."
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="">전체 상태</option>
                <option value="Pending">대기 중 (Pending)</option>
                <option value="Completed">완료됨 (Completed)</option>
                <option value="Cancelled">취소됨 (Cancelled)</option>
              </select>
            </div>
          </div>

          {/* TanStack Schedule Data Table */}
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            {table.getRowModel().rows.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <Calendar className="w-12 h-12 mx-auto text-slate-600 stroke-[1.5]" />
                <h4 className="text-base font-semibold text-slate-300">등록된 일정 항목이 없습니다</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {schedules.length === 0
                    ? '등록된 알림 일정이 없습니다. "+ 새 일정 등록" 버튼을 눌러 일정을 등록해 보세요.'
                    : '검색 조건과 일치하는 일정 항목이 없습니다.'}
                </p>
                {schedules.length === 0 && (
                  <button
                    onClick={() => openScheduleModal()}
                    className="mt-2 bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all"
                  >
                    + 첫 일정 추가하기
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 font-semibold border-b border-slate-800">
                      {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <th
                              key={header.id}
                              className="px-6 py-4 cursor-pointer select-none hover:text-white"
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              <div className="flex items-center space-x-1.5">
                                <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                                {header.column.getCanSort() && (
                                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {table.getRowModel().rows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="px-6 py-4">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-900/40">
                  <div className="flex items-center space-x-2">
                    <span>페이지당</span>
                    <select
                      value={table.getState().pagination.pageSize}
                      onChange={(e) => table.setPageSize(Number(e.target.value))}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white focus:outline-none"
                    >
                      {[10, 20, 30, 50].map((pageSize) => (
                        <option key={pageSize} value={pageSize}>
                          {pageSize}개씩 보기
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center space-x-4">
                    <span>
                      총 <strong className="text-slate-200">{filteredData.length}</strong>건 중{' '}
                      {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} -{' '}
                      {Math.min(
                        (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                        filteredData.length
                      )}
                      건
                    </span>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="font-semibold text-slate-300 px-1">
                        {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
                      </span>
                      <button
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
