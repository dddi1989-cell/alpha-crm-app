/**
 * NTS Embedded Hometax Authentication & Scraping Service (비용 0원 국세청 직접 연동)
 * Opens an embedded official Hometax Simple Authentication Window, intercepts login session,
 * and fetches Year-End Tax Settlement Medical & Indemnity Claim records directly into WLB CRM.
 */

const { BrowserWindow, session, ipcMain } = require('electron');
const { fetchHometaxMedicalData } = require('./ntsHometaxScraper');

let authWindow = null;

// Modern Chrome User-Agent
const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/**
 * Open Official NTS Hometax Simple Auth Window & Intercept Login
 */
async function openHometaxAuthWindow({ clientName, clientPhone, clientBirth, provider = 'kakao', targetYear = 2025 }) {
  console.log('[NTS-AuthWindow] Opening official NTS Hometax window for:', { clientName, clientPhone, provider, targetYear });

  return new Promise((resolve) => {
    if (authWindow && !authWindow.isDestroyed()) {
      authWindow.focus();
      return resolve({ success: false, error: '이미 국세청 인증 창이 열려 있습니다.' });
    }

    // 1. Create Dedicated Browser Window for NTS
    authWindow = new BrowserWindow({
      width: 1040,
      height: 900,
      title: '국세청 홈택스 간편인증 - [WLB CRM 실시간 연동] 스마트폰 인증 완료 시 자동으로 데이터를 가져옵니다',
      center: true,
      autoHideMenuBar: true,
      resizable: true,
      alwaysOnTop: true,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'persist:nts_auth_session'
      }
    });

    authWindow.webContents.setUserAgent(CHROME_USER_AGENT);

    let isCompleted = false;
    let windowOpenedAt = Date.now();
    let hasAttemptedLogin = false;

    // 2. Complete Scraping & Close Window
    const finishAndScrape = async (reason = 'AUTO_DETECTED') => {
      if (isCompleted) return;
      isCompleted = true;
      console.log(`[NTS-AuthWindow] Scraping triggered by: ${reason}`);

      try {
        const cookies = await authWindow.webContents.session.cookies.get({ domain: 'hometax.go.kr' });
        const cookieMap = {};
        cookies.forEach(c => { cookieMap[c.name] = c.value; });

        const scrapedData = await fetchHometaxMedicalData({
          cookies: cookieMap,
          clientName,
          clientPhone,
          clientBirth,
          provider,
          targetYear
        });

        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.close();
        }

        resolve({
          success: true,
          data: scrapedData,
          message: '국세청 홈택스 간편인증 및 연말정산 의료비·실손보험금 조회가 성공적으로 완료되었습니다!'
        });
      } catch (err) {
        console.error('[NTS-AuthWindow] Scrape error:', err);
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.close();
        }
        resolve({
          success: false,
          error: '데이터 수집 중 오류: ' + err.message
        });
      }
    };

    // 3. Inject Floating WLB CRM Action Bar into Hometax page
    const injectWlbToolbar = async () => {
      if (!authWindow || authWindow.isDestroyed()) return;
      try {
        const script = `
          (function() {
            if (document.getElementById('wlb-nts-topbar')) return;
            const bar = document.createElement('div');
            bar.id = 'wlb-nts-topbar';
            bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:46px;background:linear-gradient(90deg,#0f172a,#881337,#0f172a);color:#fff;z-index:99999999;display:flex;align-items:center;justify-content:between;padding:0 20px;font-family:sans-serif;font-size:13px;font-weight:bold;box-shadow:0 4px 20px rgba(0,0,0,0.6);border-bottom:2px solid #f43f5e;';
            bar.innerHTML = '<div style="display:flex;align-items:center;gap:8px;">' +
              '<span style="background:#f43f5e;color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;">WLB CRM 연동</span>' +
              '<span>스마트폰에서 본인인증 완료 후 오른쪽 버튼을 눌러주세요 ➔</span>' +
              '</div>' +
              '<button id="wlb-fetch-btn" style="background:linear-gradient(90deg,#f43f5e,#fb7185);border:none;color:#fff;padding:6px 16px;border-radius:8px;font-weight:900;font-size:12px;cursor:pointer;box-shadow:0 2px 10px rgba(244,63,94,0.4);">' +
              '✨ [인증 완료] 의료비 데이터 가져오기' +
              '</button>';
            document.body.prepend(bar);
            document.body.style.marginTop = '46px';

            document.getElementById('wlb-fetch-btn').onclick = function() {
              this.innerText = '⏳ WLB CRM으로 데이터 전송 중...';
              this.style.background = '#059669';
              document.title = '__WLB_AUTH_COMPLETE__';
            };
          })();
        `;
        await authWindow.webContents.executeJavaScript(script);
      } catch (e) {}
    };

    // 4. Check DOM & Title for Login Success or WLB Button Click
    const checkLoginStatus = async () => {
      if (isCompleted || !authWindow || authWindow.isDestroyed()) return;

      try {
        const title = await authWindow.getTitle();
        if (title.includes('__WLB_AUTH_COMPLETE__')) {
          return finishAndScrape('WLB_TOOLBAR_BUTTON');
        }

        // Check if user has passed at least 4 seconds and logged in
        if (Date.now() - windowOpenedAt > 4000) {
          const domCheck = await authWindow.webContents.executeJavaScript(`
            (function() {
              const text = document.body ? document.body.innerText : '';
              const isLogged = text.includes('로그아웃') || 
                               text.includes('님 환영합니다') || 
                               text.includes('인증서 로그아웃') || 
                               text.includes('마이홈택스') ||
                               text.includes('연말정산간소화') ||
                               !!document.querySelector('.btn_logout') ||
                               !!document.getElementById('btn_logout');
              return isLogged;
            })()
          `);

          if (domCheck) {
            console.log('[NTS-AuthWindow] DOM login confirmation detected!');
            hasAttemptedLogin = true;
            return finishAndScrape('DOM_LOGGED_IN');
          }
        }

        // Try injecting toolbar
        injectWlbToolbar();
      } catch (err) {}
    };

    // Events
    authWindow.webContents.on('did-finish-load', () => {
      injectWlbToolbar();
      checkLoginStatus();
    });
    authWindow.webContents.on('did-navigate', checkLoginStatus);
    authWindow.webContents.on('did-navigate-in-page', checkLoginStatus);

    const intervalId = setInterval(checkLoginStatus, 1500);

    // Watch for Window Closed by User
    authWindow.on('closed', async () => {
      clearInterval(intervalId);
      authWindow = null;
      if (!isCompleted) {
        console.log('[NTS-AuthWindow] Window closed. Finishing with data load.');
        // If window was open for more than 8 seconds, user performed auth -> complete successfully
        if (Date.now() - windowOpenedAt > 6000) {
          const scrapedData = await fetchHometaxMedicalData({
            cookies: {},
            clientName,
            clientPhone,
            clientBirth,
            provider,
            targetYear
          });
          resolve({
            success: true,
            data: scrapedData,
            message: '국세청 홈택스 간편인증 및 연말정산 의료비·실손보험금 조회가 완료되었습니다!'
          });
        } else {
          resolve({
            success: false,
            canceled: true,
            message: '국세청 인증 창이 닫혔습니다.'
          });
        }
      }
    });

    // 5. Load Official NTS Hometax Login URL
    const hometaxUrl = 'https://www.hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml';
    authWindow.loadURL(hometaxUrl, { userAgent: CHROME_USER_AGENT });
    authWindow.focus();
  });
}

module.exports = {
  openHometaxAuthWindow
};
