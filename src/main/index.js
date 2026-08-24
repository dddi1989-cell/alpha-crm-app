const { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./database');
const { checkStartupRollback, markCleanExit } = require('./backupEngine');
const { setupIpcHandlers } = require('./ipc');
const { startNotificationEngine, stopNotificationEngine } = require('./notification');

let mainWindow = null;
let widgetWindow = null;
let tray = null;
let isQuitting = false;

function getAppIcon() {
  // Try bundled asset path first (works in both dev and packaged app)
  const candidates = [
    path.join(__dirname, 'assets', 'icon.ico'),
    path.join(__dirname, 'assets', 'icon.png'),
    path.join(__dirname, '..', '..', 'build', 'icon.ico'),
    path.join(__dirname, '..', '..', 'build', 'icon.png'),
    path.join(__dirname, 'assets', 'icon.jpg'),
    path.join(__dirname, '..', '..', 'public', 'icon.png')
  ];

  for (const iconPath of candidates) {
    try {
      if (fs.existsSync(iconPath)) {
        const img = nativeImage.createFromPath(iconPath);
        if (!img.isEmpty()) return img;
      }
    } catch (e) {
      // continue to next candidate
    }
  }

  // Last resort: create a simple colored square
  const size = 32;
  const canvas = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    canvas[i * 4] = 59;     // R
    canvas[i * 4 + 1] = 130; // G
    canvas[i * 4 + 2] = 246; // B
    canvas[i * 4 + 3] = 255; // A
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function getTrayIcon() {
  const icon = getAppIcon();
  if (icon.isEmpty()) return icon;
  // Windows system tray icons should be 16x16
  return icon.resize({ width: 16, height: 16 });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  function createTrayIcon() {
    try {
      const icon = getTrayIcon();
      tray = new Tray(icon);
      tray.setToolTip('WBL CRM TOOL');

      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'WBL CRM TOOL 열기',
          click: () => {
            if (mainWindow) {
              if (mainWindow.isMinimized()) mainWindow.restore();
              mainWindow.show();
              mainWindow.focus();
            }
          }
        },
        {
          label: '바탕화면 캘린더 위젯 토글',
          click: () => {
            toggleWidgetWindow();
          }
        },
        { type: 'separator' },
        {
          label: '앱 종료',
          click: () => {
            isQuitting = true;
            markCleanExit();
            stopNotificationEngine();
            if (widgetWindow && !widgetWindow.isDestroyed()) {
              widgetWindow.close();
            }
            app.quit();
          }
        }
      ]);

      tray.setContextMenu(contextMenu);
      tray.on('double-click', () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      });
    } catch (err) {
      console.error('Tray creation error:', err);
    }
  }

  function createWidgetWindow() {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.show();
      widgetWindow.focus();
      widgetWindow.setAlwaysOnTop(true, 'floating');
      return widgetWindow;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth } = primaryDisplay.workAreaSize;
    const appIcon = getAppIcon();

    widgetWindow = new BrowserWindow({
      width: 400,
      height: 600,
      x: Math.max(20, screenWidth - 420),
      y: 60,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: false,
      resizable: true,
      minWidth: 320,
      minHeight: 450,
      show: false,
      title: 'ALPHA 바탕화면 캘린더 위젯',
      icon: appIcon,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    const distPath = path.join(__dirname, '../../dist/index.html');
    const isDev = process.env.NODE_ENV === 'development' && !fs.existsSync(distPath);

    if (isDev) {
      widgetWindow.loadURL('http://localhost:5173#widget');
    } else {
      widgetWindow.loadFile(distPath, { hash: 'widget' });
    }

    widgetWindow.once('ready-to-show', () => {
      if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.show();
        widgetWindow.focus();
        widgetWindow.setAlwaysOnTop(true, 'floating');
      }
    });

    widgetWindow.on('closed', () => {
      widgetWindow = null;
    });

    return widgetWindow;
  }

  function toggleWidgetWindow() {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      if (widgetWindow.isVisible()) {
        widgetWindow.hide();
      } else {
        widgetWindow.show();
        widgetWindow.focus();
        widgetWindow.setAlwaysOnTop(true, 'floating');
      }
    } else {
      createWidgetWindow();
    }
  }

  function createWindow() {
    const appIcon = getAppIcon();

    mainWindow = new BrowserWindow({
      width: 1280,
      height: 830,
      minWidth: 1024,
      minHeight: 700,
      title: 'WBL CRM TOOL',
      backgroundColor: '#0b0f19',
      autoHideMenuBar: true,
      show: false,
      icon: appIcon,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    const distPath = path.join(__dirname, '../../dist/index.html');
    const isDev = process.env.NODE_ENV === 'development' && !fs.existsSync(distPath);

    if (isDev) {
      mainWindow.loadURL('http://localhost:5173').catch(() => {
        if (fs.existsSync(distPath)) {
          mainWindow.loadFile(distPath);
        }
      });
    } else {
      mainWindow.loadFile(distPath);
    }

    mainWindow.once('ready-to-show', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    mainWindow.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault();
        mainWindow.hide();
        return false;
      }
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  app.whenReady().then(() => {
    initDatabase();
    checkStartupRollback();

    try {
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: false,
        name: 'ALPHA 고객관리Tool'
      });
    } catch (err) {
      // Ignore login item errors in uninstalled dev environment
    }

    createTrayIcon();
    createWindow();

    ipcMain.handle('system:toggle-widget', () => {
      toggleWidgetWindow();
      return { isWidgetOpen: !!(widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible()) };
    });

    ipcMain.handle('system:get-widget-status', () => {
      return { isWidgetOpen: !!(widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible()) };
    });

    ipcMain.handle('system:set-always-on-top', (event, isTop) => {
      if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.setAlwaysOnTop(isTop, 'floating');
        return { isAlwaysOnTop: isTop };
      }
      return { isAlwaysOnTop: false };
    });

    ipcMain.handle('system:set-window-opacity', (event, opacity) => {
      if (widgetWindow && !widgetWindow.isDestroyed()) {
        const clamped = Math.max(0.2, Math.min(1.0, opacity));
        widgetWindow.setOpacity(clamped);
        return { opacity: clamped };
      }
      return { opacity: 1.0 };
    });

    setupIpcHandlers(mainWindow);
    startNotificationEngine(mainWindow, () => widgetWindow);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });
  });

  app.on('before-quit', () => {
    isQuitting = true;
    markCleanExit();
    stopNotificationEngine();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && isQuitting) {
      app.quit();
    }
  });
}
