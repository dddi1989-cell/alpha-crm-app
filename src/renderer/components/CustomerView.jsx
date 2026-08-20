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
  const deleteCustomer = useCrmStore((state) => state.deleteCustomer);

  const currentUser = useCrmStore((state) => state.currentUser);
  const customerViewScope = useCrmStore((state) => state.customerViewScope);
  const setCustomerViewScope = useCrmStore((state) => state.setCustomerViewScope);
  const customerOrgFilter = useCrmStore((state) => state.customerOrgFilter);
  const setCustomerOrgFilter = useCrmStore((state) => state.setCustomerOrgFilter);
  const organizations = useCrmStore((state) => state.organizations);
  const accessibleUsers = useCrmStore((state) => state.accessibleUsers);

  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sorting, setSorting] = useState([]);

  // Client-side Strict Customer Filter Guard
  const visibleCustomers = useMemo(() => {
    if (!Array.isArray(customers)) return [];

    if (customerViewScope === 'personal') {
      const myId = currentUser ? Number(currentUser.id) : 1;
      return customers.filter((c) => {
        const cOwnerId = c.user_id !== null && c.user_id !== undefined ? Number(c.user_id) : 1;
        return cOwnerId === myId;
      });
    }

    // Organization Scope
    if (!customerOrgFilter) {
      return customers; // 전체 하위 조직 및 조직원 고객
    }

    // User-specific filter (e.g. 'user:3')
    if (customerOrgFilter.startsWith('user:')) {
      const targetUid = Number(customerOrgFilter.replace('user:', ''));
      return customers.filter((c) => Number(c.user_id) === targetUid);
    }

    // Org-specific filter
    return customers.filter((c) => {
      if (c.org_id && String(c.org_id) === String(customerOrgFilter)) return true;
      if (c.user_org_name && String(c.user_org_name) === String(customerOrgFilter)) return true;
      return false;
    });
  }, [customers, customerViewScope, customerOrgFilter, currentUser]);

  const filteredData = useMemo(() => {
    if (!statusFilter) return visibleCustomers;
    return visibleCustomers.filter(c => c.status === statusFilter);
  }, [visibleCustomers, statusFilter]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: '고객명 & 소개자 & 담당자',
        cell: (info) => {
          const customer = info.row.original;
          const isOwner = !currentUser || !customer.user_id || Number(customer.user_id) === Number(currentUser.id) || Number(currentUser.id) === 1;

          return (
            <div
              onClick={() => openCustomerDetailModal(customer)}
              className="flex items-center space-x-3 cursor-pointer group"
              title="클릭하여 고객 상세정보 및 최근 3년 일정 조회"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-sm group-hover:scale-105 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                {customer.name ? customer.name.charAt(0).toUpperCase() : 'C'}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-white group-hover:text-indigo-400 transition-colors">
                    {customer.name}
                  </span>
                  {!isOwner && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                      조회 전용
                    </span>
                  )}
                </div>

                {/* Subordinate Manager Badge (담당 조직원 이름과 직급 노출) */}
                {customer.user_name && (
                  <div className="flex items-center space-x-1 text-[11px] text-indigo-300 font-semibold bg-indigo-950/70 px-2 py-0.5 rounded-md border border-indigo-800/60 w-fit">
                    <User className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span>담당: {customer.user_name} ({customer.user_role || 'FA'})</span>
                    {customer.user_org_name && (
                      <span className="text-slate-400 font-normal"> · {customer.user_org_name}</span>
                    )}
                  </div>
                )}

                {customer.referrer_name && (
                  <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 text-[10px] font-medium">
                    <UserCheck className="w-3 h-3 text-emerald-400" />
                    <span>소개자: {customer.referrer_name}</span>
                  </div>
                )}
                {customer.notes && (
                  <span className="text-xs text-slate-400 line-clamp-1 max-w-xs block">{customer.notes}</span>
                )}
              </div>
            </div>
          );
        }
      }),
      columnHelper.accessor('phone', {
        header: '연락처 & 생년월일',
        cell: (info) => {
          const customer = info.row.original;
          return (
            <div className="space-y-1 text-xs">
              {customer.phone && (
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>{customer.phone}</span>
                </div>
              )}
              {customer.birth_date && (
                <div className="flex items-center space-x-1.5 text-indigo-300 font-medium">
                  <span className="text-xs">🎂</span>
                  <span>{customer.birth_date}</span>
                </div>
              )}
            </div>
          );
        }
      }),
      columnHelper.accessor('insurances', {
        header: '가입 보험 정보 (가입일 & 경과월수)',
        cell: (info) => {
          const customer = info.row.original;
          const list = Array.isArray(customer.insurances) ? customer.insurances : [];
          return <CustomerInsuranceCell list={list} customer={customer} />;
        }
      }),
      columnHelper.accessor('status', {
        header: '상태',
        cell: (info) => {
          const status = info.getValue();
          const statusText = status === 'Active' ? '보유고객' : status === 'Lead' ? '가망고객' : '장기미터치고객';
          return (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
              status === 'Active'
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                : status === 'Lead'
                ? 'bg-blue-950/60 text-blue-400 border-blue-800/50'
                : 'bg-rose-950/70 text-rose-300 border-rose-800/60'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                status === 'Active' ? 'bg-emerald-400' : status === 'Lead' ? 'bg-blue-400' : 'bg-rose-400'
              }`}></span>
              {statusText}
            </span>
          );
        }
      }),
      columnHelper.display({
        id: 'actions',
        header: () => <div className="text-right">작업</div>,
        cell: (info) => {
          const customer = info.row.original;
          const myId = currentUser ? Number(currentUser.id) : 1;
          const isOwner = customer.user_id == null ? myId === 1 : Number(customer.user_id) === myId;

          return (
            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => openCustomerDetailModal(customer)}
                className="p-2 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                title="상세 정보 및 최근 3년 일정 조회"
              >
                <Eye className="w-4 h-4" />
              </button>
              {isOwner ? (
                <>
                  <button
                    onClick={() => openCustomerModal(customer)}
                    className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                    title="고객 수정"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteCustomer(customer.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                    title="고객 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <span className="text-[10px] text-slate-500 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800" title="해당 고객의 담당자만 수정할 수 있습니다.">
                  조회 전용
                </span>
              )}
            </div>
          );
        }
      })
    ],
    [openCustomerModal, openCustomerDetailModal, deleteCustomer, currentUser]
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
            고객 디렉토리
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            소개자 연동, 가입보험별 가입일자 및 경과월수(X개월차) 계산 & 고객별 최근 3년 이내 일정 실시간 조회.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Customer Scope Switcher: Personal vs Organization */}
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setCustomerViewScope('personal')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                customerViewScope === 'personal'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              👤 내 고객만 보기
            </button>
            <button
              onClick={() => setCustomerViewScope('organization')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                customerViewScope === 'organization'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🏢 조직 고객 전체 및 하위조직
            </button>
          </div>

          {/* Sub-Organization / User Selector (Only in organization scope) */}
          {customerViewScope === 'organization' && (
            <div className="flex items-center space-x-2 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400 font-bold px-1.5">조회 대상:</span>
              <select
                value={customerOrgFilter}
                onChange={(e) => setCustomerOrgFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-300 focus:outline-none focus:border-emerald-500 max-w-[220px] truncate"
              >
                <option value="">🏢 전체 하위조직 고객 통합</option>
                <optgroup label="── 하부 조직별 선택 ──">
                  {organizations.map((org) => (
                    <option key={org.id} value={org.name}>
                      [{org.type || '팀'}] {org.name} ({org.member_count || 0}명)
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
            onClick={() => openCustomerModal()}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/25 flex items-center space-x-2 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>새 고객 추가</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="이름, 이메일, 전화번호, 소개자, 보험사 검색..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">전체 상태</option>
            <option value="Active">보유고객</option>
            <option value="Lead">가망고객</option>
            <option value="Inactive">장기미터치고객 (6개월 미터치)</option>
          </select>
        </div>
      </div>

      {/* TanStack Data Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        {table.getRowModel().rows.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <Users className="w-12 h-12 mx-auto text-slate-600 stroke-[1.5]" />
            <h4 className="text-base font-semibold text-slate-300">등록된 고객 기록이 없습니다</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {customers.length === 0
                ? '로컬 CRM 데이터베이스가 완전히 비어 있습니다. "+ 새 고객 추가" 버튼을 눌러 첫 고객을 등록해 보세요.'
                : '현재 검색 조건에 일치하는 고객 기록이 없습니다.'}
            </p>
            {customers.length === 0 && (
              <button
                onClick={() => openCustomerModal()}
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
