import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  ShieldCheck, 
  Users, 
  FileCheck, 
  RefreshCw, 
  Phone,
  Eye,
  FilePlus,
  ArrowRight,
  Shield,
  Calendar,
  Clock,
  Edit2,
  ExternalLink,
  ChevronRight,
  UserCheck,
  FileSpreadsheet,
  Zap,
  Info
} from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';
import { api } from '../utils/api';

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

export default function ReportsView() {
  const customers = useCrmStore((state) => state.customers);
  const loadAllData = useCrmStore((state) => state.loadAllData);
  const openCustomerModal = useCrmStore((state) => state.openCustomerModal);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'registered', 'unregistered', 'has_insurance'
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  // Filter customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesSearch = 
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.phone && customer.phone.includes(searchTerm)) ||
        (customer.insurance_provider && customer.insurance_provider.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (Array.isArray(customer.insurances) && customer.insurances.some(i => (i.provider && i.provider.toLowerCase().includes(searchTerm.toLowerCase())) || (i.details && i.details.toLowerCase().includes(searchTerm.toLowerCase()))));

      const hasPdf = Boolean(customer.report_pdf_path);
      const hasExcel = Boolean(customer.report_excel_path);
      const hasReport = hasPdf || hasExcel;
      const hasInsurance = Array.isArray(customer.insurances) && customer.insurances.length > 0;

      if (filterStatus === 'registered') return matchesSearch && hasReport;
      if (filterStatus === 'unregistered') return matchesSearch && !hasReport;
      if (filterStatus === 'has_insurance') return matchesSearch && hasInsurance;
      return matchesSearch;
    });
  }, [customers, searchTerm, filterStatus]);

  // Keep first customer selected by default if none selected or if selected customer not in list
  useEffect(() => {
    if (filteredCustomers.length > 0) {
      const exists = filteredCustomers.some(c => c.id === selectedCustomerId);
      if (!exists && !selectedCustomerId) {
        setSelectedCustomerId(filteredCustomers[0].id);
      }
    }
  }, [filteredCustomers, selectedCustomerId]);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || filteredCustomers[0] || null;
  }, [customers, selectedCustomerId, filteredCustomers]);

  const registeredCount = customers.filter(c => Boolean(c.report_pdf_path || c.report_excel_path)).length;
  const unregisteredCount = customers.length - registeredCount;

  // Open PDF / Excel File
  const handleOpenFile = async (filePath, title = '리포트') => {
    if (!filePath) {
      alert(`등록된 ${title} 파일이 없습니다.`);
      return;
    }
    try {
      const res = await api.customers.openPdf(filePath);
      if (!res.success) {
        alert(res.error || `${title} 파일을 열 수 없습니다.`);
      }
    } catch (err) {
      alert(`${title} 열기 오류: ${err.message}`);
    }
  };

  // Upload or replace report file for a customer
  const handleParseFileForCustomer = async (customer, targetPath = null) => {
    if (!customer) return;
    try {
      setIsProcessing(true);

      const res = await api.customers.parseReportPdf(targetPath);
      if (res.canceled) return;
      if (!res.success) {
        alert(`리포트 처리 실패: ${res.error || '파일을 읽을 수 없습니다.'}`);
        return;
      }

      const filePath = res.filePath || '';
      const parsedInsurances = res.insurances || [];
      const isExcel = filePath.endsWith('.xlsx') || filePath.endsWith('.xls');

      const mergedInsurances = parsedInsurances.length > 0 ? parsedInsurances : (customer.insurances || []);

      const updateData = {
        ...customer,
        insurances: mergedInsurances
      };

      if (isExcel) {
        updateData.report_excel_path = filePath || customer.report_excel_path || '';
      } else {
        updateData.report_pdf_path = filePath || customer.report_pdf_path || '';
      }

      await api.customers.update(updateData);
      await loadAllData();

      const typeLabel = isExcel ? '엑셀' : 'PDF';
      alert(`📄/📊 ${customer.name} 고객의 보장분석 ${typeLabel} 파일이 등록되었습니다!\n\n(추출된 보장 항목: ${parsedInsurances.length}건)`);
    } catch (err) {
      alert(`보장분석 리포트 처리 중 오류 발생: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto h-[calc(100vh-2rem)] flex flex-col">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>보장분석 & 보험목록 열람</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                PDF & 엑셀 문서 센터
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              고객명을 클릭하여 가입된 보험 목록을 확인하고, 보장분석 PDF 및 엑셀 파일을 즉시 열람하세요.
            </p>
          </div>
        </div>

        <button
          onClick={() => loadAllData()}
          className="self-start sm:self-auto flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-all active:scale-95 shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          <span>새로고침</span>
        </button>
      </div>

      {/* Main Split Layout: Left Customer List / Right Insurance & Report Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* LEFT COLUMN: Customer Selection List (5 cols on lg) */}
        <div className="lg:col-span-5 flex flex-col bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 overflow-hidden shadow-xl">
          
          {/* Search & Filter Header */}
          <div className="space-y-3 pb-3 border-b border-slate-800/60 shrink-0">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="고객명, 연락처, 보험사 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto custom-scrollbar pb-1 text-[11px]">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  filterStatus === 'all'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                전체 ({customers.length})
              </button>
              <button
                onClick={() => setFilterStatus('registered')}
                className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  filterStatus === 'registered'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                리포트있음 ({registeredCount})
              </button>
              <button
                onClick={() => setFilterStatus('unregistered')}
                className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  filterStatus === 'unregistered'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                미등록 ({unregisteredCount})
              </button>
            </div>
          </div>

          {/* Customer Scroll List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pt-3 pr-1">
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <Users className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400 font-medium">검색 결과가 없습니다.</p>
              </div>
            ) : (
              filteredCustomers.map((customer) => {
                const isSelected = selectedCustomer?.id === customer.id;
                const hasPdf = Boolean(customer.report_pdf_path);
                const hasExcel = Boolean(customer.report_excel_path);
                const insurances = Array.isArray(customer.insurances) ? customer.insurances : [];

                return (
                  <div
                    key={customer.id}
                    onClick={() => setSelectedCustomerId(customer.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                      isSelected
                        ? 'bg-gradient-to-r from-indigo-950/80 to-slate-900 border-indigo-500/60 shadow-lg shadow-indigo-950/40 translate-x-1'
                        : 'bg-slate-950/60 border-slate-800/60 hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                      <div className="flex items-center space-x-2">
                        <span className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                          {customer.name}
                        </span>
                        {customer.phone && (
                          <span className="text-[11px] text-slate-400 font-mono">
                            {customer.phone}
                          </span>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {insurances.length > 0 ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                            <Shield className="w-2.5 h-2.5" />
                            <span>보험 {insurances.length}건</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] text-slate-500 bg-slate-900 border border-slate-800">
                            보험 미등록
                          </span>
                        )}

                        {hasPdf && (
                          <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/50">
                            <span>📄 PDF</span>
                          </span>
                        )}

                        {hasExcel && (
                          <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-teal-950 text-teal-300 border border-teal-800/50">
                            <span>📊 엑셀</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight className={`w-4 h-4 transition-transform shrink-0 ${
                      isSelected ? 'text-indigo-400 translate-x-1' : 'text-slate-600 group-hover:text-slate-400'
                    }`} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Selected Customer Detail Workspace (7 cols on lg) */}
        <div className="lg:col-span-7 flex flex-col bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 overflow-hidden shadow-xl">
          {selectedCustomer ? (
            <div className="flex flex-col h-full space-y-5 overflow-y-auto custom-scrollbar pr-1">
              
              {/* Customer Profile Header */}
              <div className="p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 rounded-2xl border border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-black text-lg flex items-center justify-center shadow-lg shadow-indigo-950/50">
                    {selectedCustomer.name ? selectedCustomer.name.charAt(0) : 'C'}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2.5">
                      <h3 className="text-lg font-bold text-white tracking-tight">
                        {selectedCustomer.name}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                        selectedCustomer.status === 'Active'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                          : selectedCustomer.status === 'Lead'
                          ? 'bg-blue-950 text-blue-400 border-blue-800/60'
                          : 'bg-rose-950 text-rose-300 border-rose-800/60'
                      }`}>
                        {selectedCustomer.status === 'Active' ? '보유고객' : selectedCustomer.status === 'Lead' ? '가망고객' : '장기미터치고객'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                      {selectedCustomer.phone && (
                        <span className="flex items-center space-x-1 font-mono">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>{selectedCustomer.phone}</span>
                        </span>
                      )}
                      {selectedCustomer.birth_date && (
                        <span className="text-indigo-300 font-medium">
                          🎂 {selectedCustomer.birth_date}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => openCustomerModal(selectedCustomer)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition-colors shadow-sm"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>정보 수정</span>
                </button>
              </div>

              {/* 1. Report Files Center (PDF & Excel) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>보장분석 리포트 문서 열람 & 등록</span>
                  </h4>
                  {(selectedCustomer.report_pdf_path || selectedCustomer.report_excel_path) && (
                    <button
                      onClick={() => handleParseFileForCustomer(selectedCustomer, selectedCustomer.report_excel_path || selectedCustomer.report_pdf_path)}
                      disabled={isProcessing}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 text-[11px] font-bold transition-all disabled:opacity-50"
                      title="첨부된 파일에서 보험사/상품/보장항목 자동 추출"
                    >
                      <Zap className="w-3 h-3 text-indigo-400" />
                      <span>{isProcessing ? '추출 중...' : '⚡ 보장내용 로드'}</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* PDF Card */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90 space-y-3 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                          <FileText className="w-4 h-4 text-emerald-400" />
                          <span>PDF 보장분석서</span>
                        </span>
                        {selectedCustomer.report_pdf_path ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                            등록 완료
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-500 border border-slate-800">
                            미등록
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate font-mono">
                        {selectedCustomer.report_pdf_path 
                          ? selectedCustomer.report_pdf_path.split(/[\\/]/).pop() 
                          : '등록된 PDF 파일이 없습니다.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {selectedCustomer.report_pdf_path ? (
                        <button
                          onClick={() => handleOpenFile(selectedCustomer.report_pdf_path, 'PDF')}
                          className="flex-1 py-2 px-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center space-x-1.5 whitespace-nowrap min-w-0"
                          title="등록된 보장분석 PDF 파일 열람"
                        >
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">PDF 열람</span>
                        </button>
                      ) : null}
                      <button
                        onClick={() => handleParseFileForCustomer(selectedCustomer)}
                        disabled={isProcessing}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1 whitespace-nowrap shrink-0 ${
                          selectedCustomer.report_pdf_path
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                            : 'flex-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 shadow-md'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5 shrink-0" />
                        <span>{selectedCustomer.report_pdf_path ? '교체' : '+ PDF 등록'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Excel Card */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90 space-y-3 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                          <FileSpreadsheet className="w-4 h-4 text-teal-400" />
                          <span>엑셀 보장분석표</span>
                        </span>
                        {selectedCustomer.report_excel_path ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-950 text-teal-400 border border-teal-800/60">
                            등록 완료
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-500 border border-slate-800">
                            미등록
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate font-mono">
                        {selectedCustomer.report_excel_path 
                          ? selectedCustomer.report_excel_path.split(/[\\/]/).pop() 
                          : '등록된 엑셀 파일이 없습니다.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {selectedCustomer.report_excel_path ? (
                        <button
                          onClick={() => handleOpenFile(selectedCustomer.report_excel_path, '엑셀')}
                          className="flex-1 py-2 px-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center space-x-1.5 whitespace-nowrap min-w-0"
                          title="등록된 보장분석 엑셀 파일 열람"
                        >
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">엑셀 열람</span>
                        </button>
                      ) : null}
                      <button
                        onClick={() => handleParseFileForCustomer(selectedCustomer)}
                        disabled={isProcessing}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1 whitespace-nowrap shrink-0 ${
                          selectedCustomer.report_excel_path
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                            : 'flex-1 bg-teal-950 hover:bg-teal-900 text-teal-300 border border-teal-800 shadow-md'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5 shrink-0" />
                        <span>{selectedCustomer.report_excel_path ? '교체' : '+ 엑셀 등록'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Insurance List */}
              <div className="space-y-3 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>가입 보험 상세 목록 ({Array.isArray(selectedCustomer.insurances) ? selectedCustomer.insurances.length : 0}건)</span>
                  </h4>
                  <button
                    onClick={() => openCustomerModal(selectedCustomer)}
                    className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    + 보험 추가/수정
                  </button>
                </div>

                {(!Array.isArray(selectedCustomer.insurances) || selectedCustomer.insurances.length === 0) ? (
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-8 text-center space-y-3 my-auto">
                    <Shield className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs font-semibold text-slate-400">등록된 가입 보험 정보가 없습니다.</p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      보장분석 리포트(PDF/엑셀)를 등록하거나 [정보 수정]을 눌러 가입 보험을 추가하세요.
                    </p>
                    <button
                      onClick={() => openCustomerModal(selectedCustomer)}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md inline-flex items-center space-x-1"
                    >
                      <span>보험 정보 직접 등록</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5 overflow-y-auto custom-scrollbar flex-1 pr-1">
                    {selectedCustomer.insurances.map((ins, idx) => {
                      const startDateStr = ins.startDate || ins.start_date || '';
                      const endDateStr = ins.endDate || ins.end_date || '';
                      const elapsedMonths = calculateElapsedMonths(startDateStr);

                      return (
                        <div
                          key={idx}
                          className="bg-slate-950 p-4 rounded-2xl border border-slate-800/90 space-y-2 hover:border-slate-700 transition-all shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                              <span className="font-bold text-sm text-white">{ins.provider || '미지정 보험사'}</span>
                            </div>
                            
                            <div className="flex items-center space-x-1.5">
                              {elapsedMonths !== null && (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                                  {elapsedMonths}개월차
                                </span>
                              )}
                              {endDateStr && (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-rose-950/80 text-rose-300 border border-rose-800/60">
                                  만기: {endDateStr}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Insurance Details & Coverage */}
                          {ins.details && (
                            <div className="text-xs text-slate-300 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/60 whitespace-pre-wrap leading-relaxed">
                              {ins.details}
                            </div>
                          )}

                          {/* Date Info Footer */}
                          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                            {startDateStr && (
                              <span className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3 text-slate-500" />
                                <span>가입일: {startDateStr}</span>
                              </span>
                            )}
                            {endDateStr && (
                              <span className="flex items-center space-x-1 text-rose-400/90">
                                <Clock className="w-3 h-3 text-rose-400" />
                                <span>만기일: {endDateStr}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
              <Users className="w-12 h-12 text-slate-600" />
              <p className="text-sm font-semibold text-slate-400">조회할 고객을 선택해 주세요.</p>
              <p className="text-xs text-slate-500">좌측 목록에서 고객을 클릭하면 가입된 보험 목록과 보장분석 리포트가 표시됩니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
