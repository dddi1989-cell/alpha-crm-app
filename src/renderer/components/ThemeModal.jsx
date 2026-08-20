import React, { useState } from 'react';
import { Palette, Check, X, Sparkles, Sun, Moon, Waves, Trees, Flame, Heart, Coffee, Star } from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';

export const THEME_LIST = [
  // 다크 테마 라인업
  {
    id: 'midnight',
    category: 'dark',
    name: '미드나잇 네이비 (기본)',
    desc: '세련되고 깊이 있는 프리미엄 딥 다크 테마',
    icon: Moon,
    bgPreview: '#090d16',
    sidebarPreview: '#0e1422',
    accentPreview: '#6366f1',
    isDark: true
  },
  {
    id: 'dark-zinc',
    category: 'dark',
    name: '차콜 징크 (다크 블랙)',
    desc: '차분하고 집중도 높은 현대적 미니멀 블랙 테마',
    icon: Moon,
    bgPreview: '#121214',
    sidebarPreview: '#18181b',
    accentPreview: '#10b981',
    isDark: true
  },
  {
    id: 'ocean',
    category: 'dark',
    name: '오션 마린 (딥 블루)',
    desc: '시원하고 신뢰감을 주는 깊은 바다빛 마린 블루 테마',
    icon: Waves,
    bgPreview: '#081426',
    sidebarPreview: '#0b1e38',
    accentPreview: '#0ea5e9',
    isDark: true
  },
  {
    id: 'emerald',
    category: 'dark',
    name: '에메랄드 포레스트 (딥 그린)',
    desc: '눈의 피로를 덜어주는 편안한 숲속 딥 그린 & 민트 테마',
    icon: Trees,
    bgPreview: '#061912',
    sidebarPreview: '#0a251b',
    accentPreview: '#10b981',
    isDark: true
  },
  {
    id: 'purple',
    category: 'dark',
    name: '로열 바이올렛 (퍼플)',
    desc: '고급스럽고 매력적인 딥 퍼플 & 라벤더 테마',
    icon: Sparkles,
    bgPreview: '#140924',
    sidebarPreview: '#1d0e33',
    accentPreview: '#a855f7',
    isDark: true
  },
  {
    id: 'sunset-amber',
    category: 'dark',
    name: '선셋 앰버 (웜 오렌지)',
    desc: '노을빛의 따뜻하고 감성적인 다크 앰버 테마',
    icon: Flame,
    bgPreview: '#1c100a',
    sidebarPreview: '#2b170e',
    accentPreview: '#f59e0b',
    isDark: true
  },
  {
    id: 'cherry-dark',
    category: 'pink',
    name: '체리 다크 (딥 핑크)',
    desc: '우아하고 고혹적인 다크 로즈 & 베리 핑크 테마',
    icon: Heart,
    bgPreview: '#1f0b14',
    sidebarPreview: '#2b0f1c',
    accentPreview: '#f43f5e',
    isDark: true
  },

  // 라이트 & 핑크 테마 라인업
  {
    id: 'pure-white',
    category: 'light',
    name: '퓨어 화이트 (완전 올화이트)',
    desc: '사이드바와 대시보드 배경 전체가 완전한 순백색(#ffffff)인 테마',
    icon: Sun,
    bgPreview: '#ffffff',
    sidebarPreview: '#f8fafc',
    accentPreview: '#2563eb',
    isDark: false
  },
  {
    id: 'enterprise-white',
    category: 'light',
    name: '엔터프라이즈 화이트 (듀얼)',
    desc: '다크 사이드바 + 대시보드 개요 배경 전체가 화이트인 모던 테마',
    icon: Sun,
    bgPreview: '#f8fafc',
    sidebarPreview: '#0e1422',
    accentPreview: '#3b82f6',
    isDark: false
  },
  {
    id: 'rose-pink',
    category: 'pink',
    name: '로즈 핑크 (화사한 핑크)',
    desc: '사랑스럽고 화사한 벚꽃 핑크 & 로즈 골드 라이트 테마',
    icon: Heart,
    bgPreview: '#fff1f2',
    sidebarPreview: '#ffe4e6',
    accentPreview: '#e11d48',
    isDark: false
  },
  {
    id: 'soft-cream',
    category: 'light',
    name: '소프트 크림 (아이보리)',
    desc: '따스하고 부드러운 감성의 내추럴 크림 베이지 테마',
    icon: Coffee,
    bgPreview: '#faf7f2',
    sidebarPreview: '#f4eee5',
    accentPreview: '#d97706',
    isDark: false
  },
  {
    id: 'warm-light',
    category: 'light',
    name: '클라우드 라이트 (소프트)',
    desc: '눈부심 없이 산뜻하고 차분한 모던 라이트 그레이 테마',
    icon: Sun,
    bgPreview: '#f8fafc',
    sidebarPreview: '#ffffff',
    accentPreview: '#4f46e5',
    isDark: false
  }
];

export default function ThemeModal() {
  const isThemeModalOpen = useCrmStore((state) => state.isThemeModalOpen);
  const closeThemeModal = useCrmStore((state) => state.closeThemeModal);
  const theme = useCrmStore((state) => state.theme);
  const setTheme = useCrmStore((state) => state.setTheme);

  const [selectedCategory, setSelectedCategory] = useState('all');

  if (!isThemeModalOpen) return null;

  const filteredThemes = THEME_LIST.filter(t => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'dark') return t.category === 'dark';
    if (selectedCategory === 'light') return t.category === 'light';
    if (selectedCategory === 'pink') return t.category === 'pink';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none">
      <div className="bg-[#0f172a] border border-indigo-500/40 rounded-3xl p-6 w-full max-w-2xl shadow-2xl shadow-indigo-950/80 space-y-5 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-['Outfit',sans-serif] text-lg font-extrabold text-white tracking-tight flex items-center space-x-2">
                <span>프로그램 색상 테마 설정 ({THEME_LIST.length}종)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                완전 화이트, 로즈 핑크, 다크 징크 등 원하는 컬러를 선택하면 즉시 적용됩니다.
              </p>
            </div>
          </div>

          <button
            onClick={closeThemeModal}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          {[
            { id: 'all', label: '전체 보기', icon: Star },
            { id: 'light', label: '화이트 & 라이트', icon: Sun },
            { id: 'pink', label: '핑크 & 로즈', icon: Heart },
            { id: 'dark', label: '다크 & 네이비', icon: Moon }
          ].map((cat) => {
            const Icon = cat.icon;
            const isTabActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                  isTabActive
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Theme Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1">
          {filteredThemes.map((t) => {
            const isSelected = theme === t.id;
            const Icon = t.icon;

            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden group flex flex-col justify-between ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-950/40 shadow-lg shadow-indigo-950/50 scale-[1.01]'
                    : 'border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                {/* Color Preview Bar */}
                <div className="flex items-center justify-between w-full mb-2.5">
                  <div className="flex items-center space-x-1.5">
                    <div
                      className="w-4 h-4 rounded-full border border-black/20 shadow-sm"
                      style={{ backgroundColor: t.sidebarPreview }}
                      title="사이드바 색상"
                    />
                    <div
                      className="w-4 h-4 rounded-full border border-black/20 shadow-sm"
                      style={{ backgroundColor: t.bgPreview }}
                      title="메인 배경 색상"
                    />
                    <div
                      className="w-4 h-4 rounded-full border border-black/20 shadow-sm"
                      style={{ backgroundColor: t.accentPreview }}
                      title="강조 포인트 색상"
                    />
                  </div>

                  {isSelected ? (
                    <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500 text-white shadow-sm">
                      <Check className="w-3 h-3" />
                      <span>적용 중</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-500 group-hover:text-slate-300">
                      {t.isDark ? '다크' : '라이트'}
                    </span>
                  )}
                </div>

                {/* Title & Desc */}
                <div>
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                      {t.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed line-clamp-2">
                    {t.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-800 text-xs text-slate-400">
          <span>설정한 테마는 프로그램 재실행 시에도 자동 유지됩니다.</span>
          <button
            onClick={closeThemeModal}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-600/30"
          >
            확인 완료
          </button>
        </div>
      </div>
    </div>
  );
}
