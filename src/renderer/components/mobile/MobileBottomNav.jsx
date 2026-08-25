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
    { id: 'customers', label: '고객관리', icon: Users },
    { id: 'schedules', label: '일정관리', icon: Calendar },
    { id: 'tools', label: '연금설계', icon: Calculator, badge: 'HOT' },
    { id: 'market', label: '증시시황', icon: TrendingUp },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-bottom">
      {mainTabs.map((t) => {
        const Icon = t.icon;
        const isActive = activeTab === t.id;

        return (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={'flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition-all relative ' + 
              (isActive 
                ? 'text-indigo-400 font-extrabold scale-105' 
                : 'text-slate-500 hover:text-slate-300 font-medium')}
          >
            {t.badge && !isActive && (
              <span className="absolute -top-1 right-1 px-1 py-0.2 bg-amber-500 text-[8px] font-black text-slate-950 rounded-full animate-bounce">
                {t.badge}
              </span>
            )}
            <div className={'p-1 rounded-xl transition-all ' + (isActive ? 'bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 shadow-md shadow-indigo-600/30' : '')}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">
              {t.label}
            </span>
          </button>
        );
      })}

      {/* 5th Tab: Full Menu Drawer Trigger */}
      <button
        onClick={onOpenDrawer}
        className="flex flex-col items-center justify-center py-1 px-2 rounded-2xl text-slate-400 hover:text-indigo-300 font-medium active:scale-95 transition-all"
      >
        <div className="p-1 rounded-xl bg-slate-900 border border-slate-800">
          <Menu className="w-4 h-4 text-indigo-400" />
        </div>
        <span className="text-[10px] mt-0.5 tracking-tight text-indigo-300 font-bold">
          전체메뉴
        </span>
      </button>
    </nav>
  );
}
