import React from 'react';
import { 
  X, 
  LayoutDashboard, 
  Users, 
  Calendar, 
  TrendingUp, 
  Calculator, 
  BookOpen, 
  Building2, 
  FileCheck, 
  FileText, 
  Database, 
  Palette, 
  LogOut, 
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { useCrmStore } from '../../store/useCrmStore';

export default function MobileDrawer({ isOpen, onClose }) {
  const activeTab = useCrmStore((state) => state.activeTab);
  const setActiveTab = useCrmStore((state) => state.setActiveTab);
  const currentUser = useCrmStore((state) => state.currentUser);
  const logout = useCrmStore((state) => state.logout);
  const openThemeModal = useCrmStore((state) => state.openThemeModal);

  if (!isOpen) return null;

  const menuItems = [
    { id: 'dashboard', label: '대시보드 개요', icon: LayoutDashboard, desc: '전체 현황 및 장기미터치 모니터링' },
    { id: 'customers', label: '고객 관리', icon: Users, desc: '내 고객 및 가망고객 POOL 리스트' },
    { id: 'schedules', label: '일정 관리', icon: Calendar, desc: '상담 및 미팅 캘린더' },
    { id: 'tools', label: '설계사도구 (연금계산기)', icon: Calculator, badge: 'HOT', desc: '4대 보험사 대조 연금설계 및 제안서' },
    { id: 'market', label: '오늘의 증시/시황', icon: TrendingUp, desc: '국내/해외 증시 및 속보' },
    { id: 'board', label: '상품전략자료실', icon: BookOpen, desc: '보험사별 전략 및 약관 자료실' },
    { id: 'org', label: '조직 관리', icon: Building2, desc: '사업단/지점/팀 조직원 현황' },
    { id: 'reports', label: '보장분석', icon: FileCheck, desc: '고객 증권 보장분석 리포트' },
    { id: 'claims', label: '보험금 청구', icon: FileText, desc: '30대 보험사 청구서 양식' },
    { id: 'system', label: '백업 & 복원', icon: Database, desc: '클라우드 동기화 및 시스템 정보' }
  ];

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end animate-fadeIn">
      <div className="w-4/5 max-w-sm h-full bg-[#0d1322] border-l border-slate-800 flex flex-col justify-between p-5 shadow-2xl overflow-y-auto custom-scrollbar animate-slideLeft">
        
        {/* Top Header */}
        <div>
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-amber-500 flex items-center justify-center text-white font-black text-sm shadow-md">
                W
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white">WLB CRM TOOL</h3>
                <p className="text-[10px] text-slate-400">모바일 전체 메뉴</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* User Profile Card */}
          <div className="my-4 p-3 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-950 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-sm">
                {currentUser?.name ? currentUser.name[0] : '설'}
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-xs text-white">{currentUser?.name || '설계사'}</span>
                  <span className="px-1.5 py-0.2 bg-indigo-950 text-indigo-300 border border-indigo-800/60 rounded text-[9px] font-mono">
                    {currentUser?.role || 'FA'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate max-w-[150px]">
                  {currentUser?.org_name || '본사 총괄 사업단'}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                openThemeModal();
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold flex items-center space-x-1"
              title="테마 설정"
            >
              <Palette className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 10 Major Menu Items */}
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase px-2 mb-1 tracking-wider">전체 메뉴 목록</p>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full p-2.5 rounded-xl flex items-center justify-between transition-all text-left ${
                    isActive 
                      ? 'bg-indigo-950/80 border border-indigo-500/50 text-white font-bold shadow-md shadow-indigo-950' 
                      : 'hover:bg-slate-900/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-1.5 rounded-lg ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs">{item.label}</span>
                        {item.badge && (
                          <span className="px-1.5 py-0.2 bg-amber-500 text-[8px] font-black text-slate-950 rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-slate-500 line-clamp-1">{item.desc}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Logout */}
        <div className="pt-4 border-t border-slate-800">
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="w-full py-2.5 bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span>시스템 로그아웃</span>
          </button>
        </div>

      </div>
    </div>
  );
}
