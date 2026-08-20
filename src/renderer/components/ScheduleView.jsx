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
import { Calendar, Search, Plus, Edit2, Trash2, Clock, CheckCircle2, XCircle, Bell, Filter, User, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';

const columnHelper = createColumnHelper();

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
    if (!statusFilter) return visibleSchedules;
    return visibleSchedules.filter(s => s.status === statusFilter);
  }, [visibleSchedules, statusFilter]);

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
                <CheckCircle2 className="w-5 h-5" />
              ) : schedule.status === 'Cancelled' ? (
                <XCircle className="w-5 h-5" />
              ) : (
                <Clock className="w-5 h-5" />
              )}
            </button>
          );
        }
      }),
      columnHelper.accessor('title', {
        header: '일정 제목 & 상세',
        cell: (info) => {
          const schedule = info.row.original;
          return (
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                {schedule.user_name && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold flex items-center space-x-1">
                    <User className="w-3 h-3 text-indigo-400" />
                    <span>{schedule.user_name}</span>
                    {schedule.user_org_name && <span className="text-[10px] text-slate-400">({schedule.user_org_name})</span>}
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

          let reminderLabel = '정시';
          if (offset > 0) {
            if (offset < 60) reminderLabel = `${offset}분 전`;
            else if (offset < 1440) reminderLabel = `${Math.floor(offset / 60)}시간 전`;
            else reminderLabel = `${Math.floor(offset / 1440)}일 전`;
          }

          return (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-indigo-400 flex items-center space-x-1">
                <Bell className="w-3.5 h-3.5" />
                <span>{eventTime.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 font-medium">
                  {reminderLabel} 알림
                </span>
                {schedule.notified === 1 && (
                  <span className="text-[10px] text-emerald-400 font-medium">
                    ✓ 발송 완료
                  </span>
                )}
              </div>
            </div>
          );
        }
      }),
      columnHelper.display({
        id: 'actions',
        header: () => <div className="text-right">작업</div>,
        cell: (info) => {
          const schedule = info.row.original;
          const myId = currentUser ? Number(currentUser.id) : 1;
          const isOwner = schedule.user_id == null ? myId === 1 : Number(schedule.user_id) === myId;

          if (!isOwner) {
            return (
              <div className="text-right text-[11px] text-slate-500 font-semibold">
                🔒 조회 전용
              </div>
            );
          }

          return (
            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => openScheduleModal(schedule)}
                className="p-2 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                title="일정 수정"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => deleteSchedule(schedule.id)}
                className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                title="일정 삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        }
      })
    ],
    [openScheduleModal, deleteSchedule, toggleScheduleStatus, currentUser]
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
        pageSize: 8
      }
    }
  });

  return (
    <div className="p-8 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-['Outfit',sans-serif] text-2xl font-bold text-white tracking-tight">
            일정 & 알림 관리
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            원하는 시간(정시/10분전/30분전/1시간전 등)에 미리 Windows 토스트 알림이 발송됩니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Personal vs Org Switcher */}
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setScheduleViewScope('personal')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                scheduleViewScope === 'personal'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              👤 내 일정만 보기
            </button>
            <button
              onClick={() => setScheduleViewScope('organization')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                scheduleViewScope === 'organization'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🏢 조직 전체 및 하부조직
            </button>
          </div>

          {/* Sub-Organization Selector (Only shown in organization scope) */}
          {scheduleViewScope === 'organization' && (
            <div className="flex items-center space-x-2 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400 font-bold px-1.5">조직 선택:</span>
              <select
                value={selectedOrgFilter}
                onChange={(e) => setSelectedOrgFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-300 focus:outline-none focus:border-emerald-500 max-w-[220px] truncate"
              >
                <option value="">🏢 전체 하위조직 통합 조회</option>
                <optgroup label="── 하부 조직별 선택 ──">
                  {organizations.map((org) => (
                    <option key={org.id} value={org.name}>
                      [{org.type || '팀'}] {org.name}
                    </option>
                  ))}
                </optgroup>
                {accessibleUsers.length > 0 && (
                  <optgroup label="── 특정 조직원별 선택 ──">
                    {accessibleUsers.map((u) => (
                      <option key={u.id} value={`user:${u.id}`}>
                        👤 {u.name} ({u.role}) · {u.org_name || '소속없음'}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}

          <button
            onClick={() => openScheduleModal()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/25 flex items-center space-x-2 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>새 일정 등록</span>
          </button>
        </div>
      </div>

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
            className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
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
                ? '등록된 알림 일정이 없습니다. "+ 새 일정 등록" 버튼을 눌러 팔로업 일정을 등록해 보세요.'
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
            <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center space-x-2">
                <span>페이지당</span>
                <select
                  value={table.getState().pagination.pageSize}
                  onChange={(e) => table.setPageSize(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white focus:outline-none"
                >
                  {[8, 15, 25, 50].map((pageSize) => (
                    <option key={pageSize} value={pageSize}>
                      {pageSize}
                    </option>
                  ))}
                </select>
                <span>개 보기</span>
              </div>

              <div className="flex items-center space-x-4">
                <span>
                  페이지 <strong className="text-white">{table.getState().pagination.pageIndex + 1}</strong> /{' '}
                  <strong className="text-white">{table.getPageCount()}</strong>
                </span>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
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
  );
}
