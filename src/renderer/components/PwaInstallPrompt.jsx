import React, { useState, useEffect } from 'react';
import { Smartphone, X, Share2, PlusSquare, ArrowDown } from 'lucide-react';
import { isElectron } from '../utils/api';

export default function PwaInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // If in electron desktop, never show
    if (isElectron) return;

    // Check if already dismissed
    const dismissed = localStorage.getItem('wlb_pwa_prompt_dismissed');
    if (dismissed) return;

    // Check standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) return;

    // Catch Chrome PWA prompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // On iOS Safari, show prompt after 2 seconds
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      setTimeout(() => setShowPrompt(true), 2000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else {
      setShowGuideModal(true);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('wlb_pwa_prompt_dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <>
      <div className="md:hidden bg-gradient-to-r from-indigo-900/90 via-slate-900 to-amber-950/80 border-b border-indigo-500/40 p-2.5 px-4 flex items-center justify-between shadow-xl animate-fadeIn">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-xl bg-indigo-600 text-white shadow-md">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-black text-white">홈 화면에 WLB CRM 앱 추가</p>
            <p className="text-[10px] text-indigo-200">설치 없이 앱처럼 전체화면으로 빠르게 사용하세요</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleInstallClick}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] rounded-lg shadow-md active:scale-95 transition-all"
          >
            앱 추가
          </button>
          <button onClick={handleDismiss} className="text-slate-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Guide Modal for iOS / Browser */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0f172a] border border-indigo-500/50 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                <Smartphone className="w-4 h-4 text-indigo-400" />
                <span>홈 화면에 WLB CRM 추가 방법</span>
              </h3>
              <button onClick={() => setShowGuideModal(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <p className="font-bold text-indigo-300 flex items-center space-x-1">
                  <span>🍎 아이폰 / 아이패드 (사파리)</span>
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-400">
                  <li>브라우저 하단의 <strong>공유 아이콘 (네모에 위 화살표 <Share2 className="w-3 h-3 inline" />)</strong>을 탭합니다.</li>
                  <li>메뉴를 아래로 내려 <strong>'홈 화면에 추가 (<PlusSquare className="w-3 h-3 inline" />)'</strong>를 선택합니다.</li>
                  <li>우측 상단 <strong>'추가'</strong>를 누르면 바탕화면에 전용 앱이 생성됩니다!</li>
                </ol>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <p className="font-bold text-amber-300 flex items-center space-x-1">
                  <span>🤖 갤럭시 / 안드로이드 (크롬)</span>
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-400">
                  <li>브라우저 우측 상단의 <strong>메뉴 (점 3개 ⋮)</strong>를 탭합니다.</li>
                  <li><strong>'앱 설치'</strong> 또는 <strong>'홈 화면에 추가'</strong>를 선택합니다.</li>
                </ol>
              </div>
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg"
            >
              확인했습니다
            </button>
          </div>
        </div>
      )}
    </>
  );
}
