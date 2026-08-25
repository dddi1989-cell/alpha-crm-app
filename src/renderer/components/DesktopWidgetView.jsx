import React, { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, Clock, CheckCircle2, X, RefreshCw, ChevronLeft, ChevronRight, User, Pin, Sliders, Plus, Edit3, Trash2, Save } from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';
import { api } from '../utils/api';
import { getDescendantOrgAndUserIds, matchesOrgFilter } from '../utils/orgHierarchy';
import { isCustomerBirthdayOnDate } from '../utils/lunarSolar';

export default function DesktopWidgetView() {
  const schedules = useCrmStore((state) => state.schedules);
  const customers = useCrmStore((state) => state.customers);
  const loadAllData = useCrmStore((state) => state.loadAllData);
  const toggleScheduleStatus = useCrmStore((state) => state.toggleScheduleStatus);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('calendar');
  const [isPinned, setIsPinned] = useState(true);
  const [opacity, setOpacity] = useState(0.95);
  const [showOpacitySlider, setShowOpacitySlider] = useState(false);

  // Schedule editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editorForm, setEditorForm] = useState({ title: '', scheduled_at: '', customer_id: '', memo: '' });

  // Date popup
  const [popupDate, setPopupDate] = useState(null);

  const applyOpacity = (val) => {
    setOpacity(val);
    if (api?.system?.setWindowOpacity) api.system.setWindowOpacity(val);
  };
  // Local cache for orgs & accessible users in widget
  const [localOrgs, setLocalOrgs] = useState([]);
  const [localUsers, setLocalUsers] = useState([]);

  const loadWidgetData = async () => {
    await loadAllData();
    try {
      const stored = typeof window !== 'undefined' ? (sessionStorage.getItem('alpha_crm_active_user') || localStorage.getItem('alpha_crm_active_user') || localStorage.getItem('wlb_active_user')) : null;
      const u = stored ? JSON.parse(stored) : null;
      const uid = u?.id || 1;

      const [orgsRes, usersRes] = await Promise.all([
        api.org?.getAllOrganizations ? api.org.getAllOrganizations(uid) : Promise.resolve({ organizations: [] }),
        api.users?.getAccessibleSubordinates ? api.users.getAccessibleSubordinates(uid) : Promise.resolve({ users: [] })
      ]);

      let orgsList = Array.isArray(orgsRes) ? orgsRes : (orgsRes?.organizations || []);
      let usersList = Array.isArray(usersRes) ? usersRes : (usersRes?.users || []);

      if (orgsList.length === 0 && api.org?.getAllOrganizations) {
        const fallbackOrgs = await api.org.getAllOrganizations(1);
        orgsList = Array.isArray(fallbackOrgs) ? fallbackOrgs : (fallbackOrgs?.organizations || []);
      }

      if (usersList.length === 0 && api.users?.getAll) {
        const fallbackUsers = await api.users.getAll();
        usersList = Array.isArray(fallbackUsers) ? fallbackUsers : (fallbackUsers?.users || []);
      }

      if (orgsList.length > 0) setLocalOrgs(orgsList);
      if (usersList.length > 0) setLocalUsers(usersList);
    } catch (e) {
      console.error('Widget org loading error:', e);
    }
  };

  useEffect(() => {
    loadWidgetData();
    const unsub1 = api.onSchedulesChanged ? api.onSchedulesChanged(() => loadWidgetData()) : null;
    const unsub2 = api.onScheduleDue ? api.onScheduleDue(() => loadWidgetData()) : null;
    return () => {
      if (unsub1) unsub1();
      if (unsub2) unsub2();
    };
  }, []);

  const handleTogglePin = async () => {
    const nextPin = !isPinned;
    setIsPinned(nextPin);
    if (api?.system?.setAlwaysOnTop) await api.system.setAlwaysOnTop(nextPin);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => { setCurrentDate(new Date(year, month - 1, 1)); setPopupDate(null); };
  const handleNextMonth = () => { setCurrentDate(new Date(year, month + 1, 1)); setPopupDate(null); };

  const isToday = (day) => {
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  };

  const currentUser = useCrmStore((state) => state.currentUser);
  const scheduleViewScope = useCrmStore((state) => state.scheduleViewScope);
  const setScheduleViewScope = useCrmStore((state) => state.setScheduleViewScope);
  const selectedOrgFilter = useCrmStore((state) => state.selectedOrgFilter);
  const setSelectedOrgFilter = useCrmStore((state) => state.setSelectedOrgFilter);
  const storeOrganizations = useCrmStore((state) => state.organizations);
  const storeAccessibleUsers = useCrmStore((state) => state.accessibleUsers);

  const effectiveOrgs = localOrgs.length > 0 ? localOrgs : (storeOrganizations || []);
  const effectiveUsers = localUsers.length > 0 ? localUsers : (storeAccessibleUsers || []);

  // Resolved hierarchy for selected organization filter
  const hierarchyInfo = useMemo(() => {
    if (scheduleViewScope === 'personal') return null;
    return getDescendantOrgAndUserIds(selectedOrgFilter, effectiveOrgs, effectiveUsers);
  }, [scheduleViewScope, selectedOrgFilter, effectiveOrgs, effectiveUsers]);

  // Client-side Strict Filter Guard
  const visibleSchedules = useMemo(() => {
    if (!Array.isArray(schedules)) return [];

    if (scheduleViewScope === 'personal') {
      const myId = currentUser ? Number(currentUser.id) : 1;
      return schedules.filter((s) => {
        const sOwnerId = s.user_id !== null && s.user_id !== undefined ? Number(s.user_id) : 1;
        if (sOwnerId === myId) return true;
        if (s.is_broadcast === 1) return true;
        return false;
      });
    }

    // Organization Scope (Includes all recursive descendants and broadcast notices)
    return schedules.filter((s) => matchesOrgFilter(s, hierarchyInfo) || s.is_broadcast === 1);
  }, [schedules, scheduleViewScope, hierarchyInfo, currentUser]);

  const getSchedulesForDay = (day) => visibleSchedules.filter((s) => {
    const dateStr = s.date || (s.scheduled_at ? s.scheduled_at.slice(0, 10) : '');
    if (!dateStr) return false;
    const parts = dateStr.split('-').map(Number);
    return parts[0] === year && parts[1] === (month + 1) && parts[2] === day;
  });

  const getBirthdaysForDay = (day) => {
    if (!Array.isArray(customers)) return [];
    return customers.filter(c => isCustomerBirthdayOnDate(c, year, month, day));
  };

  const getSchedulesForDate = (date) => {
    const targetY = date.getFullYear();
    const targetM = date.getMonth() + 1;
    const targetD = date.getDate();
    return visibleSchedules.filter((s) => {
      const dateStr = s.date || (s.scheduled_at ? s.scheduled_at.slice(0, 10) : '');
      if (!dateStr) return false;
      const parts = dateStr.split('-').map(Number);
      return parts[0] === targetY && parts[1] === targetM && parts[2] === targetD;
    });
  };

  const todaySchedules = useMemo(() => {
    const today = new Date();
    const targetY = today.getFullYear();
    const targetM = today.getMonth() + 1;
    const targetD = today.getDate();
    return visibleSchedules.filter((s) => {
      const dateStr = s.date || (s.scheduled_at ? s.scheduled_at.slice(0, 10) : '');
      if (!dateStr) return false;
      const parts = dateStr.split('-').map(Number);
      return parts[0] === targetY && parts[1] === targetM && parts[2] === targetD;
    });
  }, [visibleSchedules]);

  const handleCloseWidget = () => api.system.toggleWidget();

  // --- Schedule Editor ---
  const openNewSchedule = (targetDate) => {
    const dt = targetDate || selectedDate;
    const defaultTime = new Date();
    defaultTime.setHours(defaultTime.getHours() + 1, 0, 0, 0);

    const dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(defaultTime.getHours()).padStart(2, '0')}:${String(defaultTime.getMinutes()).padStart(2, '0')}`;
    setEditorForm({ title: '', scheduled_at: `${dateStr}T${timeStr}`, customer_id: '', memo: '' });
    setEditingItem(null);
    setShowEditor(true);
  };

  const openEditSchedule = (schedule) => {
    const d = new Date(schedule.scheduled_at);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    setEditorForm({ title: schedule.title || '', scheduled_at: `${dateStr}T${timeStr}`, customer_id: schedule.customer_id || '', memo: schedule.memo || '' });
    setEditingItem(schedule);
    setShowEditor(true);
  };

  const handleSaveSchedule = async () => {
    if (!editorForm.title.trim()) return;
    const payload = {
      title: editorForm.title.trim(),
      scheduled_at: new Date(editorForm.scheduled_at).toISOString(),
      customer_id: editorForm.customer_id || null,
      memo: editorForm.memo || '',
      status: editingItem?.status || 'Pending'
    };
    try {
      if (editingItem) await api.schedules.update({ id: editingItem.id, ...payload });
      else await api.schedules.create(payload);
      await loadAllData();
      setShowEditor(false);
      setEditingItem(null);
    } catch (err) { console.error('Schedule save error:', err); }
  };

  const handleDeleteSchedule = async (id) => {
    try { await api.schedules.delete(id); await loadAllData(); setShowEditor(false); setEditingItem(null); }
    catch (err) { console.error('Schedule delete error:', err); }
  };

  const handleDateCellClick = (day) => {
    const clickedDate = new Date(year, month, day);
    setSelectedDate(clickedDate);
    setPopupDate(clickedDate);
  };

  const popupSchedules = popupDate ? getSchedulesForDate(popupDate) : [];

  // --- Sub-Components ---

  const ScheduleRow = ({ s }) => {
    const isOwner = !currentUser || !s.user_id || Number(s.user_id) === Number(currentUser.id) || Number(currentUser.id) === 1;
    const u = s.user_id ? effectiveUsers.find(user => Number(user.id) === Number(s.user_id)) : null;
    const userName = s.user_name || u?.name || '설계사';
    const userRole = s.user_role || u?.role || 'FA';

    return (
      <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs flex items-center justify-between group">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <button
            onClick={() => {
              if (!isOwner) {
                alert('본인이 등록한 일정만 상태를 변경할 수 있습니다.');
                return;
              }
              toggleScheduleStatus(s);
            }}
            className={`p-0.5 rounded border shrink-0 ${s.status === 'Completed' ? 'bg-emerald-950 border-emerald-700 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5 truncate">
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-950 text-purple-200 border border-purple-800 font-extrabold shrink-0">
                {userName} ({userRole})
              </span>
              <span className={`font-semibold truncate ${s.status === 'Completed' ? 'line-through text-slate-500' : 'text-white'}`}>
                {s.title}
              </span>
            </div>
            {s.customer_name && (
              <div className="text-[10px] text-indigo-300 flex items-center mt-0.5">
                <User className="w-3 h-3 mr-0.5 shrink-0" />
                {s.customer_name}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-1 shrink-0 ml-1">
          <span className="text-[10px] text-amber-400 font-medium">
            {new Date(s.scheduled_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isOwner && (
            <button
              onClick={() => openEditSchedule(s)}
              className="p-0.5 rounded text-slate-500 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="수정"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // ========== RENDER ==========
  return (
    <div className="w-screen h-screen bg-slate-950 border border-slate-700/80 rounded-3xl shadow-2xl shadow-black flex flex-col text-slate-100 overflow-hidden font-['Inter',sans-serif] select-none">

      {/* ── Drag Header ── */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border-b border-slate-800 flex items-center justify-between cursor-move shrink-0"
        style={{ WebkitAppRegion: 'drag' }}>
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <CalendarIcon className="w-3.5 h-3.5" />
          </div>
          <span className="font-['Outfit',sans-serif] font-bold text-xs tracking-wide text-white">WLB CRM 캘린더 위젯</span>
        </div>
        <div className="flex items-center space-x-1" style={{ WebkitAppRegion: 'no-drag' }}>
          <button onClick={() => setShowOpacitySlider(!showOpacitySlider)}
            className={`p-1 rounded-lg transition-colors ${showOpacitySlider ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="투명도">
            <Sliders className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleTogglePin}
            className={`p-1 rounded-lg transition-colors ${isPinned ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            title={isPinned ? '상단 고정 해제' : '상단 고정'}>
            <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-amber-400' : ''}`} />
          </button>
          <button onClick={() => loadAllData()} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" title="새로고침">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleCloseWidget} className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors" title="닫기">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Opacity Slider ── */}
      {showOpacitySlider && (
        <div className="px-4 py-2 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between space-x-3 text-xs shrink-0">
          <span className="text-[11px] font-semibold text-slate-300 shrink-0">투명도 ({Math.round(opacity * 100)}%)</span>
          <input type="range" min="0.2" max="1.0" step="0.05" value={opacity}
            onChange={(e) => applyOpacity(parseFloat(e.target.value))} className="flex-1 max-w-32 accent-indigo-500 cursor-pointer" />
          <div className="flex space-x-1 shrink-0">
            {[0.4, 0.7, 1.0].map((val) => (
              <button key={val} onClick={() => applyOpacity(val)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${opacity === val ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                {val * 100}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Scope Switcher & Tab Switcher ── */}
      <div className="p-1.5 bg-slate-900/90 border-b border-slate-800 flex flex-col gap-1.5 shrink-0 text-xs">
        <div className="flex items-center justify-between gap-1">
          {/* Scope Toggle */}
          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
            <button
              onClick={() => setScheduleViewScope('personal')}
              className={`px-2 py-1 rounded-md font-bold transition-all ${
                scheduleViewScope === 'personal'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              👤 내 일정
            </button>
            <button
              onClick={() => setScheduleViewScope('org')}
              className={`px-2 py-1 rounded-md font-bold transition-all ${
                scheduleViewScope === 'org' || scheduleViewScope === 'organization'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🏢 조직
            </button>
          </div>

          {/* Mode Buttons */}
          <div className="flex items-center space-x-1">
            <button onClick={() => { setActiveTab('calendar'); setShowEditor(false); setPopupDate(null); }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${activeTab === 'calendar' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
              월간
            </button>
            <button onClick={() => { setActiveTab('list'); setShowEditor(false); setPopupDate(null); }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${activeTab === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
              오늘 ({todaySchedules.length})
            </button>
          </div>
        </div>

        {/* Sub-Organization Selector (Only shown in organization scope) */}
        {(scheduleViewScope === 'org' || scheduleViewScope === 'organization') && (
          <div className="flex items-center space-x-1.5 pt-0.5 px-0.5">
            <span className="text-[10px] font-bold text-slate-400 shrink-0">조직 선택:</span>
            <select
              value={selectedOrgFilter}
              onChange={(e) => setSelectedOrgFilter(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-1 text-[11px] font-medium text-emerald-300 focus:outline-none focus:border-emerald-500 truncate"
            >
              <option value="">🏢 전체 하위조직 통합 조회</option>
              {effectiveOrgs.length > 0 && (
                <optgroup label="── 하부 조직별 ──">
                  {effectiveOrgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      🏢 {org.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {effectiveUsers.length > 0 && (
                <optgroup label="── 특정 조직원별 ──">
                  {effectiveUsers.map((u) => (
                    <option key={u.id} value={`user:${u.id}`}>
                      👤 {u.name} ({u.role || 'FA'}) {u.org_name ? `· ${u.org_name}` : ''}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        )}
      </div>

      {/* ── Main Content (fills all remaining space) ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">

        {showEditor && (
          <div className="bg-slate-900 border border-indigo-500/50 rounded-2xl p-3 space-y-2 shadow-lg shadow-indigo-950/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400">{editingItem ? '📝 일정 수정' : '➕ 새 일정 등록'}</span>
              <button onClick={() => { setShowEditor(false); setEditingItem(null); }} className="p-0.5 rounded text-slate-400 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
            </div>
            <input type="text" placeholder="일정 제목" value={editorForm.title}
              onChange={(e) => setEditorForm({ ...editorForm, title: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" autoFocus />
            <input type="datetime-local" value={editorForm.scheduled_at}
              onChange={(e) => setEditorForm({ ...editorForm, scheduled_at: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500" />
            <select value={editorForm.customer_id}
              onChange={(e) => setEditorForm({ ...editorForm, customer_id: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500">
              <option value="">고객 선택 (선택사항)</option>
              {customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
            <textarea placeholder="메모 (선택사항)" value={editorForm.memo}
              onChange={(e) => setEditorForm({ ...editorForm, memo: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none" rows={2} />
            <div className="flex items-center justify-between">
              {editingItem ? (
                <button onClick={() => handleDeleteSchedule(editingItem.id)}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-950 text-red-400 border border-red-800 hover:bg-red-900">
                  <Trash2 className="w-3 h-3" /><span>삭제</span>
                </button>
              ) : <div />}
              <button onClick={handleSaveSchedule} disabled={!editorForm.title.trim()}
                className="flex items-center space-x-1 px-3 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-md">
                <Save className="w-3 h-3" /><span>{editingItem ? '수정 저장' : '등록'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ===== CALENDAR VIEW ===== */}
        {activeTab === 'calendar' && (
          <div className="flex flex-col h-full space-y-2">
            {/* Month Nav */}
            <div className="flex items-center justify-between px-1 shrink-0">
              <span className="text-sm font-bold text-white flex items-center space-x-2">
                <span>{year}년 {month + 1}월</span>
                <span className="text-[11px] font-normal text-slate-400">({schedules.length}개 전체)</span>
              </span>
              <div className="flex items-center space-x-1">
                <button onClick={handlePrevMonth} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={handleNextMonth} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-500 pb-1 shrink-0">
              <span className="text-red-400">일</span><span>월</span><span>화</span>
              <span>수</span><span>목</span><span>금</span><span className="text-blue-400">토</span>
            </div>

            {/* Calendar Grid — cells expand to fill available space */}
            <div className="grid grid-cols-7 gap-1 flex-1 auto-rows-fr">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`e-${i}`} className="bg-slate-900/20 rounded-xl border border-slate-950 min-h-0" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const daySchedules = getSchedulesForDay(day);
                const isTodayDay = isToday(day);
                const isPopupDay = popupDate && popupDate.getFullYear() === year && popupDate.getMonth() === month && popupDate.getDate() === day;

                return (
                  <button key={day} onClick={() => handleDateCellClick(day)}
                    className={`p-1 rounded-xl border flex flex-col justify-start text-left transition-all overflow-hidden min-h-0 ${
                      isPopupDay ? 'border-indigo-500 bg-indigo-950/50 ring-1 ring-indigo-400'
                        : isTodayDay ? 'ring-1 ring-amber-400 text-amber-300 bg-amber-950/20 border-slate-800/80'
                        : 'border-slate-800/80 bg-slate-900/60 hover:bg-slate-800/80'
                    }`}>
                    <div className="flex items-center justify-between w-full shrink-0">
                      <span className={`text-[11px] font-bold ${isTodayDay ? 'text-amber-300' : isPopupDay ? 'text-indigo-300' : 'text-slate-300'}`}>{day}</span>
                      <div className="flex items-center space-x-1">
                        {(() => {
                          const bdays = getBirthdaysForDay(day);
                          if (bdays.length > 0) {
                            return <span className="text-[8px] bg-pink-500/20 text-pink-300 border border-pink-500/30 px-0.5 rounded font-bold">🎂{bdays.length}</span>;
                          }
                          return null;
                        })()}
                        {daySchedules.length > 0 && (
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 rounded font-bold">{daySchedules.length}</span>
                        )}
                      </div>
                    </div>
                    <div className="w-full space-y-0.5 mt-0.5 overflow-hidden flex-1 min-h-0">
                      {getBirthdaysForDay(day).slice(0, 1).map(c => (
                        <div key={`wbday-${c.id}`} className="w-full px-1 py-0.5 rounded text-[8px] leading-tight truncate border bg-pink-950/80 text-pink-200 border-pink-700/60 font-bold">
                          🎂 {c.name}
                        </div>
                      ))}
                      {daySchedules.slice(0, 2).map((s) => (
                        <div key={s.id}
                          className={`w-full px-1 py-0.5 rounded text-[9px] leading-tight truncate border ${
                            s.status === 'Completed' ? 'bg-slate-900/80 text-slate-500 border-slate-800 line-through' : 'bg-indigo-950/90 text-indigo-200 border-indigo-700/60 font-medium'
                          }`} title={`${s.title}${s.customer_name ? ` (${s.customer_name})` : ''}`}>
                          <span className="font-bold">{s.title}</span>
                          {s.customer_name && <span className="text-[8px] text-amber-300 ml-0.5">({s.customer_name})</span>}
                        </div>
                      ))}
                      {daySchedules.length > 2 && <div className="text-[8px] text-slate-400 font-bold text-center">+{daySchedules.length - 2}건</div>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Date Detail Popup */}
            {popupDate && (
              <div className="bg-slate-900/95 border border-indigo-500/40 rounded-2xl p-3 space-y-2 shadow-lg shadow-indigo-950/30 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400">
                    📅 {popupDate.getMonth() + 1}월 {popupDate.getDate()}일 ({popupSchedules.length}건)
                  </span>
                  <div className="flex items-center space-x-1">
                    <button onClick={() => openNewSchedule(popupDate)}
                      className="flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-600 text-white hover:bg-indigo-500 shadow">
                      <Plus className="w-3 h-3" /><span>새 일정</span>
                    </button>
                    <button onClick={() => setPopupDate(null)} className="p-0.5 rounded text-slate-400 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                {/* Birthday in Popup */}
                {(() => {
                  const bdays = getBirthdaysForDay(popupDate.getDate());
                  if (bdays.length > 0) {
                    return (
                      <div className="space-y-1">
                        {bdays.map(c => (
                          <div key={`p-bday-${c.id}`} className="bg-pink-950/80 border border-pink-500/40 rounded-xl p-2 flex items-center justify-between text-xs text-pink-200">
                            <span className="font-bold">🎂 {c.name} ({c.birth_type === 'lunar' ? '음력' : '양력'})</span>
                            <span className="text-[10px] text-pink-300 font-mono">{c.phone || ''}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                })()}
                {popupSchedules.length === 0 ? (
                  <p className="text-[11px] text-slate-500 py-1">이 날짜에 등록된 일정이 없습니다.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {popupSchedules.map((s) => <ScheduleRow key={s.id} s={s} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== LIST VIEW ===== */}
        {activeTab === 'list' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">오늘의 일정</span>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-slate-400 font-medium">
                  {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                </span>
                <button onClick={() => openNewSchedule(new Date())}
                  className="flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-600 text-white hover:bg-indigo-500 shadow">
                  <Plus className="w-3 h-3" /><span>추가</span>
                </button>
              </div>
            </div>
            {todaySchedules.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800/60">
                <CalendarIcon className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
                <p className="text-xs text-slate-400">오늘 예정된 일정이 없습니다.</p>
              </div>
            ) : (
              todaySchedules.map((schedule) => {
                const sDate = new Date(schedule.scheduled_at);
                const timeStr = sDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
                const isCompleted = schedule.status === 'Completed';
                return (
                  <div key={schedule.id}
                    className={`p-3 rounded-2xl border transition-all group ${isCompleted ? 'bg-slate-900/50 border-slate-800/80 opacity-60' : 'bg-slate-900/90 border-slate-800 hover:border-indigo-500/50 shadow-sm'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-2.5">
                        <button onClick={() => toggleScheduleStatus(schedule)}
                          className={`mt-0.5 p-1 rounded-lg border transition-colors ${isCompleted ? 'bg-emerald-950 border-emerald-700 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-emerald-400'}`}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                        <div>
                          <h4 className={`text-xs font-bold ${isCompleted ? 'line-through text-slate-500' : 'text-white'}`}>{schedule.title}</h4>
                          <div className="flex items-center space-x-2 mt-1 text-[11px] text-slate-400">
                            <span className="flex items-center text-amber-400"><Clock className="w-3 h-3 mr-1" />{timeStr}</span>
                            {schedule.customer_name && <span className="flex items-center text-indigo-300"><User className="w-3 h-3 mr-1" />{schedule.customer_name}</span>}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => openEditSchedule(schedule)}
                        className="p-1 rounded text-slate-500 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" title="수정">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="p-2 bg-slate-950 border-t border-slate-800/80 text-center text-[10px] text-slate-500 shrink-0">
        ALPHA 고객관리Tool 데스크톱 위젯
      </div>
    </div>
  );
}
