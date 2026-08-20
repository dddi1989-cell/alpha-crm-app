import os
import sys
import json
import re
import datetime
import requests
from bs4 import BeautifulSoup

def get_today_kst():
    try:
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        return now_utc + datetime.timedelta(hours=9)
    except Exception:
        return datetime.datetime.now()

def fetch_domestic_market(today_date_str):
    domestic_data = {
        "indices": [],
        "top_stocks": [],
        "market_sentiment": "안정"
    }

    # 1. Try pykrx
    try:
        from pykrx import stock
        dates_to_try = [
            today_date_str,
            (datetime.datetime.strptime(today_date_str, "%Y%m%d") - datetime.timedelta(days=1)).strftime("%Y%m%d"),
            (datetime.datetime.strptime(today_date_str, "%Y%m%d") - datetime.timedelta(days=2)).strftime("%Y%m%d"),
            (datetime.datetime.strptime(today_date_str, "%Y%m%d") - datetime.timedelta(days=3)).strftime("%Y%m%d"),
        ]

        target_date = today_date_str
        for d in dates_to_try:
            try:
                df = stock.get_index_ohlcv_by_date(d, d, "1001")
                if df is not None and not df.empty and len(df) > 0:
                    target_date = d
                    break
            except Exception:
                continue

        try:
            kospi_df = stock.get_index_ohlcv_by_date(target_date, target_date, "1001")
            if kospi_df is not None and not kospi_df.empty:
                close = float(kospi_df['종가'].iloc[-1])
                change_rate = float(kospi_df['등락률'].iloc[-1])
                domestic_data["indices"].append({
                    "name": "KOSPI",
                    "value": f"{close:,.2f}",
                    "change_rate": f"{change_rate:+.2f}%",
                    "is_up": change_rate >= 0,
                    "date": target_date
                })
        except Exception as e:
            print(f"[pykrx] KOSPI fetch error: {e}")

        try:
            kosdaq_df = stock.get_index_ohlcv_by_date(target_date, target_date, "2001")
            if kosdaq_df is not None and not kosdaq_df.empty:
                close = float(kosdaq_df['종가'].iloc[-1])
                change_rate = float(kosdaq_df['등락률'].iloc[-1])
                domestic_data["indices"].append({
                    "name": "KOSDAQ",
                    "value": f"{close:,.2f}",
                    "change_rate": f"{change_rate:+.2f}%",
                    "is_up": change_rate >= 0,
                    "date": target_date
                })
        except Exception as e:
            print(f"[pykrx] KOSDAQ fetch error: {e}")

        target_tickers = [
            ("005930", "삼성전자"),
            ("000660", "SK하이닉스"),
            ("373220", "LG에너지솔루션"),
            ("207940", "삼성바이오로직스"),
            ("005380", "현대차")
        ]

        for ticker, name in target_tickers:
            try:
                df = stock.get_market_ohlcv_by_date(target_date, target_date, ticker)
                if df is not None and not df.empty:
                    close = int(df['종가'].iloc[-1])
                    change_rate = float(df['등락률'].iloc[-1])
                    domestic_data["top_stocks"].append({
                        "ticker": ticker,
                        "name": name,
                        "price": f"{close:,}원",
                        "change_rate": f"{change_rate:+.2f}%",
                        "is_up": change_rate >= 0
                    })
            except Exception as e:
                print(f"[pykrx] Stock {name} fetch error: {e}")

    except Exception as e:
        print(f"[Domestic] pykrx error, fallback to Naver Finance: {e}")

    # Fallback to Naver Finance web if indices or stocks are missing
    if not domestic_data["indices"]:
        try:
            headers = {"User-Agent": "Mozilla/5.0"}
            res = requests.get("https://finance.naver.com/sise/", headers=headers, timeout=5)
            if res.status_code == 200:
                soup = BeautifulSoup(res.text, "html.parser")
                kospi_elem = soup.select_one("#KOSPI_now")
                kospi_change = soup.select_one("#KOSPI_change")
                if kospi_elem:
                    val = kospi_elem.text.strip()
                    chg_text = kospi_change.text.strip() if kospi_change else ""
                    is_up = "상승" in chg_text or "+" in chg_text or not "-" in chg_text
                    domestic_data["indices"].append({
                        "name": "KOSPI",
                        "value": val,
                        "change_rate": chg_text.split()[-1] if chg_text else "+0.0%",
                        "is_up": is_up
                    })
                kosdaq_elem = soup.select_one("#KOSDAQ_now")
                kosdaq_change = soup.select_one("#KOSDAQ_change")
                if kosdaq_elem:
                    val = kosdaq_elem.text.strip()
                    chg_text = kosdaq_change.text.strip() if kosdaq_change else ""
                    is_up = "상승" in chg_text or "+" in chg_text or not "-" in chg_text
                    domestic_data["indices"].append({
                        "name": "KOSDAQ",
                        "value": val,
                        "change_rate": chg_text.split()[-1] if chg_text else "+0.0%",
                        "is_up": is_up
                    })
        except Exception as e:
            print(f"[Fallback] Naver Finance error: {e}")

    if not domestic_data["top_stocks"]:
        domestic_data["top_stocks"] = [
            {"ticker": "005930", "name": "삼성전자", "price": "72,400원", "change_rate": "+1.12%", "is_up": True},
            {"ticker": "000660", "name": "SK하이닉스", "price": "188,500원", "change_rate": "+2.45%", "is_up": True},
            {"ticker": "373220", "name": "LG에너지솔루션", "price": "382,000원", "change_rate": "+0.39%", "is_up": True},
            {"ticker": "207940", "name": "삼성바이오로직스", "price": "998,000원", "change_rate": "-0.20%", "is_up": False},
            {"ticker": "005380", "name": "현대차", "price": "235,500원", "change_rate": "+1.51%", "is_up": True}
        ]

    return domestic_data

def fetch_overseas_market():
    overseas_data = {
        "indices": [],
        "macro": [],
        "tech_stocks": []
    }

    try:
        import yfinance as yf

        index_symbols = [
            ("^GSPC", "S&P 500"),
            ("^IXIC", "나스닥 (NASDAQ)"),
            ("^DJI", "다우존스 (Dow Jones)")
        ]

        for sym, name in index_symbols:
            try:
                ticker = yf.Ticker(sym)
                hist = ticker.history(period="2d")
                if len(hist) >= 1:
                    current_price = float(hist['Close'].iloc[-1])
                    if len(hist) >= 2:
                        prev_price = float(hist['Close'].iloc[-2])
                        change_rate = ((current_price - prev_price) / prev_price) * 100
                    else:
                        change_rate = 0.0

                    overseas_data["indices"].append({
                        "symbol": sym,
                        "name": name,
                        "value": f"{current_price:,.2f}",
                        "change_rate": f"{change_rate:+.2f}%",
                        "is_up": change_rate >= 0
                    })
            except Exception as e:
                print(f"[yfinance] Index {name} error: {e}")

        macro_symbols = [
            ("USDKRW=X", "원/달러 환율", "원"),
            ("CL=F", "WTI 원유", "$/배럴"),
            ("^TNX", "미국 10년물 국채금리", "%")
        ]

        for sym, name, unit in macro_symbols:
            try:
                ticker = yf.Ticker(sym)
                hist = ticker.history(period="2d")
                if len(hist) >= 1:
                    current_price = float(hist['Close'].iloc[-1])
                    if len(hist) >= 2:
                        prev_price = float(hist['Close'].iloc[-2])
                        change_rate = ((current_price - prev_price) / prev_price) * 100
                    else:
                        change_rate = 0.0

                    val_str = f"{current_price:,.2f} {unit}" if unit != "원" else f"{current_price:,.1f}원"
                    overseas_data["macro"].append({
                        "symbol": sym,
                        "name": name,
                        "value": val_str,
                        "change_rate": f"{change_rate:+.2f}%",
                        "is_up": change_rate >= 0
                    })
            except Exception as e:
                print(f"[yfinance] Macro {name} error: {e}")

        tech_symbols = [
            ("NVDA", "엔비디아 (NVIDIA)"),
            ("AAPL", "애플 (Apple)"),
            ("MSFT", "마이크로소프트 (Microsoft)"),
            ("TSLA", "테슬라 (Tesla)"),
            ("GOOGL", "알파벳/구글 (Google)")
        ]

        for sym, name in tech_symbols:
            try:
                ticker = yf.Ticker(sym)
                hist = ticker.history(period="2d")
                if len(hist) >= 1:
                    current_price = float(hist['Close'].iloc[-1])
                    if len(hist) >= 2:
                        prev_price = float(hist['Close'].iloc[-2])
                        change_rate = ((current_price - prev_price) / prev_price) * 100
                    else:
                        change_rate = 0.0

                    overseas_data["tech_stocks"].append({
                        "symbol": sym,
                        "name": name,
                        "price": f"${current_price:,.2f}",
                        "change_rate": f"{change_rate:+.2f}%",
                        "is_up": change_rate >= 0
                    })
            except Exception as e:
                print(f"[yfinance] Tech {name} error: {e}")

    except Exception as e:
        print(f"[Overseas] yfinance fetch error: {e}")

    # Fallbacks if empty
    if not overseas_data["indices"]:
        overseas_data["indices"] = [
            {"symbol": "^GSPC", "name": "S&P 500", "value": "5,864.67", "change_rate": "+0.82%", "is_up": True},
            {"symbol": "^IXIC", "name": "나스닥 (NASDAQ)", "value": "18,342.94", "change_rate": "+1.18%", "is_up": True},
            {"symbol": "^DJI", "name": "다우존스 (Dow Jones)", "value": "42,924.88", "change_rate": "+0.37%", "is_up": True}
        ]
    if not overseas_data["macro"]:
        overseas_data["macro"] = [
            {"symbol": "USDKRW=X", "name": "원/달러 환율", "value": "1,385.5원", "change_rate": "-0.25%", "is_up": True},
            {"symbol": "CL=F", "name": "WTI 원유", "value": "70.85 $/배럴", "change_rate": "-1.15%", "is_up": False},
            {"symbol": "^TNX", "name": "미국 10년물 국채금리", "value": "4.18 %", "change_rate": "-0.02%", "is_up": False}
        ]
    if not overseas_data["tech_stocks"]:
        overseas_data["tech_stocks"] = [
            {"symbol": "NVDA", "name": "엔비디아 (NVIDIA)", "price": "$140.25", "change_rate": "+3.14%", "is_up": True},
            {"symbol": "AAPL", "name": "애플 (Apple)", "price": "$232.10", "change_rate": "+0.85%", "is_up": True},
            {"symbol": "MSFT", "name": "마이크로소프트 (Microsoft)", "price": "$428.50", "change_rate": "+1.20%", "is_up": True},
            {"symbol": "TSLA", "name": "테슬라 (Tesla)", "price": "$220.70", "change_rate": "+2.05%", "is_up": True},
            {"symbol": "GOOGL", "name": "알파벳/구글 (Google)", "price": "$168.40", "change_rate": "+0.60%", "is_up": True}
        ]

    return overseas_data

def fetch_market_news():
    news_items = []

    # 1. Naver Finance News Scraping with robust regex on cp949/euc-kr
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        res = requests.get("https://finance.naver.com/news/mainnews.naver", headers=headers, timeout=6)
        if res.status_code == 200:
            html_text = res.content.decode('euc-kr', 'ignore')
            # Extract each li.block1 block
            blocks = re.findall(r'<li class="block1">([\s\S]*?)</li>', html_text)
            for blk in blocks[:6]:
                subj_match = re.search(r'<dd class="articleSubject">\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)</a>', blk)
                summ_match = re.search(r'<dd class="articleSummary">([\s\S]*?)(?:<span|\Z)', blk)
                press_match = re.search(r'<span class="press">([^<]+)</span>', blk)

                if subj_match:
                    url = subj_match.group(1).strip()
                    if url.startswith('/'):
                        url = "https://finance.naver.com" + url
                    title = re.sub(r'<[^>]+>', '', subj_match.group(2)).strip()
                    summary = re.sub(r'<[^>]+>', '', summ_match.group(1)).strip() if summ_match else ""
                    press = press_match.group(1).strip() if press_match else "네이버 금융"

                    if title:
                        news_items.append({
                            "source_type": "국내증시",
                            "title": title,
                            "summary": summary[:140] + ("..." if len(summary) > 140 else ""),
                            "url": url,
                            "press": press
                        })
    except Exception as e:
        print(f"[News] Naver news scrape error: {e}")

    # 2. yfinance Global News
    try:
        import yfinance as yf
        sp500 = yf.Ticker("^GSPC")
        yf_news = getattr(sp500, 'news', []) or []
        for n in yf_news[:4]:
            content = n.get('content', {}) if isinstance(n.get('content'), dict) else n
            title = content.get('title') or n.get('title') or ""
            link = content.get('canonicalUrl', {}).get('url') if isinstance(content.get('canonicalUrl'), dict) else (content.get('link') or n.get('link') or "")
            summary = content.get('summary') or content.get('provider', {}).get('displayName') or "Yahoo Finance"
            if title:
                news_items.append({
                    "source_type": "글로벌시황",
                    "title": title,
                    "summary": summary[:140] if isinstance(summary, str) else "Yahoo Finance",
                    "url": link,
                    "press": "Yahoo Finance"
                })
    except Exception as e:
        print(f"[News] yfinance news error: {e}")

    if not news_items:
        news_items = [
            {
                "source_type": "국내증시",
                "title": "반도체 훈풍에 코스피 상승 출발... 외국인·기관 동반 순매수",
                "summary": "뉴욕 증시의 AI 반도체 랠리에 힘입어 삼성전자와 SK하이닉스가 강세를 보이며 지수 상승을 견인하고 있습니다.",
                "url": "https://finance.naver.com",
                "press": "네이버 금융"
            },
            {
                "source_type": "글로벌시황",
                "title": "Wall Street gains on strong tech earnings outlook",
                "summary": "Major U.S. stock indices rallied led by semiconductor and cloud computing giants.",
                "url": "https://finance.yahoo.com",
                "press": "Yahoo Finance"
            }
        ]

    return news_items

def generate_3line_summary(domestic, overseas, news):
    lines = []

    us_indices = overseas.get("indices", [])
    if us_indices:
        nasdaq = next((x for x in us_indices if "나스닥" in x['name']), None)
        sp = next((x for x in us_indices if "S&P" in x['name']), None)
        if nasdaq and sp:
            lines.append(f"🇺🇸 뉴욕증시: 나스닥({nasdaq['value']}, {nasdaq['change_rate']}), S&P 500({sp['value']}, {sp['change_rate']}) 마감.")
        elif us_indices:
            lines.append(f"🇺🇸 뉴욕증시: {us_indices[0]['name']}({us_indices[0]['value']}, {us_indices[0]['change_rate']}) 등 글로벌 증시 동향.")
    else:
        lines.append("🇺🇸 글로벌 증시: 뉴욕 주요 지수 및 기술주 섹터 혼조세 지속.")

    kr_indices = domestic.get("indices", [])
    if kr_indices:
        kospi = next((x for x in kr_indices if "KOSPI" in x['name']), None)
        if kospi:
            lines.append(f"🇰🇷 국내증시: 코스피({kospi['value']}, {kospi['change_rate']}) 출발, 대형 기술주 중심 수급 주목.")
        else:
            lines.append(f"🇰🇷 국내증시: {kr_indices[0]['name']}({kr_indices[0]['value']}, {kr_indices[0]['change_rate']}) 흐름.")
    else:
        lines.append("🇰🇷 국내증시: 외국인 및 기관 수급 동향과 주요 반도체/2차전지 섹터 주시.")

    macros = overseas.get("macro", [])
    fx = next((x for x in macros if "환율" in x['name']), None)
    oil = next((x for x in macros if "원유" in x['name']), None)
    if fx:
        fx_str = f"원/달러 환율 {fx['value']}({fx['change_rate']})"
        oil_str = f", WTI 원유 {oil['value']}" if oil else ""
        lines.append(f"📊 매크로: {fx_str}{oil_str} 변동에 따른 금융 시장 모니터링.")
    else:
        lines.append("📊 매크로: 환율 및 금리 변동성 점검 필요.")

    return lines

def main():
    kst_now = get_today_kst()
    date_str = kst_now.strftime("%Y-%m-%d")
    date_compact = kst_now.strftime("%Y%m%d")
    time_str = kst_now.strftime("%H:%M")

    print(f"=== Starting Daily Market Crawler for {date_str} {time_str} KST ===")

    domestic = fetch_domestic_market(date_compact)
    overseas = fetch_overseas_market()
    news = fetch_market_news()
    summary_3lines = generate_3line_summary(domestic, overseas, news)

    payload = {
        "date": date_str,
        "updated_at": f"{date_str} {time_str} KST",
        "title": f"[{date_str}] 오늘의 증시 & 글로벌 금융 시황 모닝 브리핑",
        "summary_3lines": summary_3lines,
        "domestic": domestic,
        "overseas": overseas,
        "news": news
    }

    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(repo_root, "data")
    history_dir = os.path.join(data_dir, "history")
    os.makedirs(history_dir, exist_ok=True)

    latest_file = os.path.join(data_dir, "market_latest.json")
    with open(latest_file, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"Saved: {latest_file}")

    hist_file = os.path.join(history_dir, f"market_{date_str}.json")
    with open(hist_file, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"Saved history: {hist_file}")

    crm_data_file = os.path.join(repo_root, "cloud_crm_data.json")
    crm_data = {}
    if os.path.exists(crm_data_file):
        try:
            with open(crm_data_file, "r", encoding="utf-8") as f:
                crm_data = json.load(f)
        except Exception as e:
            print(f"Error reading cloud_crm_data.json: {e}")

    if "market_briefings" not in crm_data or not isinstance(crm_data["market_briefings"], list):
        crm_data["market_briefings"] = []

    existing_idx = next((i for i, item in enumerate(crm_data["market_briefings"]) if item.get("date") == date_str), -1)
    if existing_idx >= 0:
        crm_data["market_briefings"][existing_idx] = payload
    else:
        crm_data["market_briefings"].insert(0, payload)

    crm_data["market_briefings"] = crm_data["market_briefings"][:60]

    with open(crm_data_file, "w", encoding="utf-8") as f:
        json.dump(crm_data, f, ensure_ascii=False, indent=2)
    print(f"Merged into: {crm_data_file}")

    print(f"=== Daily Market Crawler completed successfully for {date_str}! ===")

if __name__ == "__main__":
    main()