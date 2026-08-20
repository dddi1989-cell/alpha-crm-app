import React, { useState, useEffect } from 'react';
import { X, Calendar, Save, Bell } from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';

export default function ScheduleModal() {
  const isOpen = useCrmStore((state) => state.isScheduleModalOpen);
  const editingSchedule = useCrmStore((state) => state.editingSchedule);
  const customers = useCrmStore((state) => state.customers);
  const closeScheduleModal = useCrmStore((state) => state.closeScheduleModal);
  const saveSchedule = useCrmStore((state) => state.saveSchedule);
  const currentUser = useCrmStore((state) => state.currentUser);
  const myId = currentUser ? Number(currentUser.id) : 1;
  const isOwner = !editingSchedule || editingSchedule.user_id == null ? myId === 1 : Number(editingSchedule.user_id) === myId;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    customer_id: '',
    scheduled_at: '',
    reminder_offset_minutes: 0,
    status: 'Pending'
  });

  const initialScheduleData = useCrmStore((state) => state.initialScheduleData);

  useEffect(() => {
    if (editingSchedule) {
      let formattedDate = editingSchedule.scheduled_at;
      if (formattedDate) {
        const d = new Date(formattedDate);
        if (!isNaN(d.getTime())) {
          formattedDate = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        }
      }
      setFormData({
        ...editingSchedule,
        customer_id: editingSchedule.customer_id || '',
        scheduled_at: formattedDate || '',
        reminder_offset_minutes: editingSchedule.reminder_offset_minutes ?? 0,
        status: editingSchedule.status || 'Pending'
      });
    } else {
      const defaultDate = new Date(Date.now() + 3600000);
      const localISO = new Date(defaultDate.getTime() - (defaultDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
      
      setFormData({
        title: initialScheduleData?.title || '',
        description: '',
        customer_id: initialScheduleData?.customer_id || customers[0]?.id || '',
        scheduled_at: initialScheduleData?.scheduled_at || localISO,
        reminder_offset_minutes: 10,
        status: 'Pending'
      });
    }
  }, [editingSchedule, isOpen, customers, initialScheduleData]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isOwner) {
      alert('본인이 등록한 일정만 수정할 수 있습니다. (권한 없음)');
      return;
    }
    if (!formData.title.trim() || !formData.scheduled_at) return;
    
    const isoDate = new Date(formData.scheduled_at).toISOString();
    saveSchedule({
      ...formData,
      customer_id: formData.customer_id ? Number(formData.customer_id) : null,
      scheduled_at: isoDate,
      reminder_offset_minutes: Number(formData.reminder_offset_minutes) || 0
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-scaleUp">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="font-semibold text-lg text-white">
                {editingSchedule ? (isOwner ? '일정 정보 수정' : '일정 정보 조회 (조회 전용)') : '새 일정 / 알림 등록'}
              </h3>
              {editingSchedule?.user_name && (
                <span className="text-xs text-slate-400">담당자: {editingSchedule.user_name}</span>
              )}
            </div>
          </div>
          <button
            onClick={closeScheduleModal}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              일정 제목 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              disabled={!isOwner}
              placeholder="예: 영업 미팅 및 계약 팔로업"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                연결할 고객
              </label>
              <select
                value={formData.customer_id}
                disabled={!isOwner}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">-- 연결 없음 (일반) --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.insurance_provider ? `(${c.insurance_provider})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                일정 일시 <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                required
                disabled={!isOwner}
                value={formData.scheduled_at}
                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center space-x-1">
                <Bell className="w-3.5 h-3.5 text-indigo-400" />
                <span>미리 알림 설정</span>
              </label>
              <select
                value={formData.reminder_offset_minutes}
                disabled={!isOwner}
                onChange={(e) => setFormData({ ...formData, reminder_offset_minutes: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value={0}>⏰ 정시 알림 (일정 시간)</option>
                <option value={5}>🔔 5분 전 미리 알림</option>
                <option value={10}>🔔 10분 전 미리 알림</option>
                <option value={15}>🔔 15분 전 미리 알림</option>
                <option value={30}>🔔 30분 전 미리 알림</option>
                <option value={60}>🔔 1시간 전 미리 알림</option>
                <option value={120}>🔔 2시간 전 미리 알림</option>
                <option value={1440}>📅 1일 전 (24시간 전) 알림</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                상태
              </label>
              <select
                value={formData.status}
                disabled={!isOwner}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="Pending">대기 중 (Pending)</option>
                <option value="Completed">완료됨 (Completed)</option>
                <option value="Cancelled">취소됨 (Cancelled)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              상세 설명 / 메모
            </label>
            <textarea
              rows={3}
              disabled={!isOwner}
              placeholder="미팅 안건, 알림 내용 또는 메모를 입력하세요..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end space-x-3">
            <button
              type="button"
              onClick={closeScheduleModal}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              {isOwner ? '취소' : '닫기'}
            </button>
            {isOwner && (
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white flex items-center space-x-2 shadow-lg shadow-indigo-600/30 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>{editingSchedule ? '수정 내용 저장' : '일정 저장'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
