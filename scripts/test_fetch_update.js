const https = require('https');

const ghConfig = {
  owner: 'dddi1989-cell',
  repo: 'alpha-crm-app',
  branch: 'main',
  token: 'ghp_MASKED'
};

const fetchJson = (url) => new Promise((resolve, reject) => {
  const headers = { 'User-Agent': 'ALPHA-CRM-App-Updater' };
  if (ghConfig.token) {
    headers['Authorization'] = `token ${ghConfig.token}`;
    headers['Accept'] = 'application/vnd.github.v3+json';
  }
  const req = https.get(url, { headers }, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      return fetchJson(res.headers.location).then(resolve).catch(reject);
    }
    if (res.statusCode !== 200) {
      return reject(new Error(`HTTP Status ${res.statusCode}`));
    }
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
  });
  req.on('error', reject);
});

async function test() {
  console.log('Testing GitHub Raw Manifest query...');
  const manifestUrl = `https://raw.githubusercontent.com/${ghConfig.owner}/${ghConfig.repo}/${ghConfig.branch}/update_manifest.json?t=${Date.now()}`;
  const manifest = await fetchJson(manifestUrl);
  console.log('Manifest result:', manifest);

  const currentVersion = '1.5.2';
  const parseSemver = (v) => v.split('.').map(Number);
  const isNewerSemver = (lat, cur) => {
    const latV = parseSemver(lat);
    const curV = parseSemver(cur);
    for (let i = 0; i < Math.max(curV.length, latV.length); i++) {
      const c = curV[i] || 0;
      const l = latV[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }
    return false;
  };

  const isNewer = isNewerSemver(manifest.latestVersion, currentVersion);
  console.log(`Comparison: server(${manifest.latestVersion}) > current(${currentVersion}) => updateAvailable: ${isNewer}`);
}

test().catch(console.error);
