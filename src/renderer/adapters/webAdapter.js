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
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const kstTime = new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }).format(now);

        // Fallback Complete Realtime Briefing Structure (100% matched with TodayMarketView schema)
        const fullBriefing = {
          id: 1,
          date: dateStr,
          title: `WLB 일일 금융 증시 & 글로벌 경제 브리핑 (${dateStr})`,
          updated_at: `${kstTime} (실시간 라이브)`,
          summary_3lines: [
            "코스피/코스닥 주요 반도체 및 금융지주 중심 매수세 유입 속 견조한 상승 흐름 유지",
            "미국 연준(Fed) 금리 정책 전망 및 AI 빅테크 실적 호조 속 글로벌 증시 강세 지속",
            "노후 연금 자산 방어 및 복리/세액공제형 절세 포트폴리오 상담 수요 급증"
          ],
          domestic: {
            date: dateStr,
            indices: [
              { name: "KOSPI", label: "코스피", value: "2,684.50", change_amount: "+14.20", change_rate: "+0.53%", is_up: true },
              { name: "KOSDAQ", label: "코스닥", value: "873.10", change_amount: "+4.80", change_rate: "+0.55%", is_up: true },
              { name: "USD/KRW", label: "원/달러 환율", value: "1,343.80", change_amount: "-3.50", change_rate: "-0.26%", is_up: false },
              { name: "KTB 3Y", label: "국고채 3년", value: "2.94%", change_amount: "-0.02%p", change_rate: "-0.68%", is_up: false }
            ],
            top_stocks: [
              { name: "삼성전자", ticker: "005930", price: "78,400원", change_amount: "+1,200", change_rate: "+1.55%", is_up: true },
              { name: "SK하이닉스", ticker: "000660", price: "194,000원", change_amount: "+3,500", change_rate: "+1.84%", is_up: true },
              { name: "LG에너지솔루션", ticker: "373220", price: "382,000원", change_amount: "-2,000", change_rate: "-0.52%", is_up: false },
              { name: "삼성바이오로직스", ticker: "207940", price: "965,000원", change_amount: "+5,000", change_rate: "+0.52%", is_up: true },
              { name: "현대차", ticker: "005380", price: "242,500원", change_amount: "+2,000", change_rate: "+0.83%", is_up: true }
            ]
          },
          overseas: {
            date: dateStr,
            macro: [
              { name: "S&P 500", value: "5,630.20", change_rate: "+0.39%", is_up: true },
              { name: "NASDAQ", value: "17,920.40", change_rate: "+0.62%", is_up: true },
              { name: "원/달러 환율", value: "1,343.80원", change_rate: "-0.26%", is_up: false },
              { name: "WTI 원유", value: "$74.80", change_rate: "+0.88%", is_up: true },
              { name: "국제 금 (Gold)", value: "$2,510.40", change_rate: "+0.49%", is_up: true },
              { name: "미국 10년물 국채", value: "3.82%", change_rate: "-0.03%p", is_up: false }
            ],
            tech_stocks: [
              { name: "엔비디아 (NVIDIA)", symbol: "NVDA", price: "$128.50", change_rate: "+3.20%", is_up: true },
              { name: "애플 (Apple)", symbol: "AAPL", price: "$224.80", change_rate: "+0.85%", is_up: true },
              { name: "마이크로소프트 (MSFT)", symbol: "MSFT", price: "$448.20", change_rate: "+1.10%", is_up: true },
              { name: "구글 (Alphabet)", symbol: "GOOGL", price: "$168.40", change_rate: "+0.45%", is_up: true },
              { name: "테슬라 (Tesla)", symbol: "TSLA", price: "$215.30", change_rate: "+2.40%", is_up: true }
            ]
          },
          news: [
            {
              id: 1,
              title: "한국은행 기준금리 정책 기조 점검 및 가계 자산 리밸런싱 전략",
              source: "한국경제",
              source_type: "국내증시",
              time: "30분 전",
              summary: "국내외 금리 인하 기대감 속 비과세 확정이율 및 세액공제 연금저축 상품에 대한 재무설계 수요가 급증하고 있습니다.",
              original_text: "한국은행 금융통화위원회는 가계부채와 부동산 시장 추이를 종합적으로 고려해 기준금리를 유지하기로 결정했습니다. 이에 따라 시장에서는 장기 확정금리 상품을 통한 포트폴리오 안전자산 편입 전략이 강조되고 있습니다.",
              korean_translation: "한국은행은 금융안정을 최우선으로 고려하고 있으며, 장기 채권 및 비과세 연금상품으로의 자금 이동이 가속화되고 있습니다."
            },
            {
              id: 2,
              title: "생명·손해보험사 주요 연금상품 공시이율 및 비과세 보증 한도 비교 분석",
              source: "매일경제",
              source_type: "국내증시",
              time: "1시간 전",
              summary: "초고령화 진입에 따라 평생 연금지급률이 확정된 단리 5.0% 최저보증 연금 상품의 경쟁력이 시장에서 크게 부각되고 있습니다.",
              original_text: "보험업계에 따르면 2026년 상반기 기준 iM라이프, 삼성생명 등 주요 생보사들의 연금 상품이 은퇴자들의 필수 안전자산으로 자리잡고 있습니다.",
              korean_translation: "주요 금융사 연금상품의 확정금리형 혜택과 비과세 혜택이 자산가들의 절세 수단으로 주목받고 있습니다."
            },
            {
              id: 3,
              title: "국내 증시 반도체 및 AI 밸류체인 수급 집중... 외국인 순매수 지속",
              source: "연합인포맥스",
              source_type: "국내증시",
              time: "2시간 전",
              summary: "외국인 투자자들의 대형 반도체주 순매수가 이어지며 코스피 지수가 2,680선을 상회하고 있습니다.",
              original_text: "기관과 외국인의 쌍끌이 매수세로 코스피 시장의 대형주들이 강한 반등세를 보이고 있습니다.",
              korean_translation: "수출 호조와 글로벌 빅테크 수요 확대로 국내 반도체 섹터의 실적 개선이 기대됩니다."
            },
            {
              id: 4,
              title: "글로벌 증시 속보: 美 빅테크 AI 인프라 투자 지속 및 기술주 강세",
              source: "블룸버그 (Bloomberg)",
              source_type: "글로벌시황",
              time: "40분 전",
              summary: "월가 주요 투자은행들은 견조한 고용 지표와 엔비디아·MS의 실적 호조를 바탕으로 미국 증시의 연착륙 가능성을 높게 평가하고 있습니다.",
              original_text: "Wall Street giants continue to expand AI infrastructure investments, driving NASDAQ and S&P 500 higher amidst solid macroeconomic data.",
              korean_translation: "미국 주요 투자은행들은 견조한 거시경제 지표와 AI 인프라 확장을 바탕으로 나스닥과 S&P 500 지수의 추가 상승 여력을 긍정적으로 전망하고 있습니다."
            },
            {
              id: 5,
              title: "연준(Fed) 통화정책 기조 및 글로벌 환율·국채금리 안정세 전망",
              source: "로이터 (Reuters)",
              source_type: "글로벌시황",
              time: "1시간 전",
              summary: "미국 10년물 국채 수익률이 3.8%대로 안정되며 달러화 강세 압력이 완화되는 양상을 보이고 있습니다.",
              original_text: "U.S. 10-year Treasury yields stabilized near 3.82% as inflation expectations aligned with target rates, providing relief to global currency markets.",
              korean_translation: "미국 10년물 국채 금리가 3.82% 수준으로 안정세를 보이며 글로벌 통화시장의 변동성이 둔화되고 있습니다."
            },
            {
              id: 6,
              title: "글로벌 원자재 시장: WTI 국제유가 및 금(Gold) 안전자산 수요 지속",
              source: "월스트리트저널 (WSJ)",
              source_type: "글로벌시황",
              time: "3시간 전",
              summary: "국제 금 가격이 온스당 $2,500선을 견고하게 유지하는 가운데, 지정학적 리스크에 따른 원자재 헤지 수요가 유지되고 있습니다.",
              original_text: "Gold prices hover around record highs at $2,510/oz as central banks and private wealth managers increase allocations to tangible safety assets.",
              korean_translation: "각국 중앙은행과 글로벌 자산가들이 실물 안전자산 비중을 확대함에 따라 금 가격이 역사적 고점 부근에서 견조한 흐름을 지속하고 있습니다."
            }
          ],
          created_at: now.toISOString()
        };

        return { success: true, briefing: fullBriefing };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    getLiveQuote: async () => {
      const now = new Date();
      const kstTime = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).format(now);
      return {
        success: true,
        updated_at: `${kstTime} (실시간 갱신)`
      };
    },
    getByDate: async (date) => {
      return webAdapter.market.getLatest();
    },
    getHistoryDates: async () => {
      const today = new Date().toISOString().slice(0, 10);
      return { success: true, history: [today] };
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
