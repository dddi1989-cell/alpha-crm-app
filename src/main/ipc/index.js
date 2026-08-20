const { getDb } = require('../database');
const { performDualBackup } = require('../backupEngine');
const { loadCloudAccounts, loadCloudData, syncCloudAccounts, syncCloudData, syncCloudUpdateManifest } = require('../services/cloudSyncService');
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
    loadCloudAccounts(db);
    loadCloudData(db);
    syncCustomerInsuranceExpirySchedules(db);
    syncCloudAccounts(db);
    syncCloudData(db);
    syncCloudUpdateManifest(
      '1.5.8',
      'https://github.com/dddi1989-cell/alpha-crm-app/releases/download/v1.5.8/ALPHA_CRM_MicroPatch_v1.5.8.asar',
      'v1.5.8 공식 정식 배포 버전',
      '사용자 로그인 인증 및 계정 동기화 안정화 정식 패치'
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
