import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Users,
  Search,
  Calendar,
  Clock,
  Shield,
  Phone,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Filter,
  Flame,
  CalendarDays,
  UserPlus,
  Edit,
  Trash2,
  Check,
  X,
  ShieldAlert,
  FolderPlus,
  Layers,
  Briefcase,
  User,
  GitBranch,
  Network
} from 'lucide-react';
import { api } from '../utils/api';
import { useCrmStore } from '../store/useCrmStore';

function calculateElapsedMonths(startDateStr) {
  if (!startDateStr) return null;
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return null;

  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  
  let totalMonths = years * 12 + months + 1;
  return totalMonths > 0 ? totalMonths : 1;
}

export default function OrganizationManagementView() {
  const currentUser = useCrmStore((state) => state.currentUser);
  const openCustomerDetailModal = useCrmStore((state) => state.openCustomerDetailModal);

  // Main Top-Level Tab: 'monitoring' (조직 모니터링) | 'hierarchy' (조직도 및 계정/조직 관리)
  const [mainTab, setMainTab] = useState('monitoring');

  // Sub-mode in Monitoring: 'individual' (개별 조직원별 조회) | 'team' (조직 전체 통합 조회)
  const [monitoringMode, setMonitoringMode] = useState('individual');

  // ==========================================
  // 1. [조직 / 팀 목록 & 관리] 상태
  // ==========================================
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [selectedOrgName, setSelectedOrgName] = useState('');
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [orgFormData, setOrgFormData] = useState({
    name: '',
    type: 'Team',
    parent_id: ''
  });
  const [orgError, setOrgError] = useState('');
  const [orgSuccessMsg, setOrgSuccessMsg] = useState('');

  // ==========================================
  // 2. [조직원 모니터링] 상태 및 로직
  // ==========================================
  const [accessibleUsers, setAccessibleUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Individual & Team Aggregate CRM Data State
  const [subordinateData, setSubordinateData] = useState(null);
  const [teamAggregateData, setTeamAggregateData] = useState(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('longtouch'); // 'longtouch' | 'schedules' | 'all-customers'

  // Calendar state for schedules tab
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date());
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState('');
  const [customerSearchFilter, setCustomerSearchFilter] = useState('');

  // ==========================================
  // 3. [Admin 계정 & 조직도 관리] 상태
  // ==========================================
  const [allUsersList, setAllUsersList] = useState([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({
    username: '',
    password: '',
    name: '',
    phone: '',
    role: 'FA',
    parent_id: '',
    org_id: '',
    org_name: ''
  });
  const [adminError, setAdminError] = useState('');
  const [adminSuccessMsg, setAdminSuccessMsg] = useState('');

  // Load organizations list (filtered by user's organization scope)
  const loadOrganizations = async () => {
    try {
      if (api.org?.getAllOrganizations) {
        const res = await api.org.getAllOrganizations(currentUser?.id);
        if (res?.success && Array.isArray(res.organizations)) {
          setOrganizations(res.organizations);
          if (res.organizations.length > 0) {
            // If currently selected org is not in the allowed list, default to the user's primary root org
            const isCurrentOrgValid = res.organizations.some(o => o.id === selectedOrgId || o.name === selectedOrgName);
            if (!isCurrentOrgValid) {
              setSelectedOrgId(res.organizations[0].id);
              setSelectedOrgName(res.organizations[0].name);
            }
          } else {
            setSelectedOrgId(null);
            setSelectedOrgName('');
          }
        }
      }
    } catch (err) {
      console.error('Error loading organizations:', err);
    }
  };

  // Load accessible subordinates
  const loadSubordinates = async () => {
    if (!currentUser?.id) return;
    setIsLoadingUsers(true);
    try {
      const res = await api.users.getAccessibleSubordinates(currentUser.id);
      if (res?.success && Array.isArray(res.users)) {
        setAccessibleUsers(res.users);
        if (res.users.length > 0 && !selectedUserId) {
          const defaultUser = res.users.find(u => !u.isSelf) || res.users[0];
          setSelectedUserId(defaultUser.id);
        }
      }
    } catch (err) {
      console.error('Error loading accessible subordinates:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Load all users list (Admin)
  const loadAllUsersList = async () => {
    try {
      const res = await api.users.getAll();
      if (res?.success && Array.isArray(res.users)) {
        setAllUsersList(res.users);
      }
    } catch (err) {
      console.error('Error loading all users:', err);
    }
  };

  // Load target individual subordinate CRM data
  const loadTargetData = async (userId, forceSync = false) => {
    if (!userId || !currentUser?.id) return;
    setIsLoadingData(true);
    try {
      const res = await api.org.getSubordinateData({
        currentUserId: currentUser.id,
        targetUserId: userId,
        forceSync
      });
      if (res?.success) {
        setSubordinateData(res);
      } else {
        console.error('Failed to load subordinate data:', res?.error);
      }
    } catch (err) {
      console.error('Error loading subordinate data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Load team aggregate CRM data
  const loadTeamData = async (orgId, orgName, forceSync = false) => {
    if (!currentUser?.id) return;
    setIsLoadingData(true);
    try {
      if (api.org?.getOrganizationAggregateData) {
        const res = await api.org.getOrganizationAggregateData({
          orgId,
          orgName,
          currentUserId: currentUser.id,
          forceSync
        });
        if (res?.success) {
          setTeamAggregateData(res);
        } else {
          console.error('Failed to load team aggregate data:', res?.error);
        }
      }
    } catch (err) {
      console.error('Error loading team aggregate data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadOrganizations();
    loadSubordinates();
    if (currentUser?.role === 'Admin' || currentUser?.role === 'admin') {
      loadAllUsersList();
    }
  }, [currentUser]);

  useEffect(() => {
    if (monitoringMode === 'individual' && selectedUserId) {
      loadTargetData(selectedUserId);
    } else if (monitoringMode === 'team' && (selectedOrgId || selectedOrgName)) {
      loadTeamData(selectedOrgId, selectedOrgName);
    }
  }, [monitoringMode, selectedUserId, selectedOrgId, selectedOrgName]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await api.system.syncCloudData();
      await loadOrganizations();
      await loadSubordinates();
      if (monitoringMode === 'individual' && selectedUserId) {
        await loadTargetData(selectedUserId, true);
      } else if (monitoringMode === 'team') {
        await loadTeamData(selectedOrgId, selectedOrgName, true);
      }
      if (currentUser?.role === 'Admin' || currentUser?.role === 'admin') {
        await loadAllUsersList();
      }
    } catch (err) {
      console.error('Manual sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Filtered users for individual chip selector
  const filteredUsers = useMemo(() => {
    return accessibleUsers.filter(u => {
      const matchesSearch = !userSearchQuery ||
        u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        (u.phone && u.phone.includes(userSearchQuery)) ||
        (u.org_name && u.org_name.toLowerCase().includes(userSearchQuery.toLowerCase()));

      const matchesRole = !roleFilter || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [accessibleUsers, userSearchQuery, roleFilter]);

  // Current active data set depending on monitoringMode
  const activeDataset = monitoringMode === 'individual' ? subordinateData : teamAggregateData;

  const selectedOrg = useMemo(() => {
    return organizations.find((o) => o.id === selectedOrgId || o.name === selectedOrgName) || organizations[0] || null;
  }, [organizations, selectedOrgId, selectedOrgName]);

  const targetUser = subordinateData?.targetUser;
  const stats = activeDataset?.stats || {
    memberCount: 0,
    totalCustomers: 0,
    longTouchCustomers: 0,
    activeCustomers: 0,
    leadCustomers: 0,
    totalSchedules: 0,
    pendingSchedules: 0,
    completedSchedules: 0,
    upcomingThisMonth: 0
  };

  const filteredLongTouchCustomers = useMemo(() => {
    if (!activeDataset?.longTouchList) return [];
    if (!customerSearchFilter) return activeDataset.longTouchList;
    const term = customerSearchFilter.toLowerCase();
    return activeDataset.longTouchList.filter(c =>
      c.name.toLowerCase().includes(term) ||
      (c.phone && c.phone.includes(term)) ||
      (c.notes && c.notes.toLowerCase().includes(term)) ||
      (c.insurance_provider && c.insurance_provider.toLowerCase().includes(term)) ||
      (c.user_name && c.user_name.toLowerCase().includes(term))
    );
  }, [activeDataset?.longTouchList, customerSearchFilter]);

  const filteredAllCustomers = useMemo(() => {
    if (!activeDataset?.customers) return [];
    if (!customerSearchFilter) return activeDataset.customers;
    const term = customerSearchFilter.toLowerCase();
    return activeDataset.customers.filter(c =>
      c.name.toLowerCase().includes(term) ||
      (c.phone && c.phone.includes(term)) ||
      (c.notes && c.notes.toLowerCase().includes(term)) ||
      (c.user_name && c.user_name.toLowerCase().includes(term))
    );
  }, [activeDataset?.customers, customerSearchFilter]);

  // Calendar Calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const isToday = (day) => {
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  };

  const isSelectedDay = (day) => {
    return selectedCalendarDate.getFullYear() === year && selectedCalendarDate.getMonth() === month && selectedCalendarDate.getDate() === day;
  };

  const getSchedulesForDay = (day) => {
    if (!activeDataset?.schedules) return [];
    return activeDataset.schedules.filter((s) => {
      const d = new Date(s.scheduled_at);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  const selectedDaySchedules = useMemo(() => {
    if (!activeDataset?.schedules) return [];
    return activeDataset.schedules.filter((s) => {
      const d = new Date(s.scheduled_at);
      const isSameDay = d.getFullYear() === selectedCalendarDate.getFullYear() &&
        d.getMonth() === selectedCalendarDate.getMonth() &&
        d.getDate() === selectedCalendarDate.getDate();

      if (!isSameDay) return false;
      if (scheduleStatusFilter && s.status !== scheduleStatusFilter) return false;
      return true;
    });
  }, [activeDataset?.schedules, selectedCalendarDate, scheduleStatusFilter]);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
      case 'Admin':
        return { label: '👑 Admin (L7 최고관리자)', style: 'bg-purple-100 text-purple-900 border-purple-300' };
      case 'CEO':
        return { label: '🏢 CEO (L6 대표이사)', style: 'bg-rose-100 text-rose-900 border-rose-300' };
      case 'COO':
        return { label: '🏛️ COO (L5 총괄이사)', style: 'bg-orange-100 text-orange-900 border-orange-300' };
      case 'RM':
        return { label: '🏬 RM (L4 본부장)', style: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'BM':
        return { label: '🏢 BM (L3 지점장)', style: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
      case 'SM':
      case 'Manager':
        return { label: '👔 SM (L2 팀장)', style: 'bg-cyan-100 text-cyan-900 border-cyan-300' };
      case 'FA':
      case 'Agent':
      default:
        return { label: '💼 FA (L1 자산관리사)', style: 'bg-blue-100 text-blue-900 border-blue-300' };
    }
  };

  const getOrgTypeBadge = (type) => {
    switch (type) {
      case 'Executive':
      case 'HQ':
        return { label: '총괄', style: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800' };
      case 'Headquarters':
        return { label: '사업단', style: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800' };
      case 'Division':
        return { label: '본부', style: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' };
      case 'Branch':
        return { label: '지점', style: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' };
      case 'Team':
      default:
        return { label: '팀', style: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800' };
    }
  };

  // ==========================================
  // Organization Handlers (Admin)
  // ==========================================
  const handleOpenCreateOrgModal = () => {
    setEditingOrg(null);
    setOrgFormData({ name: '', type: 'Team', parent_id: '' });
    setOrgError('');
    setOrgSuccessMsg('');
    setIsOrgModalOpen(true);
  };

  const handleOpenEditOrgModal = (org) => {
    setEditingOrg(org);
    setOrgFormData({
      name: org.name,
      type: org.type || 'Team',
      parent_id: org.parent_id || ''
    });
    setOrgError('');
    setOrgSuccessMsg('');
    setIsOrgModalOpen(true);
  };

  const handleOrgSubmit = async (e) => {
    e.preventDefault();
    setOrgError('');
    setOrgSuccessMsg('');

    if (!orgFormData.name.trim()) {
      setOrgError('조직명을 입력해 주세요.');
      return;
    }

    try {
      if (editingOrg) {
        const res = await api.org.updateOrganization({
          id: editingOrg.id,
          name: orgFormData.name.trim(),
          type: orgFormData.type,
          parent_id: orgFormData.parent_id || null
        });
        if (res?.success) {
          setOrgSuccessMsg(`[${orgFormData.name}] 조직 정보가 수정되었습니다.`);
          setIsOrgModalOpen(false);
          await loadOrganizations();
          await loadSubordinates();
        } else {
          setOrgError(res?.error || '조직 수정 실패');
        }
      } else {
        const res = await api.org.createOrganization({
          name: orgFormData.name.trim(),
          type: orgFormData.type,
          parent_id: orgFormData.parent_id || null
        });
        if (res?.success) {
          setOrgSuccessMsg(`[${orgFormData.name}] 신규 조직이 생성되었습니다.`);
          setIsOrgModalOpen(false);
          await loadOrganizations();
          await loadSubordinates();
        } else {
          setOrgError(res?.error || '조직 생성 실패');
        }
      }
    } catch (err) {
      setOrgError(err.message);
    }
  };

  const handleDeleteOrg = async (org) => {
    if (!window.confirm(`[${org.name}] 조직을 삭제하시겠습니까?\n소속된 조직원의 소속 조직 정보는 해제됩니다.`)) {
      return;
    }
    try {
      const res = await api.org.deleteOrganization(org.id);
      if (res?.success) {
        alert(`[${org.name}] 조직이 삭제되었습니다.`);
        await loadOrganizations();
        await loadSubordinates();
      } else {
        alert(res?.error || '조직 삭제에 실패했습니다.');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // ==========================================
  // User Account Handlers (Admin)
  // ==========================================
  const handleOpenCreateUserModal = () => {
    setEditingUser(null);
    setUserFormData({
      username: '',
      password: '',
      name: '',
      phone: '',
      role: 'FA',
      parent_id: '',
      org_id: organizations.length > 0 ? organizations[0].id : '',
      org_name: organizations.length > 0 ? organizations[0].name : ''
    });
    setAdminError('');
    setAdminSuccessMsg('');
    setIsUserModalOpen(true);
  };

  const handleOpenEditUserModal = (u) => {
    setEditingUser(u);
    setUserFormData({
      username: u.username,
      password: '',
      name: u.name,
      phone: u.phone || '',
      role: u.role,
      parent_id: u.parent_id || '',
      org_id: u.org_id || '',
      org_name: u.org_name || ''
    });
    setAdminError('');
    setAdminSuccessMsg('');
    setIsUserModalOpen(true);
  };

  const handleAdminUserSubmit = async (e) => {
    e.preventDefault();
    setAdminError('');
    setAdminSuccessMsg('');

    if (!userFormData.name.trim()) {
      setAdminError('성명을 입력해 주세요.');
      return;
    }

    if (!editingUser && (!userFormData.username.trim() || !userFormData.password.trim())) {
      setAdminError('아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }

    const selectedOrg = organizations.find(o => String(o.id) === String(userFormData.org_id));
    const targetOrgName = selectedOrg ? selectedOrg.name : (userFormData.org_name || '');

    try {
      if (editingUser) {
        const res = await api.users.update({
          id: editingUser.id,
          name: userFormData.name.trim(),
          phone: userFormData.phone.trim(),
          password: userFormData.password.trim(),
          role: userFormData.role,
          parent_id: userFormData.parent_id || null,
          org_id: userFormData.org_id || null,
          org_name: targetOrgName
        });
        if (res?.success) {
          setAdminSuccessMsg(`[${userFormData.name}] 사용자 정보가 성공적으로 수정되었습니다.`);
          setIsUserModalOpen(false);
          await loadAllUsersList();
          await loadSubordinates();
        } else {
          setAdminError(res?.error || '수정에 실패했습니다.');
        }
      } else {
        const res = await api.users.create({
          username: userFormData.username.trim(),
          password: userFormData.password.trim(),
          name: userFormData.name.trim(),
          phone: userFormData.phone.trim(),
          role: userFormData.role,
          parent_id: userFormData.parent_id || null,
          org_id: userFormData.org_id || null,
          org_name: targetOrgName
        });
        if (res?.success) {
          setAdminSuccessMsg(`[${userFormData.name}] 신규 사용자가 등록되었습니다.`);
          setIsUserModalOpen(false);
          await loadAllUsersList();
          await loadSubordinates();
        } else {
          setAdminError(res?.error || '사용자 생성에 실패했습니다.');
        }
      }
    } catch (err) {
      setAdminError(err.message);
    }
  };

  const handleDeleteUser = async (u) => {
    if (u.username === 'admin') {
      alert('최고 관리자(admin) 계정은 삭제할 수 없습니다.');
      return;
    }

    if (!window.confirm(`정말 [${u.name} (${u.username})] 계정을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      const res = await api.users.delete(u.id);
      if (res?.success) {
        alert(`[${u.name}] 계정이 성공적으로 삭제되었습니다.`);
        await loadAllUsersList();
        await loadSubordinates();
      } else {
        alert(res?.error || '계정 삭제에 실패했습니다.');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn pb-16">
      {/* Top Header & Navigation Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-300 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-500 rounded-xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                <span>조직도 및 조직 통합 모니터링 시스템</span>
                <span className="text-xs bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-300 dark:border-indigo-800 font-semibold">
                  {currentUser?.role || 'FA'}
                </span>
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                개별 조직원 및 팀·지점·본부·사업단·총괄 전체 단위의 실시간 일정, 고객 데이터, 6개월 장기미터치 현황을 일괄 모니터링합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action & Tabs */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all border border-slate-300 dark:border-slate-700 shadow-sm"
            title="클라우드 실시간 데이터 동기화"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-500' : 'text-slate-500'}`} />
            <span>{isSyncing ? '클라우드 동기화 중...' : '클라우드 실시간 동기화'}</span>
          </button>

          {/* Main Top Tab Switcher */}
          <div className="flex bg-slate-200 dark:bg-slate-900 p-1 rounded-xl border border-slate-300 dark:border-slate-800">
            <button
              onClick={() => setMainTab('monitoring')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mainTab === 'monitoring'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>조직 모니터링</span>
            </button>

            {(currentUser?.role === 'Admin' || currentUser?.role === 'admin') && (
              <button
                onClick={() => setMainTab('hierarchy')}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  mainTab === 'hierarchy'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>조직도 및 계정 관리 (Admin)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: 조직 모니터링 (개별 조직원 vs 조직 전체 통합 조회) */}
      {/* ========================================================================= */}
      {mainTab === 'monitoring' && (
        <div className="space-y-6">
          {/* Sub-mode Toggle (개별 vs 팀 전체) */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-100 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-300 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">조회 방식 선택:</span>
              <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl border border-slate-300 dark:border-slate-700">
                <button
                  onClick={() => setMonitoringMode('individual')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    monitoringMode === 'individual'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>👤 개별 조직원별 모니터링</span>
                </button>
                <button
                  onClick={() => setMonitoringMode('team')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    monitoringMode === 'team'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>🏢 조직(팀/지점/본부) 전체 통합 모니터링</span>
                </button>
              </div>
            </div>

            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {monitoringMode === 'individual' ? (
                <span>조회 대상: <strong className="text-indigo-600 dark:text-indigo-400">{filteredUsers.length}명</strong></span>
              ) : (
                <span>등록된 조직: <strong className="text-emerald-600 dark:text-emerald-400">{organizations.length}개</strong></span>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* MODE A: 개별 조직원 선택 바 */}
          {/* ========================================================================= */}
          {monitoringMode === 'individual' && (
            <div className="glass-panel p-4 rounded-2xl border space-y-3">
              <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="조직원 성명(이름), 사번, 소속팀 검색..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                <div className="flex items-center space-x-2 w-full md:w-auto">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">전체 직급</option>
                    <option value="FA">FA (자산관리사)</option>
                    <option value="SM">SM (팀장)</option>
                    <option value="BM">BM (지점장)</option>
                    <option value="RM">RM (본부장)</option>
                    <option value="COO">COO (총괄이사)</option>
                    <option value="CEO">CEO (대표이사)</option>
                    <option value="Admin">Admin (최고관리자)</option>
                  </select>
                </div>
              </div>

              {/* User Selection Chips */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-1 custom-scrollbar pt-1">
                {filteredUsers.length === 0 ? (
                  <div className="text-xs text-slate-500 py-2">검색 조건에 일치하는 조직원이 없습니다.</div>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelected = selectedUserId === u.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className={`flex items-center space-x-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 border ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-md scale-[1.02]'
                            : 'bg-white hover:bg-slate-100 dark:bg-slate-900/80 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                        }`}>
                          {u.name ? u.name.charAt(0) : 'U'}
                        </div>
                        <div className="text-left">
                          <div className="flex items-center space-x-1">
                            <span>{u.name}</span>
                            {u.isSelf && <span className="text-[9px] opacity-75 font-normal">(본인)</span>}
                          </div>
                          <div className={`text-[10px] ${isSelected ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>
                            {u.role} · {u.org_name || u.username}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODE B: 조직(팀/지점/본부) 목록 선택 바 (드롭다운 목록화) */}
          {/* ========================================================================= */}
          {monitoringMode === 'team' && (
            <div className="glass-panel p-4 rounded-2xl border space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <Briefcase className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">조회할 조직(팀/지점/본부/사업단) 목록 선택</span>
                </div>
                {(currentUser?.role === 'Admin' || currentUser?.role === 'admin') && (
                  <button
                    onClick={handleOpenCreateOrgModal}
                    className="flex items-center space-x-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-bold self-start md:self-auto"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>+ 신규 조직 추가</span>
                  </button>
                )}
              </div>

              {/* Organized Select Dropdown & Selected Org Info Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <select
                    value={selectedOrgId || ''}
                    onChange={(e) => {
                      const found = organizations.find((o) => String(o.id) === String(e.target.value));
                      if (found) {
                        setSelectedOrgId(found.id);
                        setSelectedOrgName(found.name);
                      }
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 shadow-sm"
                  >
                    {organizations.length === 0 ? (
                      <option value="">등록된 조직이 없습니다</option>
                    ) : (
                      organizations.map((org) => {
                        const badge = getOrgTypeBadge(org.type);
                        return (
                          <option key={org.id} value={org.id}>
                            [{badge.label}] {org.name} {org.org_path ? `(${org.org_path})` : ''} · 소속 {org.member_count || 0}명
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>

                {/* Quick Info Chip for Selected Organization */}
                {selectedOrg && (
                  <div className="flex items-center space-x-2 bg-emerald-950/40 border border-emerald-800/60 px-3.5 py-2 rounded-xl text-xs shrink-0">
                    <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="text-[11px] leading-tight">
                      <span className="font-bold text-emerald-300">{selectedOrg.name}</span>
                      <span className="text-slate-400 ml-1.5 font-normal">
                        ({getOrgTypeBadge(selectedOrg.type).label} / 소속 {selectedOrg.member_count || 0}명)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoadingData ? (
            <div className="glass-panel p-16 rounded-2xl border text-center space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto text-indigo-500 animate-spin" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {monitoringMode === 'individual' ? '조직원의 실시간 데이터를 불러오는 중입니다...' : '조직 전체 통합 데이터를 집계 중입니다...'}
              </p>
            </div>
          ) : (
            <>
              {/* ========================================================================= */}
              {/* Summary Profile & Stats Cards */}
              {/* ========================================================================= */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Target Profile or Team Info Card */}
                <div className="glass-panel p-4 rounded-2xl border flex flex-col justify-between space-y-3">
                  {monitoringMode === 'individual' ? (
                    <>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-600 flex items-center justify-center font-extrabold text-base">
                            {targetUser?.name ? targetUser.name.charAt(0) : 'U'}
                          </div>
                          <div>
                            <div className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-1.5">
                              <span>{targetUser?.name || '조직원'}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-300 dark:border-indigo-800">
                                {targetUser?.role}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-400">
                              사번: <strong className="font-mono text-slate-800 dark:text-slate-200">{targetUser?.username}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-[11px] space-y-1 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>소속 조직:</span>
                          <strong className="text-slate-800 dark:text-slate-200">{targetUser?.org_name || '미배정'}</strong>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>직속 상위자:</span>
                          <strong className="text-slate-800 dark:text-slate-200">{targetUser?.parent_name ? `${targetUser.parent_name} (${targetUser.parent_role})` : '최상위 관리자'}</strong>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-600 flex items-center justify-center font-extrabold text-base">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-1.5">
                              <span>{selectedOrgName || '조직 통합'}</span>
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                                하위조직 전체 포함
                              </span>
                            </div>
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                              총 소속 조직원: {stats.memberCount || 0}명
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-[11px] bg-slate-50 dark:bg-slate-900/50 p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                        하위 부서 및 소속 팀원 전체 통합 데이터 집계 중
                      </div>
                    </>
                  )}
                </div>

                {/* Total Customers */}
                <div className="glass-panel p-4 rounded-2xl border flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      {monitoringMode === 'individual' ? '총 관리 고객수' : '팀 전체 관리 고객수'}
                    </span>
                    <Users className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {stats.totalCustomers}<span className="text-sm font-normal text-slate-500 ml-1">명</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex justify-between">
                    <span>가망고객 {stats.leadCustomers}명</span>
                    <span>정상 보유 {stats.activeCustomers}명</span>
                  </div>
                </div>

                {/* 6-Month Long Touch Customers */}
                <div className="glass-panel p-4 rounded-2xl border border-amber-300 dark:border-amber-500/30 flex flex-col justify-between bg-amber-50/40 dark:bg-amber-950/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300 flex items-center space-x-1">
                      <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
                      <span>6개월 장기미터치 고객</span>
                    </span>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-black text-amber-900 dark:text-amber-300">
                    {stats.longTouchCustomers}<span className="text-sm font-normal ml-1">명</span>
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400/80">
                    {stats.longTouchCustomers > 0 ? '⚠️ 즉시 컨택 및 일정 등록 코칭 권장' : '✅ 전 고객 양호 관리 중'}
                  </div>
                </div>

                {/* Month Schedules */}
                <div className="glass-panel p-4 rounded-2xl border flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">이번 달 등록 일정</span>
                    <Clock className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {stats.upcomingThisMonth}<span className="text-sm font-normal text-slate-500 ml-1">건</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex justify-between">
                    <span>총 등록 일정: {stats.totalSchedules}건</span>
                    <span>대기중 {stats.pendingSchedules}건</span>
                  </div>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* Monitoring Sub-Tabs (장기미터치 / 캘린더 / 전체 고객) */}
              {/* ========================================================================= */}
              <div className="flex border-b border-slate-300 dark:border-slate-800 space-x-4">
                <button
                  onClick={() => setActiveSubTab('longtouch')}
                  className={`pb-3 text-xs font-extrabold flex items-center space-x-2 border-b-2 transition-all ${
                    activeSubTab === 'longtouch'
                      ? 'border-amber-500 text-amber-700 dark:text-amber-400'
                      : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Flame className="w-4 h-4" />
                  <span>🔥 6개월 장기미터치 집중 모니터링 ({filteredLongTouchCustomers.length}명)</span>
                </button>

                <button
                  onClick={() => setActiveSubTab('schedules')}
                  className={`pb-3 text-xs font-extrabold flex items-center space-x-2 border-b-2 transition-all ${
                    activeSubTab === 'schedules'
                      ? 'border-indigo-500 text-indigo-700 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>📅 월간 일정 캘린더 모니터링 ({activeDataset?.schedules?.length || 0}건)</span>
                </button>

                <button
                  onClick={() => setActiveSubTab('all-customers')}
                  className={`pb-3 text-xs font-extrabold flex items-center space-x-2 border-b-2 transition-all ${
                    activeSubTab === 'all-customers'
                      ? 'border-blue-500 text-blue-700 dark:text-blue-400'
                      : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>👥 보유 고객 전체 목록 ({filteredAllCustomers.length}명)</span>
                </button>
              </div>

              {/* Sub-tab 1: 6-Month Long Touch Customers Table */}
              {activeSubTab === 'longtouch' && (
                <div className="glass-panel p-5 rounded-2xl border space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                        <span>6개월 이상 미접촉(장기미터치) 고객 현황</span>
                        <span className="text-xs bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800 font-bold">
                          총 {filteredLongTouchCustomers.length}명
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        최근 6개월간 일정이 없거나 비활성화된 고객입니다. 상위 관리자는 담당자에게 일정 등록을 지도할 수 있습니다.
                      </p>
                    </div>

                    <div className="relative w-full md:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="고객명, 연락처, 담당자 검색..."
                        value={customerSearchFilter}
                        onChange={(e) => setCustomerSearchFilter(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {filteredLongTouchCustomers.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 space-y-2">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 opacity-80" />
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">6개월 이상 장기미터치 고객이 없습니다.</p>
                      <p className="text-xs text-slate-500">모든 고객과 원활하게 일정 및 터치가 이루어지고 있습니다.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold bg-slate-50 dark:bg-slate-900/40">
                            {monitoringMode === 'team' && <th className="p-3">담당 설계사</th>}
                            <th className="p-3">고객명</th>
                            <th className="p-3">연락처</th>
                            <th className="p-3">주요 보험사/상품</th>
                            <th className="p-3">마지막 터치일</th>
                            <th className="p-3">미터치 경과</th>
                            <th className="p-3">상태</th>
                            <th className="p-3 text-right">상세조회</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                          {filteredLongTouchCustomers.map((cust) => (
                            <tr key={cust.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                              {monitoringMode === 'team' && (
                                <td className="p-3">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                      {cust.user_name || '미배정'} ({cust.user_role || 'FA'})
                                    </span>
                                    {cust.user_org_name && (
                                      <span className="text-[10px] text-slate-500 font-medium">
                                        📁 {cust.user_org_name}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              )}
                              <td className="p-3 font-extrabold text-slate-900 dark:text-white">{cust.name}</td>
                              <td className="p-3 text-slate-600 dark:text-slate-300 font-mono">{cust.phone || '-'}</td>
                              <td className="p-3 text-slate-600 dark:text-slate-300">
                                {cust.insurances?.length > 0 ? (
                                  <div className="space-y-0.5">
                                    {cust.insurances.map((ins, idx) => (
                                      <div key={idx} className="truncate max-w-xs">
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{ins.provider}</span>
                                        {ins.details && <span className="text-slate-500 ml-1">({ins.details})</span>}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="p-3 text-slate-500 font-mono">
                                {cust.last_touched_at ? new Date(cust.last_touched_at).toLocaleDateString('ko-KR') : '터치 기록 없음'}
                              </td>
                              <td className="p-3">
                                <span className="font-extrabold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800">
                                  {cust.untouched_days !== null ? `${cust.untouched_days}일 경과` : '180일 이상'}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {cust.status === 'Active' ? '정상계약' : '가망고객'}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => openCustomerDetailModal(cust)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-lg border border-slate-300 dark:border-slate-700 text-xs transition-all"
                                >
                                  고객 상세
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 2: Monthly Calendar View */}
              {activeSubTab === 'schedules' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Calendar Grid */}
                  <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                        {year}년 {month + 1}월 일정 현황
                      </h3>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={handlePrevMonth}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            const now = new Date();
                            setCurrentDate(now);
                            setSelectedCalendarDate(now);
                          }}
                          className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-300 dark:border-slate-700"
                        >
                          오늘
                        </button>
                        <button
                          onClick={handleNextMonth}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs py-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl">
                      <div className="text-red-500">일</div>
                      <div className="text-slate-700 dark:text-slate-300">월</div>
                      <div className="text-slate-700 dark:text-slate-300">화</div>
                      <div className="text-slate-700 dark:text-slate-300">수</div>
                      <div className="text-slate-700 dark:text-slate-300">목</div>
                      <div className="text-slate-700 dark:text-slate-300">금</div>
                      <div className="text-blue-500">토</div>
                    </div>

                    {/* Date Grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                        <div key={`empty-${i}`} className="h-20 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl opacity-30" />
                      ))}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const daySchedules = getSchedulesForDay(day);
                        const isCurrent = isToday(day);
                        const isSelected = isSelectedDay(day);

                        return (
                          <div
                            key={`day-${day}`}
                            onClick={() => setSelectedCalendarDate(new Date(year, month, day))}
                            className={`h-20 p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                              isSelected
                                ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 shadow-md ring-2 ring-indigo-500/30'
                                : 'bg-white hover:bg-slate-50 dark:bg-slate-900/40 dark:hover:bg-slate-800/50 border-slate-200 dark:border-slate-800/80'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-extrabold w-5 h-5 flex items-center justify-center rounded-full ${
                                isCurrent ? 'bg-indigo-600 text-white' : 'text-slate-800 dark:text-slate-200'
                              }`}>
                                {day}
                              </span>
                              {daySchedules.length > 0 && (
                                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black px-1 rounded border border-indigo-300 dark:border-indigo-800">
                                  {daySchedules.length}
                                </span>
                              )}
                            </div>

                            {/* Schedule chips preview */}
                            <div className="space-y-0.5 overflow-hidden">
                              {daySchedules.slice(0, 2).map((s) => (
                                <div
                                  key={s.id}
                                  className="text-[9px] truncate px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold border border-slate-300 dark:border-slate-700"
                                >
                                  {monitoringMode === 'team' && s.user_name && (
                                    <strong className="text-indigo-600 dark:text-indigo-400 mr-0.5">[{s.user_name}]</strong>
                                  )}
                                  {s.title}
                                </div>
                              ))}
                              {daySchedules.length > 2 && (
                                <div className="text-[8px] text-slate-500 font-bold">
                                  +{daySchedules.length - 2}개 더보기
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Day Schedule Details */}
                  <div className="glass-panel p-5 rounded-2xl border space-y-4">
                    <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center justify-between">
                        <span>{selectedCalendarDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</span>
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">총 {selectedDaySchedules.length}건</span>
                      </h4>
                    </div>

                    <div className="space-y-2.5 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                      {selectedDaySchedules.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 space-y-1">
                          <Calendar className="w-6 h-6 mx-auto opacity-50" />
                          <p className="text-xs">선택한 날짜에 예정된 일정이 없습니다.</p>
                        </div>
                      ) : (
                        selectedDaySchedules.map((s) => (
                          <div
                            key={s.id}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5 hover:border-indigo-500 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">{s.title}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                s.status === 'Completed'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}>
                                {s.status === 'Completed' ? '완료됨' : '예정됨'}
                              </span>
                            </div>

                            {monitoringMode === 'team' && s.user_name && (
                              <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center space-x-1.5">
                                <span>담당: {s.user_name} ({s.user_role || 'FA'})</span>
                                {s.user_org_name && (
                                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.2 rounded border border-slate-300 dark:border-slate-700">
                                    {s.user_org_name}
                                  </span>
                                )}
                              </div>
                            )}

                            {s.customer_name && (
                              <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center space-x-1">
                                <span>고객: <strong className="text-slate-800 dark:text-slate-200">{s.customer_name}</strong></span>
                                {s.customer_phone && <span className="text-slate-500 font-mono">({s.customer_phone})</span>}
                              </div>
                            )}

                            {s.description && (
                              <p className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-950/40 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                                {s.description}
                              </p>
                            )}

                            <div className="text-[10px] text-slate-500 font-mono">
                              ⏰ {new Date(s.scheduled_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 3: All Customers Table */}
              {activeSubTab === 'all-customers' && (
                <div className="glass-panel p-5 rounded-2xl border space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {monitoringMode === 'individual' ? '조직원 보유 고객 전체 목록' : '조직 전체 통합 고객 목록'} ({filteredAllCustomers.length}명)
                    </h3>
                    <div className="relative w-full md:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="고객명, 연락처, 담당자 검색..."
                        value={customerSearchFilter}
                        onChange={(e) => setCustomerSearchFilter(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold bg-slate-50 dark:bg-slate-900/40">
                          {monitoringMode === 'team' && <th className="p-3">담당 설계사</th>}
                          <th className="p-3">고객명</th>
                          <th className="p-3">연락처</th>
                          <th className="p-3">생년월일</th>
                          <th className="p-3">보험사/상품</th>
                          <th className="p-3">상태</th>
                          <th className="p-3 text-right">상세보기</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                        {filteredAllCustomers.map((cust) => (
                          <tr key={cust.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            {monitoringMode === 'team' && (
                              <td className="p-3">
                                <div className="flex flex-col">
                                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                    {cust.user_name || '미배정'} ({cust.user_role || 'FA'})
                                  </span>
                                  {cust.user_org_name && (
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      📁 {cust.user_org_name}
                                    </span>
                                  )}
                                </div>
                              </td>
                            )}
                            <td className="p-3 font-extrabold text-slate-900 dark:text-white">{cust.name}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-300 font-mono">{cust.phone || '-'}</td>
                            <td className="p-3 text-slate-500 font-mono">{cust.birth_date || '-'}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-300">
                              {cust.insurances?.length > 0 ? (
                                <div className="truncate max-w-xs">{cust.insurances[0].provider}</div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                cust.status === 'Active'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              }`}>
                                {cust.status === 'Active' ? '정상보유' : '가망고객'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => openCustomerDetailModal(cust)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-lg border border-slate-300 dark:border-slate-700 text-xs transition-all"
                              >
                                상세조회
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: 조직도 및 계정 & 조직(부서/팀) 관리 (Admin Only) */}
      {/* ========================================================================= */}
      {mainTab === 'hierarchy' && (currentUser?.role === 'Admin' || currentUser?.role === 'admin') && (
        <div className="space-y-8">
          {/* 1. 조직(팀/지점/본부/사업단/총괄) 생성 및 관리 섹션 */}
          <div className="glass-panel p-6 rounded-2xl border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-emerald-500" />
                  <span>사내 조직 및 계층 구조(상하관계) 관리</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  팀, 지점, 본부, 사업단, 총괄 구분을 자유롭게 설정하고 상하 연결관계를 구성합니다.
                </p>
              </div>

              <button
                onClick={handleOpenCreateOrgModal}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-all"
              >
                <FolderPlus className="w-4 h-4" />
                <span>신규 조직 등록</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {organizations.map((org) => {
                const badge = getOrgTypeBadge(org.type);
                return (
                  <div
                    key={org.id}
                    className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-start justify-between shadow-sm hover:border-emerald-500 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">{org.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${badge.style}`}>
                          {badge.label}
                        </span>
                      </div>
                      
                      {/* Hierarchical Tree Path */}
                      <div className="text-[10px] text-slate-500 flex items-center space-x-1">
                        <GitBranch className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span className="truncate max-w-[200px]" title={org.org_path || org.name}>
                          {org.org_path || org.name}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        소속 조직원: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{org.member_count || 0}명</strong>
                        {org.direct_member_count !== undefined && org.direct_member_count !== org.member_count && (
                          <span className="text-[10px] text-slate-400 ml-1">
                            (직속 {org.direct_member_count}명)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleOpenEditOrgModal(org)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="조직명 및 상하관계 수정"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteOrg(org)}
                        className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                        title="조직 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. 전체 조직원 계정 관리 섹션 */}
          <div className="glass-panel p-6 rounded-2xl border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Users className="w-5 h-5 text-indigo-500" />
                  <span>전체 계정 및 조직도 계층 관리</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  조직원의 직급(Role), 소속 조직(팀), 직속 상위자를 자유롭게 배정합니다.
                </p>
              </div>

              <button
                onClick={handleOpenCreateUserModal}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>신규 조직원 등록</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold bg-slate-50 dark:bg-slate-900/40">
                    <th className="p-3">성명</th>
                    <th className="p-3">사번 (아이디)</th>
                    <th className="p-3">직급 (Role)</th>
                    <th className="p-3">소속 조직</th>
                    <th className="p-3">직속 상위자</th>
                    <th className="p-3">연락처</th>
                    <th className="p-3 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {allUsersList.map((u) => {
                    const badge = getRoleBadge(u.role);
                    return (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                          <span>{u.name}</span>
                          {u.username === 'admin' && (
                            <span className="text-[9px] bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300 px-1 rounded font-bold">
                              시스템
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 font-mono">{u.username}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${badge.style}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                            {u.org_name || '미배정'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 font-medium">
                          {u.parent_name ? `${u.parent_name} (${u.parent_role})` : '-'}
                        </td>
                        <td className="p-3 text-slate-500 font-mono">{u.phone || '-'}</td>
                        <td className="p-3 text-right space-x-1">
                          <button
                            onClick={() => handleOpenEditUserModal(u)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="계정 정보 수정"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {u.username !== 'admin' && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                              title="계정 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: 조직(팀/지점/본부/사업단/총괄) 생성/수정 모달 */}
      {/* ========================================================================= */}
      {isOrgModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-scaleUp text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold flex items-center space-x-2">
                <FolderPlus className="w-5 h-5 text-emerald-500" />
                <span>{editingOrg ? '조직 정보 및 상하관계 수정' : '신규 조직 등록'}</span>
              </h3>
              <button onClick={() => setIsOrgModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {orgError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-xl font-bold">
                {orgError}
              </div>
            )}

            <form onSubmit={handleOrgSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">조직 명칭 *</label>
                <input
                  type="text"
                  placeholder="예: 강남 1본부, 골드 2지점, 드림 1팀, 알파 사업단"
                  value={orgFormData.name}
                  onChange={(e) => setOrgFormData({ ...orgFormData, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">조직 구분 (유형)</label>
                <select
                  value={orgFormData.type}
                  onChange={(e) => setOrgFormData({ ...orgFormData, type: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                >
                  <option value="Team">팀 (Team)</option>
                  <option value="Branch">지점 (Branch)</option>
                  <option value="Division">본부 (Division)</option>
                  <option value="Headquarters">사업단 (Headquarters)</option>
                  <option value="Executive">총괄 (Executive)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">상위 조직 (상하관계 / 연결관계)</label>
                <select
                  value={orgFormData.parent_id}
                  onChange={(e) => setOrgFormData({ ...orgFormData, parent_id: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                >
                  <option value="">상위 조직 없음 (최상위 조직)</option>
                  {organizations
                    .filter(o => !editingOrg || o.id !== editingOrg.id)
                    .map(o => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({getOrgTypeBadge(o.type).label})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOrgModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md"
                >
                  {editingOrg ? '수정 완료' : '조직 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: 계정 등록/수정 모달 (조직 배정 드롭다운 포함) */}
      {/* ========================================================================= */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 animate-scaleUp text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-indigo-500" />
                <span>{editingUser ? `[${editingUser.name}] 사용자 정보 수정` : '신규 조직원 등록'}</span>
              </h3>
              <button onClick={() => setIsUserModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {adminError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-xl font-bold">
                {adminError}
              </div>
            )}

            <form onSubmit={handleAdminUserSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">성명 (이름) *</label>
                  <input
                    type="text"
                    placeholder="예: 홍길동"
                    value={userFormData.name}
                    onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">연락처</label>
                  <input
                    type="text"
                    placeholder="예: 010-1234-5678"
                    value={userFormData.phone}
                    onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    사번 / 아이디 {editingUser ? '(수정불가)' : '*'}
                  </label>
                  <input
                    type="text"
                    placeholder="예: 20260101"
                    value={userFormData.username}
                    onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                    disabled={!!editingUser}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    required={!editingUser}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    비밀번호 {editingUser ? '(변경 시에만 입력)' : '*'}
                  </label>
                  <input
                    type="password"
                    placeholder={editingUser ? '변경 시에만 입력' : '초기 비밀번호'}
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                    required={!editingUser}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">직급 (Role) *</label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="FA">FA (L1 자산관리사)</option>
                    <option value="SM">SM (L2 팀장)</option>
                    <option value="BM">BM (L3 지점장)</option>
                    <option value="RM">RM (L4 본부장)</option>
                    <option value="COO">COO (L5 총괄이사)</option>
                    <option value="CEO">CEO (L6 대표이사)</option>
                    <option value="Admin">Admin (L7 최고관리자)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">소속 조직 (부서/팀)</label>
                  <select
                    value={userFormData.org_id}
                    onChange={(e) => {
                      const sel = organizations.find(o => String(o.id) === e.target.value);
                      setUserFormData({
                        ...userFormData,
                        org_id: e.target.value,
                        org_name: sel ? sel.name : ''
                      });
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">소속 조직 없음 (미배정)</option>
                    {organizations.map(o => (
                      <option key={o.id} value={o.id}>{o.name} ({getOrgTypeBadge(o.type).label})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">직속 상위 관리자 (Parent)</label>
                <select
                  value={userFormData.parent_id}
                  onChange={(e) => setUserFormData({ ...userFormData, parent_id: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                >
                  <option value="">직속 상위자 없음 (최상위)</option>
                  {allUsersList
                    .filter(u => !editingUser || u.id !== editingUser.id)
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role} · {u.org_name || u.username})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md"
                >
                  {editingUser ? '수정 완료' : '사용자 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
