import React, { useState, useEffect, useRef } from 'react';
import { X, UserPlus, Save, Shield, Plus, Trash2, UserCheck, Search, Calendar, FileText } from 'lucide-react';
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

export default function CustomerModal() {
  const isOpen = useCrmStore((state) => state.isCustomerModalOpen);
  const editingCustomer = useCrmStore((state) => state.editingCustomer);
  const isPoolCustomerModal = useCrmStore((state) => state.isPoolCustomerModal);
  const customers = useCrmStore((state) => state.customers);
  const closeCustomerModal = useCrmStore((state) => state.closeCustomerModal);
  const saveCustomer = useCrmStore((state) => state.saveCustomer);
  const currentUser = useCrmStore((state) => state.currentUser);

  const myId = currentUser ? Number(currentUser.id) : 1;
  const isOwner = !editingCustomer || editingCustomer.user_id == null || Number(editingCustomer.user_id) === myId;

  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [customRelationship, setCustomRelationship] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    birth_date: '',
    relationship: '지인',
    pool_group: 'A',
    is_pool: 0,
    referrer_id: '',
    insurances: [{ id: 1, provider: '', details: '', startDate: '', endDate: '' }],
    status: 'Lead',
    notes: '',
    report_pdf_path: '',
    report_excel_path: ''
  });

  // Searchable Referrer State
  const [referrerSearch, setReferrerSearch] = useState('');
  const [isReferrerOpen, setIsReferrerOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (editingCustomer) {
      let initialInsurances = [];
      if (Array.isArray(editingCustomer.insurances) && editingCustomer.insurances.length > 0) {
        initialInsurances = editingCustomer.insurances.map((item, idx) => ({
          id: item.id || (Date.now() + idx),
          provider: item.provider || '',
          details: item.details || '',
          startDate: item.startDate || item.start_date || '',
          endDate: item.endDate || item.end_date || ''
        }));
      } else if (editingCustomer.insurance_provider || editingCustomer.insurance_details) {
        initialInsurances = [{
          id: Date.now(),
          provider: editingCustomer.insurance_provider || '',
          details: editingCustomer.insurance_details || '',
          startDate: '',
          endDate: ''
        }];
      } else {
        initialInsurances = [{ id: Date.now(), provider: '', details: '', startDate: '', endDate: '' }];
      }

      const rel = editingCustomer.relationship || '지인';
      const standardRels = ['지인', '가족', '소개', '개척', '직장동료', '동호회'];
      const isCustomRel = rel && !standardRels.includes(rel);

      setFormData({
        name: editingCustomer.name || '',
        phone: editingCustomer.phone || '',
        birth_date: editingCustomer.birth_date || '',
        relationship: isCustomRel ? '기타' : rel,
        pool_group: editingCustomer.pool_group || 'A',
        is_pool: editingCustomer.is_pool ? 1 : 0,
        referrer_id: editingCustomer.referrer_id || '',
        insurances: initialInsurances,
        status: editingCustomer.status || 'Active',
        notes: editingCustomer.notes || '',
        report_pdf_path: editingCustomer.report_pdf_path || '',
        report_excel_path: editingCustomer.report_excel_path || ''
      });
      if (isCustomRel) setCustomRelationship(rel);
      else setCustomRelationship('');

      setReferrerSearch(editingCustomer.referrer_name || '');

      // Auto-parse report on modal open if attached but no insurances filled in
      const hasEmptyInsurances = !initialInsurances.some(i => i.provider || i.details);
      const autoPath = editingCustomer.report_excel_path || editingCustomer.report_pdf_path;
      if (autoPath && hasEmptyInsurances) {
        api.customers.parseReportPdf(autoPath).then(res => {
          if (res && res.success && res.insurances && res.insurances.length > 0) {
            setFormData(prev => ({
              ...prev,
              insurances: res.insurances
            }));
          }
        }).catch(err => {
          console.error('Auto-parse report error on modal open:', err);
        });
      }
    } else {
      setFormData({
        name: '',
        phone: '',
        birth_date: '',
        relationship: '지인',
        pool_group: 'A',
        is_pool: isPoolCustomerModal ? 1 : 0,
        referrer_id: '',
        insurances: [{ id: Date.now(), provider: '', details: '', startDate: '', endDate: '' }],
        status: isPoolCustomerModal ? 'Lead' : 'Active',
        notes: '',
        report_pdf_path: '',
        report_excel_path: ''
      });
      setCustomRelationship('');
    }
    setReferrerSearch('');
    setIsReferrerOpen(false);
  }, [editingCustomer, isPoolCustomerModal, isOpen]);

  // Click outside to close referrer dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsReferrerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleSearchChange = (e) => {
    setReferrerSearch(e.target.value);
    setIsReferrerOpen(true);
  };

  const handleReferrerSelect = (referrerId) => {
    setFormData({ ...formData, referrer_id: referrerId });
    setIsReferrerOpen(false);
  };

  const filteredReferrers = (customers || []).filter(c => {
    if (editingCustomer && c.id === editingCustomer.id) return false;
    if (!referrerSearch.trim()) return true;
    const term = referrerSearch.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.phone && c.phone.includes(term)) ||
      (c.insurance_provider && c.insurance_provider.toLowerCase().includes(term))
    );
  });

  const selectedReferrer = (customers || []).find(c => String(c.id) === String(formData.referrer_id));

  const handleAddInsurance = () => {
    setFormData(prev => ({
      ...prev,
      insurances: [
        ...(prev.insurances || []),
        { id: Date.now(), provider: '', details: '', startDate: '', endDate: '' }
      ]
    }));
  };

  const handleRemoveInsurance = (id) => {
    setFormData(prev => ({
      ...prev,
      insurances: (prev.insurances || []).filter(item => item.id !== id)
    }));
  };

  const handleInsuranceChange = (id, field, value) => {
    setFormData(prev => ({
      ...prev,
      insurances: (prev.insurances || []).map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleParseReportFile = async (targetFilePath = null, fileType = 'auto') => {
    try {
      setIsParsingPdf(true);
      const filePathToParse = (typeof targetFilePath === 'string' && targetFilePath) ? targetFilePath : null;
      const res = await api.customers.parseReportPdf(filePathToParse);
      if (res.canceled) return;
      if (!res.success) {
        alert(`리포트 파싱 오류: ${res.error || '파일을 읽을 수 없습니다.'}`);
        return;
      }

      const extractedName = res.customerName || '';
      const insurancesCount = res.insurances ? res.insurances.length : 0;
      const resPath = res.filePath || '';
      const isExcel = resPath.endsWith('.xlsx') || resPath.endsWith('.xls');

      setFormData(prev => {
        const updateObj = {
          ...prev,
          name: prev.name || extractedName || '',
          insurances: insurancesCount > 0 ? res.insurances : prev.insurances
        };
        if (isExcel) {
          updateObj.report_excel_path = resPath || prev.report_excel_path || '';
        } else {
          updateObj.report_pdf_path = resPath || prev.report_pdf_path || '';
        }
        return updateObj;
      });

      const typeLabel = isExcel ? '엑셀' : 'PDF';
      if (insurancesCount > 0) {
        alert(`📄/📊 ${extractedName ? `'${extractedName}' 고객의 ` : ''}${typeLabel} 보장분석 리포트에서 총 ${insurancesCount}건의 보험 정보가 자동으로 입력되었습니다!`);
      } else {
        alert(`📄/📊 보장분석 ${typeLabel} 리포트가 첨부되었습니다.`);
      }
    } catch (err) {
      alert(`리포트 처리 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsParsingPdf(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.name.trim()) return;

    if (!isOwner) {
      alert('해당 고객을 등록한 담당자만 수정할 수 있습니다. (권한 없음)');
      return;
    }

    // Safely filter and clean insurance entries
    const validInsurances = (formData.insurances || [])
      .map(item => ({
        provider: (item.provider || '').trim(),
        details: (item.details || '').trim(),
        startDate: (item.startDate || '').trim(),
        endDate: (item.endDate || '').trim()
      }))
      .filter(item => item.provider !== '' || item.details !== '' || item.startDate !== '' || item.endDate !== '');

    const resolvedRelationship = formData.relationship === '기타' 
      ? (customRelationship.trim() || '기타') 
      : (formData.relationship || '지인');

    saveCustomer({
      name: (formData.name || '').trim(),
      email: (formData.email || '').trim(),
      phone: (formData.phone || '').trim(),
      birth_date: (formData.birth_date || '').trim(),
      relationship: resolvedRelationship,
      pool_group: formData.pool_group || 'A',
      is_pool: isPoolCustomerModal ? 1 : (formData.is_pool ? 1 : 0),
      referrer_id: formData.referrer_id ? Number(formData.referrer_id) : null,
      insurances: validInsurances,
      status: formData.status || (isPoolCustomerModal ? 'Lead' : 'Active'),
      notes: (formData.notes || '').trim(),
      report_pdf_path: formData.report_pdf_path || '',
      report_excel_path: formData.report_excel_path || ''
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-scaleUp max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <UserPlus className={`w-5 h-5 ${isPoolCustomerModal ? 'text-amber-400' : 'text-blue-400'}`} />
            <h3 className="font-semibold text-lg text-white">
              {editingCustomer 
                ? (isPoolCustomerModal ? '📋 POOL LIST 고객 수정' : '고객 정보 수정')
                : (isPoolCustomerModal ? '📋 POOL LIST 가망고객 등록' : '새 고객 등록')}
            </h3>
            {!isOwner && (
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center space-x-1">
                <Shield className="w-3 h-3 text-amber-400" />
                <span>🔒 타 조직원 담당 (조회 전용)</span>
              </span>
            )}
          </div>
          <button
            onClick={closeCustomerModal}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form (Scrollable) */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {/* POOL LIST Guide Banner */}
          {isPoolCustomerModal && !editingCustomer && (
            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-300 flex items-start space-x-2">
              <span className="text-base leading-none">💡</span>
              <div>
                <strong className="font-bold">POOL LIST 자동 분류 안내:</strong>
                <p className="text-[11px] text-amber-200/80 mt-0.5">
                  등록 시 기본으로 <strong>[가망고객]</strong>으로 자동 분류되며, 추후 보장분석/증권 입력 시 <strong>[보유고객]</strong>으로 자동 승격됩니다.
                </p>
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                성명 (이름) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="예: 홍길동"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                연락처 (전화번호)
              </label>
              <input
                type="text"
                placeholder="010-0000-0000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Relationship & Pool Group Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                관계 (Relationship)
              </label>
              <div className="space-y-1.5">
                <select
                  value={formData.relationship}
                  onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="지인">지인</option>
                  <option value="가족">가족 / 친척</option>
                  <option value="소개">소개 고객</option>
                  <option value="개척">개척 (DB/온라인/필드)</option>
                  <option value="직장동료">직장 동료 / 선후배</option>
                  <option value="동호회">동호회 / 모임</option>
                  <option value="기타">기타 (직접 입력)</option>
                </select>

                {formData.relationship === '기타' && (
                  <input
                    type="text"
                    placeholder="관계 직접 입력 (예: 동창, 이웃)"
                    value={customRelationship}
                    onChange={(e) => setCustomRelationship(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                그룹 선택
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'A', color: 'border-rose-500 text-rose-300 bg-rose-950/60' },
                  { key: 'B', color: 'border-amber-500 text-amber-300 bg-amber-950/60' },
                  { key: 'C', color: 'border-emerald-500 text-emerald-300 bg-emerald-950/60' },
                  { key: 'D', color: 'border-blue-500 text-blue-300 bg-blue-950/60' }
                ].map(grp => (
                  <button
                    key={grp.key}
                    type="button"
                    onClick={() => setFormData({ ...formData, pool_group: grp.key })}
                    className={`py-2 rounded-xl text-center border font-bold text-sm transition-all ${
                      formData.pool_group === grp.key
                        ? `${grp.color} ring-2 ring-indigo-400 scale-[1.02] shadow-md`
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {grp.key}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                <span>🎂 생년월일</span>
              </label>
              <input
                type="date"
                placeholder="YYYY-MM-DD"
                value={formData.birth_date || ''}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                고객 상태 분류
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-bold"
              >
                <option value="Lead">가망고객 (Lead)</option>
                <option value="Active">보유고객 (Active)</option>
                <option value="Inactive">장기미터치고객 (Inactive)</option>
              </select>
            </div>
          </div>

          {/* Searchable Referrer (소개자 실시간 검색 연동) */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center justify-between">
              <span className="flex items-center space-x-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>소개자 (등록된 다른 고객 검색 및 연동)</span>
              </span>
              {selectedReferrer && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, referrer_id: '' })}
                  className="text-[11px] text-slate-500 hover:text-red-400 underline"
                >
                  소개자 해제
                </button>
              )}
            </label>

            {selectedReferrer ? (
              <div className="bg-slate-900 border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                    {selectedReferrer.name ? selectedReferrer.name.charAt(0) : 'U'}
                  </div>
                  <div>
                    <span className="font-semibold text-sm text-white">{selectedReferrer.name}</span>
                    <span className="text-xs text-slate-400 ml-2">
                      {selectedReferrer.insurance_provider ? `(${selectedReferrer.insurance_provider})` : ''} {selectedReferrer.phone ? `• ${selectedReferrer.phone}` : ''}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, referrer_id: '' })}
                  className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800"
                  title="소개자 연결 취소"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div
                  onClick={() => setIsReferrerOpen(true)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white flex items-center justify-between cursor-pointer focus-within:border-emerald-500"
                >
                  <input
                    type="text"
                    placeholder="소개자 이름, 전화번호, 보험사 검색..."
                    value={referrerSearch}
                    onChange={(e) => {
                      setReferrerSearch(e.target.value);
                      setIsReferrerOpen(true);
                    }}
                    onFocus={() => setIsReferrerOpen(true)}
                    className="bg-transparent border-none outline-none text-white w-full placeholder-slate-500 text-sm"
                  />
                  <Search className="w-4 h-4 text-slate-500 shrink-0 ml-2" />
                </div>

                {isReferrerOpen && (
                  <div className="absolute z-30 left-0 right-0 mt-1 bg-[#111827] border border-slate-700 rounded-xl shadow-2xl max-h-52 overflow-y-auto custom-scrollbar animate-fadeIn">
                    <div
                      onClick={() => {
                        setFormData({ ...formData, referrer_id: '' });
                        setIsReferrerOpen(false);
                      }}
                      className="px-3.5 py-2.5 hover:bg-slate-800/80 cursor-pointer text-xs text-slate-400 border-b border-slate-800"
                    >
                      -- 소개자 없음 (자발적 가입 / 기타) --
                    </div>

                    {filteredReferrers.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        일치하는 고객 검색 결과가 없습니다.
                      </div>
                    ) : (
                      filteredReferrers.map((ref) => (
                        <div
                          key={ref.id}
                          onClick={() => {
                            setFormData({ ...formData, referrer_id: ref.id });
                            setIsReferrerOpen(false);
                          }}
                          className="px-3.5 py-2.5 hover:bg-slate-800 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-sm text-white">{ref.name}</span>
                            {ref.insurance_provider && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-indigo-400 border border-slate-700">
                                {ref.insurance_provider}
                              </span>
                            )}
                          </div>
                          {ref.phone && (
                            <span className="text-xs text-slate-400 font-mono">{ref.phone}</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dynamic Multiple Insurances Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-400">
                <Shield className="w-4 h-4" />
                <span>가입 보험사, 가입일자 & 내역 (다중 등록)</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleAddInsurance}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>보험사 추가</span>
                </button>
              </div>
            </div>

            {/* Dual Attachment Slots: PDF & Excel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {/* PDF Slot */}
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400 flex items-center space-x-1">
                    <FileText className="w-3.5 h-3.5" />
                    <span>보장분석 PDF</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleParseReportFile(null, 'pdf')}
                    disabled={isParsingPdf}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    {isParsingPdf ? '파싱중...' : formData.report_pdf_path ? '변경/추가' : '📄 PDF 첨부'}
                  </button>
                </div>
                {formData.report_pdf_path ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] text-slate-300 font-mono truncate bg-slate-950 p-1.5 rounded border border-slate-800" title={formData.report_pdf_path}>
                      {formData.report_pdf_path.split(/[\\/]/).pop()}
                    </div>
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        type="button"
                        onClick={() => handleParseReportFile(formData.report_pdf_path)}
                        disabled={isParsingPdf}
                        className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] transition-all"
                      >
                        ⚡ 보장내용 로드
                      </button>
                      <button
                        type="button"
                        onClick={() => api.customers.openPdf(formData.report_pdf_path)}
                        className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] transition-all"
                      >
                        📄 PDF 열람
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">등록된 PDF 파일 없음</p>
                )}
              </div>

              {/* Excel Slot */}
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-teal-400 flex items-center space-x-1">
                    <FileText className="w-3.5 h-3.5" />
                    <span>보장분석 엑셀</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleParseReportFile(null, 'excel')}
                    disabled={isParsingPdf}
                    className="text-[11px] font-bold text-teal-400 hover:text-teal-300 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-md hover:bg-teal-500/20 transition-all disabled:opacity-50"
                  >
                    {isParsingPdf ? '파싱중...' : formData.report_excel_path ? '변경/추가' : '📊 엑셀 첨부'}
                  </button>
                </div>
                {formData.report_excel_path ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] text-slate-300 font-mono truncate bg-slate-950 p-1.5 rounded border border-slate-800" title={formData.report_excel_path}>
                      {formData.report_excel_path.split(/[\\/]/).pop()}
                    </div>
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        type="button"
                        onClick={() => handleParseReportFile(formData.report_excel_path)}
                        disabled={isParsingPdf}
                        className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] transition-all"
                      >
                        ⚡ 보장내용 로드
                      </button>
                      <button
                        type="button"
                        onClick={() => api.customers.openPdf(formData.report_excel_path)}
                        className="px-2 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white font-bold text-[10px] transition-all"
                      >
                        📊 엑셀 열람
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">등록된 엑셀 파일 없음</p>
                )}
              </div>
            </div>

            {(!formData.insurances || formData.insurances.length === 0) ? (
              <p className="text-xs text-slate-500 py-2 text-center">
                등록된 보험사가 없습니다. "+ 보험사 추가" 버튼을 누르세요.
              </p>
            ) : (
              <div className="space-y-3">
                {formData.insurances.map((item, index) => {
                  const elapsedMonths = calculateElapsedMonths(item.startDate);
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5 relative group hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-400">
                          보험사 #{index + 1}
                        </span>
                        {formData.insurances.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveInsurance(item.id)}
                            className="text-slate-500 hover:text-red-400 p-1 rounded-lg hover:bg-slate-800 transition-colors"
                            title="이 보험사 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            placeholder="보험사명 (예: 삼성화재, 현대해상)"
                            value={item.provider || ''}
                            onChange={(e) => handleInsuranceChange(item.id, 'provider', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                          />

                          <div className="relative flex items-center">
                            <input
                              type="date"
                              value={item.startDate || ''}
                              onChange={(e) => handleInsuranceChange(item.id, 'startDate', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div className="relative flex items-center">
                            <input
                              type="date"
                              value={item.endDate || ''}
                              onChange={(e) => handleInsuranceChange(item.id, 'endDate', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                              title="보험 만기일"
                            />
                          </div>
                        </div>

                        {/* Calculated Elapsed Months Badge */}
                        {(item.startDate || item.endDate) && (
                          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/70 text-indigo-300 border border-indigo-800/50 text-[11px] font-medium">
                            <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            {item.startDate && <span>가입일: {item.startDate}</span>}
                            {item.startDate && elapsedMonths !== null && <span className="text-amber-400 font-bold ml-1">({elapsedMonths}개월차)</span>}
                            {item.endDate && <span className="ml-2 text-red-300">만기일: {item.endDate}</span>}
                          </div>
                        )}

                        <textarea
                          rows={2}
                          placeholder="가입 보험 내용 (예: 실손의료비보험 5만원, 운전자보험 3만원)"
                          value={item.details || ''}
                          onChange={(e) => handleInsuranceChange(item.id, 'details', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              기타 상담 메모
            </label>
            <textarea
              rows={2}
              placeholder="상담 특이사항 또는 기타 메모..."
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Footer buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between shrink-0">
            {!isOwner ? (
              <span className="text-xs text-amber-400 font-semibold flex items-center space-x-1">
                <Shield className="w-3.5 h-3.5" />
                <span>해당 고객을 등록한 담당자만 수정할 수 있습니다.</span>
              </span>
            ) : <div />}

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={closeCustomerModal}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                {isOwner ? '취소' : '닫기'}
              </button>
              {isOwner && (
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white flex items-center space-x-2 shadow-lg shadow-blue-600/30 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingCustomer ? '수정 내용 저장' : '고객 저장'}</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
