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

def translate_to_korean(text):
    if not text:
        return ""
    try:
        url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q={requests.utils.quote(text)}"
        res = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=5)
        if res.status_code == 200:
            data = res.json()
            translated = "".join([x[0] for x in data[0] if x and len(x) > 0])
            return translated if translated else text
    except Exception:
        pass
    return text

def fetch_domestic_market():
    domestic_data = {
        "indices": [],
        "top_stocks": [],
        "market_sentiment": "안정"
    }

    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

    # 1. Real-time Indices (KOSPI, KOSDAQ)
    try:
        idx_res = requests.get("https://polling.finance.naver.com/api/realtime/domestic/index/KOSPI,KOSDAQ", headers=headers, timeout=6)
        if idx_res.status_code == 200:
            idx_json = idx_res.json()
            for d in idx_json.get("datas", []):
                name = "KOSPI" if d.get("itemCode") == "KOSPI" else ("KOSDAQ" if d.get("itemCode") == "KOSDAQ" else d.get("stockName", ""))
                ratio_val = float(d.get("fluctuationsRatio", 0) or 0)
                is_up = d.get("compareToPreviousPrice", {}).get("name") == "RISING" or ratio_val > 0
                domestic_data["indices"].append({
                    "name": name,
                    "value": d.get("closePrice", ""),
                    "change_amount": d.get("compareToPreviousClosePrice", ""),
                    "change_rate": f"{ratio_val:+.2f}%",
                    "is_up": is_up
                })
    except Exception as e:
        print(f"[Domestic-Index] Error: {e}")

    # 2. Real-time Top Stocks from Market Value API (Exact matches Naver Pay Stock Top list)
    try:
        stk_res = requests.get("https://m.stock.naver.com/api/stocks/marketValue/KOSPI?page=1&pageSize=8", headers=headers, timeout=6)
        if stk_res.status_code == 200:
            stk_json = stk_res.json()
            for s in stk_json.get("stocks", [])[:6]:
                ratio_val = float(s.get("fluctuationsRatio", 0) or 0)
                is_up = ratio_val > 0
                domestic_data["top_stocks"].append({
                    "ticker": s.get("itemCode", ""),
                    "name": s.get("stockName", ""),
                    "price": f"{s.get('closePrice', '')}원",
                    "change_amount": s.get("compareToPreviousClosePrice", ""),
                    "change_rate": f"{ratio_val:+.2f}%",
                    "is_up": is_up
                })
    except Exception as e:
        print(f"[Domestic-Stocks] Error: {e}")

    return domestic_data

def fetch_overseas_market():
    overseas_data = {
        "indices": [],
        "macro": [],
        "tech_stocks": []
    }

    symbols = [
        ("^GSPC", "S&P 500", "index", ""),
        ("^IXIC", "나스닥 (NASDAQ)", "index", ""),
        ("^DJI", "다우존스 (Dow Jones)", "index", ""),
        ("USDKRW=X", "원/달러 환율", "macro", "원"),
        ("CL=F", "WTI 원유", "macro", "$/배럴"),
        ("^TNX", "미국 10년물 국채금리", "macro", "%"),
        ("NVDA", "엔비디아 (NVIDIA)", "tech", ""),
        ("AAPL", "애플 (Apple)", "tech", ""),
        ("MSFT", "마이크로소프트 (Microsoft)", "tech", ""),
        ("TSLA", "테슬라 (Tesla)", "tech", ""),
        ("GOOGL", "알파벳/구글 (Google)", "tech", "")
    ]

    headers = {"User-Agent": "Mozilla/5.0"}
    for sym, name, category, unit in symbols:
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=2d"
            res = requests.get(url, headers=headers, timeout=5)
            if res.status_code == 200:
                data = res.json()
                meta = data.get("chart", {}).get("result", [{}])[0].get("meta", {})
                cur_price = meta.get("regularMarketPrice") or meta.get("chartPreviousClose", 0)
                prev_price = meta.get("chartPreviousClose") or meta.get("previousClose", cur_price)
                chg_rate = ((cur_price - prev_price) / prev_price * 100) if prev_price else 0.0
                is_up = chg_rate >= 0

                if category == "index":
                    overseas_data["indices"].append({
                        "symbol": sym,
                        "name": name,
                        "value": f"{cur_price:,.2f}",
                        "change_rate": f"{chg_rate:+.2f}%",
                        "is_up": is_up
                    })
                elif category == "macro":
                    val_str = f"{cur_price:,.1f}원" if unit == "원" else f"{cur_price:,.2f} {unit}"
                    overseas_data["macro"].append({
                        "symbol": sym,
                        "name": name,
                        "value": val_str,
                        "change_rate": f"{chg_rate:+.2f}%",
                        "is_up": is_up
                    })
                elif category == "tech":
                    overseas_data["tech_stocks"].append({
                        "symbol": sym,
                        "name": name,
                        "price": f"${cur_price:,.2f}",
                        "change_rate": f"{chg_rate:+.2f}%",
                        "is_up": is_up
                    })
        except Exception as e:
            print(f"[Yahoo-Live] Error fetching {name}: {e}")

    return overseas_data

def fetch_curated_news():
    news_items = []

    # 1. 3 Domestic News from Naver Finance with Article Excerpt
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        res = requests.get("https://finance.naver.com/news/mainnews.naver", headers=headers, timeout=6)
        if res.status_code == 200:
            html_text = res.content.decode("euc-kr", "ignore")
            blocks = re.findall(r'<li class="block1">([\s\S]*?)</li>', html_text)
            for blk in blocks[:6]:
                if len([n for n in news_items if n["source_type"] == "국내증시"]) >= 3:
                    break
                subj_match = re.search(r'<dd class="articleSubject">\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)</a>', blk)
                summ_match = re.search(r'<dd class="articleSummary">([\s\S]*?)(?:<span|\Z)', blk)
                press_match = re.search(r'<span class="press">([^<]+)</span>', blk)

                if subj_match:
                    url = subj_match.group(1).strip()
                    if url.startswith("/"):
                        url = "https://finance.naver.com" + url
                    title = re.sub(r'<[^>]+>', '', subj_match.group(2)).strip()
                    summary = re.sub(r'<[^>]+>', '', summ_match.group(1)).strip() if summ_match else ""
                    press = press_match.group(1).strip() if press_match else "네이버 금융"

                    # Fetch body excerpt
                    body_excerpt = summary
                    try:
                        art_res = requests.get(url, headers=headers, timeout=4)
                        if art_res.status_code == 200:
                            match = re.search(r'<article[^>]*id=["\'](?:dic_area|articleBodyContents)["\'][^>]*>([\s\S]*?)</article>', art_res.text, re.I) or \
                                    re.search(r'<div[^>]*id=["\'](?:dic_area|articleBodyContents|articleCont)["\'][^>]*>([\s\S]*?)</div>', art_res.text, re.I)
                            if match:
                                text = re.sub(r'<[^>]+>', ' ', match.group(1))
                                body_excerpt = re.sub(r'\s+', ' ', text).strip()
                    except Exception:
                        pass

                    if title:
                        news_items.append({
                            "source_type": "국내증시",
                            "title": title,
                            "summary": summary[:140] + ("..." if len(summary) > 140 else ""),
                            "body_excerpt": body_excerpt,
                            "url": url,
                            "press": press
                        })
    except Exception as e:
        print(f"[Domestic-News] Error: {e}")

    # 2. 3 Global News from Yahoo Finance (Korean Translated)
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        res = requests.get("https://query1.finance.yahoo.com/v1/finance/search?q=stock%20market&newsCount=5", headers=headers, timeout=5)
        if res.status_code == 200:
            news_json = res.json().get("news", [])
            for n in news_json:
                if len([x for x in news_items if x["source_type"] == "글로벌시황"]) >= 3:
                    break
                title = n.get("title", "")
                link = n.get("link", "")
                publisher = n.get("publisher", "Yahoo Finance")
                if title:
                    ko_title = translate_to_korean(title)
                    news_items.append({
                        "source_type": "글로벌시황",
                        "title": ko_title,
                        "original_title": title,
                        "summary": f"[{publisher} 외신] {ko_title} - 실시간 글로벌 증시 경제 속보입니다.",
                        "body_excerpt": f"[외신 기사 원문 - {publisher}]
{title}

상세 기사 원문은 아래 원문 기사 읽기를 통해 확인하실 수 있습니다.",
                        "url": link,
                        "press": f"{publisher} (외신)"
                    })
    except Exception as e:
        print(f"[Global-News] Error: {e}")

    return news_items

def generate_3line_summary(domestic, overseas, news):
    lines = []

    us_indices = overseas.get("indices", [])
    if us_indices:
        nasdaq = next((x for x in us_indices if "나스닥" in x["name"]), None)
        sp = next((x for x in us_indices if "S&P" in x["name"]), None)
        if nasdaq and sp:
            lines.append(f"🇺🇸 뉴욕증시: 나스닥({nasdaq['value']}, {nasdaq['change_rate']}), S&P 500({sp['value']}, {sp['change_rate']}) 마감.")
        elif us_indices:
            lines.append(f"🇺🇸 뉴욕증시: {us_indices[0]['name']}({us_indices[0]['value']}, {us_indices[0]['change_rate']}) 등 글로벌 증시 동향.")
    else:
        lines.append("🇺🇸 글로벌 증시: 뉴욕 주요 지수 및 기술주 섹터 동향.")

    kr_indices = domestic.get("indices", [])
    if kr_indices:
        kospi = next((x for x in kr_indices if "KOSPI" in x["name"]), None)
        kosdaq = next((x for x in kr_indices if "KOSDAQ" in x["name"]), None)
        if kospi:
            lines.append(f"🇰🇷 국내증시: 코스피({kospi['value']}, {kospi['change_rate']}), 코스닥({kosdaq['value'] if kosdaq else ''}, {kosdaq['change_rate'] if kosdaq else ''}) 실시간 호가.")
        else:
            lines.append(f"🇰🇷 국내증시: {kr_indices[0]['name']}({kr_indices[0]['value']}, {kr_indices[0]['change_rate']}) 흐름.")
    else:
        lines.append("🇰🇷 국내증시: 외국인 및 기관 수급 동향과 주요 반도체/2차전지 섹터 주시.")

    macros = overseas.get("macro", [])
    fx = next((x for x in macros if "환율" in x["name"]), None)
    oil = next((x for x in macros if "원유" in x["name"]), None)
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
    time_str = kst_now.strftime("%H:%M")

    print(f"=== Starting Daily Market Crawler for {date_str} {time_str} KST ===")

    domestic = fetch_domestic_market()
    overseas = fetch_overseas_market()
    news = fetch_curated_news()
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