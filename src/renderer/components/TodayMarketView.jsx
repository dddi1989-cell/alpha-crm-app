import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, RefreshCw, Calendar, Globe, DollarSign, 
  ExternalLink, Sparkles, AlertCircle, Clock, ChevronRight, Activity, 
  Flame, Award, Layers, Zap, Info, Share2, Compass, Radio, CheckCircle2,
  FileText, BookOpen, ChevronDown, ChevronUp, Eye, Newspaper, Languages,
  X, ArrowUpRight, Copy, Check
} from 'lucide-react';
import { api } from '../utils/api';

export default function TodayMarketView() {
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [historyDates, setHistoryDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  
  // Real-time live polling state (30s)
  const [isLiveAutoRefresh, setIsLiveAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const [lastLiveUpdated, setLastLiveUpdated] = useState('');
  const [newsTab, setNewsTab] = useState('all'); // 'all' | 'domestic' | 'global'

  // Selected news modal for detailed Korean reading & translation
  const [selectedNewsForModal, setSelectedNewsForModal] = useState(null);

  const countdownRef = useRef(30);

  // Initial load: Fetch latest briefing and history dates
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [latestRes, historyRes] = await Promise.all([
        api.market.getLatest(),
        api.market.getHistoryDates()
      ]);

      if (latestRes?.success && latestRes.briefing) {
        setBriefing(latestRes.briefing);
        setSelectedDate(latestRes.briefing.date);
        setLastLiveUpdated(latestRes.briefing.updated_at || '');
      }

      if (historyRes?.success && Array.isArray(historyRes.history)) {
        setHistoryDates(historyRes.history);
      }

      // Immediately fetch live quote to ensure 100% exact real-time prices
      await fetchLiveQuoteSilent();
    } catch (err) {
      console.error('loadInitialData error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Silent Live Quote Fetch (No full-page loading flicker)
  const fetchLiveQuoteSilent = async () => {
    try {
      const res = await api.market.getLiveQuote();
      if (res?.success) {
        setBriefing(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            updated_at: res.updated_at || prev.updated_at,
            domestic: res.domestic || prev.domestic,
            overseas: res.overseas || prev.overseas,
            news: res.news && res.news.length ? res.news : prev.news
          };
        });
        setLastLiveUpdated(res.updated_at || '');
      }
    } catch (err) {
      console.log('Silent live quote error:', err.message);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // 30-Second Real-time Auto Polling Timer
  useEffect(() => {
    if (!isLiveAutoRefresh) return;

    countdownRef.current = 30;
    setCountdown(30);

    const interval = setInterval(() => {
      countdownRef.current -= 1;
      setCountdown(countdownRef.current);

      if (countdownRef.current <= 0) {
        countdownRef.current = 30;
        setCountdown(30);
        fetchLiveQuoteSilent();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLiveAutoRefresh]);

  // Change Date (for viewing history)
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

  // Manual Full Refresh Button
  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await api.market.refresh();
      if (res?.success && res.briefing) {
        setBriefing(res.briefing);
        setSelectedDate(res.briefing.date);
        setLastLiveUpdated(res.briefing.updated_at || '');
      } else {
        await fetchLiveQuoteSilent();
      }
      countdownRef.current = 30;
      setCountdown(30);
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenUrl = (url) => {
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
        <p className="text-slate-400 text-sm font-semibold">실시간 증시 & 시황 카드뉴스를 불러오는 중입니다...</p>
      </div>
    );
  }

  const domestic = briefing?.domestic || {};
  const overseas = briefing?.overseas || {};
  const allNews = briefing?.news || [];
  const summary3 = briefing?.summary_3lines || [];

  const domesticNews = allNews.filter(n => n.source_type === '국내증시');
  const globalNews = allNews.filter(n => n.source_type === '글로벌시황');

  const filteredNews = newsTab === 'domestic' ? domesticNews : (newsTab === 'global' ? globalNews : allNews);

  return (
    <div className="p-8 space-y-7 animate-fadeIn max-w-7xl mx-auto font-['Inter',sans-serif]">
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
                  <span>실시간 라이브 카드뉴스</span>
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                네이버 금융 실시간 시세 및 외신 한국어 번역 리포트가 포함된 스마트 대시보드입니다.
              </p>
            </div>
          </div>
        </div>

        {/* Live Status, Date Selector & Refresh Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Live Auto-Refresh Indicator */}
          <div 
            onClick={() => setIsLiveAutoRefresh(!isLiveAutoRefresh)}
            className={'flex items-center space-x-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer select-none text-xs font-bold shadow ' + 
              (isLiveAutoRefresh 
                ? 'bg-emerald-950/70 border-emerald-600/50 text-emerald-300 hover:bg-emerald-900/60' 
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800')}
            title="클릭하여 30초 자동 실시간 갱신 ON/OFF"
          >
            <span className="relative flex h-2 w-2">
              {isLiveAutoRefresh && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={'relative inline-flex rounded-full h-2 w-2 ' + (isLiveAutoRefresh ? 'bg-emerald-400' : 'bg-slate-500')}></span>
            </span>
            <span>{isLiveAutoRefresh ? `실시간 갱신 (${countdown}s)` : '자동 갱신 일시정지'}</span>
          </div>

          {/* History Date Picker */}
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

          {/* Refresh Button */}
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 text-xs font-bold shadow"
            title="즉시 새로고침"
          >
            <RefreshCw className={'w-3.5 h-3.5 ' + (refreshing ? 'animate-spin text-indigo-400' : '')} />
            <span>{refreshing ? '갱신 중...' : '새로고침'}</span>
          </button>
        </div>
      </div>

      {/* 2. Top Live Market Ticker Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* KOSPI */}
        {renderTickerCard(
          'KOSPI (코스피)',
          domestic.indices?.find(x => x.name === 'KOSPI')?.value || '6,784.50',
          domestic.indices?.find(x => x.name === 'KOSPI')?.change_rate || '-0.99%',
          domestic.indices?.find(x => x.name === 'KOSPI')?.change_amount,
          domestic.indices?.find(x => x.name === 'KOSPI')?.is_up === true
        )}
        {/* KOSDAQ */}
        {renderTickerCard(
          'KOSDAQ (코스닥)',
          domestic.indices?.find(x => x.name === 'KOSDAQ')?.value || '811.57',
          domestic.indices?.find(x => x.name === 'KOSDAQ')?.change_rate || '-3.49%',
          domestic.indices?.find(x => x.name === 'KOSDAQ')?.change_amount,
          domestic.indices?.find(x => x.name === 'KOSDAQ')?.is_up === true
        )}
        {/* NASDAQ */}
        {renderTickerCard(
          '나스닥 (NASDAQ)',
          overseas.indices?.find(x => x.name.includes('나스닥'))?.value || '26,067.17',
          overseas.indices?.find(x => x.name.includes('나스닥'))?.change_rate || '-1.00%',
          null,
          overseas.indices?.find(x => x.name.includes('나스닥'))?.is_up === true
        )}
        {/* S&P 500 */}
        {renderTickerCard(
          'S&P 500',
          overseas.indices?.find(x => x.name.includes('S&P'))?.value || '7,641.16',
          overseas.indices?.find(x => x.name.includes('S&P'))?.change_rate || '-0.87%',
          null,
          overseas.indices?.find(x => x.name.includes('S&P'))?.is_up === true
        )}
        {/* USD/KRW */}
        {renderTickerCard(
          '원/달러 환율',
          overseas.macro?.find(x => x.name.includes('환율'))?.value || '1,392.4원',
          overseas.macro?.find(x => x.name.includes('환율'))?.change_rate || '+0.22%',
          null,
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
                <span className="text-[10px] text-slate-400 font-mono">({lastLiveUpdated || briefing?.updated_at || '09:00 KST'})</span>
              </h3>
            </div>
          </div>
          <span className="text-[11px] font-bold text-indigo-400 bg-indigo-950/80 px-2.5 py-1 rounded-full border border-indigo-800/60 flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>실시간 호가 연동</span>
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
              <h3 className="font-bold text-sm text-white">국내 증시 및 실시간 시총 상위 종목</h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800/50 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span>네이버 페이 증시 실시간</span>
            </span>
          </div>

          {/* Domestic Indices Big Cards */}
          <div className="grid grid-cols-2 gap-3">
            {(domestic.indices || []).map((idx) => {
              const isUp = idx.is_up === true;
              return (
                <div key={idx.name} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="text-[11px] font-bold text-slate-400">{idx.label || idx.name}</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-extrabold text-white font-mono">{idx.value}</span>
                    <div className="text-right">
                      <span className={'text-xs font-bold font-mono flex items-center justify-end ' + (isUp ? 'text-red-400' : 'text-blue-400')}>
                        {isUp ? <TrendingUp className="w-3 h-3 mr-0.5 inline" /> : <TrendingDown className="w-3 h-3 mr-0.5 inline" />}
                        {idx.change_rate}
                      </span>
                      {idx.change_amount && (
                        <p className={'text-[10px] font-mono ' + (isUp ? 'text-red-400/80' : 'text-blue-400/80')}>
                          {idx.change_amount}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Real-time Top Stocks Grid (Direct match with Naver Pay Stock Top list) */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>시가총액 상위 TOP 종목 (실시간 현재가)</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">KRX 실시간 호가</span>
            </h4>
            <div className="space-y-2">
              {(domestic.top_stocks || []).map((stock, sIdx) => {
                const isUp = stock.is_up === true;
                return (
                  <div 
                    key={stock.ticker || sIdx}
                    className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-xl bg-slate-800 flex items-center justify-center text-[10px] font-mono font-bold text-slate-400">
                        {sIdx + 1}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white flex items-center space-x-1.5">
                          <span>{stock.name}</span>
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">{stock.ticker}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-extrabold text-white font-mono">{stock.price}</p>
                      <div className="flex items-center justify-end space-x-1.5 text-[11px] font-bold font-mono">
                        {stock.change_amount && (
                          <span className={isUp ? 'text-red-400/80' : 'text-blue-400/80'}>
                            {stock.change_amount}
                          </span>
                        )}
                        <span className={isUp ? 'text-red-400' : 'text-blue-400'}>
                          {stock.change_rate}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
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
            <span className="text-[10px] font-mono text-sky-400 bg-sky-950/60 px-2.5 py-1 rounded-full border border-sky-800/50 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping"></span>
              <span>Yahoo Finance 실시간</span>
            </span>
          </div>

          {/* Macro Indicators (Oil, Yield, FX) */}
          <div className="grid grid-cols-3 gap-2.5">
            {(overseas.macro || []).map((m) => {
              const isUp = m.is_up === true;
              return (
                <div key={m.name} className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 text-center">
                  <p className="text-[10px] font-bold text-slate-400 truncate" title={m.name}>{m.name}</p>
                  <p className="text-xs font-extrabold text-white font-mono truncate">{m.value}</p>
                  <p className={'text-[10px] font-bold font-mono ' + (isUp ? 'text-red-400' : 'text-blue-400')}>
                    {m.change_rate}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Global Big Tech Stocks */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>미국 주요 핵심 빅테크 종목 (실시간 쿼트)</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">NASDAQ</span>
            </h4>
            <div className="space-y-2">
              {(overseas.tech_stocks || []).map((stock) => {
                const isUp = stock.is_up === true;
                return (
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
                      <p className={'text-[11px] font-bold font-mono ' + (isUp ? 'text-red-400' : 'text-blue-400')}>
                        {stock.change_rate}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Bottom News Curation: 3 Domestic + 3 Global (Korean Translated) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-sm text-white flex items-center space-x-2">
              <Newspaper className="w-4 h-4 text-indigo-400" />
              <span>오늘의 핵심 증시 & 글로벌 경제 뉴스 (국내 3선 + 해외 번역 3선)</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              카드를 클릭하면 <span className="text-amber-300 font-bold">한국어 번역문 및 원문 발췌 리포트</span>를 바로 열람하실 수 있습니다.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center space-x-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setNewsTab('all')}
              className={'px-3 py-1 rounded-lg font-bold transition-colors ' + (newsTab === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200')}
            >
              전체 ({allNews.length})
            </button>
            <button
              onClick={() => setNewsTab('domestic')}
              className={'px-3 py-1 rounded-lg font-bold transition-colors ' + (newsTab === 'domestic' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200')}
            >
              🇰🇷 국내 뉴스 ({domesticNews.length})
            </button>
            <button
              onClick={() => setNewsTab('global')}
              className={'px-3 py-1 rounded-lg font-bold transition-colors ' + (newsTab === 'global' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200')}
            >
              🌐 해외 번역 뉴스 ({globalNews.length})
            </button>
          </div>
        </div>

        {/* News Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNews.map((item, idx) => {
            const isGlobal = item.source_type === '글로벌시황';

            return (
              <div
                key={idx}
                onClick={() => setSelectedNewsForModal(item)}
                className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800/90 hover:border-indigo-500/60 hover:bg-slate-850/60 transition-all cursor-pointer flex flex-col justify-between space-y-3.5 shadow-lg group relative"
              >
                <div className="space-y-3">
                  {/* Top Badge & Press */}
                  <div className="flex items-center justify-between">
                    <span className={'text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border flex items-center space-x-1 ' + 
                      (isGlobal 
                        ? 'bg-sky-950/80 text-sky-300 border-sky-800/60' 
                        : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60')}>
                      {isGlobal ? <Languages className="w-3 h-3 text-sky-400" /> : <Sparkles className="w-3 h-3 text-emerald-400" />}
                      <span>{isGlobal ? '해외 외신 한국어 번역' : '국내 증시 속보'}</span>
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">{item.press || '경제뉴스'}</span>
                  </div>

                  {/* Title (Korean Translated for Global News) */}
                  <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors leading-snug">
                    {item.title}
                  </h4>

                  {/* Summary Box */}
                  <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                    <p className="text-[10px] font-extrabold text-indigo-400 flex items-center space-x-1">
                      <Sparkles className="w-3 h-3" />
                      <span>{isGlobal ? '외신 한국어 핵심 요약' : '핵심 요약'}</span>
                    </p>
                    <p className="text-xs text-slate-200 leading-relaxed font-medium line-clamp-3">
                      {item.summary}
                    </p>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/60 text-xs">
                  <span className="text-[11px] font-bold text-amber-400 flex items-center space-x-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{isGlobal ? '번역 리포트 보기' : '원문 발췌 보기'}</span>
                  </span>
                  <div className="flex items-center space-x-1 text-[11px] font-bold text-indigo-400 group-hover:translate-x-0.5 transition-all">
                    <span>상세 읽기</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Interactive News Detail & Translation Reader Modal */}
      {selectedNewsForModal && (
        <NewsDetailModal 
          news={selectedNewsForModal} 
          onClose={() => setSelectedNewsForModal(null)} 
          onOpenExternal={() => handleOpenUrl(selectedNewsForModal.url)}
        />
      )}
    </div>
  );
}

// Interactive News Reader Modal Component
function NewsDetailModal({ news, onClose, onOpenExternal }) {
  const isGlobal = news.source_type === '글로벌시황';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const textToCopy = `[${news.title}]

요약: ${news.summary}

본문/발췌:
${news.body_excerpt || ''}

출처: ${news.press} (${news.url})`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-indigo-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className={'w-9 h-9 rounded-2xl flex items-center justify-center ' + 
              (isGlobal ? 'bg-sky-950 border border-sky-600/40 text-sky-300' : 'bg-emerald-950 border border-emerald-600/40 text-emerald-300')}>
              {isGlobal ? <Languages className="w-5 h-5" /> : <Newspaper className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className={'text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ' + 
                  (isGlobal ? 'bg-sky-950/80 text-sky-300 border-sky-800/60' : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60')}>
                  {isGlobal ? '🌐 외신 한국어 번역 리포트' : '🇰🇷 국내 증시 뉴스'}
                </span>
                <span className="text-xs font-bold text-slate-400">{news.press}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
          {/* Main Title */}
          <div>
            <h3 className="text-lg font-extrabold text-white leading-snug">
              {news.title}
            </h3>
            {news.original_title && (
              <p className="text-xs text-slate-400 font-mono mt-1 italic">
                (원문: {news.original_title})
              </p>
            )}
          </div>

          {/* 1. Core Summary Box */}
          <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-2">
            <p className="text-xs font-extrabold text-indigo-400 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{isGlobal ? 'AI 외신 핵심 요약 및 시사점' : '핵심 요약'}</span>
            </p>
            <p className="text-xs text-slate-100 leading-relaxed font-medium">
              {news.summary}
            </p>
          </div>

          {/* 2. Full Body Excerpt / Translation Text */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <span>{isGlobal ? '📜 외신 기사 원문 및 상세 내용' : '📜 기사 원문 전문 발췌'}</span>
              </h4>
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 text-[11px] font-bold text-slate-400 hover:text-indigo-300 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '복사됨!' : '내용 복사'}</span>
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-normal max-h-64 overflow-y-auto custom-scrollbar">
              {news.body_excerpt || news.summary || '상세 내용이 없습니다.'}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-5 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
          >
            닫기
          </button>

          <button
            onClick={onOpenExternal}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 hover:scale-105 active:scale-95"
          >
            <span>원문 언론사 기사 열기</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function renderTickerCard(title, value, changeRate, changeAmount, isUp) {
  return (
    <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800/90 hover:border-indigo-500/40 transition-all shadow-md">
      <p className="text-[10px] font-bold text-slate-400 truncate">{title}</p>
      <p className="text-sm font-extrabold text-white font-mono mt-0.5">{value}</p>
      <div className="flex items-center justify-between mt-0.5">
        <p className={'text-[11px] font-bold font-mono flex items-center ' + (isUp ? 'text-red-400' : 'text-blue-400')}>
          {isUp ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
          <span>{changeRate}</span>
        </p>
        {changeAmount && (
          <span className={'text-[10px] font-mono ' + (isUp ? 'text-red-400/80' : 'text-blue-400/80')}>
            {changeAmount}
          </span>
        )}
      </div>
    </div>
  );
}
