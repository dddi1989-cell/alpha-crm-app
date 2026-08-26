const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = 'ghp_MASKED';
const OWNER = 'dddi1989-cell';
const REPO = 'alpha-crm-app';

function ghRequest(urlPath, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: urlPath,
      method,
      headers: {
        'User-Agent': 'ALPHA-CRM-Canary',
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data || '{}') }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== Pushing Canary update_manifest.json to GitHub main branch ===');
  const manifestPath = path.join(__dirname, '..', 'update_manifest.json');
  const contentStr = fs.readFileSync(manifestPath, 'utf8');
  const contentBase64 = Buffer.from(contentStr).toString('base64');

  const curFile = await ghRequest(`/repos/${OWNER}/${REPO}/contents/update_manifest.json`);
  const sha = curFile.status === 200 ? curFile.data.sha : null;

  const body = JSON.stringify({
    message: 'Configure canary channels: Admin test v1.5.4 vs Production stable v1.5.3',
    content: contentBase64,
    sha: sha || undefined,
    branch: 'main'
  });

  const res = await ghRequest(`/repos/${OWNER}/${REPO}/contents/update_manifest.json`, 'PUT', body);
  console.log(`Manifest push result: ${res.status}`);
}

main().catch(console.error);
