const { getDb } = require('../database');
const { performDualBackup } = require('../backupEngine');
const { loadCloudAccounts, loadCloudData, syncCloudAccounts, syncCloudData, syncCloudUpdateManifest, importLegacyLocalDatabases, startPeriodicCloudSync } = require('../services/cloudSyncService');
const { autoCheckAndApplyMicroPatch } = require('../services/updaterService');

const { registerAuthHandlers } = require('./authHandlers');
const { registerCustomerHandlers } = require('./customerHandlers');
const { registerScheduleHandlers, broadcastSchedulesUpdated, syncCustomerInsuranceExpirySchedules } = require('./scheduleHandlers');
const { registerOrgHandlers } = require('./orgHandlers');
const { registerClaimHandlers } = require('./claimHandlers');
const { registerUpdaterHandlers } = require('./updaterHandlers');
const { registerSystemHandlers } = require('./systemHandlers');
const { registerBoardHandlers } = require('./boardHandlers');
const { registerMarketHandlers } = require('./marketHandlers');

function setupIpcHandlers(mainWindow) {
  const triggerDualBackup = () => {
    setImmediate(() => {
      performDualBackup(mainWindow).catch(() => {});
    });
  };

  // Initial sync of all data on launch
  try {
    const db = getDb();
    
    // 1. Recover legacy offline local databases if existing on this machine
    importLegacyLocalDatabases(db);

    // 2. Load latest cloud accounts and CRM data first
    loadCloudAccounts(db).then(() => {
      syncCustomerInsuranceExpirySchedules(db);
      return loadCloudData(db);
    }).then(() => {
      // 3. Only sync outwards after loading
      syncCloudAccounts(db);
      syncCloudData(db);
      // 4. Start periodic background sync (every 60s)
      startPeriodicCloudSync(db, mainWindow);
    }).catch(err => {
      console.error('[Launch-Sync] Background sync error:', err.message);
    });
  } catch (syncErr) {
    console.error('Initial sync error:', syncErr);
  }

  // Automatic silent micro patch check on launch
  setTimeout(() => {
    autoCheckAndApplyMicroPatch(mainWindow);
  }, 2000);

  // Register domain handlers safely
  try { registerAuthHandlers(mainWindow, triggerDualBackup); } catch (e) { console.error('registerAuthHandlers error:', e); }
  try { registerCustomerHandlers(mainWindow, triggerDualBackup, broadcastSchedulesUpdated, syncCustomerInsuranceExpirySchedules); } catch (e) { console.error('registerCustomerHandlers error:', e); }
  try { registerScheduleHandlers(mainWindow, triggerDualBackup); } catch (e) { console.error('registerScheduleHandlers error:', e); }
  try { registerOrgHandlers(mainWindow, triggerDualBackup); } catch (e) { console.error('registerOrgHandlers error:', e); }
  try { registerClaimHandlers(mainWindow); } catch (e) { console.error('registerClaimHandlers error:', e); }
  try { registerUpdaterHandlers(mainWindow, triggerDualBackup); } catch (e) { console.error('registerUpdaterHandlers error:', e); }
  try { registerSystemHandlers(mainWindow, triggerDualBackup); } catch (e) { console.error('registerSystemHandlers error:', e); }
  try { registerBoardHandlers(mainWindow, triggerDualBackup); } catch (e) { console.error('registerBoardHandlers error:', e); }
  try { registerMarketHandlers(mainWindow); } catch (e) { console.error('registerMarketHandlers error:', e); }

  console.log('✅ All modular IPC handlers registered successfully.');
}

module.exports = {
  setupIpcHandlers
};
