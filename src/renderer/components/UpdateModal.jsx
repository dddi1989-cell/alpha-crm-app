import React, { useState, useEffect } from 'react';
import { Sparkles, Download, CheckCircle2, AlertCircle, RefreshCw, X, ShieldCheck, Check } from 'lucide-react';
import { api } from '../utils/api';
import { useCrmStore } from '../store/useCrmStore';

export default function UpdateModal() {
  const updateAvailableInfo = useCrmStore((state) => state.updateAvailableInfo);
  const closeUpdateModal = useCrmStore((state) => state.closeUpdateModal);

  const [isApplying, setIsApplying] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [progressInfo, setProgressInfo] = useState(null);

  useEffect(() => {
    if (api.onUpdateProgress) {
      const unsub = api.onUpdateProgress((prog) => {
        setProgressInfo(prog);
        setStatusText(`패치 다운로드 중... (${prog.percent}% - ${prog.downloadedMB}MB / ${prog.totalMB}MB)`);
      });
      return () => {
        if (typeof unsub === 'function') unsub();
      };
    }
  }, []);

  if (!updateAvailableInfo) return null;

  const isNewUpdate = !!updateAvailableInfo.updateAvailable;
  const currentVer = updateAvailableInfo.currentVersion || '1.4.3';
  const latestVer = updateAvailableInfo.latestVersion || currentVer;

  const handleApplyUpdate = async (overrideUrl = null) => {
    setIsApplying(true);
    setErrorMsg('');
    setProgressInfo(null);
    setStatusText('원격 패치 서버 연결 중...');

    try {
      const downloadUrl = overrideUrl || updateAvailableInfo.downloadUrl;
      const res = await api.system.downloadAndApplyUpdate(downloadUrl);
      if (res?.success === false) {
        setErrorMsg(res?.error || '패치 적용 중 오류가 발생했습니다.');
        setIsApplying(false);
      } else {
        setStatusText('패치 다운로드 완료! 프로그램을 100% 자동 재시작합니다...');
      }
    } catch (err) {
      setErrorMsg('패치 설치 실패: ' + err.message);
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none">
      <div className="bg-[#0f172a] border border-indigo-500/50 rounded-3xl p-6 w-full max-w-lg shadow-2xl shadow-indigo-950/80 space-y-6 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-indigo-600/20 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${isNewUpdate ? 'bg-gradient-to-br from-amber-500 to-indigo-600 shadow-amber-500/30' : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'}`}>
              {isNewUpdate ? <Sparkles className="w-6 h-6 animate-pulse" /> : <CheckCircle2 className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="font-['Outfit',sans-serif] text-lg font-extrabold text-white tracking-tight flex items-center space-x-2">
                <span>{isNewUpdate ? '🚀 서버 신규 패치 감지' : '✅ 최신 버전을 사용 중입니다'}</span>
                <span className={`px-2 py-0.5 border rounded-full text-xs font-bold ${isNewUpdate ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'}`}>
                  v{latestVer}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isNewUpdate
                  ? '원격 패치 서버에서 최신 신규 패치가 감지되었습니다. 지금 설치하시겠습니까?'
                  : '온라인 패치 서버 연결 완료. 시스템의 모든 기능이 최신 상태입니다.'}
              </p>
            </div>
          </div>

          {!isApplying && (
            <button
              onClick={closeUpdateModal}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Version Comparison Box */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-around text-center">
          <div>
            <span className="text-[11px] text-slate-400 block font-semibold">현재 실행 버전</span>
            <span className="text-sm font-bold text-slate-300 font-mono">v{currentVer}</span>
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-base ${isNewUpdate ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            {isNewUpdate ? '➔' : '✓'}
          </div>
          <div>
            <span className={`text-[11px] block font-semibold ${isNewUpdate ? 'text-amber-400' : 'text-emerald-400'}`}>
              {isNewUpdate ? '패치 후 버전' : '서버 게시 버전'}
            </span>
            <span className={`text-sm font-extrabold font-mono ${isNewUpdate ? 'text-amber-300' : 'text-emerald-300'}`}>
              v{latestVer}
            </span>
          </div>
        </div>

        {/* Release Notes or Info Box */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{isNewUpdate ? '신규 업데이트 패치 주요 내역' : '온라인 패치 서버 연결 상태'}</span>
          </label>
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 text-xs text-slate-300 space-y-1.5 max-h-36 overflow-y-auto leading-relaxed">
            {updateAvailableInfo.releaseNotes ? (
              updateAvailableInfo.releaseNotes.split('\n').map((line, idx) => (
                <div key={idx} className="flex items-start space-x-1.5">
                  <span className="text-indigo-400 shrink-0">•</span>
                  <span>{line}</span>
                </div>
              ))
            ) : isNewUpdate ? (
              <p>최신 기능 개선, 성능 최적화 및 보안 데이터 보호 패치가 포함되어 있습니다.</p>
            ) : (
              <div className="space-y-1 text-slate-400">
                <p>• GitHub 공개 서버(`dddi1989-cell/alpha-crm-app`)와 실시간 200 OK 수신 완료</p>
                <p>• 계정별 데이터 분리 및 무인 자동 업데이트 엔진이 정상 작동 중입니다.</p>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar & Applying State Indicator */}
        {isApplying && (
          <div className="bg-slate-900/90 border border-indigo-500/40 rounded-2xl p-4 space-y-2.5 animate-fadeIn">
            <div className="flex items-center justify-between text-xs">
              <span className="text-indigo-300 font-bold flex items-center space-x-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span>{statusText}</span>
              </span>
              {progressInfo?.percent !== undefined && (
                <span className="text-white font-mono font-extrabold bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                  {progressInfo.percent}%
                </span>
              )}
            </div>

            <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5">
              <div
                className="bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-sm"
                style={{ width: `${progressInfo?.percent || (statusText.includes('완료') ? 100 : 15)}%` }}
              />
            </div>

            {progressInfo?.totalMB && (
              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>다운로드 용량: {progressInfo.downloadedMB} MB / {progressInfo.totalMB} MB</span>
                <span>무인 핫스왑 준비 완료</span>
              </div>
            )}
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-red-950/80 border border-red-500/50 text-red-300 p-3 rounded-2xl flex items-center space-x-2 text-xs">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex items-center space-x-3">
          {!isApplying && (
            <button
              onClick={closeUpdateModal}
              className="w-1/3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors"
            >
              {isNewUpdate ? '나중에 하기' : '닫기'}
            </button>
          )}

          {isNewUpdate ? (
            <button
              onClick={() => handleApplyUpdate()}
              disabled={isApplying}
              className={`${isApplying ? 'w-full' : 'w-2/3'} py-3.5 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-80 active:scale-98`}
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>{statusText}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>🚀 최신 버전 업데이트 및 즉시 재시작</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => handleApplyUpdate()}
              disabled={isApplying}
              className={`${isApplying ? 'w-full' : 'w-2/3'} py-3.5 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2 active:scale-98`}
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>{statusText}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>🚀 최신 버전 업데이트</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
