const { app, ipcMain } = require('electron');
const { initDatabase } = require('./src/main/database');
const { registerToolsHandlers } = require('./src/main/ipc/toolsHandlers');

app.whenReady().then(() => {
  initDatabase();
  console.log('Testing registerToolsHandlers directly...');
  try {
    registerToolsHandlers(null);
    console.log('✓ registerToolsHandlers SUCCESS!');
  } catch (err) {
    console.error('❌ registerToolsHandlers ERROR:', err);
  }
  
  const handlers = ipcMain._invokeHandlers ? Array.from(ipcMain._invokeHandlers.keys()) : [];
  console.log('tools:nts-create-mobile-link exists?:', handlers.includes('tools:nts-create-mobile-link'));
  
  app.quit();
});
