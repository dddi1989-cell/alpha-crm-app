const { app, ipcMain } = require('electron');
const path = require('path');
const { initDatabase } = require('./src/main/database');
const { setupIpcHandlers } = require('./src/main/ipc');

app.whenReady().then(() => {
  initDatabase();
  console.log('Testing setupIpcHandlers...');
  try {
    setupIpcHandlers(null);
    console.log('✓ setupIpcHandlers executed without error!');
    
    // Check if tools:nts-create-mobile-link is registered in ipcMain
    const handlers = ipcMain._invokeHandlers ? Array.from(ipcMain._invokeHandlers.keys()) : [];
    console.log('Total IPC handlers registered:', handlers.length);
    const hasMobileLink = handlers.includes('tools:nts-create-mobile-link');
    console.log('tools:nts-create-mobile-link registered?:', hasMobileLink);
    
    if (hasMobileLink) {
      console.log('🎉 VERIFICATION SUCCESS: All mobile auth link handlers are active!');
    } else {
      console.error('❌ FAILED: tools:nts-create-mobile-link is missing!');
    }
  } catch (err) {
    console.error('❌ setupIpcHandlers failed:', err);
  }
  app.quit();
});
