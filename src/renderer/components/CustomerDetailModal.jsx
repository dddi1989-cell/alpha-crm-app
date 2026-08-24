import React, { useMemo, useState } from 'react';
import { X, User, Phone, Mail, Shield, Calendar, Clock, CheckCircle2, Plus, Edit2, UserCheck, AlertCircle, FileText, Zap } from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';
import { api } from '../utils/api';
import { getSolarBirthdayInYear } from '../utils/lunarSolar';

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

export default function CustomerDetailModal() {
  const isOpen = useCrmStore((state) => state.isCustomerDetailModalOpen);
  const customer = useCrmStore((state) => state.detailCustomer);
  const closeCustomerDetailModal = useCrmStore((state) => state.closeCustomerDetailModal);
  const openCustomerModal = useCrmStore((state) => state.openCustomerModal);
  const openScheduleModal = useCrmStore((state) => state.openScheduleModal);
  const toggleScheduleStatus = useCrmStore((state) => state.toggleScheduleStatus);
  const schedules = useCrmStore((state) => state.schedules);
  const customers = useCrmStore((state) => state.customers);
  const loadAllData = useCrmStore((state) => state.loadAllData);
  const currentUser = useCrmStore((state) => state.currentUser);

  const [isExtracting, setIsExtracting] = useState(false);

  const handleReParsePdfForDetail = async () => {
    const targetFile = customer?.report_excel_path || customer?.report_pdf_path;
    if (!targetFile) return;
    try {
      setIsExtracting(true);
      const res = await api.customers.parseReportPdf(targetFile);
      if (res.canceled) return;

      if (res && res.success && res.insurances && res.insurances.length > 0) {
        await api.customers.update({
          ...customer,
          insurances: res.insurances,
          report_pdf_path: customer.report_pdf_path,
          report_excel_path: customer.report_excel_path
        });
        await loadAllData();
        alert(`📄/📊 ${customer.name} 고객의 리포트 파일에서 총 ${res.insurances.length}건의 보험 정보가 로드되었습니다!`);
      } else if (res && res.error) {
        alert(`리포트 처리 알림: ${res.error}`);
      } else {
        alert('첨부된 파일에서 보장 항목을 찾지 못했습니다.');
      }
    } catch (err) {
      alert(`리포트 처리 중 오류: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Filter schedules for this customer within the last 3 years, sorted descending
  const recentSchedules = useMemo(() => {
    if (!customer) return [];
    
    const now = new Date();
    // 3 years ago from today
    const threeYearsAgo = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());

    return schedules
      .filter((s) => {
        const isCustomerMatch = (s.customer_id && Number(s.customer_id) === Number(customer.id)) ||
                                (s.customer_name && s.customer_name === customer.name);
        if (!isCustomerMatch) return false;
        
        const scheduledDate = new Date(s.scheduled_at);
        return !isNaN(scheduledDate.getTime()) && scheduledDate >= threeYearsAgo;
      })
      .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at)); // Descending by date (최근순)
  }, [schedules, customer]);

  if (!isOpen || !customer) return null;

  // Find referrer object if exists
  const referrer = customer.referrer_id
    ? customers.find((c) => String(c.id) === String(customer.referrer_id))
    : null;

  const insurancesList = Array.isArray(customer.insurances) ? customer.insurances : [];

  const myId = currentUser ? Number(currentUser.id) : 1;
  const isOwner = customer?.user_id == null ? myId === 1 : Number(customer.user_id) === myId;

  const handleEditClick = () => {
    if (!isOwner) {
      alert('해당 고객을 등록한 담당자만 수정할 수 있습니다. (권한 없음)');
      return;
    }
    closeCustomerDetailModal();
    openCustomerModal(customer);
  };

  const handleAddScheduleClick = () => {
    const defaultDate = new Date(Date.now() + 3600000);
    const localISO = new Date(defaultDate.getTime() - (defaultDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    openScheduleModal(null, {
      customer_id: customer.id,
      title: `${customer.name} 고객 미팅`,
      scheduled_at: localISO
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl shadow-black/80 overflow-hidden animate-scaleUp">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg">
              {customer.name ? customer.name.charAt(0) : '고'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-['Outfit',sans-serif] text-xl font-bold text-white tracking-tight">
                  {customer.name}
                </h3>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  customer.status === 'Active'
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                    : customer.status === 'Lead'
                    ? 'bg-blue-950/80 text-blue-400 border-blue-800/60'
                    : 'bg-rose-950/80 text-rose-300 border-rose-800/60'
                }`}>
                  {customer.status === 'Active' ? '보유고객' : customer.status === 'Lead' ? '가망고객' : '장기미터치고객'}
                </span>
                {!isOwner && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    🔒 타 조직원 담당 (조회 전용)
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 mt-1">
                {customer.user_name && (
                  <span className="text-xs text-indigo-300 font-semibold bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-800/60">
                    👤 담당: {customer.user_name} ({customer.user_role || 'FA'}) {customer.user_org_name ? `· ${customer.user_org_name}` : ''}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {customer.user_name ? `담당자: ${customer.user_name} | ` : ''}고객 상세 정보 및 최근 3년 이내 일정 조회
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isOwner && (
              <button
                onClick={handleEditClick}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center space-x-1.5 border border-slate-700 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>수정</span>
              </button>
            )}
            <button
              onClick={closeCustomerDetailModal}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          
          {/* Customer Info Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contact Details */}
            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-2.5">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span>연락처 및 연동 정보</span>
              </h4>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-500">전화번호</span>
                  <span className="text-white font-medium font-mono">{customer.phone || '미등록'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-500">생년월일</span>
                  {customer.birth_date ? (
                    <div className="flex items-center space-x-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        customer.birth_type === 'lunar' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-blue-950 text-blue-300 border border-blue-800'
                      }`}>
                        {customer.birth_type === 'lunar' ? '음력' : '양력'}
                      </span>
                      <span className="text-indigo-300 font-bold">
                        🎂 {customer.birth_date}
                      </span>
                      {customer.birth_type === 'lunar' && (() => {
                        const bInfo = getSolarBirthdayInYear(customer);
                        return bInfo ? (
                          <span className="text-[11px] text-purple-300 bg-purple-950/40 px-1.5 py-0.5 rounded">
                            (올해 양력: {bInfo.month + 1}월 {bInfo.day}일)
                          </span>
                        ) : null;
                      })()}
                    </div>
                  ) : (
                    <span className="text-slate-500 font-medium">미등록</span>
                  )}
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-500">관계 / POOL 그룹</span>
                  <div className="flex items-center space-x-1.5">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                      {customer.relationship || '지인'}
                    </span>
                    {customer.pool_group && (
                      <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold text-[10px]">
                        {customer.pool_group}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">소개자</span>
                  {referrer ? (
                    <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                      <UserCheck className="w-3 h-3" />
                      <span>{referrer.name} ({referrer.phone || '소개자'})</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">{customer.referrer_name || '소개자 없음'}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Insurance Summary */}
            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-400" />
                  <span>가입 보험 현황</span>
                </h4>
                <div className="flex flex-wrap items-center gap-1.5">
                  {customer.report_pdf_path && (
                    <button
                      onClick={() => api.customers.openPdf(customer.report_pdf_path)}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-bold transition-all"
                      title="등록된 보장분석 PDF 파일 열람"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>📄 PDF 열람</span>
                    </button>
                  )}
                  {customer.report_excel_path && (
                    <button
                      onClick={() => api.customers.openPdf(customer.report_excel_path)}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 hover:bg-teal-500/20 text-[11px] font-bold transition-all"
                      title="등록된 보장분석 엑셀 파일 열람"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>📊 엑셀 열람</span>
                    </button>
                  )}
                  {isOwner && (customer.report_pdf_path || customer.report_excel_path) && (
                    <button
                      onClick={handleReParsePdfForDetail}
                      disabled={isExtracting}
                      className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 text-[11px] font-bold transition-all disabled:opacity-50"
                      title="첨부된 파일에서 가입 보험사/상품/보장만기 정보를 읽어와 입력"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{isExtracting ? '추출 중...' : '⚡ 보장내용 로드'}</span>
                    </button>
                  )}
                </div>
              </div>

              {insurancesList.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">등록된 보험 정보가 없습니다.</p>
              ) : (
                <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
                  {insurancesList.map((ins, idx) => {
                    const startDateStr = ins.startDate || ins.start_date || '';
                    const elapsedMonths = calculateElapsedMonths(startDateStr);
                    return (
                      <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/90 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-300">{ins.provider || '미지정 보험사'}</span>
                          {elapsedMonths !== null && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/60">
                              {elapsedMonths}개월차
                            </span>
                          )}
                        </div>
                        {startDateStr && (
                          <div className="text-[11px] text-slate-400">가입일: {startDateStr}</div>
                        )}
                        {(ins.endDate || ins.end_date) && (
                          <div className="text-[11px] text-red-300">만기일: {ins.endDate || ins.end_date}</div>
                        )}
                        {ins.details && (
                          <div className="text-[11px] text-slate-300 line-clamp-2">{ins.details}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Customer Notes */}
          {customer.notes && (
            <div className="bg-slate-900/50 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
              <span className="text-xs font-bold text-slate-400 flex items-center space-x-1">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>상담 및 특이사항 메모</span>
              </span>
              <p className="text-xs text-slate-300 whitespace-pre-wrap pl-4">{customer.notes}</p>
            </div>
          )}

          {/* ========================================================================= */}
          {/* RECENT 3 YEARS SCHEDULES SECTION (최근 3년 이내 일정 목록) */}
          {/* ========================================================================= */}
          {/* Recent Schedules Section (Last 3 Years) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center space-x-2">
                    <span>최근 3년 이내 일정 목록</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/60">
                      {recentSchedules.length}건 (최근순 정렬)
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    현재 시점으로부터 최근 3년간 진행되었거나 예정된 이 고객의 전체 일정입니다. {!isOwner && '(조회 전용)'}
                  </p>
                </div>
              </div>

              {isOwner && (
                <button
                  onClick={handleAddScheduleClick}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-1 shadow-md transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>새 일정 추가</span>
                </button>
              )}
            </div>

            {recentSchedules.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800/60 space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-600 mx-auto opacity-60" />
                <p className="text-xs text-slate-400">최근 3년 이내에 등록된 일정이 없습니다.</p>
                {isOwner && (
                  <button
                    onClick={handleAddScheduleClick}
                    className="text-xs text-indigo-400 hover:underline font-semibold"
                  >
                    + 이 고객의 첫 일정 등록하기
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar">
                {recentSchedules.map((schedule) => {
                  const sDate = new Date(schedule.scheduled_at);
                  const formattedDate = sDate.toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short'
                  });
                  const formattedTime = sDate.toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  const isCompleted = schedule.status === 'Completed';

                  return (
                    <div
                      key={schedule.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between ${
                        isCompleted
                          ? 'bg-slate-900/40 border-slate-800/60 opacity-70'
                          : 'bg-slate-900/90 border-slate-800 hover:border-indigo-500/50 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        {isOwner ? (
                          <button
                            onClick={() => toggleScheduleStatus(schedule)}
                            className={`mt-0.5 p-1 rounded-lg border transition-colors ${
                              isCompleted
                                ? 'bg-emerald-950 border-emerald-700 text-emerald-400'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-emerald-400'
                            }`}
                            title={isCompleted ? '완료 취소' : '완료 처리'}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <div
                            className={`mt-0.5 p-1 rounded-lg border ${
                              isCompleted
                                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                                : 'bg-slate-800/60 border-slate-700 text-slate-500'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        )}

                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <h5 className={`text-xs font-bold ${isCompleted ? 'line-through text-slate-500' : 'text-white'}`}>
                              {schedule.title}
                            </h5>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              isCompleted
                                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                                : 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                            }`}>
                              {isCompleted ? '완료' : '예정'}
                            </span>
                          </div>

                          <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                            <span className="flex items-center text-amber-400 font-medium">
                              <Calendar className="w-3 h-3 mr-1" />
                              {formattedDate}
                            </span>
                            <span className="flex items-center text-slate-400">
                              <Clock className="w-3 h-3 mr-1 text-slate-500" />
                              {formattedTime}
                            </span>
                          </div>

                          {(schedule.memo || schedule.description) && (
                            <p className="text-[11px] text-slate-300 mt-1 pl-0.5 leading-relaxed">
                              {schedule.memo || schedule.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {isOwner && (
                        <button
                          onClick={() => {
                            closeCustomerDetailModal();
                            openScheduleModal(schedule);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-slate-800 transition-colors shrink-0"
                          title="일정 수정"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>ALPHA 고객관리Tool • 고객별 최근 3년 일정 자동 정렬</span>
          <button
            onClick={closeCustomerDetailModal}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
