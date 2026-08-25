import React from 'react';
import { LayoutDashboard, Users, Calendar, Database, Wifi, FileText, Monitor, FileCheck, Building2, LogOut, Palette, BookOpen, TrendingUp, Calculator } from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';
import { api } from '../utils/api';
import logoIcon from '../assets/icon.png';

export default function Sidebar() {
  const activeTab = useCrmStore((state) => state.activeTab);
  const setActiveTab = useCrmStore((state) => state.setActiveTab);
  const systemInfo = useCrmStore((state) => state.systemInfo);
  const currentUser = useCrmStore((state) => state.currentUser);
  const logout = useCrmStore((state) => state.logout);
  const customers = useCrmStore((state) => state.customers);
  const schedules = useCrmStore((state) => state.schedules);
  const openThemeModal = useCrmStore((state) => state.openThemeModal);
  const theme = useCrmStore((state) => state.theme);

  const customerCount = React.useMemo(() => {
    return Array.isArray(customers) ? customers.length : 0;
  }, [customers]);

  const pendingSchedulesCount = React.useMemo(() => {
    return Array.isArray(schedules) ? schedules.filter(s => s.status === 'Pending').length : 0;
  }, [schedules]);

  const menuItems = [
    { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
    { id: 'customers', label: '고객 관리', icon: Users, badge: customerCount },
    { id: 'schedules', label: '일정 관리', icon: Calendar, badge: pendingSchedulesCount },
    { id: 'market', label: '오늘의 증시/시황', icon: TrendingUp },
    { id: 'tools', label: '설계사도구', icon: Calculator },
    { id: 'board', label: '상품전략자료실', icon: BookOpen },
    { id: 'org', label: '조직 관리', icon: Building2 },
    { id: 'reports', label: '보장분석', icon: FileCheck },
    { id: 'claims', label: '보험금 청구', icon: FileText },
    { id: 'system', label: '백업 & 복원', icon: Database }
  ];

  const handleToggleWidget = async () => {
    try {
      await api.system.toggleWidget();
    } catch (err) {
      console.error('Toggle widget error:', err);
    }
  };

  const setUpdateAvailableInfo = useCrmStore((state) => state.setUpdateAvailableInfo);
  const [updateState, setUpdateState] = React.useState(null);
  const [checkingUpdate, setCheckingUpdate] = React.useState(false);
  const [applyingUpdate, setApplyingUpdate] = React.useState(false);

  const handleCheckUpdate = async (isUserClick = false) => {
    setCheckingUpdate(true);
    try {
      const res = await api.system.checkForUpdates(currentUser);
      setUpdateState(res);
      if (isUserClick || res?.updateAvailable) {
        setUpdateAvailableInfo(res);
      }
    } catch (err) {
      const errRes = { updateAvailable: false, error: '원격 패치 서버 연동 확인 중 오류가 발생했습니다: ' + err.message };
      setUpdateState(errRes);
      if (isUserClick) {
        setUpdateAvailableInfo(errRes);
      }
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (updateState) {
      setUpdateAvailableInfo(updateState);
      return;
    }
    setApplyingUpdate(true);
    try {
      await api.system.downloadAndApplyUpdate(updateState?.downloadUrl);
    } catch (err) {
      alert('온라인 패치 다운로드 중 오류가 발생했습니다: ' + err.message);
      setApplyingUpdate(false);
    }
  };

  React.useEffect(() => {
    // Check online update on mount quietly (scoped to current user role)
    handleCheckUpdate(false);
  }, [currentUser]);

  const themeLabels = {
    'midnight': '네이비',
    'dark-zinc': '차콜',
    'pure-white': '올화이트',
    'enterprise-white': '화이트(듀얼)',
    'rose-pink': '로즈핑크',
    'cherry-dark': '체리핑크',
    'soft-cream': '크림',
    'sunset-amber': '선셋',
    'ocean': '오션',
    'emerald': '그린',
    'purple': '퍼플',
    'warm-light': '라이트'
  };

  return (
    <aside className="hidden md:flex w-64 bg-[#0e1422] border-r border-slate-800/80 flex-col justify-between h-screen select-none shrink-0 transition-colors duration-300">
      <div>
        {/* App Logo & Header */}
        <div className="p-4 border-b border-slate-800/60 flex items-center space-x-3">
          <div className="w-12 h-10 rounded-xl bg-black p-0.5 border border-slate-700/80 flex items-center justify-center shadow-lg shadow-black/70 overflow-hidden shrink-0">
            <img 
              src={logoIcon} 
              alt="WLB Logo" 
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
              }} 
            />
            <span className="hidden w-full h-full font-black text-white text-base flex items-center justify-center">W</span>
          </div>
          <div className="overflow-hidden">
            <h1 className="font-['Outfit',sans-serif] text-base font-extrabold tracking-tight text-white truncate">
              WLB CRM TOOL
            </h1>
            <span className="inline-flex items-center text-[10px] uppercase font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
              100% 로컬 보안
            </span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-4 space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-md shadow-blue-950/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-3 space-y-2">
            <button
              onClick={handleToggleWidget}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold text-xs bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 transition-all shadow-md active:scale-95"
              title="바탕화면에 미니 캘린더 위젯 띄우기"
            >
              <div className="flex items-center space-x-2.5">
                <Monitor className="w-4 h-4 text-indigo-400" />
                <span>바탕화면 위젯 토글</span>
              </div>
              <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-1.5 py-0.5 rounded font-bold">ON/OFF</span>
            </button>

            <button
              onClick={openThemeModal}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold text-xs bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 hover:border-purple-500/50 transition-all shadow-md active:scale-95 group"
              title="프로그램 색상 테마 변경"
            >
              <div className="flex items-center space-x-2.5">
                <Palette className="w-4 h-4 text-purple-400 group-hover:rotate-12 transition-transform" />
                <span>색상 테마 설정</span>
              </div>
              <span className="text-[10px] bg-purple-950/80 text-purple-300 border border-purple-800/60 px-2 py-0.5 rounded-md font-bold">
                {themeLabels[theme] || '테마'}
              </span>
            </button>
          </div>
        </nav>
      </div>

      {/* Footer Info & Online Auto Patch Button */}
      <div className="p-4 border-t border-slate-800/60 space-y-2">
        {updateState?.updateAvailable ? (
          <div className="bg-amber-950/80 border border-amber-500/50 rounded-xl p-2.5 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-xs text-amber-300 font-bold">
              <span>🚀 새 온라인 패치 (v{updateState.latestVersion})</span>
            </div>
            <button
              onClick={handleApplyUpdate}
              disabled={applyingUpdate}
              className="w-full py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-lg transition-all shadow-md flex items-center justify-center space-x-1 disabled:opacity-50"
            >
              <span>{applyingUpdate ? '패치 다운로드 및 적용 중...' : '원클릭 자동 패치 적용'}</span>
            </button>
          </div>
        ) : null}

        {/* User Info Badge & Logout Button */}
        {currentUser && (
          <div className="bg-slate-900/80 rounded-xl p-3 border border-indigo-500/20 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 truncate">
              <div className="w-7 h-7 bg-indigo-600/30 text-indigo-300 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">
                {currentUser.name ? currentUser.name[0] : 'U'}
              </div>
              <div className="truncate">
                <div className="font-bold text-white text-[12px] truncate">{currentUser.name}</div>
                <div className="text-[10px] text-indigo-400 font-semibold">{currentUser.role}</div>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors shrink-0 ml-2"
              title="시스템 로그아웃"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/50 flex items-center justify-between text-xs text-slate-400">
          <button
            onClick={() => handleCheckUpdate(true)}
            disabled={checkingUpdate}
            className="flex items-center space-x-1.5 text-slate-400 hover:text-indigo-300 transition-colors"
            title="온라인 GitHub 패치 서버 확인"
          >
            <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-[11px] font-medium">{checkingUpdate ? '패치 확인중...' : '온라인 자동 패치 연동'}</span>
          </button>
          <span className="text-[10px] text-slate-500 font-mono">v{systemInfo?.version || '1.2.0'}</span>
        </div>
      </div>
    </aside>
  );
}
