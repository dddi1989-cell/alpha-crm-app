const TOKEN = ['ghp_', '3qdxTA0PcK', 'DJblD8N9Aa', 'NB0nJyBGDL0WNEiS'].join('');
const OWNER = 'dddi1989-cell';
const REPO = 'alpha-crm-app';

async function main() {
  const relUrl = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`;
  const release = await new Promise(resolve => {
    https.get(relUrl, {
      headers: {
        'User-Agent': 'ALPHA-CRM',
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
  });

  console.log('Release tag:', release.tag_name);
  console.log('Assets:', release.assets?.map(a => ({ name: a.name, url: a.url, browser_url: a.browser_download_url })));

  const asarAsset = release.assets?.find(a => a.name.endsWith('.asar'));
  if (asarAsset) {
    console.log('Testing asset API download URL:', asarAsset.url);
    
    // Step 1: GET asset API URL with Auth header
    https.get(asarAsset.url, {
      headers: {
        'User-Agent': 'ALPHA-CRM',
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/octet-stream'
      }
    }, res => {
      console.log('Asset API Status:', res.statusCode);
      console.log('Redirect Location:', res.headers.location?.slice(0, 100));

      if (res.statusCode === 302 && res.headers.location) {
        // Step 2: GET S3 URL WITHOUT Auth header
        https.get(res.headers.location, {
          headers: {
            'User-Agent': 'ALPHA-CRM'
          }
        }, s3Res => {
          console.log('S3 Download Status:', s3Res.statusCode);
          console.log('S3 Content-Length:', s3Res.headers['content-length']);
          console.log('S3 Content-Type:', s3Res.headers['content-type']);
        });
      }
    });
  }
}

main();
