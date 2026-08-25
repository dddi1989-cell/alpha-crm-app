import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  User,
  Users,
  MapPin,
  AlertCircle,
  Cake,
  Sparkles,
  Phone,
  MessageSquare
} from 'lucide-react';
import { isCustomerBirthdayOnDate } from '../../utils/lunarSolar';

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_LIST = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function MobileScheduleView({
  schedules = [],
  customers = [],
  visibleSchedules = [],
  visibleCustomers = [],
  currentDate,
  setCurrentDate,
  selectedDateStr,
  setSelectedDateStr,
  openScheduleModal,
  toggleScheduleStatus,
  deleteSchedule,
  currentUser,
  scheduleViewScope,
  setScheduleViewScope,
  selectedOrgFilter,
  setSelectedOrgFilter,
  organizations = [],
  accessibleUsers = []
}) {
  const todayStr = useMemo(() => formatDateKey(new Date()), []);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Selected Date Object & Formatted Label
  const selectedDateObj = useMemo(() => {
    if (!selectedDateStr) return new Date();
    const parts = selectedDateStr.split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }, [selectedDateStr]);

  const selectedDateDayOfWeek = selectedDateObj.getDay();
  const selectedDayName = WEEK_DAYS[selectedDateDayOfWeek];

  // Calendar Calculation
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  // Map schedules by date
  const schedulesByDate = useMemo(() => {
    const map = new Map();
    visibleSchedules.forEach((s) => {
      let dateKey = s.date;
      if (!dateKey && s.scheduled_at) {
        dateKey = s.scheduled_at.slice(0, 10);
      }
      if (dateKey) {
        if (!map.has(dateKey)) map.set(dateKey, []);
        map.get(dateKey).push(s);
      }
    });

    // Sort by time within each date
    map.forEach((list) => {
      list.sort((a, b) => {
        const timeA = a.time || (a.scheduled_at ? a.scheduled_at.slice(11, 16) : '99:99');
        const timeB = b.time || (b.scheduled_at ? b.scheduled_at.slice(11, 16) : '99:99');
        return timeA.localeCompare(timeB);
      });
    });

    return map;
  }, [visibleSchedules]);

  // Selected date's schedules
  const selectedDateSchedules = useMemo(() => {
    return schedulesByDate.get(selectedDateStr) || [];
  }, [schedulesByDate, selectedDateStr]);

  // Selected date's birthdays
  const selectedDateBirthdays = useMemo(() => {
    const d = selectedDateObj.getDate();
    return visibleCustomers.filter((c) => isCustomerBirthdayOnDate(c, year, month, d));
  }, [visibleCustomers, year, month, selectedDateObj]);

  // Navigation handlers
  const handlePrevMonth = () => {
    const newD = new Date(year, month - 1, 1);
    setCurrentDate(newD);
    setSelectedDateStr(formatDateKey(newD));
  };

  const handleNextMonth = () => {
    const newD = new Date(year, month + 1, 1);
    setCurrentDate(newD);
    setSelectedDateStr(formatDateKey(newD));
  };

  const handleSelectMonth = (mIndex) => {
    const newD = new Date(year, mIndex, 1);
    setCurrentDate(newD);
    setSelectedDateStr(formatDateKey(newD));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDateStr(todayStr);
  };

  // Map accessible users for reliable fallback lookup
  const userMap = useMemo(() => {
    const map = new Map();
    if (Array.isArray(accessibleUsers)) {
      accessibleUsers.forEach((u) => map.set(Number(u.id), u));
    }
    return map;
  }, [accessibleUsers]);

  const getPlannerInfo = (schedule) => {
    const u = schedule.user_id ? userMap.get(Number(schedule.user_id)) : null;
    const name = schedule.user_name || u?.name || '담당 설계사';
    const role = schedule.user_role || u?.role || 'FA';
    const org = schedule.user_org_name || u?.org_name || '';
    return { name, role, org };
  };

  return (
    <div className="flex flex-col h-full space-y-4 pb-24 select-none">
      
      {/* 1. Top Header: Year/Month Selector & Scope Chips */}
      <div className="glass-panel p-3.5 rounded-2xl border border-slate-800 space-y-3 shadow-lg bg-slate-900/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 active:scale-95 transition-all"
              title="이전 달"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="font-['Outfit',sans-serif] text-base font-black text-white tracking-tight">
              {year}년 {month + 1}월
            </h3>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 active:scale-95 transition-all"
              title="다음 달"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 rounded-xl bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white font-extrabold text-xs border border-indigo-500/40 transition-all active:scale-95"
            >
              오늘
            </button>
          </div>

          {/* Scope Toggle Button (내 일정 vs 조직 전체) */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setScheduleViewScope('personal')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                scheduleViewScope === 'personal'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              내 일정
            </button>
            <button
              onClick={() => setScheduleViewScope('org')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
                scheduleViewScope === 'org'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>조직</span>
            </button>
          </div>
        </div>

        {/* 2. Month Quick Jump Chips (Google Calendar Style) */}
        <div className="flex items-center space-x-1.5 overflow-x-auto custom-scrollbar pb-1 pt-0.5">
          {MONTHS_LIST.map((mNum, idx) => {
            const isCurMonth = month === idx;
            return (
              <button
                key={`m-${mNum}`}
                onClick={() => handleSelectMonth(idx)}
                className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all ${
                  isCurMonth
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
                }`}
              >
                {mNum}월
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Google Calendar Style Compact Dot Calendar */}
      <div className="glass-panel p-3.5 rounded-2xl border border-slate-800 shadow-xl bg-slate-900/40">
        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 gap-1 text-center font-extrabold text-xs py-1.5 border-b border-slate-800/80 text-slate-400 mb-2">
          <div className="text-rose-400">일</div>
          <div>월</div>
          <div>화</div>
          <div>수</div>
          <div>목</div>
          <div>금</div>
          <div className="text-blue-400">토</div>
        </div>

        {/* Day Numbers Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty slots for previous month */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => {
            const prevDayNum = prevMonthDays - firstDayOfWeek + i + 1;
            return (
              <div
                key={`prev-${i}`}
                className="h-11 flex flex-col items-center justify-center text-slate-600 text-xs opacity-30 select-none"
              >
                <span>{prevDayNum}</span>
              </div>
            );
          })}

          {/* Current Month Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateObj = new Date(year, month, dayNum);
            const dayOfWeek = dateObj.getDay();
            const dateStr = formatDateKey(dateObj);
            const daySchedules = schedulesByDate.get(dateStr) || [];
            const dayBirthdays = visibleCustomers.filter((c) =>
              isCustomerBirthdayOnDate(c, year, month, dayNum)
            );
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDateStr;

            const hasSchedule = daySchedules.length > 0;
            const hasBirthday = dayBirthdays.length > 0;

            return (
              <button
                key={`day-${dayNum}`}
                type="button"
                onClick={() => setSelectedDateStr(dateStr)}
                className={`h-11 rounded-2xl flex flex-col items-center justify-center relative transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-600/40 ring-2 ring-blue-400'
                    : isToday
                    ? 'bg-slate-800 border border-indigo-500/80 text-indigo-300 font-black'
                    : 'hover:bg-slate-800/60 text-slate-200'
                }`}
              >
                {/* Day Number */}
                <span
                  className={`text-sm ${
                    isSelected
                      ? 'text-white'
                      : isToday
                      ? 'text-indigo-300'
                      : dayOfWeek === 0
                      ? 'text-rose-400'
                      : dayOfWeek === 6
                      ? 'text-blue-400'
                      : 'text-slate-200'
                  }`}
                >
                  {dayNum}
                </span>

                {/* Dot Indicators underneath (Google Calendar Style) */}
                <div className="flex items-center space-x-0.5 h-1.5 mt-0.5">
                  {hasBirthday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400"></span>
                  )}
                  {hasSchedule && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-amber-300' : 'bg-blue-400'
                      }`}
                    ></span>
                  )}
                  {daySchedules.length > 1 && (
                    <span
                      className={`w-1 h-1 rounded-full ${
                        isSelected ? 'bg-white' : 'bg-indigo-300'
                      }`}
                    ></span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Bottom Selected Day Schedule Agenda / Timeline List */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 shadow-2xl bg-gradient-to-b from-slate-900/90 to-[#0c1220] space-y-4">
        {/* Selected Date Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex flex-col items-center justify-center font-black shadow-md">
              <span className="text-[10px] leading-tight font-medium opacity-90">
                {selectedDayName}
              </span>
              <span className="text-base leading-tight font-extrabold">
                {selectedDateObj.getDate()}
              </span>
            </div>
            <div>
              <h4 className="text-base font-black text-white tracking-tight">
                {selectedDateStr} ({selectedDayName}요일)
              </h4>
              <p className="text-xs text-slate-400 font-medium">
                일정 {selectedDateSchedules.length}건
                {selectedDateBirthdays.length > 0 && ` · 생일 ${selectedDateBirthdays.length}명`}
              </p>
            </div>
          </div>

          <button
            onClick={() => openScheduleModal(null, { date: selectedDateStr })}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center space-x-1 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>일정 추가</span>
          </button>
        </div>

        {/* Birthday Banner if any */}
        {selectedDateBirthdays.length > 0 && (
          <div className="space-y-2">
            {selectedDateBirthdays.map((c) => (
              <div
                key={`bday-${c.id}`}
                className="p-3 rounded-2xl bg-gradient-to-r from-pink-950/70 to-purple-950/70 border border-pink-500/40 flex items-center justify-between shadow-sm animate-fadeIn"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-pink-900/80 border border-pink-500/50 flex items-center justify-center text-pink-200 text-base">
                    🎂
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-black text-sm text-pink-200">{c.name} 고객님</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-pink-900 text-pink-300 rounded font-bold">
                        생일 ({c.birth_type === 'lunar' ? '음력' : '양력'})
                      </span>
                    </div>
                    <p className="text-xs text-pink-300/80 font-mono mt-0.5">
                      {c.phone || '연락처 미등록'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5">
                  {c.phone && (
                    <a
                      href={`tel:${c.phone.replace(/[^0-9]/g, '')}`}
                      className="p-2 rounded-xl bg-pink-900/90 text-pink-200 border border-pink-700 flex items-center justify-center"
                      title="생일 축하 통화"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() =>
                      openScheduleModal(null, {
                        date: selectedDateStr,
                        customer_id: c.id,
                        title: `🎂 [생일축하] ${c.name} 고객님 안부 연락`
                      })
                    }
                    className="px-2.5 py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-black shadow-sm"
                  >
                    축하등록
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Schedule Cards Stack (Handles same-time overlapping schedules cleanly) */}
        {selectedDateSchedules.length === 0 && selectedDateBirthdays.length === 0 ? (
          <div className="py-10 text-center space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-500 mx-auto">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-300">등록된 일정이 없습니다.</p>
            <p className="text-xs text-slate-500">
              우측 하단 '+' 버튼 또는 상단 [일정 추가]를 눌러 새 일정을 등록해 보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedDateSchedules.map((s) => {
              const isCompleted = s.status === 'Completed';
              const isBroadcast = s.is_broadcast === 1;
              const timeStr = s.time || (s.scheduled_at ? s.scheduled_at.slice(11, 16) : '');
              const planner = getPlannerInfo(s);

              return (
                <div
                  key={s.id}
                  onClick={() => openScheduleModal(s)}
                  className={`p-4 rounded-2xl border transition-all active:scale-[0.99] flex flex-col justify-between space-y-3 cursor-pointer shadow-md ${
                    isCompleted
                      ? 'bg-slate-900/60 border-slate-800/80 opacity-75'
                      : isBroadcast
                      ? 'bg-amber-950/40 border-amber-500/50 shadow-amber-950/40'
                      : 'bg-slate-900/90 border-slate-700/80 hover:border-indigo-500/60'
                  }`}
                >
                  {/* Top: Time, Planner Badge & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div
                        className={`px-2.5 py-1 rounded-xl text-xs font-mono font-black flex items-center space-x-1 ${
                          timeStr
                            ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/60'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{timeStr || '시간 미지정'}</span>
                      </div>

                      {/* 👤 담당자 선명 배지 */}
                      <div className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-purple-950/80 text-purple-200 border border-purple-800/80 text-xs font-black shadow-sm">
                        <User className="w-3.5 h-3.5 text-purple-400" />
                        <span>{planner.name}</span>
                        <span className="text-[10px] text-purple-300/80 font-bold">({planner.role})</span>
                      </div>

                      {isBroadcast && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 border border-amber-700 text-[10px] font-black">
                          📢 조직공지
                        </span>
                      )}

                      {s.type && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                          {s.type}
                        </span>
                      )}
                    </div>

                    {/* Quick Toggle Status Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleScheduleStatus(s.id);
                      }}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center space-x-1 border transition-all shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700/80'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      <CheckCircle2 className={`w-3.5 h-3.5 ${isCompleted ? 'text-emerald-400' : 'text-slate-500'}`} />
                      <span>{isCompleted ? '완료됨' : '미완료'}</span>
                    </button>
                  </div>

                  {/* Title & Customer */}
                  <div>
                    <h5
                      className={`text-base font-black tracking-tight ${
                        isCompleted ? 'text-slate-400 line-through' : 'text-white'
                      }`}
                    >
                      {s.title}
                    </h5>

                    {s.customer_name && (
                      <div className="flex items-center space-x-1.5 text-xs text-indigo-300 font-bold mt-1">
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                        <span>고객: {s.customer_name}</span>
                        {s.customer_phone && (
                          <span className="text-slate-400 font-mono">({s.customer_phone})</span>
                        )}
                      </div>
                    )}

                    {s.location && (
                      <div className="flex items-center space-x-1 text-xs text-slate-400 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span>{s.location}</span>
                      </div>
                    )}

                    {s.description && (
                      <p className="text-xs text-slate-300/90 mt-1.5 line-clamp-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                        {s.description}
                      </p>
                    )}
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/60 text-xs">
                    <div className="flex items-center space-x-1 text-slate-400 text-xs font-semibold">
                      <span className="text-slate-500">소속:</span>
                      <span className="text-slate-300 font-bold">{planner.org || 'WLB 본부'}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openScheduleModal(s);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center space-x-1 text-[11px] font-bold"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>수정</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`'${s.title}' 일정을 삭제하시겠습니까?`)) {
                            deleteSchedule(s.id);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-red-950/50 text-red-300 hover:bg-red-900 border border-red-800/60 flex items-center space-x-1 text-[11px] font-bold"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>삭제</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Google Calendar Floating Action Button (FAB) at Bottom Right */}
      <button
        onClick={() => openScheduleModal(null, { date: selectedDateStr })}
        className="fixed right-5 bottom-20 z-30 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-90 text-white shadow-2xl shadow-blue-600/60 flex items-center justify-center transition-all border-2 border-blue-400"
        title="새 일정 추가"
      >
        <Plus className="w-7 h-7" />
      </button>
    </div>
  );
}
