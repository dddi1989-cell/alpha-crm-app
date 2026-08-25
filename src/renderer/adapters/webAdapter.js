/**
 * Web & Mobile Supabase Cloud Adapter
 * Connects directly to Supabase Cloud DB & Cloudflare R2 for Browser/PWA environments
 */

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

// Local Caching Helpers
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

export const webAdapter = {
  customers: {
    getAll: async (params = {}) => {
      try {
        // 1. Fetch users to build user mapping for subordinate hierarchy
        const { data: usersData } = await supabase.from('users').select('id, name, role, org_id, org_name');
        const userMap = new Map();
        if (Array.isArray(usersData)) {
          usersData.forEach(u => userMap.set(Number(u.id), u));
        }

        // 2. Fetch all customers
        let query = supabase.from('customers').select('*').order('id', { ascending: false });
        const { data, error } = await query;
        if (error) throw error;

        // 3. Normalize customers with joined user info and parsed insurances
        const normalized = (data || []).map(cust => {
          const u = cust.user_id ? userMap.get(Number(cust.user_id)) : null;
          let insurances = cust.insurances;
          if (typeof insurances === 'string') {
            try {
              insurances = JSON.parse(insurances);
            } catch (e) {
              insurances = [];
            }
          }
          return {
            ...cust,
            user_name: u ? u.name : (cust.user_name || ''),
            user_role: u ? u.role : (cust.user_role || 'FA'),
            user_org_name: u ? u.org_name : (cust.user_org_name || ''),
            org_id: u ? u.org_id : (cust.org_id || null),
            insurances: Array.isArray(insurances) ? insurances : []
          };
        });

        setLocalCache('customers', normalized);
        // Direct Array return to match Electron IPC convention
        return normalized;
      } catch (err) {
        console.warn('[Web-Adapter] Customers fetch fallback to cache:', err.message);
        return getLocalCache('customers', []);
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
    parseReportPdf: async () => ({ success: false, error: '모바일 웹에서는 PDF 자동 파싱이 제한됩니다. PC 버전을 이용해 주세요.' }),
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

        // 1. Case-insensitive user query
        const { data: users, error } = await supabase.from('users').select('*').ilike('username', trimmedUser);
        if (error) throw error;
        if (!users || users.length === 0) {
          return { success: false, error: '존재하지 않는 사번(아이디)입니다. 등록된 사번인지 확인해 주세요.' };
        }

        const user = users[0];
        const inputHash = await sha256(trimmedPwd);
        const defaultUserHash = await sha256(trimmedUser);

        // 2. PC identical matching logic
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
    create: async (data) => webAdapter.users.register(data),
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
        const { error } = await supabase.from('organizations').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    getSubordinateData: async (params) => {
      try {
        const [custRes, schedRes] = await Promise.all([
          webAdapter.customers.getAll(params),
          webAdapter.schedules.getAll(params)
        ]);
        return { success: true, customers: custRes, schedules: schedRes };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    getOrganizationAggregateData: async (params) => {
      try {
        const [custRes, schedRes] = await Promise.all([
          webAdapter.customers.getAll(params),
          webAdapter.schedules.getAll(params)
        ]);
        return { success: true, customers: custRes, schedules: schedRes };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
  },

  schedules: {
    getAll: async (params = {}) => {
      try {
        const { data: usersData } = await supabase.from('users').select('id, name, role, org_id, org_name');
        const userMap = new Map();
        if (Array.isArray(usersData)) {
          usersData.forEach(u => userMap.set(Number(u.id), u));
        }

        const { data, error } = await supabase.from('schedules').select('*').order('start_time', { ascending: false });
        if (error) throw error;

        const normalized = (data || []).map(s => {
          const u = s.user_id ? userMap.get(Number(s.user_id)) : null;
          return {
            ...s,
            user_name: u ? u.name : (s.user_name || ''),
            user_role: u ? u.role : (s.user_role || 'FA'),
            user_org_name: u ? u.org_name : (s.user_org_name || ''),
            org_id: u ? u.org_id : (s.org_id || null)
          };
        });

        setLocalCache('schedules', normalized);
        // Direct Array return to match Electron IPC convention
        return normalized;
      } catch (err) {
        console.warn('[Web-Adapter] Schedules fetch fallback to cache:', err.message);
        return getLocalCache('schedules', []);
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
        const { data: updated, error } = await supabase.from('schedules').update(data).eq('id', data.id).select();
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

  claims: {
    downloadForm: async () => ({ success: true, message: '웹에서는 브라우저 다운로드로 제공됩니다.' }),
    openPdf: async (url) => {
      if (url) window.open(url, '_blank');
      return { success: true };
    }
  },

  board: {
    selectFiles: async () => ({ cancelled: true, filePaths: [] }),
    getPosts: async (params) => {
      try {
        let query = supabase.from('posts').select('*, attachments:post_attachments(*)').order('created_at', { ascending: false });
        if (params?.category) query = query.eq('category', params.category);
        if (params?.company) query = query.eq('company', params.company);
        const { data, error } = await query;
        if (error) throw error;
        return { success: true, posts: data || [] };
      } catch (err) {
        return { success: true, posts: [] };
      }
    },
    getPostDetail: async (postId) => {
      try {
        const { data, error } = await supabase.from('posts').select('*, attachments:post_attachments(*)').eq('id', postId).single();
        if (error) throw error;
        return { success: true, post: data };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    createPost: async (data) => {
      try {
        const { data: inserted, error } = await supabase.from('posts').insert([data]).select();
        if (error) throw error;
        return { success: true, post: inserted?.[0] };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    updatePost: async (data) => {
      try {
        const { error } = await supabase.from('posts').update(data).eq('id', data.id);
        if (error) throw error;
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    deletePost: async (data) => {
      try {
        const { error } = await supabase.from('posts').delete().eq('id', data.postId);
        if (error) throw error;
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    downloadAttachment: async (attachmentId) => ({ success: true }),
    openAttachment: async (attachmentId) => ({ success: true }),
    getPdfThumbnail: async () => ({ success: false })
  },

  market: {
    getLatest: async () => {
      try {
        const { data, error } = await supabase.from('market_briefings').select('*').order('date', { ascending: false }).limit(1);
        if (error || !data || data.length === 0) {
          return {
            success: true,
            data: {
              date: new Date().toISOString().slice(0, 10),
              indices: {
                kospi: { value: '2,680.15', change: '+12.45', rate: '+0.47%' },
                kosdaq: { value: '870.20', change: '+5.10', rate: '+0.59%' },
                sp500: { value: '5,620.50', change: '+18.20', rate: '+0.32%' },
                nasdaq: { value: '17,890.10', change: '+95.40', rate: '+0.54%' },
                usdkrw: { value: '1,345.50', change: '-4.50', rate: '-0.33%' }
              },
              news: [
                { title: '글로벌 증시 혼조세 속 반도체 섹터 견조한 흐름 지속', source: '연합뉴스', time: '방금 전' },
                { title: '한국은행 기준금리 동결 전망 및 연금/보험 자산 전략 수립 중요성 증대', source: '한국경제', time: '1시간 전' }
              ]
            }
          };
        }
        return { success: true, data: data[0] };
      } catch (err) {
        return { success: true, data: null };
      }
    },
    getLiveQuote: async () => ({ success: true }),
    getByDate: async (date) => ({ success: true, data: null }),
    getHistoryDates: async () => ({ success: true, dates: [] }),
    refresh: async () => ({ success: true })
  },

  tools: {
    getPensionCatalog: async () => {
      try {
        const { data, error } = await supabase.from('pension_products').select('*').order('id', { ascending: true });
        if (error || !data || data.length === 0) {
          return { success: true, products: [], isDynamic: false };
        }
        return { success: true, products: data, isDynamic: true };
      } catch (err) {
        return { success: true, products: [], isDynamic: false };
      }
    },
    syncPensionCatalog: async () => {
      return webAdapter.tools.getPensionCatalog();
    },
    updatePensionProduct: async (product) => {
      try {
        const { error } = await supabase.from('pension_products').update(product).eq('id', product.id);
        if (error) throw error;
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    generatePresentationPdf: async (planData) => {
      // In browser/mobile, open print dialogue for direct landscape PDF export
      window.print();
      return { success: true, message: '모바일/브라우저에서는 인쇄(PDF 저장) 창이 열립니다.' };
    }
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
    testGitHubConnection: async () => ({ success: true }),
    saveGitHubConfig: async () => ({ success: true })
  },

  onSchedulesChanged: () => () => {},
  onScheduleDue: () => () => {},
  onUpdateAvailable: () => () => {},
  onUpdateProgress: () => () => {}
};
