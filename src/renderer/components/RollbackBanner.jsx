import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';

export default function RollbackBanner() {
  const dismissRollbackAlert = useCrmStore((state) => state.dismissRollbackAlert);

  return (
    <div className="bg-amber-950/80 border-b border-amber-500/30 text-amber-200 px-4 py-3 shadow-lg flex items-center justify-between backdrop-blur-md animate-fadeIn">
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
          <AlertTriangle className="w-5 h-5 animate-bounce" />
        </div>
        <div>
          <h4 className="font-semibold text-sm text-amber-300">
            자동 데이터베이스 복구(Rollback) 실행됨
          </h4>
          <p className="text-xs text-amber-200/80">
            비정상적인 이전 종료로 인해, 데이터를 마지막 정상 백업 시점으로 복구하였습니다.
          </p>
        </div>
      </div>
      <button
        onClick={dismissRollbackAlert}
        className="p-1.5 rounded-lg hover:bg-amber-500/20 text-amber-400 hover:text-white transition-colors"
        title="알림 닫기"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
