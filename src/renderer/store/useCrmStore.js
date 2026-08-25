import { create } from 'zustand';
import { api } from '../utils/api';

const getStoredUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const webSaved = localStorage.getItem('wlb_active_user');
    if (webSaved) return JSON.parse(webSaved);
    const sessionSaved = sessionStorage.getItem('alpha_crm_active_user');
    if (sessionSaved) return JSON.parse(sessionSaved);
    return null;
  } catch (e) {
    return null;
  }
};

export const useCrmStore = create((set, get) => ({
  // State
  currentUser: getStoredUser(),
  activeTab: 'dashboard',
  scheduleViewScope: (typeof window !== 'undefined' && localStorage.getItem('alpha_crm_schedule_scope')) || 'personal', // 'personal' | 'organization'
  selectedOrgFilter: (typeof window !== 'undefined' && localStorage.getItem('alpha_crm_org_filter')) || '', // '' = 전체, or org_id/name, or user:id
  customerViewScope: (typeof window !== 'undefined' && localStorage.getItem('alpha_crm_customer_scope')) || 'personal', // 'personal' | 'organization'
  customerOrgFilter: (typeof window !== 'undefined' && localStorage.getItem('alpha_crm_customer_org_filter')) || '', // '' = 전체, or org_id/name, or user:id
  organizations: [],
  accessibleUsers: [],
  customers: [],
  schedules: [],
  systemInfo: null,
  isLoading: false,
  showRollbackAlert: false,
  isRestoring: false,

  setScheduleViewScope: (scope) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('alpha_crm_schedule_scope', scope);
    }
    set({ scheduleViewScope: scope });
    get().loadAllData();
  },

  setSelectedOrgFilter: (orgId) => {
    const val = orgId ? String(orgId) : '';
    if (typeof window !== 'undefined') {
      localStorage.setItem('alpha_crm_org_filter', val);
    }
    set({ selectedOrgFilter: val });
  },

  setCustomerViewScope: (scope) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('alpha_crm_customer_scope', scope);
    }
    set({ customerViewScope: scope });
    get().loadAllData();
  },

  setCustomerOrgFilter: (filterVal) => {
    const val = filterVal ? String(filterVal) : '';
    if (typeof window !== 'undefined') {
      localStorage.setItem('alpha_crm_customer_org_filter', val);
    }
    set({ customerOrgFilter: val });
  },

  // Auth Actions
  setCurrentUser: (user) => {
    if (user) {
      if (typeof window !== 'undefined') {
        const userJson = JSON.stringify(user);
        sessionStorage.setItem('alpha_crm_active_user', userJson);
        localStorage.setItem('alpha_crm_active_user', userJson);
        localStorage.setItem('wlb_active_user', userJson);
      }
      set({ currentUser: user });
      if (api.users?.setActiveUser) api.users.setActiveUser(user.id);
      get().loadAllData();
    } else {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('alpha_crm_active_user');
        localStorage.removeItem('alpha_crm_active_user');
        localStorage.removeItem('wlb_active_user');
      }
      if (api.users?.setActiveUser) api.users.setActiveUser(null);
      set({ currentUser: null, customers: [], schedules: [], dueScheduleAlerts: [] });
    }
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('alpha_crm_active_user');
      localStorage.removeItem('alpha_crm_active_user');
      localStorage.removeItem('wlb_active_user');
    }
    if (api.users?.setActiveUser) api.users.setActiveUser(null);
    set({ currentUser: null, activeTab: 'dashboard', customers: [], schedules: [], dueScheduleAlerts: [] });
  },

  // Modals state
  isCustomerModalOpen: false,
  editingCustomer: null,
  isPoolCustomerModal: false,

  isCustomerDetailModalOpen: false,
  detailCustomer: null,

  isScheduleModalOpen: false,
  editingSchedule: null,
  initialScheduleData: null,

  dueScheduleAlerts: [],
  updateAvailableInfo: null,
  theme: (typeof window !== 'undefined' && localStorage.getItem('alpha_crm_theme')) || 'midnight',
  isThemeModalOpen: false,

  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('alpha_crm_theme', theme);
    }
    set({ theme });
  },
  openThemeModal: () => set({ isThemeModalOpen: true }),
  closeThemeModal: () => set({ isThemeModalOpen: false }),

  setUpdateAvailableInfo: (info) => set({ updateAvailableInfo: info }),
  closeUpdateModal: () => set({ updateAvailableInfo: null }),

  // Actions
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Alert Actions
  addDueScheduleAlert: (schedule) => set((state) => {
    if (state.dueScheduleAlerts.some((a) => a.id === schedule.id)) {
      return state;
    }
    return { dueScheduleAlerts: [...state.dueScheduleAlerts, schedule] };
  }),

  dismissDueScheduleAlert: (id) => set((state) => ({
    dueScheduleAlerts: state.dueScheduleAlerts.filter((a) => a.id !== id)
  })),

  clearDueScheduleAlerts: () => set({ dueScheduleAlerts: [] }),

  // Modal Actions
  openCustomerModal: (customer = null, isPool = false) => set({ 
    isCustomerModalOpen: true, 
    editingCustomer: customer,
    isPoolCustomerModal: Boolean(isPool || (customer && (customer.is_pool === 1 || customer.is_pool === true)))
  }),
  closeCustomerModal: () => set({ isCustomerModalOpen: false, editingCustomer: null, isPoolCustomerModal: false }),

  openCustomerDetailModal: (customer) => set({ isCustomerDetailModalOpen: true, detailCustomer: customer }),
  closeCustomerDetailModal: () => set({ isCustomerDetailModalOpen: false, detailCustomer: null }),

  openScheduleModal: (schedule = null, initialData = null) => set({ isScheduleModalOpen: true, editingSchedule: schedule, initialScheduleData: initialData }),
  closeScheduleModal: () => set({ isScheduleModalOpen: false, editingSchedule: null, initialScheduleData: null }),

  dismissRollbackAlert: () => set({ showRollbackAlert: false }),

  // Data Fetching
  loadAllData: async () => {
    set({ isLoading: true });
    try {
      const currentUser = get().currentUser || getStoredUser();
      const userId = currentUser ? currentUser.id : null;
      const scheduleViewScope = get().scheduleViewScope;
      const customerViewScope = get().customerViewScope;
      const includeSubordinates = scheduleViewScope === 'organization' || customerViewScope === 'organization';

      const [customers, schedules, systemInfo, orgsRes, subUsersRes] = await Promise.all([
        api.customers.getAll({ userId, includeSubordinates: true }), // 항상 전체 접근 가능 데이터를 로드하고 프론트에서 각각 완벽 필터링
        api.schedules.getAll({ userId, includeSubordinates: true }),
        api.system.getInfo({ userId }),
        api.org?.getAllOrganizations ? api.org.getAllOrganizations(userId) : Promise.resolve({ organizations: [] }),
        api.users?.getAccessibleSubordinates ? api.users.getAccessibleSubordinates(userId) : Promise.resolve({ users: [] })
      ]);

      set({
        currentUser: currentUser,
        organizations: (orgsRes && orgsRes.organizations) || get().organizations || [],
        accessibleUsers: (subUsersRes && subUsersRes.users) || [],
        customers: customers || [],
        schedules: schedules || [],
        systemInfo: systemInfo || null,
        isLoading: false
      });
    } catch (err) {
      console.error('Error loading CRM data:', err);
      set({ isLoading: false });
    }
  },

  checkRollbackStatus: async () => {
    try {
      const res = await api.system.getRollbackStatus();
      if (res?.rolledBack) {
        set({ showRollbackAlert: true });
      }
    } catch (err) {
      // Ignore
    }
  },

  // Customer Actions
  saveCustomer: async (formData) => {
    const { editingCustomer, currentUser, loadAllData, closeCustomerModal } = get();
    const actingUserId = currentUser ? currentUser.id : 1;
    const payload = { ...formData, actingUserId, currentUserId: actingUserId };
    try {
      if (editingCustomer) {
        const res = await api.customers.update({ id: editingCustomer.id, ...payload });
        if (res?.success === false) {
          alert(res.error || '수정 권한이 없습니다.');
          return;
        }
      } else {
        await api.customers.create({ user_id: actingUserId, ...payload });
      }
      closeCustomerModal();
      await loadAllData();
    } catch (err) {
      console.error('Customer save error:', err);
      alert('고객 정보 저장 중 오류가 발생했습니다: ' + (err.message || err));
    }
  },

  deleteCustomer: async (id) => {
    const currentUser = get().currentUser;
    const actingUserId = currentUser ? currentUser.id : 1;
    if (window.confirm('정말로 이 고객 기록을 삭제하시겠습니까?')) {
      try {
        const res = await api.customers.delete({ id, actingUserId });
        if (res?.success === false) {
          alert(res.error || '삭제 권한이 없습니다.');
          return;
        }
        await get().loadAllData();
      } catch (err) {
        console.error('Customer delete error:', err);
        alert('삭제 실패: ' + (err.message || err));
      }
    }
  },

  // Schedule Actions
  saveSchedule: async (formData) => {
    const { editingSchedule, currentUser, loadAllData, closeScheduleModal } = get();
    const actingUserId = currentUser ? currentUser.id : 1;
    const payload = { ...formData, actingUserId, currentUserId: actingUserId };
    try {
      if (editingSchedule) {
        const res = await api.schedules.update({ id: editingSchedule.id, ...payload });
        if (res?.success === false) {
          alert(res.error || '수정 권한이 없습니다.');
          return;
        }
      } else {
        await api.schedules.create({ user_id: actingUserId, ...payload });
      }
      closeScheduleModal();
      await loadAllData();
    } catch (err) {
      console.error('Schedule save error:', err);
      alert('일정 저장 중 오류가 발생했습니다: ' + (err.message || err));
    }
  },

  deleteSchedule: async (id) => {
    const currentUser = get().currentUser;
    const actingUserId = currentUser ? currentUser.id : 1;
    if (window.confirm('정말로 이 일정 항목을 삭제하시겠습니까?')) {
      try {
        const res = await api.schedules.delete({ id, actingUserId });
        if (res?.success === false) {
          alert(res.error || '삭제 권한이 없습니다.');
          return;
        }
        await get().loadAllData();
      } catch (err) {
        console.error('Schedule delete error:', err);
        alert('삭제 실패: ' + (err.message || err));
      }
    }
  },

  toggleScheduleStatus: async (schedule) => {
    const currentUser = get().currentUser;
    const actingUserId = currentUser ? currentUser.id : 1;
    const nextStatus = schedule.status === 'Completed' ? 'Pending' : 'Completed';
    try {
      const res = await api.schedules.update({ ...schedule, status: nextStatus, actingUserId });
      if (res?.success === false) {
        alert(res.error || '상태를 변경할 권한이 없습니다.');
        return;
      }
      await get().loadAllData();
    } catch (err) {
      console.error('Status toggle error:', err);
    }
  },

  // System Backup & Restore Actions
  triggerBackup: async () => {
    try {
      const res = await api.system.triggerBackup();
      await get().loadAllData();
      return res;
    } catch (err) {
      console.error('Trigger backup error:', err);
    }
  },

  exportBackup: async () => {
    try {
      const res = await api.system.exportBackup();
      if (res?.success) {
        await get().loadAllData();
      }
      return res;
    } catch (err) {
      console.error('Export backup error:', err);
    }
  },

  restoreDb: async () => {
    set({ isRestoring: true });
    try {
      const res = await api.system.restoreDb();
      if (res?.success) {
        await get().loadAllData();
      }
      return res;
    } finally {
      set({ isRestoring: false });
    }
  },

  resetData: async () => {
    if (window.confirm('정말로 모든 고객 및 일정 데이터를 초기화하시겠습니까?\n(배포 전 샘플/테스트 데이터를 모두 지우고 깨끗한 상태로 시작할 때 사용합니다.)')) {
      try {
        await api.system.resetData();
        await get().loadAllData();
        alert('모든 테스트 데이터가 깨끗하게 초기화되었습니다.');
      } catch (err) {
        console.error('Reset data error:', err);
      }
    }
  }
}));
