import React, { useEffect } from 'react';
import { Bell, Calendar, Clock, User, CheckCircle2, X, ExternalLink, ShieldCheck } from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';

function getReminderLabel(offset) {
  const num = Number(offset) || 0;
  if (num === 0) return '정시 알림';
  if (num < 60) return `${num}분 전 알림`;
  if (num < 1440) return `${Math.floor(num / 60)}시간 전 알림`;
  return `${Math.floor(num / 1440)}일 전 알림`;
}

function playNotificationChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    
    // Note 1 (E5)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Note 2 (B5)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.12);
    gain2.gain.setValueAtTime(0.2, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch (e) {
    // Ignore audio autoplay restrictions
  }
}

export default function ScheduleAlertModal() {
  const dueScheduleAlerts = useCrmStore((state) => state.dueScheduleAlerts);
  const dismissDueScheduleAlert = useCrmStore((state) => state.dismissDueScheduleAlert);
  const toggleScheduleStatus = useCrmStore((state) => state.toggleScheduleStatus);
  const setActiveTab = useCrmStore((state) => state.setActiveTab);

  const currentAlert = dueScheduleAlerts[0];

  useEffect(() => {
    if (currentAlert) {
      playNotificationChime();
    }
  }, [currentAlert?.id]);

  if (!currentAlert) return null;

  const scheduledDate = new Date(currentAlert.scheduled_at);
  const formattedTime = scheduledDate.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

  const handleComplete = async () => {
    await toggleScheduleStatus(currentAlert);
    dismissDueScheduleAlert(currentAlert.id);
  };

  const handleGoToSchedules = () => {
    setActiveTab('schedules');
    dismissDueScheduleAlert(currentAlert.id);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      {/* Glow Backdrop */}
      <div className="absolute w-96 h-96 bg-amber-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-md bg-slate-900/95 border border-amber-500/40 rounded-3xl shadow-2xl shadow-amber-500/20 overflow-hidden flex flex-col transform transition-all duration-300 scale-100">
        
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 p-5 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/30 animate-bounce">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded-full">
                  {getReminderLabel(currentAlert.reminder_offset_minutes)}
                </span>
                {dueScheduleAlerts.length > 1 && (
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-bold">
                    1 / {dueScheduleAlerts.length}건
                  </span>
                )}
              </div>
              <h3 className="font-['Outfit',sans-serif] text-lg font-bold mt-0.5 leading-tight">
                일정 알림이 도달했습니다!
              </h3>
            </div>
          </div>

          <button
            onClick={() => dismissDueScheduleAlert(currentAlert.id)}
            className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/30 flex items-center justify-center text-white/80 hover:text-white transition-colors"
            title="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-slate-200">
          {/* Title */}
          <div>
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">일정 제목</span>
            <h4 className="text-xl font-bold text-white mt-1 leading-snug">
              {currentAlert.title}
            </h4>
          </div>

          {/* Scheduled Date/Time & Customer Info */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center space-x-3 text-sm">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-slate-300 font-medium">{formattedTime}</span>
            </div>

            {currentAlert.customer_name && (
              <div className="flex items-center space-x-3 text-sm">
                <User className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="text-slate-200 font-semibold">{currentAlert.customer_name}</span>
                {currentAlert.customer_insurance_provider && (
                  <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-md">
                    {currentAlert.customer_insurance_provider}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          {currentAlert.description && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 leading-relaxed max-h-28 overflow-y-auto custom-scrollbar">
              {currentAlert.description}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-5 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between gap-3">
          <button
            onClick={handleGoToSchedules}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition-all flex items-center justify-center space-x-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>일정 관리로 이동</span>
          </button>

          <button
            onClick={handleComplete}
            className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center space-x-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>완료 처리</span>
          </button>

          <button
            onClick={() => dismissDueScheduleAlert(currentAlert.id)}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/30 transition-all"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
