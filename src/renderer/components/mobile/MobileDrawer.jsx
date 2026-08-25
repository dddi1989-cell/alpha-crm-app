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
    { id: 'customers', label: '고객 정보 확인', icon: Users, desc: '내 고객 및 가망고객 POOL 리스트' },
    { id: 'schedules', label: '일정 관리', icon: Calendar, desc: '상담 및 미팅 캘린더' },
    { id: 'market', label: '오늘의 증시/시황', icon: TrendingUp, desc: '국내/해외 증시 및 속보' },
    { id: 'tools', label: '설계사 도구', icon: Calculator, badge: 'HOT', desc: '4대 보험사 대조 연금설계 및 시뮬레이션' },
    { id: 'board', label: '상품전략자료실', icon: BookOpen, desc: '보험사별 전략 및 약관 자료실' },
    { id: 'claims', label: '보험사 정보', icon: FileText, desc: '30대 보험사 콜센터 & 약관 정보' }
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
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-amber-500 flex items-center justify-center text-white font-black text-base shadow-md">
                W
              </div>
              <div>
                <h3 className="font-black text-base text-white">WLB CRM TOOL</h3>
                <p className="text-xs text-slate-400">모바일 전체 메뉴</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center min-w-[38px] min-h-[38px]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Profile Card */}
          <div className="my-4 p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-base">
                {currentUser?.name ? currentUser.name[0] : '설'}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-sm text-white">{currentUser?.name || '설계사'}</span>
                  <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800/60 rounded-md text-[10px] font-mono font-bold">
                    {currentUser?.role || 'FA'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 truncate max-w-[180px] font-medium mt-0.5">
                  {currentUser?.org_name || '본사 총괄 사업단'}
                </p>
              </div>
            </div>
          </div>

          {/* 6 Major Menu Items */}
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-400 uppercase px-2 mb-2 tracking-wider">주요 실무 메뉴 (6종)</p>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full p-3 rounded-2xl flex items-center justify-between transition-all text-left ${
                    isActive 
                      ? 'bg-indigo-950/90 border border-indigo-500/60 text-white font-extrabold shadow-lg shadow-indigo-950/60' 
                      : 'hover:bg-slate-900/80 text-slate-200 bg-slate-900/30 border border-slate-800/40'
                  }`}
                >
                  <div className="flex items-center space-x-3.5">
                    <div className={`p-2 rounded-xl ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-900 text-indigo-400 border border-slate-800'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold">{item.label}</span>
                        {item.badge && (
                          <span className="px-1.5 py-0.2 bg-amber-500 text-[9px] font-black text-slate-950 rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{item.desc}</p>
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
            className="w-full py-3 rounded-2xl bg-red-950/40 hover:bg-red-950/60 border border-red-900/50 text-red-300 font-extrabold text-sm flex items-center justify-center space-x-2 transition-all active:scale-98 shadow-md"
          >
            <LogOut className="w-4 h-4" />
            <span>시스템 로그아웃</span>
          </button>
        </div>

      </div>
    </div>
  );
}
