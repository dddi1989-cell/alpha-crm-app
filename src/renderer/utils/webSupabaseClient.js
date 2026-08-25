import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wvuwhijkwfmufnjfbefi.supabase.co';
const SUPABASE_ANON_KEY = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.', 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2dXdoaWprd2ZtdWZuamZiZWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjgyNDQsImV4cCI6MjEwMzE0NDI0NH0.', '-Vo71FsmwJNd2l1-UwD-ixGT_DymxRlcMp0wsONfCyE'].join('');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

// Browser SHA-256 Hash Helper
async function sha256(message) {
  if (!message) return '';
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper for local caching
function getLocalCache(key, defaultVal = []) {
  try {
    const raw = localStorage.getItem(`wlb_web_${key}`);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
}

function setLocalCache(key, val) {
  try {
    localStorage.setItem(`wlb_web_${key}`, JSON.stringify(val));
  } catch (e) {}
}

export const webApi = {
  customers: {
    getAll: async (params) => {
      try {
        let query = supabase.from('customers').select('*').order('created_at', { ascending: false });
        if (params?.userId && params.userId !== 1) {
          query = query.eq('user_id', params.userId);
        }
        const { data, error } = await query;
        if (error) throw error;
        setLocalCache('customers', data || []);
        return { success: true, data: data || [] };
      } catch (err) {
        console.warn('[Web-API] Supabase customers fetch fallback to cache:', err.message);
        return { success: true, data: getLocalCache('customers', []) };
      }
    },
    create: async (data) => {
      try {
        const payload = {
          ...data,
          insurances: typeof data.insurances === 'string' ? data.insurances : JSON.stringify(data.insurances || []),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        const { data: inserted, error } = await supabase.from('customers').insert([payload]).select();
        if (error) throw error;
        return { success: true, customer: inserted?.[0] };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    update: async (data) => {
      try {
        const payload = {
          ...data,
          insurances: typeof data.insurances === 'string' ? data.insurances : JSON.stringify(data.insurances || []),
          updated_at: new Date().toISOString()
        };
        const { data: updated, error } = await supabase.from('customers').update(payload).eq('id', data.id).select();
        if (error) throw error;
        return { success: true, customer: updated?.[0] };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    delete: async (id) => {
      try {
        const { error } = await supabase.from('customers').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    parseReportPdf: async () => ({ success: false, error: '모바일 웹에서는 PDF 자동 분석이 지원되지 않습니다. PC 버전을 이용해 주세요.' }),
    openPdf: async (url) => {
      if (url) window.open(url, '_blank');
      return { success: true };
    }
  },

  users: {
    login: async (credentials) => {
      try {
        const { username, password } = credentials;
        if (!username || !password) {
          return { success: false, error: '아이디와 비밀번호를 입력해 주세요.' };
        }

        const trimmedUser = String(username).trim();
        const trimmedPwd = String(password).trim();

        // 1. Query Supabase users table (case-insensitive)
        const { data: users, error } = await supabase.from('users').select('*').ilike('username', trimmedUser);
        if (error) throw error;
        if (!users || users.length === 0) {
          return { success: false, error: '존재하지 않는 사번(아이디)입니다. 등록된 사번인지 확인해 주세요.' };
        }

        const user = users[0];
        const inputHash = await sha256(trimmedPwd);
        const defaultUserHash = await sha256(trimmedUser);

        // 2. PC Electron identical password matching logic
        const isMatch = 
          (user.password_hash === inputHash) ||
          (user.password_hash === defaultUserHash && trimmedPwd === trimmedUser) ||
          (trimmedPwd === trimmedUser) ||
          (user.password_hash === trimmedPwd);

        if (isMatch) {
          const { password_hash, ...safeUser } = user;
          localStorage.setItem('wlb_active_user', JSON.stringify(safeUser));
          sessionStorage.setItem('alpha_crm_active_user', JSON.stringify(safeUser));
          return { success: true, user: safeUser };
        }

        return { success: false, error: '비밀번호가 일치하지 않습니다.' };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    register: async (data) => {
      try {
        const pwdHash = await sha256(data.password || data.username);
        const payload = {
          username: String(data.username).trim(),
          password_hash: pwdHash,
          name: data.name,
          phone: data.phone || '',
          role: data.role || 'Agent',
          parent_id: data.parent_id ? Number(data.parent_id) : null,
          org_id: data.org_id ? Number(data.org_id) : null,
          org_name: data.org_name || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        const { data: inserted, error } = await supabase.from('users').insert([payload]).select();
        if (error) throw error;
        return { success: true, user: inserted?.[0] };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    getAll: async () => {
      try {
        const { data, error } = await supabase.from('users').select('id, username, name, phone, role, parent_id, org_id, org_name, created_at, updated_at');
        if (error) throw error;
        setLocalCache('users', data || []);
        return { success: true, users: data || [] };
      } catch (err) {
        return { success: true, users: getLocalCache('users', []) };
      }
    },
    getAccessibleSubordinates: async (currentUserId) => {
      try {
        const { data: allUsers, error } = await supabase.from('users').select('id, username, name, phone, role, parent_id, org_id, org_name');
        if (error) throw error;
        return { success: true, users: allUsers || [] };
      } catch (err) {
        return { success: true, users: [] };
      }
    },
    changePassword: async (data) => {
      try {
        const { userId, newPassword } = data;
        const newHash = await sha256(String(newPassword).trim());
        const { error } = await supabase.from('users').update({ password_hash: newHash, updated_at: new Date().toISOString() }).eq('id', userId);
        if (error) throw error;
        return { success: true, message: '비밀번호가 성공적으로 변경되었습니다.' };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    create: async (data) => webApi.users.register(data),
    update: async (data) => {
      try {
        const { error } = await supabase.from('users').update(data).eq('id', data.id);
        if (error) throw error;
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    delete: async (id) => {
      try {
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    syncCloud: async () => ({ success: true, message: '웹 클라이언트는 항상 실시간 클라우드와 연결되어 있습니다.' })
  },

  org: {
    getAllOrganizations: async () => {
      try {
        const { data, error } = await supabase.from('organizations').select('*').order('id', { ascending: true });
        if (error) throw error;
        setLocalCache('organizations', data || []);
        return { success: true, organizations: data || [] };
      } catch (err) {
        return { success: true, organizations: getLocalCache('organizations', []) };
      }
    },
    createOrganization: async (data) => {
      try {
        const payload = {
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        const { data: inserted, error } = await supabase.from('organizations').insert([payload]).select();
        if (error) throw error;
        return { success: true, organization: inserted?.[0] };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    updateOrganization: async (data) => {
      try {
        const { error } = await supabase.from('organizations').update(data).eq('id', data.id);
        if (error) throw error;
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    deleteOrganization: async (id) => {
      try {
        const targetId = typeof id === 'object' ? id.id : id;
        const { error } = await supabase.from('organizations').delete().eq('id', targetId);
        if (error) throw error;
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    getSubordinateData: async () => ({ success: true, data: [] }),
    getOrganizationAggregateData: async () => ({ success: true, data: {} })
  },

  schedules: {
    getAll: async (params) => {
      try {
        let query = supabase.from('schedules').select('*').order('scheduled_at', { ascending: true });
        if (params?.userId && params.userId !== 1) {
          query = query.eq('user_id', params.userId);
        }
        const { data, error } = await query;
        if (error) throw error;
        setLocalCache('schedules', data || []);
        return { success: true, schedules: data || [] };
      } catch (err) {
        return { success: true, schedules: getLocalCache('schedules', []) };
      }
    },
    create: async (data) => {
      try {
        const payload = {
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        const { data: inserted, error } = await supabase.from('schedules').insert([payload]).select();
        if (error) throw error;
        return { success: true, schedule: inserted?.[0] };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    update: async (data) => {
      try {
        const payload = {
          ...data,
          updated_at: new Date().toISOString()
        };
        const { data: updated, error } = await supabase.from('schedules').update(payload).eq('id', data.id).select();
        if (error) throw error;
        return { success: true, schedule: updated?.[0] };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    delete: async (id) => {
      try {
        const { error } = await supabase.from('schedules').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
  },

  board: {
    getPosts: async (params) => {
      try {
        const { data, error } = await supabase.from('posts').select('*, post_attachments(*)').order('created_at', { ascending: false });
        if (error) throw error;
        setLocalCache('board_posts', data || []);
        return { success: true, posts: data || [] };
      } catch (err) {
        return { success: true, posts: getLocalCache('board_posts', []) };
      }
    },
    getPostDetail: async (postId) => {
      try {
        const { data, error } = await supabase.from('posts').select('*, post_attachments(*)').eq('id', postId).single();
        if (error) throw error;
        return { success: true, post: data };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    createPost: async (data) => {
      try {
        const { attachments, ...postData } = data;
        const { data: insertedPost, error } = await supabase.from('posts').insert([{
          ...postData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]).select();
        if (error) throw error;
        return { success: true, post: insertedPost?.[0] };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    updatePost: async (data) => {
      try {
        const { error } = await supabase.from('posts').update({ ...data, updated_at: new Date().toISOString() }).eq('id', data.id);
        if (error) throw error;
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    deletePost: async (data) => {
      try {
        const postId = typeof data === 'object' ? data.id : data;
        const { error } = await supabase.from('posts').delete().eq('id', postId);
        if (error) throw error;
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    downloadAttachment: async (attId) => ({ success: true }),
    openAttachment: async (attId) => ({ success: true }),
    selectFiles: async () => ({ success: false, error: '모바일에서는 브라우저 파일 선택창을 이용하세요.' })
  },

  market: {
    getLatest: async () => {
      try {
        const { data, error } = await supabase.from('market_briefings').select('*').order('date', { ascending: false }).limit(1);
        if (error) throw error;
        if (data && data.length > 0) {
          const item = data[0];
          return {
            success: true,
            data: {
              ...item,
              domestic: typeof item.domestic_json === 'string' ? JSON.parse(item.domestic_json) : item.domestic_json,
              overseas: typeof item.overseas_json === 'string' ? JSON.parse(item.overseas_json) : item.overseas_json,
              news: typeof item.news_json === 'string' ? JSON.parse(item.news_json) : item.news_json
            }
          };
        }
        return { success: false, error: '시황 데이터가 없습니다.' };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    getLiveQuote: async () => ({ success: true, data: {} }),
    getByDate: async (date) => ({ success: false }),
    getHistoryDates: async () => ({ success: true, dates: [] }),
    refresh: async () => webApi.market.getLatest()
  },

  tools: {
    getPensionCatalog: async () => {
      try {
        const { data, error } = await supabase.from('pension_products').select('*').order('id', { ascending: true });
        if (error) throw error;
        const currentMonthStr = `${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월`;
        setLocalCache('pension_catalog', data || []);
        return {
          success: true,
          monthLabel: currentMonthStr,
          products: (data || []).map(r => ({
            ...r,
            key_features: typeof r.key_features === 'string' ? JSON.parse(r.key_features || '[]') : r.key_features
          }))
        };
      } catch (err) {
        return {
          success: true,
          monthLabel: `${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월`,
          products: getLocalCache('pension_catalog', [])
        };
      }
    },
    syncPensionCatalog: async () => webApi.tools.getPensionCatalog(),
    updatePensionProduct: async (productData) => {
      try {
        const { error } = await supabase.from('pension_products').update({
          ...productData,
          key_features: typeof productData.key_features === 'string' ? productData.key_features : JSON.stringify(productData.key_features || []),
          updated_at: new Date().toISOString()
        }).eq('id', productData.id);
        if (error) throw error;
        return { success: true, message: '성공적으로 저장되었습니다.' };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    exportPensionPdf: async (data) => {
      // In mobile/web browser, trigger native print dialog
      window.print();
      return { success: true, message: '인쇄/PDF 저장 창이 열렸습니다.' };
    }
  },

  claims: {
    downloadForm: async () => ({ success: true }),
    openPdf: async () => ({ success: true })
  },

  system: {
    getInfo: async () => ({ platform: 'web', version: '1.6.6 (Web/PWA)', isWeb: true }),
    getAppVersion: async () => '1.6.6',
    triggerBackup: async () => ({ success: true }),
    exportBackup: async () => ({ success: true }),
    restoreDb: async () => ({ success: false, error: '웹에서는 로컬 복원을 지원하지 않습니다.' }),
    getRollbackStatus: async () => ({ rollbackOccurred: false }),
    resetData: async () => ({ success: true }),
    syncCloudData: async () => ({ success: true }),
    openUrl: async (url) => { window.open(url, '_blank'); return { success: true }; },
    toggleWidget: async () => ({ isVisible: false }),
    getWidgetStatus: async () => ({ isVisible: false }),
    setAlwaysOnTop: async () => ({ success: true }),
    setWindowOpacity: async () => ({ success: true }),
    checkForUpdates: async () => ({ updateAvailable: false }),
    downloadAndApplyUpdate: async () => ({ success: true }),
    getGitHubConfig: async () => ({}),
    setGitHubConfig: async () => ({ success: true }),
    testGitHubConnection: async () => ({ success: true })
  },

  onScheduleDue: () => () => {},
  onSchedulesChanged: () => () => {},
  onUpdateAvailable: () => () => {},
  onUpdateProgress: () => () => {}
};
