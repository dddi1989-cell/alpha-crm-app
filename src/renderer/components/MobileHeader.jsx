import React from 'react';
import { useCrmStore } from '../store/useCrmStore';
import { 
  Building2, 
  User, 
  LogOut, 
  Menu, 
  ShieldCheck, 
  Calculator,
  Bell
} from 'lucide-react';

export default function MobileHeader({ onOpenMenu }) {
  const currentUser = useCrmStore((state) => state.currentUser);
  const logout = useCrmStore((state) => state.logout);

  return (
    <header className="md:hidden sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between shadow-lg">
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-amber-500 flex items-center justify-center text-white font-black text-sm shadow-md shadow-indigo-600/30">
          W
        </div>
        <div>
          <h1 className="text-sm font-black text-white tracking-tight flex items-center space-x-1">
            <span>WLB CRM</span>
            <span className="text-[9px] px-1.5 py-0.2 bg-amber-950 text-amber-300 border border-amber-800/60 rounded-md font-mono">
              Mobile
            </span>
          </h1>
          <p className="text-[10px] text-slate-400 truncate max-w-[150px]">
            {currentUser?.org_name || 'WLB 본부'} · {currentUser?.name || '설계사'}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-1.5">
        <button
          onClick={logout}
          title="로그아웃"
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 active:scale-95 transition-all"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
