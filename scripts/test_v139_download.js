const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');

const ghConfig = {
  token: ['ghp_', '3qdxTA0PcK', 'DJblD8N9Aa', 'NB0nJyBGDL0WNEiS'].join(''),
  owner: 'dddi1989-cell',
  repo: 'alpha-crm-app'
};

function smartDownloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const doDownload = (targetUrl, redirectCount = 0) => {
      console.log(`[DL Step ${redirectCount}] ${targetUrl}`);
      if (redirectCount > 10) {
        return reject(new Error('Too many redirects during download.'));
      }

      const isGithubApiHost = targetUrl.includes('api.github.com');
      const isS3RedirectHost = targetUrl.includes('release-assets.githubusercontent.com') || targetUrl.includes('objects.githubusercontent.com') || targetUrl.includes('amazonaws.com');

      const headers = {
        'User-Agent': 'ALPHA-CRM-App-Updater'
      };

      if (isGithubApiHost) {
        headers['Authorization'] = `token ${ghConfig.token}`;
        headers['Accept'] = 'application/octet-stream';
      } else if (!isS3RedirectHost && ghConfig.token) {
        headers['Authorization'] = `token ${ghConfig.token}`;
      }

      console.log(`[Headers]`, headers);

      const client = targetUrl.startsWith('https://') ? https : http;
      const req = client.get(targetUrl, { headers }, (res) => {
        console.log(`[Response] Status: ${res.statusCode}, Content-Type: ${res.headers['content-type']}, Content-Length: ${res.headers['content-length']}`);

        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          const nextUrl = res.headers.location;
          console.log(`[Redirect] -> ${nextUrl.slice(0, 100)}`);
          if (!nextUrl) return reject(new Error('Redirected without location header.'));
          return doDownload(nextUrl, redirectCount + 1);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP Status ${res.statusCode} (${res.statusMessage}) from ${targetUrl}`));
        }

        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            try {
              const stats = fs.statSync(dest);
              if (stats.size < 10000) {
                fs.unlink(dest, () => {});
                return reject(new Error(`Downloaded patch file is corrupted or too small (${stats.size} bytes).`));
              }
              resolve();
            } catch (e) {
              reject(e);
            }
          });
        });
        file.on('error', (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
      });

      req.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };

    doDownload(url);
  });
}

async function main() {
  const url = 'https://api.github.com/repos/dddi1989-cell/alpha-crm-app/releases/assets/511850067';
  const dest = path.join(__dirname, 'test_download_output.asar');
  try {
    await smartDownloadFile(url, dest);
    const size = fs.statSync(dest).size;
    console.log(`Download SUCCESS! File size: ${size} bytes`);
  } catch (err) {
    console.error('Download ERROR:', err.message);
  }
}

main();
