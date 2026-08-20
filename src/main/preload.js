const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  customers: {
    getAll: (params) => ipcRenderer.invoke('customers:get-all', params),
    create: (data) => ipcRenderer.invoke('customers:create', data),
    update: (data) => ipcRenderer.invoke('customers:update', data),
    delete: (id) => ipcRenderer.invoke('customers:delete', id),
    parseReportPdf: (filePath) => ipcRenderer.invoke('customers:parse-report-pdf', filePath),
    openPdf: (filePath) => ipcRenderer.invoke('customers:open-pdf', filePath)
  },
  users: {
    login: (credentials) => ipcRenderer.invoke('users:login', credentials),
    register: (data) => ipcRenderer.invoke('users:register', data),
    syncCloud: () => ipcRenderer.invoke('users:sync-cloud'),
    changePassword: (data) => ipcRenderer.invoke('users:change-password', data),
    getAll: () => ipcRenderer.invoke('users:get-all'),
    getAccessibleSubordinates: (currentUserId) => ipcRenderer.invoke('users:get-accessible-subordinates', currentUserId),
    create: (data) => ipcRenderer.invoke('users:create', data),
    update: (data) => ipcRenderer.invoke('users:update', data),
    delete: (params) => ipcRenderer.invoke('users:delete', params),
    setActiveUser: (userId) => ipcRenderer.invoke('users:set-active-user', userId)
  },
  org: {
    getSubordinateData: (params) => ipcRenderer.invoke('org:get-subordinate-data', params),
    getAllOrganizations: (params) => ipcRenderer.invoke('org:get-all-organizations', params),
    createOrganization: (data) => ipcRenderer.invoke('org:create-organization', data),
    updateOrganization: (data) => ipcRenderer.invoke('org:update-organization', data),
    deleteOrganization: (params) => ipcRenderer.invoke('org:delete-organization', typeof params === 'object' ? params : { id: params }),
    getOrganizationAggregateData: (params) => ipcRenderer.invoke('org:get-organization-aggregate-data', params)
  },
  schedules: {
    getAll: (params) => ipcRenderer.invoke('schedules:get-all', params),
    create: (data) => ipcRenderer.invoke('schedules:create', data),
    update: (data) => ipcRenderer.invoke('schedules:update', data),
    delete: (id) => ipcRenderer.invoke('schedules:delete', id)
  },
  claims: {
    downloadForm: (company) => ipcRenderer.invoke('claims:download-form', company),
    openPdf: (company) => ipcRenderer.invoke('claims:open-pdf', company)
  },
  board: {
    selectFiles: () => ipcRenderer.invoke('board:select-files'),
    getPosts: (params) => ipcRenderer.invoke('board:get-posts', params),
    getPostDetail: (postId) => ipcRenderer.invoke('board:get-post-detail', postId),
    createPost: (data) => ipcRenderer.invoke('board:create-post', data),
    updatePost: (data) => ipcRenderer.invoke('board:update-post', data),
    deletePost: (data) => ipcRenderer.invoke('board:delete-post', data),
    downloadAttachment: (attachmentId) => ipcRenderer.invoke('board:download-attachment', attachmentId),
    openAttachment: (attachmentId) => ipcRenderer.invoke('board:open-attachment', attachmentId)
  },
  market: {
    getLatest: () => ipcRenderer.invoke('market:get-latest'),
    getByDate: (date) => ipcRenderer.invoke('market:get-by-date', date),
    getHistoryDates: () => ipcRenderer.invoke('market:get-history-dates'),
    refresh: () => ipcRenderer.invoke('market:refresh')
  },
  system: {
    getInfo: () => ipcRenderer.invoke('system:get-info'),
    getAppVersion: () => ipcRenderer.invoke('system:get-app-version'),
    triggerBackup: () => ipcRenderer.invoke('system:trigger-backup'),
    exportBackup: () => ipcRenderer.invoke('system:export-backup'),
    restoreDb: () => ipcRenderer.invoke('system:restore-db'),
    getRollbackStatus: () => ipcRenderer.invoke('system:get-rollback-status'),
    resetData: () => ipcRenderer.invoke('system:reset-data'),
    syncCloudData: () => ipcRenderer.invoke('system:sync-cloud-data'),
    openUrl: (url) => ipcRenderer.invoke('system:open-url', url),
    toggleWidget: () => ipcRenderer.invoke('system:toggle-widget'),
    getWidgetStatus: () => ipcRenderer.invoke('system:get-widget-status'),
    setAlwaysOnTop: (isTop) => ipcRenderer.invoke('system:set-always-on-top', isTop),
    setWindowOpacity: (opacity) => ipcRenderer.invoke('system:set-window-opacity', opacity),
    checkForUpdates: (repoUrl) => ipcRenderer.invoke('system:check-for-updates', repoUrl),
    downloadAndApplyUpdate: (downloadUrl) => ipcRenderer.invoke('system:download-and-apply-update', downloadUrl),
    getGitHubConfig: () => ipcRenderer.invoke('system:get-github-config'),
    setGitHubConfig: (config) => ipcRenderer.invoke('system:set-github-config', config),
    testGitHubConnection: (config) => ipcRenderer.invoke('system:test-github-connection', config)
  },
  onScheduleDue: (callback) => {
    const subscription = (event, schedule) => callback(schedule);
    ipcRenderer.on('schedule:due', subscription);
    return () => ipcRenderer.removeListener('schedule:due', subscription);
  },
  onSchedulesChanged: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('schedules:data-changed', subscription);
    return () => ipcRenderer.removeListener('schedules:data-changed', subscription);
  },
  onUpdateAvailable: (callback) => {
    const subscription = (event, info) => callback(info);
    ipcRenderer.on('system:update-available', subscription);
    return () => ipcRenderer.removeListener('system:update-available', subscription);
  },
  onUpdateProgress: (callback) => {
    const subscription = (event, progress) => callback(progress);
    ipcRenderer.on('system:update-progress', subscription);
    return () => ipcRenderer.removeListener('system:update-progress', subscription);
  }
});
