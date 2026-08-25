/**
 * Desktop Electron IPC Adapter
 * Bridges renderer requests directly to Electron Main Process IPC channels
 */

export const desktopAdapter = {
  customers: {
    getAll: (params) => window.electronAPI.customers.getAll(params),
    create: (data) => window.electronAPI.customers.create(data),
    update: (data) => window.electronAPI.customers.update(data),
    delete: (id) => window.electronAPI.customers.delete(id),
    parseReportPdf: (filePath) => window.electronAPI.customers.parseReportPdf(filePath),
    openPdf: (filePath) => window.electronAPI.customers.openPdf(filePath)
  },
  users: {
    login: (credentials) => window.electronAPI.users.login(credentials),
    register: (data) => window.electronAPI.users.register(data),
    syncCloud: () => window.electronAPI.users.syncCloud(),
    changePassword: (data) => window.electronAPI.users.changePassword(data),
    getAll: () => window.electronAPI.users.getAll(),
    getAccessibleSubordinates: (currentUserId) => window.electronAPI.users.getAccessibleSubordinates(currentUserId),
    create: (data) => window.electronAPI.users.create(data),
    update: (data) => window.electronAPI.users.update(data),
    delete: (id) => window.electronAPI.users.delete(id)
  },
  org: {
    getSubordinateData: (params) => window.electronAPI.org.getSubordinateData(params),
    getAllOrganizations: (params) => window.electronAPI.org.getAllOrganizations(params),
    createOrganization: (data) => window.electronAPI.org.createOrganization(data),
    updateOrganization: (data) => window.electronAPI.org.updateOrganization(data),
    deleteOrganization: (id) => window.electronAPI.org.deleteOrganization(id),
    getOrganizationAggregateData: (params) => window.electronAPI.org.getOrganizationAggregateData(params)
  },
  schedules: {
    getAll: (params) => window.electronAPI.schedules.getAll(params),
    create: (data) => window.electronAPI.schedules.create(data),
    update: (data) => window.electronAPI.schedules.update(data),
    delete: (id) => window.electronAPI.schedules.delete(id)
  },
  claims: {
    downloadForm: (company) => window.electronAPI.claims.downloadForm(company),
    openPdf: (company) => window.electronAPI.claims.openPdf(company)
  },
  board: {
    selectFiles: () => window.electronAPI.board.selectFiles(),
    getPosts: (params) => window.electronAPI.board.getPosts(params),
    getPostDetail: (postId) => window.electronAPI.board.getPostDetail(postId),
    createPost: (data) => window.electronAPI.board.createPost(data),
    updatePost: (data) => window.electronAPI.board.updatePost(data),
    deletePost: (data) => window.electronAPI.board.deletePost(data),
    downloadAttachment: (attachmentId) => window.electronAPI.board.downloadAttachment(attachmentId),
    openAttachment: (attachmentId) => window.electronAPI.board.openAttachment(attachmentId),
    getPdfThumbnail: (attachmentId) => window.electronAPI.board.getPdfThumbnail(attachmentId)
  },
  market: {
    getLatest: () => window.electronAPI.market.getLatest(),
    getLiveQuote: () => window.electronAPI.market.getLiveQuote(),
    getByDate: (date) => window.electronAPI.market.getByDate(date),
    getHistoryDates: () => window.electronAPI.market.getHistoryDates(),
    refresh: () => window.electronAPI.market.refresh()
  },
  tools: {
    getPensionCatalog: () => window.electronAPI.tools.getPensionCatalog(),
    syncPensionCatalog: () => window.electronAPI.tools.syncPensionCatalog(),
    updatePensionProduct: (product) => window.electronAPI.tools.updatePensionProduct(product),
    generatePresentationPdf: (planData) => window.electronAPI.tools.generatePresentationPdf(planData)
  },
  system: {
    getInfo: (params) => window.electronAPI.system.getInfo(params),
    getAppVersion: () => window.electronAPI.system.getAppVersion(),
    triggerBackup: () => window.electronAPI.system.triggerBackup(),
    exportBackup: () => window.electronAPI.system.exportBackup(),
    restoreDb: () => window.electronAPI.system.restoreDb(),
    getRollbackStatus: () => window.electronAPI.system.getRollbackStatus(),
    resetData: () => window.electronAPI.system.resetData(),
    syncCloudData: () => window.electronAPI.system.syncCloudData(),
    openUrl: (url) => window.electronAPI.system.openUrl(url),
    toggleWidget: () => window.electronAPI.system.toggleWidget(),
    getWidgetStatus: () => window.electronAPI.system.getWidgetStatus(),
    setAlwaysOnTop: (flag) => window.electronAPI.system.setAlwaysOnTop(flag),
    setWindowOpacity: (opacity) => window.electronAPI.system.setWindowOpacity(opacity),
    checkForUpdates: (user) => window.electronAPI.system.checkForUpdates(user),
    downloadAndApplyUpdate: (url) => window.electronAPI.system.downloadAndApplyUpdate(url),
    getGitHubConfig: () => window.electronAPI.system.getGitHubConfig(),
    testGitHubConnection: (cfg) => window.electronAPI.system.testGitHubConnection(cfg),
    saveGitHubConfig: (cfg) => window.electronAPI.system.saveGitHubConfig(cfg)
  },
  onSchedulesChanged: (cb) => (window.electronAPI.onSchedulesChanged ? window.electronAPI.onSchedulesChanged(cb) : () => {}),
  onScheduleDue: (cb) => (window.electronAPI.onScheduleDue ? window.electronAPI.onScheduleDue(cb) : () => {}),
  onUpdateAvailable: (cb) => (window.electronAPI.onUpdateAvailable ? window.electronAPI.onUpdateAvailable(cb) : () => {}),
  onUpdateProgress: (cb) => (window.electronAPI.onUpdateProgress ? window.electronAPI.onUpdateProgress(cb) : () => {})
};
