import React, { useState, useEffect } from 'react';
import logoIcon from '../assets/icon.png';
import { ShieldCheck, Lock, User, KeyRound, AlertCircle, ArrowRight, UserPlus, Phone, CheckCircle2, Info, Building2 } from 'lucide-react';
import { api } from '../utils/api';
import { useCrmStore } from '../store/useCrmStore';

export default function LoginView() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setCurrentUser = useCrmStore((state) => state.setCurrentUser);

  // Load app version on mount
  const [appVersion, setAppVersion] = useState('');
  useEffect(() => {
    api.system.getAppVersion().then(v => setAppVersion(v || '')).catch(() => {});
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const res = await api.users.login({
        username: username.trim(),
        password: password.trim()
      });

      if (res?.success && res?.user) {
        setCurrentUser(res.user);
      } else {
        setError(res?.error || '아이디 또는 비밀번호가 올바르지 않습니다.');
      }
    } catch (err) {
      setError('로그인 처리 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // 1. 이용자 등록 (신규 가입) Modal State
  // ==========================================
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [regForm, setRegForm] = useState({ username: '', name: '', phone: '', org_id: '' });
  const [availableOrgs, setAvailableOrgs] = useState([]);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [isRegSubmitting, setIsRegSubmitting] = useState(false);

  const loadOrganizations = async () => {
    try {
      const res = await api.org.getAllOrganizations();
      if (res?.organizations && Array.isArray(res.organizations)) {
        setAvailableOrgs(res.organizations);
      }
    } catch (e) {
      console.error('Failed to load organizations on register modal:', e);
    }
  };

  const handleOpenRegisterModal = () => {
    setRegForm({ username: '', name: '', phone: '', org_id: '' });
    setRegError('');
    setRegSuccess('');
    setIsRegisterModalOpen(true);
    loadOrganizations();
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    const trimmedUsername = regForm.username.trim();
    const trimmedName = regForm.name.trim();
    const trimmedPhone = regForm.phone.trim();
    const selectedOrgId = regForm.org_id ? Number(regForm.org_id) : null;
    const selectedOrg = availableOrgs.find(o => Number(o.id) === selectedOrgId);
    const selectedOrgName = selectedOrg ? selectedOrg.name : null;

    if (!trimmedUsername || !trimmedName || !trimmedPhone) {
      setRegError('사번(아이디), 성명, 연락처를 모두 입력해 주세요.');
      return;
    }

    if (!selectedOrgId) {
      setRegError('소속되실 조직(팀/지점/본부)을 선택해 주세요.');
      return;
    }

    setIsRegSubmitting(true);

    try {
      const res = await api.users.register({
        username: trimmedUsername,
        name: trimmedName,
        phone: trimmedPhone,
        org_id: selectedOrgId,
        org_name: selectedOrgName,
        role: 'FA'
      });

      if (res?.success) {
        setRegSuccess(res.message || `${trimmedName} 님의 이용자 등록이 완료되었습니다.`);
        
        // 로그인 폼에 자동 입력
        setUsername(trimmedUsername);
        setPassword(trimmedUsername);
        setSuccessInfo(`[${trimmedName}] 님의 이용자 등록이 완료되었습니다. 사번(${trimmedUsername})으로 로그인해 주세요.`);

        setTimeout(() => {
          setIsRegisterModalOpen(false);
        }, 1500);
      } else {
        setRegError(res?.error || '이용자 등록에 실패했습니다.');
      }
    } catch (err) {
      setRegError('이용자 등록 처리 중 오류: ' + err.message);
    } finally {
      setIsRegSubmitting(false);
    }
  };

  // ==========================================
  // 2. 비밀번호 변경 Modal State
  // ==========================================
  const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({ username: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [isPwdSubmitting, setIsPwdSubmitting] = useState(false);

  const handleOpenPwdModal = () => {
    setPwdForm({ username: username || '', currentPassword: '', newPassword: '', confirmPassword: '' });
    setPwdError('');
    setPwdSuccess('');
    setIsPwdModalOpen(true);
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (!pwdForm.username.trim() || !pwdForm.currentPassword.trim() || !pwdForm.newPassword.trim()) {
      setPwdError('모든 항목을 입력해 주세요.');
      return;
    }

    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdError('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    if (pwdForm.newPassword.length < 3) {
      setPwdError('새 비밀번호는 3자리 이상 입력해 주세요.');
      return;
    }

    setIsPwdSubmitting(true);

    try {
      const res = await api.users.changePassword({
        username: pwdForm.username.trim(),
        currentPassword: pwdForm.currentPassword.trim(),
        newPassword: pwdForm.newPassword.trim()
      });

      if (res?.success) {
        setPwdSuccess(res.message || '비밀번호가 성공적으로 변경되었습니다. 변경된 비밀번호로 로그인하세요.');
        setPwdForm({ username: '', currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPwdError(res?.error || '비밀번호 변경 실패: 입력 정보를 확인하세요.');
      }
    } catch (err) {
      setPwdError('비밀번호 변경 오류: ' + err.message);
    } finally {
      setIsPwdSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-white flex items-center justify-center p-6 select-none animate-fadeIn relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md glass-panel p-8 rounded-3xl border border-slate-800/80 shadow-2xl shadow-indigo-950/40 relative z-10 space-y-6">
        {/* Header Logo */}
        <div className="text-center space-y-3">
          <div className="w-28 h-20 bg-black rounded-2xl p-1.5 mx-auto shadow-2xl shadow-black/90 flex items-center justify-center border border-slate-700/80">
            <img 
              src={logoIcon} 
              alt="WBL Logo" 
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
              }} 
            />
            <span className="hidden w-full h-full font-black text-white text-xl flex items-center justify-center">W</span>
          </div>
          <div>
            <h1 className="font-['Outfit',sans-serif] text-2xl font-extrabold tracking-tight text-white">
              WBL CRM TOOL
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              안전한 로그인 후 CRM 시스템에 접속하세요
            </p>
          </div>
        </div>

        {/* Success Alert */}
        {successInfo && (
          <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 p-3 rounded-2xl flex items-center space-x-2 text-xs animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successInfo}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-red-950/80 border border-red-500/50 text-red-300 p-3 rounded-2xl flex items-center space-x-2 text-xs animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span>사용자 사번 (아이디)</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="사번 또는 아이디 입력"
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-medium"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1">
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                <span>비밀번호</span>
              </label>
              <button
                type="button"
                onClick={handleOpenPwdModal}
                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 transition-colors"
              >
                <KeyRound className="w-3 h-3" />
                <span>비밀번호 변경</span>
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력 (최초: 사번과 동일)"
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="space-y-2.5 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 active:scale-98"
            >
              <span>{isSubmitting ? '로그인 처리 중...' : '시스템 로그인'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* 이용자 등록 버튼 */}
            <button
              type="button"
              onClick={handleOpenRegisterModal}
              className="w-full py-3 bg-slate-900/90 hover:bg-slate-800 text-indigo-300 hover:text-white font-bold text-xs rounded-xl border border-indigo-500/30 hover:border-indigo-500/60 transition-all flex items-center justify-center space-x-2 shadow-sm active:scale-98"
            >
              <UserPlus className="w-4 h-4 text-indigo-400" />
              <span>✨ 신규 이용자 등록 (사번 가입)</span>
            </button>
          </div>
        </form>

        {/* Footer info */}
        <div className="pt-2 text-center text-[11px] text-slate-500 font-mono border-t border-slate-800/60 flex items-center justify-between">
          <span>ALPHA CRM Multi-User System {appVersion && <span className="text-slate-600 ml-1">v{appVersion}</span>}</span>
          <button
            type="button"
            onClick={handleOpenPwdModal}
            className="text-slate-400 hover:text-indigo-400 underline transition-colors"
          >
            비밀번호 변경
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* 1. 이용자 등록 (신규 가입) Modal */}
      {/* ========================================== */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0f172a] border border-indigo-500/50 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl shadow-indigo-950/80">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <span>신규 이용자 등록</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            {/* Notice Guide Box */}
            <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-3.5 space-y-1.5 text-xs text-slate-300">
              <div className="flex items-center space-x-1.5 text-indigo-300 font-bold">
                <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>이용자 등록 안내</span>
              </div>
              <ul className="space-y-1 text-[11px] text-slate-400 pl-5 list-disc">
                <li>사번, 성명, 연락처, 소속 조직을 선택하시면 즉시 등록됩니다.</li>
                <li><strong className="text-indigo-200">최초 비밀번호는 입력하신 사번(아이디)으로 자동 고정</strong>됩니다.</li>
                <li>등록 완료 후 초기 비밀번호(사번)로 바로 로그인하실 수 있습니다.</li>
              </ul>
            </div>

            {regSuccess && (
              <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 p-3 rounded-2xl text-xs font-medium animate-fadeIn flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="whitespace-pre-wrap">{regSuccess}</span>
              </div>
            )}

            {regError && (
              <div className="bg-red-950/80 border border-red-500/50 text-red-300 p-3 rounded-2xl text-xs font-medium animate-fadeIn flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold flex items-center space-x-1">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  <span>사번 (사용자 아이디) <span className="text-rose-400">*</span></span>
                </label>
                <input
                  type="text"
                  value={regForm.username}
                  onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                  placeholder="예: 20240101 또는 사번 입력"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>성명 <span className="text-rose-400">*</span></span>
                </label>
                <input
                  type="text"
                  value={regForm.name}
                  onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  placeholder="이름 입력 (예: 홍길동)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold flex items-center space-x-1">
                  <Phone className="w-3.5 h-3.5 text-indigo-400" />
                  <span>연락처 (휴대폰 번호) <span className="text-rose-400">*</span></span>
                </label>
                <input
                  type="tel"
                  value={regForm.phone}
                  onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                  placeholder="예: 010-1234-5678"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  required
                />
              </div>

              {/* 소속 조직 선택 */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold flex items-center space-x-1">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>소속 조직 선택 <span className="text-rose-400">*</span></span>
                </label>
                <select
                  value={regForm.org_id}
                  onChange={(e) => setRegForm({ ...regForm, org_id: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-xs font-medium shadow-inner"
                  required
                >
                  <option value="">소속되실 조직을 선택해 주세요</option>
                  {availableOrgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      📁 {org.name} {org.type ? `[${org.type}]` : ''} {org.org_path ? `(${org.org_path})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 pl-1">
                  등록 후 해당 조직의 상위 관리자 및 조직원들과 연동됩니다.
                </p>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isRegSubmitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-950/50 disabled:opacity-50 transition-all active:scale-95"
                >
                  {isRegSubmitting ? '등록 처리 중...' : '이용자 등록 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 2. 비밀번호 변경 Modal */}
      {/* ========================================== */}
      {isPwdModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0f172a] border border-indigo-500/50 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl shadow-indigo-950/80">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                <span>비밀번호 변경 서비스</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsPwdModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {pwdSuccess && (
              <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 p-3 rounded-2xl text-xs font-medium animate-fadeIn">
                {pwdSuccess}
              </div>
            )}

            {pwdError && (
              <div className="bg-red-950/80 border border-red-500/50 text-red-300 p-3 rounded-2xl text-xs font-medium animate-fadeIn">
                {pwdError}
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">사용자 사번 (아이디)</label>
                <input
                  type="text"
                  value={pwdForm.username}
                  onChange={(e) => setPwdForm({ ...pwdForm, username: e.target.value })}
                  placeholder="비밀번호 변경할 계정 사번/ID 입력"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">현재 비밀번호</label>
                <input
                  type="password"
                  value={pwdForm.currentPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                  placeholder="현재 사용 중인 비밀번호 (최초 등록 시 사번)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">새로운 비밀번호</label>
                <input
                  type="password"
                  value={pwdForm.newPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                  placeholder="변경할 새 비밀번호 입력"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">새로운 비밀번호 확인</label>
                <input
                  type="password"
                  value={pwdForm.confirmPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                  placeholder="새 비밀번호 재입력"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsPwdModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  닫기
                </button>
                <button
                  type="submit"
                  disabled={isPwdSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-md disabled:opacity-50"
                >
                  {isPwdSubmitting ? '변경 중...' : '비밀번호 변경 적용'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
