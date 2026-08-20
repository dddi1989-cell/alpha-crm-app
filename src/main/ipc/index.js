const { getDb } = require('../database');
const { performDualBackup } = require('../backupEngine');
const { loadCloudAccounts, loadCloudData, syncCloudAccounts, syncCloudData, syncCloudUpdateManifest, importLegacyLocalDatabases } = require('../services/cloudSyncService');
const { autoCheckAndApplyMicroPatch } = require('../services/updaterService');

const { registerAuthHandlers } = require('./authHandlers');
const { registerCustomerHandlers } = require('./customerHandlers');
const { registerScheduleHandlers, broadcastSchedulesUpdated, syncCustomerInsuranceExpirySchedules } = require('./scheduleHandlers');
const { registerOrgHandlers } = require('./orgHandlers');
const { registerClaimHandlers } = require('./claimHandlers');
const { registerUpdaterHandlers } = require('./updaterHandlers');
const { registerSystemHandlers } = require('./systemHandlers');

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

    syncCloudUpdateManifest(
      '1.6.2',
      'https://github.com/dddi1989-cell/alpha-crm-app/releases/download/v1.6.2/ALPHA_CRM_MicroPatch_v1.6.2.asar',
      'v1.6.2 공식 정식 배포 버전',
      '연속 사용자/조직 수정 시 SHA 충돌 및 롤백 방지 완벽 패치'
    );
  } catch (syncErr) {
    console.error('Initial sync error:', syncErr);
  }

  // Automatic silent micro patch check on launch
  setTimeout(() => {
    autoCheckAndApplyMicroPatch(mainWindow);
  }, 2000);

  // Register domain handlers
  registerAuthHandlers(mainWindow, triggerDualBackup);
  registerCustomerHandlers(mainWindow, triggerDualBackup, broadcastSchedulesUpdated, syncCustomerInsuranceExpirySchedules);
  registerScheduleHandlers(mainWindow, triggerDualBackup);
  registerOrgHandlers(mainWindow, triggerDualBackup);
  registerClaimHandlers(mainWindow);
  registerUpdaterHandlers(mainWindow, triggerDualBackup);
  registerSystemHandlers(mainWindow, triggerDualBackup);

  console.log('✅ All modular IPC handlers registered successfully.');
}

module.exports = {
  setupIpcHandlers
};
