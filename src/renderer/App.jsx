import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import MobileHeader from './components/mobile/MobileHeader';
import MobileBottomNav from './components/mobile/MobileBottomNav';
import MobileDrawer from './components/mobile/MobileDrawer';
import PwaInstallPrompt from './components/mobile/PwaInstallPrompt';

import DashboardView from './components/DashboardView';
import CustomerView from './components/CustomerView';
import ScheduleView from './components/ScheduleView';
import ReportsView from './components/ReportsView';
import ClaimsView from './components/ClaimsView';
import OrganizationManagementView from './components/OrganizationManagementView';
import ProductStrategyBoardView from './components/ProductStrategyBoardView';
import TodayMarketView from './components/TodayMarketView';
import PlannerToolsView from './components/PlannerToolsView';
import SystemView from './components/SystemView';
import LoginView from './components/LoginView';

import CustomerModal from './components/CustomerModal';
import CustomerDetailModal from './components/CustomerDetailModal';
import ScheduleModal from './components/ScheduleModal';
import ScheduleAlertModal from './components/ScheduleAlertModal';
import DesktopWidgetView from './components/DesktopWidgetView';
import RollbackBanner from './components/RollbackBanner';
import UpdateModal from './components/UpdateModal';
import ThemeModal from './components/ThemeModal';

import { useCrmStore } from './store/useCrmStore';
import { api, isElectron } from './utils/api';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('UI Rendering Error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-6 space-y-4 font-['Inter',sans-serif]">
          <div className="w-12 h-12 rounded-2xl bg-rose-900/50 border border-rose-500/50 flex items-center justify-center text-rose-400 font-bold text-xl">
            ⚠️
          </div>
          <h2 className="text-lg font-bold">화면 렌더링 중 일시적 오류가 발생했습니다.</h2>
          <p className="text-xs text-slate-400 max-w-md text-center">
            {this.state.error?.message || '알 수 없는 오류'}
          </p>
          <div className="flex space-x-3 pt-2">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white shadow-lg transition-all"
            >
              화면 새로고침
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('alpha_crm_active_user');
                localStorage.removeItem('wlb_active_user');
                sessionStorage.removeItem('alpha_crm_active_user');
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-all"
            >
              로그아웃 후 재시도
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const isWidgetMode = window.location.hash === '#widget';

  const currentUser = useCrmStore((state) => state.currentUser);
  const activeTab = useCrmStore((state) => state.activeTab);
  const theme = useCrmStore((state) => state.theme);
  const showRollbackAlert = useCrmStore((state) => state.showRollbackAlert);
  const loadAllData = useCrmStore((state) => state.loadAllData);
  const checkRollbackStatus = useCrmStore((state) => state.checkRollbackStatus);
  const addDueScheduleAlert = useCrmStore((state) => state.addDueScheduleAlert);
  const setUpdateAvailableInfo = useCrmStore((state) => state.setUpdateAvailableInfo);

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  useEffect(() => {
    // If running on web/mobile and current tab is not in allowed 6 tabs, switch to customers
    if (!isElectron) {
      const allowed = ['customers', 'schedules', 'market', 'tools', 'board', 'claims'];
      if (!allowed.includes(activeTab)) {
        useCrmStore.getState().setActiveTab('customers');
      }
    }

    // Initial Load & Rollback Check
    loadAllData();
    checkRollbackStatus();

    // Listen for data updates across windows (Electron only)
    const unsubData = api.onSchedulesChanged(() => {
      loadAllData();
    });

    // Listen for schedule due notification (opens popup at exact reminder time ONLY for direct owner)
    const unsubDue = api.onScheduleDue((schedule) => {
      loadAllData();
      if (!isWidgetMode && schedule && currentUser) {
        const isDirectOwner = Number(schedule.user_id) === Number(currentUser.id);
        if (isDirectOwner) {
          addDueScheduleAlert(schedule);
        }
      }
    });

    // Listen for online updates (Electron only)
    const unsubUpdate = api.onUpdateAvailable((info) => {
      if (!isWidgetMode && info) {
        setUpdateAvailableInfo(info);
      }
    });

    // Active Check for Updates on launch (Electron only)
    if (isElectron) {
      setTimeout(async () => {
        try {
          const info = await api.system.checkForUpdates();
          if (!isWidgetMode && info && info.updateAvailable) {
            setUpdateAvailableInfo(info);
          }
        } catch (err) {
          console.log('Startup update check error:', err);
        }
      }, 1500);
    }

    return () => {
      if (unsubData) unsubData();
      if (unsubDue) unsubDue();
      if (unsubUpdate) unsubUpdate();
    };
  }, [loadAllData, checkRollbackStatus, addDueScheduleAlert, setUpdateAvailableInfo, isWidgetMode, currentUser]);

  if (isWidgetMode) {
    return (
      <ErrorBoundary>
        <DesktopWidgetView />
      </ErrorBoundary>
    );
  }

  // Login Gate: If no user logged in, render LoginView
  if (!currentUser) {
    return (
      <ErrorBoundary>
        <div data-theme={theme} className="app-main-bg w-full h-full min-h-screen">
          <PwaInstallPrompt />
          <LoginView />
          <UpdateModal />
          <ThemeModal />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div
        data-theme={theme}
        className="flex flex-col md:flex-row h-screen w-screen overflow-hidden app-main-bg bg-[#090d16] text-slate-100 font-['Inter',sans-serif] select-none transition-colors duration-300"
      >
        {/* Mobile Header (Hidden on md/desktop) */}
        <MobileHeader onOpenDrawer={() => setIsMobileDrawerOpen(true)} />

        {/* Mobile PWA Install Prompt Banner */}
        <PwaInstallPrompt />

        {/* Desktop/Tablet Sidebar Navigation (Hidden on mobile) */}
        <Sidebar />

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar relative app-workspace-bg pb-20 md:pb-0">
          {/* Startup Rollback Alert Banner */}
          {showRollbackAlert && <RollbackBanner />}

          {/* View Switcher: 10 Full Major Modules */}
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'customers' && <CustomerView />}
          {activeTab === 'schedules' && <ScheduleView />}
          {activeTab === 'market' && <TodayMarketView />}
          {activeTab === 'tools' && <PlannerToolsView />}
          {activeTab === 'board' && <ProductStrategyBoardView />}
          {activeTab === 'org' && <OrganizationManagementView />}
          {activeTab === 'reports' && <ReportsView />}
          {activeTab === 'claims' && <ClaimsView />}
          {activeTab === 'system' && <SystemView />}
        </main>

        {/* Mobile Bottom Navigation Bar (Fixed on mobile) */}
        <MobileBottomNav onOpenDrawer={() => setIsMobileDrawerOpen(true)} />

        {/* Mobile Full 10-Menu Drawer */}
        <MobileDrawer 
          isOpen={isMobileDrawerOpen} 
          onClose={() => setIsMobileDrawerOpen(false)} 
        />

        {/* Global Modals */}
        <CustomerModal />
        <CustomerDetailModal />
        <ScheduleModal />
        <ScheduleAlertModal />
        <UpdateModal />
        <ThemeModal />
      </div>
    </ErrorBoundary>
  );
}
