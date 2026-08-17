/* Cloudflare Pages Function — receives a photo from the editor, verifies the
   caller's GitHub token has push access to the repo, then PUTs the file into
   the R2 bucket bound as `PHOTOS`. Public URL is served from the r2.dev
   subdomain configured on the bucket. */

const REPO = 'anandmohapatraphotography/amtonality';
const PUB_URL = 'https://pub-c5c6ce447a9d43b9b89788a2510fbbac.r2.dev';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Filename',
  'Access-Control-Max-Age': '86400'
};

const json = (o, status = 200) => new Response(JSON.stringify(o), {
  status,
  headers: { 'Content-Type': 'application/json', ...cors }
});

export const onRequestOptions = () => new Response(null, { headers: cors });

export async function onRequestPost({ request, env }) {
  const auth = request.headers.get('Authorization') || '';
  const m = auth.match(/^(?:token|Bearer)\s+(\S+)$/i);
  if (!m) return json({ error: 'missing token' }, 401);
  const pat = m[1];

  /* Verify token by asking GitHub what the repo permissions are — cheap round
     trip, and catches revoked/expired tokens before we spend R2 writes. */
  const check = await fetch(`https://api.github.com/repos/${REPO}`, {
    headers: {
      Authorization: `token ${pat}`,
      'User-Agent': 'amtonality-editor',
      Accept: 'application/vnd.github+json'
    }
  });
  if (!check.ok) return json({ error: 'invalid token' }, 401);
  const info = await check.json();
  if (!info.permissions || !info.permissions.push) {
    return json({ error: 'token lacks push access' }, 403);
  }

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key || !/^[a-zA-Z0-9._/-]+$/.test(key) || key.includes('..')) {
    return json({ error: 'invalid key' }, 400);
  }

  await env.PHOTOS.put(key, request.body, {
    httpMetadata: {
      contentType: request.headers.get('Content-Type') || 'application/octet-stream'
    }
  });

  return json({ ok: true, url: `${PUB_URL}/${key}`, key });
}
