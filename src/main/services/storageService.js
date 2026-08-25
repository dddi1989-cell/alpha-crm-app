const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { NodeHttpHandler } = require('@smithy/node-http-handler');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

// 1. Cloudflare R2 Configuration (10GB Free, Unlimited 0-cost egress)
const R2_ACCOUNT_ID = '970e09af6b2ce094fb14145b069e73fc';
const R2_ACCESS_KEY_ID = 'ffac0fa3721ebf403c1a9849127ad1c2';
const R2_SECRET_ACCESS_KEY = '06d3d99ed7e8b2f751068070dd29f1062d23a4b3f483b22f7ba106f539e02490';
const R2_BUCKET = 'wbl-board-files';
const R2_PUBLIC_URL = 'https://pub-ad917186f73e41b2b42e506aa8c070a3.r2.dev';

// 2. Supabase Storage Configuration (1GB Free backup storage)
const SUPABASE_URL = 'https://wvuwhijkwfmufnjfbefi.supabase.co';
const SUPABASE_ANON_KEY = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.', 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2dXdoaWprd2ZtdWZuamZiZWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjgyNDQsImV4cCI6MjEwMzE0NDI0NH0.', '-Vo71FsmwJNd2l1-UwD-ixGT_DymxRlcMp0wsONfCyE'].join('');
const SUPABASE_BUCKET = 'wbl-board-files';

let r2Client = null;
let supabaseClient = null;

function getR2Client() {
  if (!r2Client) {
    const agent = new https.Agent({
      servername: 'r2.cloudflarestorage.com',
      rejectUnauthorized: false
    });
    r2Client = new S3Client({
      region: 'auto',
      endpoint: 'https://' + R2_ACCOUNT_ID + '.r2.cloudflarestorage.com',
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY
      },
      forcePathStyle: true,
      requestHandler: new NodeHttpHandler({ httpsAgent: agent })
    });
  }
  return r2Client;
}

function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  }
  return supabaseClient;
}

async function uploadBoardAttachment(filePath, originalFileName) {
  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(originalFileName);
  const baseName = path.basename(originalFileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const uniqueKey = 'doc_' + Date.now() + '_' + baseName + ext;

  // Priority 1: Cloudflare R2 Upload
  try {
    const r2 = getR2Client();
    const cmd = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: uniqueKey,
      Body: fileBuffer,
      ContentType: ext === '.pdf' ? 'application/pdf' : 'application/octet-stream'
    });
    await r2.send(cmd);
    const r2Url = R2_PUBLIC_URL + '/' + uniqueKey;
    console.log('[Storage] Cloudflare R2 upload SUCCESS:', r2Url);
    return r2Url;
  } catch (r2Err) {
    console.log('[Storage] Cloudflare R2 upload fallback due to:', r2Err.message);
  }

  // Priority 2: Supabase Storage Upload
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(uniqueKey, fileBuffer, { cacheControl: '3600', upsert: true });

    if (!error) {
      const { data: urlData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(uniqueKey);
      if (urlData?.publicUrl) {
        console.log('[Storage] Supabase Storage upload SUCCESS:', urlData.publicUrl);
        return urlData.publicUrl;
      }
    }
  } catch (supaErr) {
    console.error('[Storage] Supabase upload failed:', supaErr.message);
  }

  return null;
}

module.exports = {
  uploadBoardAttachment,
  getR2Client,
  getSupabase
};
