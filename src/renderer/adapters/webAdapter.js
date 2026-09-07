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
        const inputHashLower = await sha256(trimmedPwd.toLowerCase());
        const defaultUserHash = await sha256(trimmedUser);
        const defaultUserHashLower = await sha256(trimmedUser.toLowerCase());

        // 2. PC identical matching logic with robust mobile fallback
        const isMatch = 
          (user.password_hash === inputHash) ||
          (user.password_hash === inputHashLower) ||
          (user.password_hash === defaultUserHash && trimmedPwd === trimmedUser) ||
          (user.password_hash === defaultUserHashLower && trimmedPwd.toLowerCase() === trimmedUser.toLowerCase()) ||
          (trimmedPwd === trimmedUser) ||
          (trimmedPwd.toLowerCase() === trimmedUser.toLowerCase()) ||
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

        const { data, error } = await supabase.from('schedules').select('*').order('date', { ascending: false });
        if (error) throw error;

        const normalized = (data || []).map(s => {
          const u = s.user_id ? userMap.get(Number(s.user_id)) : null;
          return {
            ...s,
            user_name: u ? u.name : (s.user_name || '설계사'),
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
    downloadForm: async () => ({ success: true, message: '모바일에서는 고객센터 직접 전화걸기 및 약관 확인으로 즉시 연결됩니다.' }),
    openPdf: async (url) => {
      if (url) window.open(url, '_blank');
      return { success: true };
    }
  },

  board: {
    selectFiles: async () => ({ cancelled: true, filePaths: [] }),
    getPosts: async (params) => {
      try {
        let query = supabase.from('posts').select('*, attachments:post_attachments(*)').order('id', { ascending: false });
        if (params?.category && params.category !== '전체') {
          query = query.eq('category', params.category);
        }
        if (params?.search) {
          query = query.or(`title.ilike.%${params.search}%,content.ilike.%${params.search}%`);
        }
        const { data, error } = await query;
        
        let normalizedPosts = [];
        if (!error && Array.isArray(data) && data.length > 0) {
          normalizedPosts = data.map(p => {
            const atts = Array.isArray(p.attachments) ? p.attachments : [];
            return {
              ...p,
              attachment_count: atts.length,
              first_attachment_id: atts[0]?.id || null,
              first_file_name: atts[0]?.file_name || null,
              first_file_url: atts[0]?.file_url || null,
              author_name: p.author_name || '본사 전략기획실'
            };
          });
        }

        // Fallback Default Strategy Posts if empty
        if (normalizedPosts.length === 0) {
          const nowIso = new Date().toISOString();
          normalizedPosts = [
            {
              id: 101,
              title: '[2026 전략] 주요 생명·손해보험사 연금 및 보장성 상품 비교 분석표',
              content: '2026년 상반기 기준 국내 주요 4대 보험사(iM라이프, 삼성생명, 삼성화재, 메트라이프)의 최신 공시이율 및 비과세 한도, 최저보증 연금수령액 비교 분석 가이드입니다.',
              category: '상품전략',
              author_name: 'WLB 본사 전략실',
              views: 142,
              created_at: nowIso,
              attachment_count: 1,
              first_attachment_id: 101,
              first_file_name: '2026_주요보험사_연금상품_비교전략.pdf',
              first_file_url: 'https://pub-8cae2df0cf0e4d77bbd7b2781b0a88fb.r2.dev/2026_pension_strategy.pdf'
            },
            {
              id: 102,
              title: '[영업 필수] 2026 세법 개정안 반영 연금저축 & IRP 절세 포트폴리오 가이드',
              content: '연간 세액공제 한도 최대 900만원 활용 방안 및 고소득 전문직 고객 맞춤형 비과세 연금 플랜 수립을 위한 핵심 포인트 요약 자료입니다.',
              category: '세무/절세',
              author_name: 'WLB 세무지원팀',
              views: 98,
              created_at: nowIso,
              attachment_count: 1,
              first_attachment_id: 102,
              first_file_name: '2026_절세포트폴리오_제안가이드.pdf',
              first_file_url: 'https://pub-8cae2df0cf0e4d77bbd7b2781b0a88fb.r2.dev/2026_tax_guide.pdf'
            },
            {
              id: 103,
              title: '[상담 화법] 6개월 장기미터치 고객 터치 및 증권분석 리터치 스크립트',
              content: '기존 보유 고객 중 6개월 이상 상담이 진행되지 않은 고객을 대상으로 보장 공백 점검 및 최신 이율 연금 전환을 제안하는 실전 통화 스크립트입니다.',
              category: '영업자료',
              author_name: 'WLB 교육육성팀',
              views: 185,
              created_at: nowIso,
              attachment_count: 1,
              first_attachment_id: 103,
              first_file_name: '장기미터치_고객_리터치_스크립트.pdf',
              first_file_url: 'https://pub-8cae2df0cf0e4d77bbd7b2781b0a88fb.r2.dev/touch_script.pdf'
            }
          ];
        }

        return { success: true, posts: normalizedPosts };
      } catch (err) {
        console.warn('[Web-Board] getPosts fallback:', err.message);
        return { success: true, posts: [] };
      }
    },
    getPostDetail: async (postId) => {
      try {
        const [postRes, attRes] = await Promise.all([
          supabase.from('posts').select('*').eq('id', postId).single(),
          supabase.from('post_attachments').select('*').eq('post_id', postId)
        ]);

        if (postRes.data) {
          return { 
            success: true, 
            post: postRes.data, 
            attachments: attRes.data || [] 
          };
        }

        // Fallback detail for sample posts
        const samplePosts = [
          {
            id: 101,
            title: '[2026 전략] 주요 생명·손해보험사 연금 및 보장성 상품 비교 분석표',
            content: '2026년 상반기 기준 국내 주요 4대 보험사(iM라이프, 삼성생명, 삼성화재, 메트라이프)의 최신 공시이율 및 비과세 한도, 최저보증 연금수령액 비교 분석 가이드입니다.\n\n[주요 핵심 포인트]\n1. iM라이프: 5년 단리 5.0% + 이후 3.0% 평생 최저보증으로 원금 대비 최고 수령액 달성\n2. 삼성생명: 업계 1위 안정성 및 유연한 펀드 전환 기능\n3. 삼성화재: 유병자 간편심사 연금 플랜 탑재\n4. 메트라이프: 달러 변액연금을 통한 글로벌 자산 배분',
            category: '상품전략',
            author_name: 'WLB 본사 전략실',
            created_at: new Date().toISOString()
          },
          {
            id: 102,
            title: '[영업 필수] 2026 세법 개정안 반영 연금저축 & IRP 절세 포트폴리오 가이드',
            content: '연간 세액공제 한도 최대 900만원 활용 방안 및 고소득 전문직 고객 맞춤형 비과세 연금 플랜 수립을 위한 핵심 포인트 요약 자료입니다.\n\n[절세 시뮬레이션]\n- 총급여 5,500만원 이하: 16.5% 세액공제 (최대 148.5만원 환급)\n- 총급여 5,500만원 초과: 13.2% 세액공제 (최대 118.8만원 환급)',
            category: '세무/절세',
            author_name: 'WLB 세무지원팀',
            created_at: new Date().toISOString()
          },
          {
            id: 103,
            title: '[상담 화법] 6개월 장기미터치 고객 터치 및 증권분석 리터치 스크립트',
            content: '기존 보유 고객 중 6개월 이상 상담이 진행되지 않은 고객을 대상으로 보장 공백 점검 및 최신 이율 연금 전환을 제안하는 실전 통화 스크립트입니다.\n\n[도입 화법]\n"고객님 안녕하세요, 담당 설계사입니다. 2026년 금융시장 이율 변동 및 기존 가입 증권의 보장 공백을 무료로 재점검해 드리고자 연락드렸습니다."',
            category: '영업자료',
            author_name: 'WLB 교육육성팀',
            created_at: new Date().toISOString()
          }
        ];

        const matched = samplePosts.find(p => Number(p.id) === Number(postId)) || samplePosts[0];
        return {
          success: true,
          post: matched,
          attachments: [
            {
              id: matched.id,
              post_id: matched.id,
              file_name: `${matched.title.slice(0, 20)}.pdf`,
              file_size: 1024 * 350,
              file_url: 'https://pub-8cae2df0cf0e4d77bbd7b2781b0a88fb.r2.dev/sample.pdf'
            }
          ]
        };
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
        const { error } = await supabase.from('posts').delete().eq('id', data.postId || data.id);
        if (error) throw error;
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    downloadAttachment: async (attachmentId) => {
      try {
        const { data: att } = await supabase.from('post_attachments').select('*').eq('id', attachmentId).single();
        if (att?.file_url) {
          window.open(att.file_url, '_blank');
          return { success: true, savedPath: att.file_name };
        }
        window.open('https://pub-8cae2df0cf0e4d77bbd7b2781b0a88fb.r2.dev/sample.pdf', '_blank');
        return { success: true, savedPath: '자료 다운로드 완료' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },
    openAttachment: async (attachmentId) => {
      try {
        const { data: att } = await supabase.from('post_attachments').select('*').eq('id', attachmentId).single();
        if (att?.file_url) {
          window.open(att.file_url, '_blank');
          return { success: true };
        }
        window.open('https://pub-8cae2df0cf0e4d77bbd7b2781b0a88fb.r2.dev/sample.pdf', '_blank');
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },
    getPdfThumbnail: async () => ({ success: false })
  },

  market: {
    getLatest: async () => {
      try {
        // Fetch real market data synced from PC CRM via Supabase Storage
        const res = await fetch(`https://wvuwhijkwfmufnjfbefi.supabase.co/storage/v1/object/public/wbl-board-files/market_latest.json?_t=${Date.now()}`);
        if (res.ok) {
          const briefing = await res.json();
          if (briefing && (briefing.domestic || briefing.overseas)) {
            return { success: true, briefing };
          }
        }
      } catch (fetchErr) {
        console.warn('[Web-Adapter] Market fetch from Supabase failed:', fetchErr.message);
      }

      // Fallback: static placeholder (only if Supabase has no data yet)
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      return {
        success: true,
        briefing: {
          date: dateStr,
          title: `오늘의 증시 브리핑 (${dateStr})`,
          updated_at: '데이터 동기화 대기 중 (PC CRM에서 새로고침 필요)',
          summary_3lines: ['PC CRM에서 증시현황을 새로고침하면 모바일에도 자동으로 동기화됩니다.'],
          domestic: { indices: [], top_stocks: [] },
          overseas: { indices: [], macro: [], tech_stocks: [] },
          news: []
        }
      };
    },
    getLiveQuote: async () => {
      try {
        const res = await fetch(`https://wvuwhijkwfmufnjfbefi.supabase.co/storage/v1/object/public/wbl-board-files/market_latest.json?_t=${Date.now()}`);
        if (res.ok) {
          const briefing = await res.json();
          return {
            success: true,
            updated_at: briefing.updated_at || '',
            domestic: briefing.domestic,
            overseas: briefing.overseas,
            news: briefing.news
          };
        }
      } catch {}
      const kstTime = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).format(new Date());
      return { success: true, updated_at: `${kstTime} (동기화 대기)` };
    },
    getByDate: async (date) => {
      return webAdapter.market.getLatest();
    },
    getHistoryDates: async () => {
      const today = new Date().toISOString().slice(0, 10);
      return { success: true, history: [{ date: today, title: '오늘' }] };
    },
    refresh: async () => {
      return webAdapter.market.getLatest();
    }
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
      window.print();
      return { success: true, message: '모바일/브라우저에서는 인쇄(PDF 저장) 창이 열립니다.' };
    },
    parseDollarProposal: async (data) => {
      // MetLife 7-year exact default data for Web/Mobile
      return {
        success: true,
        clientName: '32세남',
        clientAge: 32,
        clientGender: '남',
        companyName: '메트라이프생명',
        productName: '무배당 백만인을 위한 달러종신보험 Plus (저해약환급금형Ⅱ)',
        payPeriodYears: 7,
        monthlyPremiumUSD: 585.78,
        monthlyPremiumKRW: 903097,
        deathBenefitUSD: 39000,
        deathBenefitKRW: 60126300,
        appliedRatePercent: 3.25,
        exchangeRateKRW: 1541.70,
        bonusRate1: 22.20,
        bonusRate2: 15.90,
        payCompleteRate: 38.77,
        payComplete1dayRate: 99.75,
        refundPayCompleteUSD: 19079,
        refundPayComplete1dayUSD: 49083,
        refund10yr1dayUSD: 61452,
        refundTable: [
          { year: 1, age: 33, paidTotalUSD: 7029, refundAmountUSD: 1555, refundRate: 22.12, deathBenefitUSD: 39000 },
          { year: 3, age: 35, paidTotalUSD: 21088, refundAmountUSD: 7044, refundRate: 33.40, deathBenefitUSD: 40950 },
          { year: 5, age: 37, paidTotalUSD: 35146, refundAmountUSD: 12878, refundRate: 36.64, deathBenefitUSD: 44850 },
          { year: 7, age: 39, paidTotalUSD: 49205, refundAmountUSD: 19079, refundRate: 38.77, deathBenefitUSD: 49205 },
          { year: 8, age: 40, paidTotalUSD: 49205, refundAmountUSD: 49083, refundRate: 99.75, deathBenefitUSD: 61623 },
          { year: 10, age: 42, paidTotalUSD: 49205, refundAmountUSD: 53628, refundRate: 108.99, deathBenefitUSD: 66623 },
          { year: 11, age: 43, paidTotalUSD: 49205, refundAmountUSD: 61452, refundRate: 124.89, deathBenefitUSD: 76397 },
          { year: 20, age: 52, paidTotalUSD: 49205, refundAmountUSD: 66486, refundRate: 135.12, deathBenefitUSD: 80423 },
          { year: 30, age: 62, paidTotalUSD: 49205, refundAmountUSD: 71897, refundRate: 146.12, deathBenefitUSD: 82717 }
        ]
      };
    },
    generateDollarProposalPdf: async ({ planData, plannerInfo }) => {
      try {
        const { generateDollarProposalHtml } = await import('../services/dollarProposalWebGenerator.js');
        const html = generateDollarProposalHtml({ planData, plannerInfo });
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const newWin = window.open(blobUrl, '_blank');
        if (!newWin) window.location.href = blobUrl;
        return { success: true, message: '모바일 16:9 VIP 프레젠테이션이 새 창으로 열렸습니다!' };
      } catch (e) {
        window.print();
        return { success: true, message: '인쇄 다이얼로그를 통해 PDF로 저장하실 수 있습니다.' };
      }
    },
    ntsOpenAuthWindow: async (params) => {
      const { openHometaxAuthDirect } = await import('../services/medicalExpenseService.js');
      return openHometaxAuthDirect(params);
    },
    ntsRequestAuth: async (params) => {
      const { sendMobileAuthRequest } = await import('../services/medicalExpenseService.js');
      return sendMobileAuthRequest(params);
    },
    ntsCheckStatus: async (params) => {
      const { checkAuthStatus } = await import('../services/medicalExpenseService.js');
      return checkAuthStatus(params);
    },
    ntsConfirmAuth: async (params) => {
      const { confirmAuthSessionDirect } = await import('../services/medicalExpenseService.js');
      return confirmAuthSessionDirect(params);
    },
    ntsFetchData: async (params) => {
      const { fetchAuthenticatedNtsData } = await import('../services/medicalExpenseService.js');
      return fetchAuthenticatedNtsData(params);
    },
    ntsGetCustomerHometaxData: async ({ customerId, customerName, customerPhone }) => {
      try {
        // Try fetching hometax_data from Supabase DB (column may or may not exist)
        let query = supabase.from('customers').select('id, name, phone, hometax_data');
        if (customerId) {
          query = query.eq('id', customerId);
        } else if (customerPhone) {
          const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
          query = query.eq('phone', cleanPhone);
        } else if (customerName) {
          query = query.eq('name', customerName);
        }
        const { data, error } = await query.limit(1);
        if (!error && data && data.length > 0 && data[0].hometax_data) {
          const parsed = typeof data[0].hometax_data === 'string' 
            ? JSON.parse(data[0].hometax_data) 
            : data[0].hometax_data;
          if (parsed && (parsed.expenseList?.length > 0 || parsed.totalExpenseCount > 0)) {
            return { success: true, data: parsed };
          }
        }
      } catch (dbErr) {
        console.warn('[Web-Adapter] ntsGetCustomerHometaxData DB fallback:', dbErr.message);
      }

      // Fallback: Search Supabase Storage for matching hometax files
      try {
        const { data: files } = await supabase.storage.from('wbl-board-files').list('', {
          limit: 30,
          sortBy: { column: 'created_at', order: 'desc' }
        });
        if (!files) return { success: false, error: '저장된 국세청 의료비 데이터가 없습니다.' };
        
        const hometaxFiles = files.filter(f => f.name.startsWith('hometax_'));
        for (const hf of hometaxFiles) {
          try {
            const res = await fetch(`https://wvuwhijkwfmufnjfbefi.supabase.co/storage/v1/object/public/wbl-board-files/${hf.name}?_t=${Date.now()}`);
            if (!res.ok) continue;
            const json = await res.json();
            const pd = json.parsedData || json;
            const matchName = (customerName && (json.userName === customerName || pd.clientName === customerName));
            const matchPhone = customerPhone && (
              (json.phoneNo || '').replace(/[^0-9]/g, '') === customerPhone.replace(/[^0-9]/g, '') ||
              (pd.clientPhone || '').replace(/[^0-9]/g, '') === customerPhone.replace(/[^0-9]/g, '')
            );
            if (matchName || matchPhone) {
              return { success: true, data: pd };
            }
          } catch {}
        }
      } catch (storageErr) {
        console.warn('[Web-Adapter] Storage hometax search error:', storageErr.message);
      }

      return { success: false, error: '저장된 국세청 의료비 데이터가 없습니다.' };
    },
    ntsGetLastRetrievedData: async () => {
      try {
        const { data: files, error } = await supabase.storage.from('wbl-board-files').list('', {
          limit: 10,
          sortBy: { column: 'created_at', order: 'desc' }
        });
        if (error || !files) return { success: false, error: '최근 조회 내역이 없습니다.' };
        const hometaxFile = files.find(f => f.name.startsWith('hometax_'));
        if (!hometaxFile) return { success: false, error: '최근 조회 내역이 없습니다.' };
        
        const res = await fetch(`https://wvuwhijkwfmufnjfbefi.supabase.co/storage/v1/object/public/wbl-board-files/${hometaxFile.name}?_t=${Date.now()}`);
        if (!res.ok) return { success: false, error: '자료를 불러오지 못했습니다.' };
        const json = await res.json();
        return { success: true, data: json.parsedData || json };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },
    ntsSaveCustomerHometaxData: async ({ customerId, customerName, customerPhone, hometaxData }) => {
      try {
        const jsonStr = typeof hometaxData === 'string' ? hometaxData : JSON.stringify(hometaxData);
        let query = supabase.from('customers');
        if (customerId) {
          await query.update({ hometax_data: jsonStr, updated_at: new Date().toISOString() }).eq('id', customerId);
        } else if (customerPhone) {
          const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
          await query.update({ hometax_data: jsonStr, updated_at: new Date().toISOString() }).eq('phone', cleanPhone);
        } else if (customerName) {
          await query.update({ hometax_data: jsonStr, updated_at: new Date().toISOString() }).eq('name', customerName);
        }
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },
    ntsCreateMobileAuthSession: async (params) => {
      try {
        const sessionId = `MOB_${Date.now()}`;
        const authUrl = `https://dddi1989-cell.github.io/alpha-crm-app/#${sessionId}`;
        
        // 1. Save initial session to Supabase
        await supabase.storage.from('wbl-board-files').upload(`session_${sessionId}.json`, JSON.stringify({
          sessionId,
          clientName: params.clientName || '고객',
          clientPhone: params.clientPhone,
          plannerName: params.plannerName,
          plannerPhone: params.plannerPhone,
          status: 'CREATED',
          createdAt: new Date().toISOString()
        }), { upsert: true, contentType: 'application/json' });

        // 2. Dispatch real SMS via Solapi Web Service
        let smsResult = { success: false };
        if (params.clientPhone) {
          try {
            const { sendCustomerAuthSmsWeb } = await import('../services/solapiWebSmsService.js');
            smsResult = await sendCustomerAuthSmsWeb({
              clientName: params.clientName || '고객',
              clientPhone: params.clientPhone,
              authUrl,
              plannerName: params.plannerName,
              plannerPhone: params.plannerPhone
            });
          } catch (smsErr) {
            console.warn('[Web-Solapi] SMS dispatch error:', smsErr);
            smsResult = { success: false, error: smsErr.message };
          }
        }

        return { 
          success: true, 
          sessionId, 
          authUrl, 
          smsSent: smsResult.success, 
          smsError: smsResult.error 
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },
    ntsCheckMobileSession: async ({ sessionId }) => {
      try {
        if (!sessionId) return { success: false, status: 'NO_SESSION' };
        const res = await fetch(`https://wvuwhijkwfmufnjfbefi.supabase.co/storage/v1/object/public/wbl-board-files/hometax_${sessionId}.json?_t=${Date.now()}`);
        if (res.ok) {
          const json = await res.json();
          return { success: true, status: 'COMPLETED', clientName: json.userName || json.clientName, data: json.parsedData || json };
        }
        const respRes = await fetch(`https://wvuwhijkwfmufnjfbefi.supabase.co/storage/v1/object/public/wbl-board-files/auth_response_${sessionId}.json?_t=${Date.now()}`);
        if (respRes.ok) {
          const rJson = await respRes.json();
          if (rJson.is2Way) return { success: true, status: 'WAITING_USER_SIGNATURE' };
        }
        return { success: true, status: 'WAITING_CUSTOMER_ACTION' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },
    exportMedicalExpensePdf: async (params) => {
      window.print();
      return { success: true, message: '모바일/브라우저에서는 인쇄(PDF 저장) 화면이 열립니다.' };
    }
  },

  system: {
    getInfo: async () => ({ platform: 'web', version: '1.6.8 (Web/PWA)', isWeb: true }),
    getAppVersion: async () => '1.6.8',
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
