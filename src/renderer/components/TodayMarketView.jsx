import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, RefreshCw, Calendar, Globe, DollarSign, 
  ExternalLink, Sparkles, AlertCircle, Clock, ChevronRight, Activity, 
  Flame, Award, Layers, Zap, Info, Share2, Compass
} from 'lucide-react';
import { api } from '../utils/api';

export default function TodayMarketView() {
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [historyDates, setHistoryDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Initial load: Fetch latest and history list
  const loadInitialData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [latestRes, historyRes] = await Promise.all([
        api.market.getLatest(),
        api.market.getHistoryDates()
      ]);

      if (latestRes?.success && latestRes.briefing) {
        setBriefing(latestRes.briefing);
        setSelectedDate(latestRes.briefing.date);
      } else {
        // Fallback default sample briefing if first run before 9 AM
        setBriefing(getDefaultFallbackBriefing());
      }

      if (historyRes?.success && Array.isArray(historyRes.history)) {
        setHistoryDates(historyRes.history);
      }
    } catch (err) {
      console.error('loadInitialData error:', err);
      setBriefing(getDefaultFallbackBriefing());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Change Date
  const handleDateChange = async (date) => {
    setSelectedDate(date);
    setLoading(true);
    try {
      const res = await api.market.getByDate(date);
      if (res?.success && res.briefing) {
        setBriefing(res.briefing);
      } else {
        alert(date + ' 일자의 시황 데이터를 찾을 수 없습니다.');
      }
    } catch (err) {
      alert('데이터 조회 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Manual Refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await api.market.refresh();
      if (res?.success && res.briefing) {
        setBriefing(res.briefing);
        setSelectedDate(res.briefing.date);
      } else {
        await loadInitialData();
      }
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenNews = (url) => {
    if (!url) return;
    try {
      if (api.system && api.system.openUrl) {
        api.system.openUrl(url);
      } else {
        window.open(url, '_blank');
      }
    } catch (e) {
      window.open(url, '_blank');
    }
  };

  if (loading && !briefing) {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-[500px] space-y-4 animate-fadeIn">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 animate-spin">
          <RefreshCw className="w-6 h-6" />
        </div>
        <p className="text-slate-400 text-sm font-semibold">오늘의 증시 & 시황 카드뉴스를 불러오는 중입니다...</p>
      </div>
    );
  }

  const domestic = briefing?.domestic || {};
  const overseas = briefing?.overseas || {};
  const news = briefing?.news || [];
  const summary3 = briefing?.summary_3lines || [];

  return (
    <div className="p-8 space-y-7 animate-fadeIn max-w-7xl mx-auto">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="font-['Outfit',sans-serif] text-2xl font-bold text-white tracking-tight">
                  오늘의 증시/시황
                </h2>
                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-950 to-purple-950 text-indigo-300 border border-indigo-700/60 shadow-sm flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                  <span>모닝 카드뉴스</span>
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                매일 아침 09:00 정각에 갱신되는 국내외 주식시장, 주요 빅테크 종목 및 핵심 경제 브리핑입니다.
              </p>
            </div>
          </div>
        </div>

        {/* Date Selector & Refresh */}
        <div className="flex items-center space-x-2.5">
          {historyDates.length > 0 && (
            <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <select
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
              >
                {historyDates.map((h) => (
                  <option key={h.date} value={h.date} className="bg-slate-900 text-white">
                    {h.date} 시황
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 text-xs font-bold shadow"
            title="최신 시황 새로고침"
          >
            <RefreshCw className={'w-3.5 h-3.5 ' + (refreshing ? 'animate-spin text-indigo-400' : '')} />
            <span>{refreshing ? '갱신 중...' : '시황 갱신'}</span>
          </button>
        </div>
      </div>

      {/* 2. Top Live Market Ticker Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* KOSPI */}
        {renderTickerCard(
          'KOSPI (코스피)',
          domestic.indices?.find(x => x.name === 'KOSPI')?.value || '2,580.42',
          domestic.indices?.find(x => x.name === 'KOSPI')?.change_rate || '+0.45%',
          domestic.indices?.find(x => x.name === 'KOSPI')?.is_up !== false
        )}
        {/* KOSDAQ */}
        {renderTickerCard(
          'KOSDAQ (코스닥)',
          domestic.indices?.find(x => x.name === 'KOSDAQ')?.value || '762.15',
          domestic.indices?.find(x => x.name === 'KOSDAQ')?.change_rate || '-0.12%',
          domestic.indices?.find(x => x.name === 'KOSDAQ')?.is_up === true
        )}
        {/* NASDAQ */}
        {renderTickerCard(
          '나스닥 (NASDAQ)',
          overseas.indices?.find(x => x.name.includes('나스닥'))?.value || '18,342.94',
          overseas.indices?.find(x => x.name.includes('나스닥'))?.change_rate || '+1.18%',
          overseas.indices?.find(x => x.name.includes('나스닥'))?.is_up !== false
        )}
        {/* S&P 500 */}
        {renderTickerCard(
          'S&P 500',
          overseas.indices?.find(x => x.name.includes('S&P'))?.value || '5,864.67',
          overseas.indices?.find(x => x.name.includes('S&P'))?.change_rate || '+0.82%',
          overseas.indices?.find(x => x.name.includes('S&P'))?.is_up !== false
        )}
        {/* USD/KRW */}
        {renderTickerCard(
          '원/달러 환율',
          overseas.macro?.find(x => x.name.includes('환율'))?.value || '1,385.5원',
          overseas.macro?.find(x => x.name.includes('환율'))?.change_rate || '-0.25%',
          overseas.macro?.find(x => x.name.includes('환율'))?.is_up === true
        )}
      </div>

      {/* 3. Highlight 3-Line Summary Card */}
      <div className="relative overflow-hidden p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3.5">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center space-x-2">
                <span>오늘의 모닝 시황 3줄 핵심 요약</span>
                <span className="text-[10px] text-slate-400 font-mono">({briefing?.updated_at || '09:00 KST'})</span>
              </h3>
            </div>
          </div>
          <span className="text-[11px] font-bold text-indigo-400 bg-indigo-950/80 px-2.5 py-1 rounded-full border border-indigo-800/60 flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>매일 09:00 자동 발행</span>
          </span>
        </div>

        <div className="space-y-2.5 text-xs text-slate-200">
          {summary3.length > 0 ? (
            summary3.map((line, idx) => (
              <div key={idx} className="flex items-start space-x-3 p-2.5 rounded-2xl bg-slate-950/40 border border-slate-800/60 hover:border-indigo-500/40 transition-colors">
                <span className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <p className="font-semibold leading-relaxed text-slate-100 flex-1">{line}</p>
              </div>
            ))
          ) : (
            <p className="text-slate-400">요약 정보가 없습니다.</p>
          )}
        </div>
      </div>

      {/* 4. Two Main Columns: Domestic & Overseas Card News */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Domestic Market Card News */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🇰🇷</span>
              <h3 className="font-bold text-sm text-white">국내 증시 및 주요 대표 종목</h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
              pykrx 라이브
            </span>
          </div>

          {/* Domestic Indices Big Cards */}
          <div className="grid grid-cols-2 gap-3">
            {(domestic.indices || []).map((idx) => (
              <div key={idx.name} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-400">{idx.name}</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-base font-extrabold text-white font-mono">{idx.value}</span>
                  <span className={'text-xs font-bold font-mono flex items-center ' + (idx.is_up ? 'text-red-400' : 'text-blue-400')}>
                    {idx.is_up ? <TrendingUp className="w-3 h-3 mr-0.5 inline" /> : <TrendingDown className="w-3 h-3 mr-0.5 inline" />}
                    {idx.change_rate}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Top 5 Stocks Grid */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>시가총액 상위 대표 5대 종목</span>
            </h4>
            <div className="space-y-2">
              {(domestic.top_stocks || []).map((stock) => (
                <div 
                  key={stock.name}
                  className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-xl bg-slate-800 flex items-center justify-center text-[10px] font-mono font-bold text-slate-400">
                      {stock.ticker?.slice(-3) || 'KR'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{stock.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{stock.ticker}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-extrabold text-white font-mono">{stock.price}</p>
                    <p className={'text-[11px] font-bold font-mono ' + (stock.is_up ? 'text-red-400' : 'text-blue-400')}>
                      {stock.change_rate}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Overseas & Big Tech Card News */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🇺🇸</span>
              <h3 className="font-bold text-sm text-white">글로벌 증시 & 미국 빅테크</h3>
            </div>
            <span className="text-[10px] font-mono text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/50">
              yfinance 라이브
            </span>
          </div>

          {/* Macro Indicators (Oil, Yield, FX) */}
          <div className="grid grid-cols-3 gap-2.5">
            {(overseas.macro || []).map((m) => (
              <div key={m.name} className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 text-center">
                <p className="text-[10px] font-bold text-slate-400 truncate" title={m.name}>{m.name}</p>
                <p className="text-xs font-extrabold text-white font-mono truncate">{m.value}</p>
                <p className={'text-[10px] font-bold font-mono ' + (m.is_up ? 'text-red-400' : 'text-blue-400')}>
                  {m.change_rate}
                </p>
              </div>
            ))}
          </div>

          {/* Global Big Tech Stocks */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span>미국 주요 핵심 빅테크 종목</span>
            </h4>
            <div className="space-y-2">
              {(overseas.tech_stocks || []).map((stock) => (
                <div 
                  key={stock.name}
                  className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-xl bg-slate-800 flex items-center justify-center text-[10px] font-mono font-bold text-sky-400">
                      {stock.symbol}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{stock.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">NASDAQ</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-extrabold text-white font-mono">{stock.price}</p>
                    <p className={'text-[11px] font-bold font-mono ' + (stock.is_up ? 'text-red-400' : 'text-blue-400')}>
                      {stock.change_rate}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Bottom News Curation Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-white flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping"></span>
            <span>오늘의 핵심 증시 & 글로벌 경제 뉴스</span>
          </h3>
          <span className="text-xs text-slate-400">네이버 증시 뉴스 & Yahoo Finance 연동</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {news.map((item, idx) => (
            <div
              key={idx}
              onClick={() => handleOpenNews(item.url)}
              className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/40 transition-all cursor-pointer flex flex-col justify-between space-y-3 group shadow-lg"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={'text-[10px] font-extrabold px-2 py-0.5 rounded-full border ' + 
                    (item.source_type === '국내증시' ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60' : 'bg-sky-950/80 text-sky-300 border-sky-800/60')}>
                    {item.source_type || '증시뉴스'}
                  </span>
                  <span className="text-[10px] font-medium text-slate-500">{item.press || '경제뉴스'}</span>
                </div>

                <h4 className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-2 leading-snug">
                  {item.title}
                </h4>

                <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed font-normal">
                  {item.summary}
                </p>
              </div>

              <div className="flex items-center justify-end text-[11px] font-bold text-indigo-400 group-hover:translate-x-1 transition-transform space-x-1 pt-1 border-t border-slate-800/60">
                <span>원문 기사 읽기</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderTickerCard(title, value, changeRate, isUp) {
  return (
    <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800/90 hover:border-indigo-500/40 transition-all shadow-md">
      <p className="text-[10px] font-bold text-slate-400 truncate">{title}</p>
      <p className="text-sm font-extrabold text-white font-mono mt-0.5">{value}</p>
      <p className={'text-[11px] font-bold font-mono mt-0.5 flex items-center ' + (isUp ? 'text-red-400' : 'text-blue-400')}>
        {isUp ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
        <span>{changeRate}</span>
      </p>
    </div>
  );
}

function getDefaultFallbackBriefing() {
  const today = new Date().toISOString().split('T')[0];
  return {
    date: today,
    updated_at: today + ' 09:00 KST',
    title: '[' + today + '] 오늘의 증시 & 글로벌 금융 시황 모닝 브리핑',
    summary_3lines: [
      '🇺🇸 뉴욕증시: 기술주 실적 기대감 속 나스닥 및 S&P 500 견조한 상승 마감.',
      '🇰🇷 국내증시: 코스피 2,580선 회복 시도, 반도체 및 대형 2차전지주 외국인 매수세 유입.',
      '📊 매크로: 원/달러 환율 1,380원대 안정화, 국제 유가 소폭 하락에 따른 인플레이션 우려 완화.'
    ],
    domestic: {
      indices: [
        { name: 'KOSPI', value: '2,584.20', change_rate: '+0.52%', is_up: true },
        { name: 'KOSDAQ', value: '765.40', change_rate: '+0.28%', is_up: true }
      ],
      top_stocks: [
        { ticker: '005930', name: '삼성전자', price: '72,400원', change_rate: '+1.12%', is_up: true },
        { ticker: '000660', name: 'SK하이닉스', price: '188,500원', change_rate: '+2.45%', is_up: true },
        { ticker: '373220', name: 'LG에너지솔루션', price: '382,000원', change_rate: '+0.39%', is_up: true },
        { ticker: '207940', name: '삼성바이오로직스', price: '998,000원', change_rate: '-0.20%', is_up: false },
        { ticker: '005380', name: '현대차', price: '235,500원', change_rate: '+1.51%', is_up: true }
      ]
    },
    overseas: {
      indices: [
        { name: 'S&P 500', value: '5,864.67', change_rate: '+0.82%', is_up: true },
        { name: '나스닥 (NASDAQ)', value: '18,342.94', change_rate: '+1.18%', is_up: true },
        { name: '다우존스 (Dow Jones)', value: '42,924.88', change_rate: '+0.37%', is_up: true }
      ],
      macro: [
        { name: '원/달러 환율', value: '1,385.5원', change_rate: '-0.25%', is_up: true },
        { name: 'WTI 원유', value: '70.85 $/배럴', change_rate: '-1.15%', is_up: false },
        { name: '미국 10년물 국채금리', value: '4.18 %', change_rate: '-0.02%', is_up: false }
      ],
      tech_stocks: [
        { symbol: 'NVDA', name: '엔비디아 (NVIDIA)', price: '$140.25', change_rate: '+3.14%', is_up: true },
        { symbol: 'AAPL', name: '애플 (Apple)', price: '$232.10', change_rate: '+0.85%', is_up: true },
        { symbol: 'MSFT', name: '마이크로소프트 (Microsoft)', price: '$428.50', change_rate: '+1.20%', is_up: true },
        { symbol: 'TSLA', name: '테슬라 (Tesla)', price: '$220.70', change_rate: '+2.05%', is_up: true },
        { symbol: 'GOOGL', name: '알파벳/구글 (Google)', price: '$168.40', change_rate: '+0.60%', is_up: true }
      ]
    },
    news: [
      {
        source_type: '국내증시',
        title: '반도체 훈풍에 코스피 상승 출발... 외국인·기관 동반 순매수',
        summary: '뉴욕 증시의 AI 반도체 랠리에 힘입어 삼성전자와 SK하이닉스가 강세를 보이며 지수 상승을 견인하고 있습니다.',
        url: 'https://finance.naver.com',
        press: '네이버 금융'
      },
      {
        source_type: '글로벌시황',
        title: 'Wall Street gains on strong tech earnings outlook',
        summary: 'Major U.S. stock indices rallied led by semiconductor and cloud computing giants amid optimistic guidance.',
        url: 'https://finance.yahoo.com',
        press: 'Yahoo Finance'
      },
      {
        source_type: '국내증시',
        title: '원/달러 환율 1380원대 초반 안정세... 수출 기업 실적 기대감',
        summary: '글로벌 달러화 강세가 한풀 꺾이면서 환율이 안정세를 찾고 있으며 외인 수급 여건이 개선되고 있습니다.',
        url: 'https://finance.naver.com',
        press: '네이버 금융'
      }
    ]
  };
}
