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
import { Users, User, Search, Plus, Edit2, Trash2, Mail, Phone, Shield, Filter, UserCheck, ArrowUpDown, ChevronLeft, ChevronRight, Calendar, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';

const columnHelper = createColumnHelper();

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

function CustomerInsuranceCell({ list, customer }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!list || list.length === 0) {
    if (customer.insurance_provider || customer.insurance_details) {
      return (
        <div className="space-y-0.5 text-xs bg-slate-900/90 p-2 rounded-lg border border-slate-800 max-w-xs">
          <span className="font-semibold text-indigo-400 flex items-center space-x-1">
            <Shield className="w-3 h-3" />
            <span>{customer.insurance_provider}</span>
          </span>
          <p className="text-[11px] text-slate-300 line-clamp-1 pl-4">{customer.insurance_details}</p>
        </div>
      );
    }
    return <span className="text-xs text-slate-600">—</span>;
  }

  const displayList = isExpanded ? list : list.slice(0, 1);
  const hiddenCount = list.length - 1;

  return (
    <div className="space-y-1.5 py-0.5 max-w-xs">
      {displayList.map((item, idx) => {
        const startDateStr = item.startDate || item.start_date || '';
        const elapsedMonths = calculateElapsedMonths(startDateStr);
        return (
          <div key={idx} className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-400">
                <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>{item.provider || '미지정 보험사'}</span>
              </div>

              {startDateStr && elapsedMonths !== null && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60">
                  {elapsedMonths}개월차
                </span>
              )}
            </div>

            {startDateStr && (
              <div className="flex items-center space-x-1 text-[11px] text-slate-400 pl-5">
                <Calendar className="w-3 h-3 text-slate-500" />
                <span>가입일: {startDateStr}</span>
              </div>
            )}

            {item.details && (
              <p className="text-[11px] text-slate-300 line-clamp-2 pl-5 leading-tight">{item.details}</p>
            )}
          </div>
        );
      })}

      {hiddenCount > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="w-full text-center py-1 px-2.5 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-700/50 rounded-lg transition-all flex items-center justify-center space-x-1 shadow-sm active:scale-95"
        >
          <span>{isExpanded ? '접기' : `외 ${hiddenCount}개 보험 더보기`}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

export default function CustomerView() {
  const customers = useCrmStore((state) => state.customers);
  const openCustomerModal = useCrmStore((state) => state.openCustomerModal);
  const openCustomerDetailModal = useCrmStore((state) => state.openCustomerDetailModal);
  const openScheduleModal = useCrmStore((state) => state.openScheduleModal);
  const deleteCustomer = useCrmStore((state) => state.deleteCustomer);

  const currentUser = useCrmStore((state) => state.currentUser);
  const customerViewScope = useCrmStore((state) => state.customerViewScope);
  const setCustomerViewScope = useCrmStore((state) => state.setCustomerViewScope);
  const customerOrgFilter = useCrmStore((state) => state.customerOrgFilter);
  const setCustomerOrgFilter = useCrmStore((state) => state.setCustomerOrgFilter);
  const organizations = useCrmStore((state) => state.organizations);
  const accessibleUsers = useCrmStore((state) => state.accessibleUsers);

  // Sub-tab: 'my-customers' (1. 본인 고객리스트 - 기본) | 'my-pool' (2. 본인 POOL LIST) | 'all-customers' (3. 전체고객 조회하기)
  const [activeSubTab, setActiveSubTab] = useState('my-customers');
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [poolGroupFilter, setPoolGroupFilter] = useState('');
  const [sorting, setSorting] = useState([]);

  const myId = useMemo(() => (currentUser ? Number(currentUser.id) : 1), [currentUser]);

  // 1. User's own customers
  const myCustomers = useMemo(() => {
    if (!Array.isArray(customers)) return [];
    return customers.filter((c) => {
      const cOwnerId = c.user_id !== null && c.user_id !== undefined ? Number(c.user_id) : 1;
      return cOwnerId === myId;
    });
  }, [customers, myId]);

  // 2. User's own POOL customers
  const myPoolCustomers = useMemo(() => {
    return myCustomers.filter((c) => c.is_pool === 1 || c.pool_group || c.relationship);
  }, [myCustomers]);

  // 3. All accessible customers (with org/user filter)
  const allCustomers = useMemo(() => {
    if (!Array.isArray(customers)) return [];

    if (!customerOrgFilter) {
      return customers;
    }

    if (customerOrgFilter.startsWith('user:')) {
      const targetUid = Number(customerOrgFilter.replace('user:', ''));
      return customers.filter((c) => Number(c.user_id) === targetUid);
    }

    return customers.filter((c) => {
      if (c.org_id && String(c.org_id) === String(customerOrgFilter)) return true;
      if (c.user_org_name && String(c.user_org_name) === String(customerOrgFilter)) return true;
      return false;
    });
  }, [customers, customerOrgFilter]);

  // Base list depending on active subtab
  const currentBaseList = useMemo(() => {
    if (activeSubTab === 'my-customers') return myCustomers;
    if (activeSubTab === 'my-pool') return myPoolCustomers;
    return allCustomers;
  }, [activeSubTab, myCustomers, myPoolCustomers, allCustomers]);

  const filteredData = useMemo(() => {
    let list = currentBaseList;

    if (activeSubTab === 'my-pool' && poolGroupFilter) {
      list = list.filter((c) => (c.pool_group || 'A') === poolGroupFilter);
    }

    if (statusFilter) {
      list = list.filter((c) => c.status === statusFilter);
    }

    return list;
  }, [currentBaseList, activeSubTab, poolGroupFilter, statusFilter]);

  const poolStats = useMemo(() => {
    const poolList = myPoolCustomers;
    const total = poolList.length;
    const groupA = poolList.filter((c) => (c.pool_group || 'A') === 'A').length;
    const groupB = poolList.filter((c) => c.pool_group === 'B').length;
    const groupC = poolList.filter((c) => c.pool_group === 'C').length;
    const groupD = poolList.filter((c) => c.pool_group === 'D').length;
    const leads = poolList.filter((c) => c.status === 'Lead').length;
    const actives = poolList.filter((c) => c.status === 'Active').length;
    const inactives = poolList.filter((c) => c.status === 'Inactive').length;
    const conversionRate = total > 0 ? Math.round((actives / total) * 100) : 0;

    return { total, groupA, groupB, groupC, groupD, leads, actives, inactives, conversionRate };
  }, [myPoolCustomers]);

  const getGroupBadge = (grp) => {
    switch (grp) {
      case 'A': return { label: 'A', style: 'bg-rose-950/80 text-rose-300 border-rose-700/60' };
      case 'B': return { label: 'B', style: 'bg-amber-950/80 text-amber-300 border-amber-700/60' };
      case 'C': return { label: 'C', style: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60' };
      case 'D': default: return { label: 'D', style: 'bg-blue-950/80 text-blue-300 border-blue-700/60' };
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: '고객명 & 담당자',
        cell: (info) => {
          const customer = info.row.original;
          const isMasked = customer.is_subordinate_masked === true;
          const myId = currentUser ? Number(currentUser.id) : 1;
          const isOwner = customer.user_id == null ? myId === 1 : Number(customer.user_id) === myId;

          return (
            <div className={`flex items-center space-x-3 ${isMasked ? 'cursor-default' : 'cursor-pointer group'}`} onClick={() => !isMasked && openCustomerDetailModal(customer)}>
              <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-sm">
                {customer.name ? customer.name.charAt(0).toUpperCase() : 'C'}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-white">{customer.name}</span>
                  {customer.is_pool === 1 && <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">POOL</span>}
                  {isMasked ? <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-400 border border-amber-800 font-medium">미터치 조회전용</span> : !isOwner && <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-medium">조회 전용</span>}
                </div>
                {customer.user_name && <div className="text-[11px] text-indigo-300">담당: {customer.user_name}</div>}
              </div>
            </div>
          );
        }
      }),
      columnHelper.accessor('relationship', {
        header: '관계 & 그룹',
        cell: (info) => {
          const customer = info.row.original;
          const grpBadge = getGroupBadge(customer.pool_group || 'A');
          return (
            <div className="space-y-1 text-xs">
              <span className="inline-block px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">{customer.relationship || '지인'}</span>
              {customer.pool_group && <div><span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${grpBadge.style}`}>{grpBadge.label}</span></div>}
            </div>
          );
        }
      }),
      columnHelper.accessor('insurances', {
        header: '가입 보험 및 보장분석',
        cell: (info) => {
          const customer = info.row.original;
          if (customer.is_subordinate_masked) return <span className="text-xs text-slate-500">—</span>;
          const list = Array.isArray(customer.insurances) ? customer.insurances : [];
          return (
            <div className="space-y-1">
              <CustomerInsuranceCell list={list} customer={customer} />
              {(customer.report_pdf_path || customer.report_excel_path) && <div className="text-[10px] text-emerald-400 font-semibold">📄 리포트 첨부됨</div>}
            </div>
          );
        }
      }),
      columnHelper.accessor('status', {
        header: '고객 상태',
        cell: (info) => {
          const customer = info.row.original;
          const status = info.getValue();
          if (customer.is_subordinate_masked) return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/70 text-amber-300">장기미터치</span>;
          const statusText = status === 'Active' ? '보유고객' : status === 'Lead' ? '가망고객' : '장기미터치고객';
          return (
            <div className="space-y-1">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${status === 'Active' ? 'bg-emerald-950/60 text-emerald-400' : 'bg-rose-950/70 text-rose-300'}`}>{statusText}</span>
              {status === 'Active' && customer.is_pool === 1 && <div className="text-[10px] text-emerald-300">✨ 승격 완료</div>}
            </div>
          );
        }
      }),
      columnHelper.display({
        id: 'actions',
        header: () => <div className="text-right">작업 & 일정</div>,
        cell: (info) => {
          const customer = info.row.original;
          const myId = currentUser ? Number(currentUser.id) : 1;
          const isOwner = customer.user_id == null ? myId === 1 : Number(customer.user_id) === myId;
          const isMasked = customer.is_subordinate_masked === true;

          const handleQuickSchedule = (e) => {
            e.stopPropagation();
            openScheduleModal(null, { customer_id: customer.id, title: `${customer.name} 고객 미팅/상담`, scheduled_at: new Date().toISOString().slice(0, 16) });
          };

          return (
            <div className="flex items-center justify-end space-x-1.5">
              {!isMasked && <button onClick={handleQuickSchedule} className="px-2 py-1 bg-indigo-950 text-indigo-300 border border-indigo-700 rounded-lg text-xs font-semibold">일정</button>}
              <button onClick={(e) => { e.stopPropagation(); openCustomerDetailModal(customer); }} className="p-1.5 text-slate-400 hover:text-white"><Eye className="w-4 h-4" /></button>
              {isOwner && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); openCustomerModal(customer, customer.is_pool === 1); }} className="p-1.5 text-slate-400"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={(e) => { e.stopPropagation(); deleteCustomer(customer.id); }} className="p-1.5 text-slate-400"><Trash2 className="w-4 h-4" /></button>
                </>
              )}
            </div>
          );
        }
      })
    ],
    [currentUser, openCustomerDetailModal, openCustomerModal, openScheduleModal, deleteCustomer]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } }
  });

  return (
    <div className="p-8 space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {activeSubTab === 'my-customers' && '👤 내 고객 목록'}
              {activeSubTab === 'my-pool' && '📋 내 POOL LIST'}
              {activeSubTab === 'all-customers' && '🏢 전체고객 조회'}
            </h2>
            
            {/* Sub-tab 3-level Buttons */}
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                onClick={() => {
                  setActiveSubTab('my-customers');
                  setPoolGroupFilter('');
                }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeSubTab === 'my-customers'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                👤 내 고객 목록 ({myCustomers.length})
              </button>

              <button
                onClick={() => setActiveSubTab('my-pool')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeSubTab === 'my-pool'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📋 내 POOL LIST ({myPoolCustomers.length})
              </button>

              <button
                onClick={() => {
                  setActiveSubTab('all-customers');
                  setPoolGroupFilter('');
                }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeSubTab === 'all-customers'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🏢 전체고객 조회하기 ({allCustomers.length})
              </button>
            </div>
          </div>
        </div>

        {/* Right Action Button & Org Filter */}
        <div className="flex flex-wrap items-center gap-3">
          {activeSubTab === 'all-customers' && (
            <select
              value={customerOrgFilter}
              onChange={(e) => setCustomerOrgFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
            >
              <option value="">전체 조직 및 담당자</option>
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
          )}

          {activeSubTab === 'my-pool' ? (
            <button
              onClick={() => openCustomerModal(null, true)}
              className="bg-amber-600 hover:bg-amber-500 px-4 py-2 rounded-xl text-white font-bold text-xs shadow-lg shadow-amber-950 flex items-center space-x-1.5 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>+ POOL 고객 등록</span>
            </button>
          ) : (
            <button
              onClick={() => openCustomerModal(null, false)}
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl text-white font-bold text-xs shadow-lg shadow-blue-950 flex items-center space-x-1.5 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>+ 새 고객 추가</span>
            </button>
          )}
        </div>
      </div>

      {activeSubTab === 'my-pool' && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="glass-panel p-3.5 rounded-2xl border border-slate-800 bg-slate-900/60"><span className="text-[11px] text-slate-400 font-bold">전체 POOL</span><div className="text-xl font-extrabold text-white">{poolStats.total}명</div></div>
          <div className="glass-panel p-3.5 rounded-2xl border border-rose-900/40 bg-rose-950/20"><span className="text-[11px] text-rose-400 font-bold">A</span><div className="text-xl font-extrabold text-rose-300">{poolStats.groupA}명</div></div>
          <div className="glass-panel p-3.5 rounded-2xl border border-amber-900/40 bg-amber-950/20"><span className="text-[11px] text-amber-400 font-bold">B</span><div className="text-xl font-extrabold text-amber-300">{poolStats.groupB}명</div></div>
          <div className="glass-panel p-3.5 rounded-2xl border border-emerald-900/40 bg-emerald-950/20"><span className="text-[11px] text-emerald-400 font-bold">C</span><div className="text-xl font-extrabold text-emerald-300">{poolStats.groupC}명</div></div>
          <div className="glass-panel p-3.5 rounded-2xl border border-blue-900/40 bg-blue-950/20"><span className="text-[11px] text-blue-400 font-bold">D</span><div className="text-xl font-extrabold text-blue-300">{poolStats.groupD}명</div></div>
          <div className="glass-panel p-3.5 rounded-2xl border border-indigo-900/40 bg-indigo-950/20"><span className="text-[11px] text-indigo-400 font-bold">보유 승격</span><div className="text-xl font-extrabold text-indigo-300">{poolStats.actives}명 ({poolStats.conversionRate}%)</div></div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="이름, 연락처, 관계, 소개자, 보험사 검색..."
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Group Filter for POOL TAB */}
          {activeSubTab === 'my-pool' && (
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              {[
                { key: '', label: '전체' },
                { key: 'A', label: 'A' },
                { key: 'B', label: 'B' },
                { key: 'C', label: 'C' },
                { key: 'D', label: 'D' }
              ].map((grp) => (
                <button
                  key={grp.key}
                  onClick={() => setPoolGroupFilter(grp.key)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    poolGroupFilter === grp.key
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {grp.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="">전체 상태 분류</option>
            <option value="Lead">가망고객 (Lead)</option>
            <option value="Active">보유고객 (Active)</option>
            <option value="Inactive">장기미터치고객 (6개월 미터치)</option>
          </select>
        </div>
      </div>

      {/* TanStack Data Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        {table.getRowModel().rows.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <Users className="w-12 h-12 mx-auto text-slate-600 stroke-[1.5]" />
            <h4 className="text-base font-semibold text-slate-300">
              {activeSubTab === 'my-pool'
                ? '등록된 POOL LIST 고객이 없습니다'
                : activeSubTab === 'my-customers'
                ? '등록된 내 고객이 없습니다'
                : '등록된 고객 기록이 없습니다'}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {activeSubTab === 'my-pool'
                ? '가망고객을 등록하여 인맥 및 타겟 그룹별로 체계적으로 관리해 보세요.'
                : activeSubTab === 'my-customers'
                ? '신규 고객을 등록하여 일정을 계획하고 상담을 시작해 보세요.'
                : '선택된 조직 또는 검색 조건에 일치하는 고객이 없습니다.'}
            </p>
            {activeSubTab === 'my-pool' ? (
              <button
                onClick={() => openCustomerModal(null, true)}
                className="mt-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md"
              >
                + 첫 POOL 고객 등록하기
              </button>
            ) : (
              <button
                onClick={() => openCustomerModal(null, false)}
                className="mt-2 bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all"
              >
                + 첫 고객 추가하기
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
                <span>페이지당 표시:</span>
                <select
                  value={table.getState().pagination.pageSize}
                  onChange={(e) => table.setPageSize(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white focus:outline-none"
                >
                  {[10, 20, 30, 50].map((pageSize) => (
                    <option key={pageSize} value={pageSize}>
                      {pageSize}개씩 보기
                    </option>
                  ))}
                </select>
                <span className="text-slate-500 ml-2">
                  총 <strong className="text-slate-200">{filteredData.length}</strong>명 중{' '}
                  {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} -{' '}
                  {Math.min(
                    (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                    filteredData.length
                  )}
                  명
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-slate-300">
                  {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
                </span>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
