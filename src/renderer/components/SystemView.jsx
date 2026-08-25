import React, { useState } from 'react';
import { useCrmStore } from '../store/useCrmStore';
import { api, isElectron } from '../utils/api';
import { Database, Download, Upload, RefreshCw, CheckCircle, ShieldCheck, FileArchive, Globe, GitBranch, Send, Trash2, Smartphone, Palette, User, Shield } from 'lucide-react';

export default function SystemView() {
  const systemInfo = useCrmStore((state) => state.systemInfo);
  const currentUser = useCrmStore((state) => state.currentUser);
  const triggerBackup = useCrmStore((state) => state.triggerBackup);
  const exportBackup = useCrmStore((state) => state.exportBackup);
  const restoreDb = useCrmStore((state) => state.restoreDb);
  const isRestoring = useCrmStore((state) => state.isRestoring);

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.username === 'admin';

  const [backupMessage, setBackupMessage] = useState(null);

  // GitHub Server Configuration State
  const [ghOwner, setGhOwner] = useState('ALPHA-CRM');
  const [ghRepo, setGhRepo] = useState('alpha-crm-app');
  const [ghBranch, setGhBranch] = useState('main');
  const [ghTestResult, setGhTestResult] = useState(null);
  const [isGhTesting, setIsGhTesting] = useState(false);

  React.useEffect(() => {
    api.system.getGitHubConfig().then(res => {
      if (res?.config) {
        setGhOwner(res.config.owner || 'ALPHA-CRM');
        setGhRepo(res.config.repo || 'alpha-crm-app');
        setGhBranch(res.config.branch || 'main');
      }
    });
  }, []);

  const handleTestGitHub = async (e) => {
    e.preventDefault();
    setIsGhTesting(true);
    setGhTestResult(null);

    try {
      const res = await api.system.testGitHubConnection({
        owner: ghOwner.trim(),
        repo: ghRepo.trim(),
        branch: ghBranch.trim()
      });
      setGhTestResult(res);
    } catch (err) {
      setGhTestResult({ success: false, message: '연결 실패: ' + err.message });
    } finally {
      setIsGhTesting(false);
    }
  };

  const handleManualBackup = async () => {
    const res = await triggerBackup();
    if (res?.success) {
      setBackupMessage('자동 이중 백업(SQLite DB + CSV + PDF/엑셀 리포트 압축)이 성공적으로 동기화되었습니다!');
      setTimeout(() => setBackupMessage(null), 4000);
    }
  };

  const handleExportBackup = async () => {
    const res = await exportBackup();
    if (res?.success) {
      setBackupMessage(`전체 백업 파일이 내보내졌습니다! (고객 ${res.manifest?.customerCount || 0}명, 일정 ${res.manifest?.scheduleCount || 0}개, PDF/엑셀 리포트 ${res.manifest?.reportFilesCount || 0}개 포함)`);
      setTimeout(() => setBackupMessage(null), 5000);
    }
  };

  // Mobile Web Dedicated View
  if (!isElectron) {
    return (
      <div className="p-4 sm:p-8 space-y-6 animate-fadeIn max-w-5xl mx-auto select-none">
        <div>
          <h2 className="font-['Outfit',sans-serif] text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Smartphone className="w-6 h-6 text-indigo-400" />
            <span>모바일 클라우드 동기화 & 세션 관리</span>
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            WLB CRM 모바일 앱은 Supabase 클라우드 데이터베이스와 100% 실시간 양방향으로 동기화됩니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cloud Sync Status Card */}
          <div className="glass-panel p-5 rounded-2xl border border-indigo-500/40 bg-indigo-950/20 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-indigo-900/50">
              <div className="flex items-center space-x-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">실시간 클라우드 DB 연결</h3>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/80 font-bold animate-pulse">
                ● 실시간 동기화 ON
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p className="leading-relaxed">
                모바일에서 등록하거나 수정한 고객, 일정, 연금 설계 내역은 즉시 클라우드에 안전하게 저장되며 PC 프로그램과 자동 동기화됩니다.
              </p>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>동기화 서버:</span>
                  <span className="text-indigo-400 font-mono">Supabase Cloud + R2</span>
                </div>
                <div className="flex justify-between">
                  <span>보안 암호화:</span>
                  <span className="text-emerald-400 font-mono">TLS 1.3 / SHA-256</span>
                </div>
                <div className="flex justify-between">
                  <span>앱 버전:</span>
                  <span className="text-amber-400 font-mono">v1.6.6 (Web/PWA)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Account Session Card */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <User className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">현재 접속 계정 정보</h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-mono">
                {currentUser?.role || 'FA'}
              </span>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">설계사 성명:</span>
                <span className="font-bold text-white">{currentUser?.name || '설계사'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">사번 (아이디):</span>
                <span className="font-mono text-slate-200">{currentUser?.username || '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">소속 조직:</span>
                <span className="text-indigo-300">{currentUser?.org_name || '본사 총괄 사업단'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">연락처:</span>
                <span className="font-mono text-slate-200">{currentUser?.phone || '미등록'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h2 className="font-['Outfit',sans-serif] text-2xl font-bold text-white tracking-tight">
          백업 & 데이터베이스 복원 관리
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          모든 C/U/D 작업 시 고객 정보, 일정, 가입 보험 목록, 보장분석 PDF 및 엑셀 파일이 포함된 전체 통합 백업이 수행됩니다.
        </p>
      </div>

      {backupMessage && (
        <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-xl flex items-center space-x-2 animate-fadeIn">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{backupMessage}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dual Backup Status Card */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2.5">
              <Download className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-base text-white">전체 통합 백업 엔진</h3>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-950/80 text-blue-400 border border-blue-800/60 font-medium">
              실시간 작동 중
            </span>
          </div>

          <div className="space-y-4 text-xs">
            <p className="text-slate-300 leading-relaxed">
              고객 및 일정 데이터에 변경(생성/수정/삭제)이 발생할 때마다 아래 모든 항목이 포함된 백업 패키지가 자동 동기화됩니다:
            </p>

            <ul className="space-y-2.5 text-slate-300">
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></span>
                <div>
                  <strong className="text-white">1. 고객 프로필 & 가입 보험 목록:</strong>
                  <p className="text-slate-400 text-[11px]">고객별 가입 보험사, 상세 계약 내역, 가입일/만기일 DB 백업</p>
                </div>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></span>
                <div>
                  <strong className="text-white">2. 일정 & 만기 알림 전체 데이터:</strong>
                  <p className="text-slate-400 text-[11px]">미팅 일정, 업무 알림 및 1개월 전 자동 생성된 보험 만기 도래 알림</p>
                </div>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0"></span>
                <div>
                  <strong className="text-white">3. 보장분석 PDF 및 엑셀 원본 파일:</strong>
                  <p className="text-slate-400 text-[11px]">고객별로 등록된 보장분석 PDF 및 엑셀 분석 파일 원본 통째로 압축 포함</p>
                </div>
              </li>
            </ul>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleExportBackup}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all hover:scale-[1.01]"
              >
                <FileArchive className="w-4 h-4 text-blue-200" />
                <span>📂 백업 파일 내보내기 (컴퓨터/USB 저장)</span>
              </button>

              <button
                onClick={handleManualBackup}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl flex items-center justify-center space-x-1.5 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>내부 백업 동기화 수동 실행</span>
              </button>
            </div>
          </div>
        </div>

        {/* Database Restore Card */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2.5">
              <Upload className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-base text-white">데이터 & 파일 복원 파이프라인</h3>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-950/80 text-indigo-400 border border-indigo-800/60 font-medium">
              통합 복원 엔진
            </span>
          </div>

          <div className="space-y-4 text-xs">
            <p className="text-slate-300 leading-relaxed">
              백업 파일(<code className="text-indigo-300 font-mono">.zip</code> 또는 <code className="text-indigo-300 font-mono">.db</code>)을 선택하여 고객 정보, 일정, 가입 보험 및 보장분석 PDF/엑셀 파일 원본까지 완벽 복원합니다.
            </p>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 space-y-2 text-slate-300">
              <div className="flex items-center space-x-2 font-semibold text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>복원 무결성 검증 프로세스:</span>
              </div>
              <ol className="list-disc list-inside space-y-1 text-slate-400 text-[11px] pl-1">
                <li>SQLite WAL 데이터베이스 락 잔여물 안전 소거</li>
                <li>무결성 검사 (<code className="text-slate-300 font-mono">PRAGMA quick_check;</code>) 및 구조 검증</li>
                <li>고객별 보장분석 PDF 및 엑셀 원본 파일 자동 추출 복원</li>
              </ol>
            </div>

            <button
              onClick={restoreDb}
              disabled={isRestoring}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 transition-all hover:scale-[1.01] disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{isRestoring ? '데이터 및 파일 복원 진행 중...' : '📥 백업 파일 선택 및 전체 복원하기 (.zip / .db)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Admin Only: GitHub Live Server Repository Settings Card */}
      {isAdmin && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2.5">
              <Globe className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-base text-white">실제 깃허브(GitHub) 업데이트 서버 연동 (관리자 전용)</h3>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 font-medium">
              실시간 200 OK 테스트 지원
            </span>
          </div>

          <form onSubmit={handleTestGitHub} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">GitHub 계정 / 소유자 (Owner)</label>
                <input
                  type="text"
                  value={ghOwner}
                  onChange={(e) => setGhOwner(e.target.value)}
                  placeholder="예: my-username"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">저장소 이름 (Repository)</label>
                <input
                  type="text"
                  value={ghRepo}
                  onChange={(e) => setGhRepo(e.target.value)}
                  placeholder="예: alpha-crm-app"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">브랜치 (Branch)</label>
                <input
                  type="text"
                  value={ghBranch}
                  onChange={(e) => setGhBranch(e.target.value)}
                  placeholder="main 또는 master"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="text-[11px] text-slate-400 font-mono">
                Raw Manifest URL: <span className="text-indigo-300">https://raw.githubusercontent.com/{ghOwner}/{ghRepo}/{ghBranch}/update_manifest.json</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await api.system.checkForUpdates(currentUser);
                    useCrmStore.getState().setUpdateAvailableInfo(res);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/30 flex items-center space-x-1.5 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>🚀 원클릭 자동 패치 실행</span>
                </button>
                <button
                  type="submit"
                  disabled={isGhTesting}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center space-x-1.5 disabled:opacity-50 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isGhTesting ? '연결 테스트 중...' : '서버 연결 테스트'}</span>
                </button>
              </div>
            </div>
          </form>

          {ghTestResult && (
            <div className={`p-4 rounded-xl border text-xs animate-fadeIn ${ghTestResult.success ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' : 'bg-amber-950/80 border-amber-500/50 text-amber-300'}`}>
              <div className="font-bold flex items-center justify-between">
                <span>{ghTestResult.message}</span>
                {ghTestResult.manifest && (
                  <button
                    type="button"
                    onClick={() => {
                      useCrmStore.getState().setUpdateAvailableInfo({
                        updateAvailable: true,
                        currentVersion: useCrmStore.getState().systemInfo?.version || '1.4.3',
                        latestVersion: ghTestResult.manifest.latestVersion,
                        releaseTitle: ghTestResult.manifest.releaseTitle,
                        releaseNotes: ghTestResult.manifest.releaseNotes,
                        downloadUrl: ghTestResult.manifest.downloadUrl
                      });
                    }}
                    className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-lg shadow-md transition-all flex items-center space-x-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>⚡ 감지된 패치 즉시 적용하기</span>
                  </button>
                )}
              </div>
              {ghTestResult.manifest && (
                <div className="mt-2 p-2 bg-slate-900/90 rounded-lg text-[11px] font-mono text-slate-300 space-y-1">
                  <div>최신 감지 버전: <span className="text-indigo-400 font-bold">{ghTestResult.manifest.latestVersion}</span></div>
                  <div>패치 제목: {ghTestResult.manifest.releaseTitle}</div>
                  <div>다운로드 주소: {ghTestResult.manifest.downloadUrl}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Admin Only: System Paths & Database Metadata Details */}
      {isAdmin && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base text-white flex items-center space-x-2">
              <Database className="w-5 h-5 text-slate-400" />
              <span>현재 SQLite 데이터베이스 상세 정보 (관리자 전용)</span>
            </h3>

            <button
              onClick={() => useCrmStore.getState().resetData()}
              className="px-3 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-300 text-xs font-semibold border border-red-800/80 flex items-center space-x-1.5 transition-colors"
              title="현재 저장된 모든 고객 및 일정 데이터 초기화"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>테스트 데이터 전체 초기화</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 space-y-1">
              <span className="text-slate-400 font-medium block">데이터베이스 파일 경로:</span>
              <span className="text-white font-mono text-[11px] break-all block">
                {systemInfo?.dbPath || '불러오는 중...'}
              </span>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 space-y-1">
              <span className="text-slate-400 font-medium block">백업 저장 디렉토리:</span>
              <span className="text-white font-mono text-[11px] break-all block">
                {systemInfo?.backupDir || '불러오는 중...'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
