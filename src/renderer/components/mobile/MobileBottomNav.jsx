import React from 'react';
import { useCrmStore } from '../../store/useCrmStore';
import { 
  Users, 
  Calendar, 
  Calculator, 
  TrendingUp, 
  Menu
} from 'lucide-react';

export default function MobileBottomNav({ onOpenDrawer }) {
  const activeTab = useCrmStore((state) => state.activeTab);
  const setActiveTab = useCrmStore((state) => state.setActiveTab);

  const mainTabs = [
    { id: 'customers', label: '고객정보', icon: Users },
    { id: 'schedules', label: '일정관리', icon: Calendar },
    { id: 'tools', label: '설계사도구', icon: Calculator, badge: 'HOT' },
    { id: 'market', label: '증시시황', icon: TrendingUp },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/90 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] flex items-center justify-around shadow-2xl">
      {mainTabs.map((t) => {
        const Icon = t.icon;
        const isActive = activeTab === t.id;

        return (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={'flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all relative min-w-[58px] ' + 
              (isActive 
                ? 'text-indigo-400 font-black scale-105' 
                : 'text-slate-400 hover:text-slate-200 font-semibold')}
          >
            {t.badge && !isActive && (
              <span className="absolute -top-0.5 right-2 px-1.5 py-0.2 bg-amber-500 text-[9px] font-black text-slate-950 rounded-full animate-bounce">
                {t.badge}
              </span>
            )}
            <div className={'p-1.5 rounded-xl transition-all ' + (isActive ? 'bg-indigo-950/90 border border-indigo-500/50 text-indigo-300 shadow-md shadow-indigo-600/30' : '')}>
              <Icon className="w-5 h-5" />
            </div>
            <span className={`mt-0.5 tracking-tight ${isActive ? 'text-xs text-indigo-300 font-extrabold' : 'text-[11px] text-slate-400'}`}>
              {t.label}
            </span>
          </button>
        );
      })}

      {/* 5th Tab: Full Menu Drawer Trigger */}
      <button
        onClick={onOpenDrawer}
        className="flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl text-slate-400 hover:text-indigo-300 font-semibold active:scale-95 transition-all min-w-[58px]"
      >
        <div className="p-1.5 rounded-xl bg-slate-900 border border-slate-800">
          <Menu className="w-5 h-5 text-indigo-400" />
        </div>
        <span className="text-[11px] mt-0.5 tracking-tight text-indigo-300 font-bold">
          전체메뉴
        </span>
      </button>
    </nav>
  );
}
