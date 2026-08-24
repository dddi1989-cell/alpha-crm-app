import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, UserCheck, ShieldAlert, Key, Edit, Trash2, Check, X, AlertCircle, Building2, ChevronRight } from 'lucide-react';
import { api } from '../utils/api';
import { useCrmStore } from '../store/useCrmStore';

export default function OrganizationView() {
  const currentUser = useCrmStore((state) => state.currentUser);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    phone: '',
    role: 'Agent',
    parent_id: ''
  });

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const res = await api.users.getAll();
      if (res?.success) {
        setUsers(res.users || []);
      } else {
        setError(res?.error || '사용자 목록을 불러오지 못했습니다.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Only Admin can access Organization Management
  if (currentUser?.role !== 'Admin') {
    return (
      <div className="p-8 text-center space-y-4 animate-fadeIn">
        <div className="p-4 bg-red-950/60 border border-red-500/40 rounded-2xl max-w-md mx-auto text-red-300 flex items-center justify-center space-x-2">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          <span className="text-sm font-semibold">조직도 관리 메뉴는 최고 관리자(Admin) 전용입니다.</span>
        </div>
      </div>
    );
  }

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      password: '',
      name: '',
      phone: '',
      role: 'Agent',
      parent_id: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (u) => {
    setEditingUser(u);
    setFormData({
      username: u.username,
      password: '', // Blank unless changing
      name: u.name,
      phone: u.phone || '',
      role: u.role,
      parent_id: u.parent_id || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!formData.name.trim()) {
      setError('성명을 입력해 주세요.');
      return;
    }

    if (!editingUser) {
      if (!formData.username.trim() || !formData.password.trim()) {
        setError('아이디와 비밀번호를 모두 입력해 주세요.');
        return;
      }
    }

    try {
      if (editingUser) {
        const res = await api.users.update({
          id: editingUser.id,
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          password: formData.password.trim(),
          role: formData.role,
          parent_id: formData.parent_id
        });
        if (res?.success) {
          setSuccessMsg(`[${formData.name}] 사용자 정보가 성공적으로 수정되었습니다.`);
          setIsModalOpen(false);
          loadUsers();
        } else {
          setError(res?.error || '수정에 실패했습니다.');
        }
      } else {
        const res = await api.users.create({
          username: formData.username.trim(),
          password: formData.password.trim(),
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          role: formData.role,
          parent_id: formData.parent_id
        });
        if (res?.success) {
          setSuccessMsg(`[${formData.name}] 신규 사용자가 등록되었습니다.`);
          setIsModalOpen(false);
          loadUsers();
        } else {
          setError(res?.error || '사용자 생성에 실패했습니다.');
        }
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (u) => {
    if (u.username === 'admin') {
      alert('최고 관리자(admin) 계정은 삭제할 수 없습니다.');
      return;
    }

    if (!confirm(`정말로 사용자 [${u.name} (${u.username})] 계정을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const res = await api.users.delete(u.id);
      if (res?.success) {
        setSuccessMsg(`[${u.name}] 계정이 삭제되었습니다.`);
        loadUsers();
      } else {
        alert(res?.error || '삭제 실패');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const managers = users.filter(u => u.role === 'Admin' || u.role === 'Manager');

  return (
    <div className="p-8 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-['Outfit',sans-serif] text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Building2 className="w-6 h-6 text-indigo-400" />
            <span>조직도 및 계정 관리 (Admin 전용)</span>
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            사용자 계정을 생성하고 상위 팀장/관리자 관계 및 권한 구성을 설정합니다.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-2 active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>신규 계정 추가</span>
        </button>
      </div>

      {/* Alert Notification */}
      {successMsg && (
        <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-xl flex items-center space-x-2 animate-fadeIn">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-950/80 border border-red-500/40 text-red-300 px-4 py-3 rounded-xl flex items-center space-x-2 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Role Hierarchy Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400">총 계정 수</span>
            <h3 className="text-2xl font-bold text-white mt-1">{users.length}명</h3>
          </div>
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400">상위 관리자 (SM ~ admin)</span>
            <h3 className="text-2xl font-bold text-amber-400 mt-1">
              {users.filter(u => ['SM', 'BM', 'RM', 'COO', 'CEO', 'admin', 'Admin', 'Manager'].includes(u.role)).length}명
            </h3>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
            <Shield className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400">설계사 (FA)</span>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">
              {users.filter(u => ['FA', 'Agent'].includes(u.role)).length}명
            </h3>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* User Directory Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-white">7단계 직급 서열 조직 구조 목록</h3>
            <p className="text-xs text-slate-400 mt-0.5">서열: FA (Level 1) ➔ SM (L2) ➔ BM (L3) ➔ RM (L4) ➔ COO (L5) ➔ CEO (L6) ➔ admin (Level 7)</p>
          </div>
          <span className="text-xs text-slate-400">Admin 권한으로 자유롭게 조직 구조 변경 가능</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">아이디 (사번)</th>
                <th className="px-4 py-3">성명</th>
                <th className="px-4 py-3">연락처</th>
                <th className="px-4 py-3">직급 / 서열 (Role Hierarchy)</th>
                <th className="px-4 py-3">직속 상위 관리자</th>
                <th className="px-4 py-3">생성일시</th>
                <th className="px-4 py-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map((u) => {
                const getRoleBadge = (role) => {
                  switch (role) {
                    case 'admin':
                    case 'Admin':
                      return { label: '👑 admin (L7 최고관리자)', style: 'bg-purple-950/80 text-purple-300 border-purple-800' };
                    case 'CEO':
                      return { label: '🏢 CEO (L6 대표이사)', style: 'bg-rose-950/80 text-rose-300 border-rose-800' };
                    case 'COO':
                      return { label: '🏛️ COO (L5 사업단장)', style: 'bg-orange-950/80 text-orange-300 border-orange-800' };
                    case 'RM':
                      return { label: '🏬 RM (L4 본부장)', style: 'bg-amber-950/80 text-amber-300 border-amber-800' };
                    case 'BM':
                      return { label: '🏢 BM (L3 지점장)', style: 'bg-emerald-950/80 text-emerald-300 border-emerald-800' };
                    case 'SM':
                    case 'Manager':
                      return { label: '👔 SM (L2 팀장)', style: 'bg-cyan-950/80 text-cyan-300 border-cyan-800' };
                    case 'FA':
                    case 'Agent':
                    default:
                      return { label: '👤 FA (L1 설계사)', style: 'bg-slate-900 text-slate-300 border-slate-700' };
                  }
                };
                const badge = getRoleBadge(u.role);

                return (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-white font-bold">{u.username}</td>
                    <td className="px-4 py-3.5 font-semibold text-slate-200">{u.name}</td>
                    <td className="px-4 py-3.5 text-slate-300 font-mono text-[11px]">{u.phone || '-'}</td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.style}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {u.parent_name ? (
                        <span className="flex items-center space-x-1 text-slate-300 font-medium">
                          <ChevronRight className="w-3 h-3 text-indigo-400" />
                          <span>{u.parent_name}</span>
                          <span className="text-[10px] text-slate-500">({u.parent_role})</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">- (최상위 그룹)</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 font-mono">{u.created_at?.slice(0, 10) || '-'}</td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEditModal(u)}
                        className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition-colors"
                        title="계정 수정"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      {u.username !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
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

      {/* User Create & Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn select-none">
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl shadow-indigo-950/60">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <span>{editingUser ? `계정 수정: ${editingUser.name}` : '신규 계정 생성'}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">사용자 아이디 (Login ID)</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="예: fa_kim, sm_park, bm_lee"
                  disabled={!!editingUser}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">
                  비밀번호 {editingUser && '(변경 시에만 입력)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? '비밀번호 변경하지 않으려면 빈칸 유지' : '비밀번호 입력'}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required={!editingUser}
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">성명 (실명)</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="예: 홍길동"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">연락처 (휴대폰 번호)</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="예: 010-1234-5678"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">역할 / 직급 서열 선택 (FA ~ admin)</label>
                <div className="space-y-2">
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500 font-bold"
                  >
                    <option value="FA">👤 FA (Level 1 - 설계사 / 영업담당)</option>
                    <option value="SM">👔 SM (Level 2 - Sub Manager / 팀장)</option>
                    <option value="BM">🏢 BM (Level 3 - Branch Manager / 지점장)</option>
                    <option value="RM">🏬 RM (Level 4 - Regional Manager / 본부장)</option>
                    <option value="COO">🏛️ COO (Level 5 - Chief Operating Officer / 사업단장)</option>
                    <option value="CEO">🏢 CEO (Level 6 - Chief Executive Officer / 대표이사)</option>
                    <option value="admin">👑 admin (Level 7 - System Admin / 최고관리자)</option>
                  </select>

                  <div className="flex flex-wrap gap-1 text-[10px]">
                    <span className="text-slate-400 self-center">원클릭 프리셋:</span>
                    {[
                      { role: 'FA', name: 'FA (L1)' },
                      { role: 'SM', name: 'SM (L2)' },
                      { role: 'BM', name: 'BM (L3)' },
                      { role: 'RM', name: 'RM (L4)' },
                      { role: 'COO', name: 'COO (L5)' },
                      { role: 'CEO', name: 'CEO (L6)' },
                      { role: 'admin', name: 'admin (L7)' }
                    ].map((p) => (
                      <button
                        key={p.role}
                        type="button"
                        onClick={() => setFormData({ ...formData, role: p.role })}
                        className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                          formData.role === p.role ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">직속 상위 관리자 지정 (다단계 N-Depth 자유 지정)</label>
                <select
                  value={formData.parent_id}
                  onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">- 최상위 조직 (상위 관리자 없음) -</option>
                  {users.filter(u => !editingUser || u.id !== editingUser.id).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role}) - ID: {u.username}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">
                  * Admin이 상위 관리자 및 역할 명칭을 자유롭게 임의 설정하여 다단계 조직도를 자유롭게 구성할 수 있습니다.
                </p>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-md"
                >
                  {editingUser ? '수정 저장' : '계정 생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
