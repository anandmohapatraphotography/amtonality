/* Cloudflare Pages Function — catches EVERY request. For static assets it
   passes straight through to the file. For SPA routes it fetches index.html
   and rewrites the meta tags per URL so link-preview services (iMessage,
   WhatsApp, Twitter, LinkedIn) show the album's cover + title + statement,
   not the default homepage preview. */

const HOME_IMG = 'https://pub-c5c6ce447a9d43b9b89788a2510fbbac.r2.dev/photos/architecture/000.jpg';
const BASE_TITLE = 'Tonality — Anand Mohapatra | Architecture Photography, Vancouver';
const BASE_DESC  = 'Tonality — architecture and interiors photography studio by Anand Mohapatra, Vancouver.';

const STATIC_RE = /\.(?:css|js|mjs|jpe?g|png|webp|svg|gif|ico|json|xml|txt|map|woff2?|ttf|otf|pdf|mp4|webm|avif)$/i;
const PASSTHROUGH_PREFIXES = ['/photos/', '/admin', '/api/', '/_'];

function isAsset(path) {
  if (STATIC_RE.test(path)) return true;
  if (PASSTHROUGH_PREFIXES.some(p => path.startsWith(p))) return true;
  return false;
}

function seoFor(path, content) {
  if (path.startsWith('/p/')) {
    const slug = path.slice(3).replace(/\/$/,'');
    const proj = content?.projects?.[slug];
    if (proj) {
      const title = (proj.title || slug) + ' — Tonality';
      const desc  = String(proj.statement || '').replace(/\s+/g,' ').trim().slice(0, 200);
      return { title, description: desc || BASE_DESC, image: proj.cover || HOME_IMG, url: 'https://amtonality.com' + path };
    }
  }
  const map = {
    '/':             { t: BASE_TITLE, d: BASE_DESC },
    '/architecture': { t: 'Architecture — Tonality', d: 'Architectural and interiors photography portfolio by Anand Mohapatra, Vancouver.' },
    '/explorations': { t: 'Explorations — Tonality', d: 'Travel, music, portraits, and personal photography projects by Anand Mohapatra.' },
    '/about':        { t: 'About — Tonality', d: 'Anand Mohapatra is a South Asian-origin photographer specialising in architecture, based in Vancouver, Canada.' },
    '/contact':      { t: 'Contact — Tonality', d: 'Get in touch with Anand Mohapatra for architectural and interior photography commissions.' }
  };
  const preset = map[path] || map['/'];
  return { title: preset.t, description: preset.d, image: HOME_IMG, url: 'https://amtonality.com' + path };
}

export const onRequest = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  /* Static files / functions / admin — hand back to the assets pipeline. */
  if (path === '/' + '' || isAsset(path)) {
    if (path !== '/') return env.ASSETS.fetch(request);
  }

  /* Fetch the base HTML shell and the live content.json in parallel. */
  const htmlUrl = new URL(url); htmlUrl.pathname = '/index.html';
  const [htmlRes, contentRes] = await Promise.all([
    env.ASSETS.fetch(new Request(htmlUrl.toString(), request)),
    env.ASSETS.fetch(new URL('/content.json', url).toString()).catch(() => null)
  ]);

  let content = {};
  if (contentRes && contentRes.ok) {
    try { content = await contentRes.json(); } catch (_) { content = {}; }
  }
  const seo = seoFor(path, content);

  /* Stream-rewrite the meta tags in place. */
  const setContent = value => ({ element(el) { el.setAttribute('content', value); } });
  return new HTMLRewriter()
    .on('title',                            { element(el) { el.setInnerContent(seo.title); } })
    .on('meta[name="description"]',         setContent(seo.description))
    .on('meta[property="og:title"]',        setContent(seo.title))
    .on('meta[property="og:description"]',  setContent(seo.description))
    .on('meta[property="og:image"]',        setContent(seo.image))
    .on('meta[property="og:url"]',          setContent(seo.url))
    .on('meta[name="twitter:title"]',       setContent(seo.title))
    .on('meta[name="twitter:description"]', setContent(seo.description))
    .on('meta[name="twitter:image"]',       setContent(seo.image))
    .on('link[rel="canonical"]',            { element(el) { el.setAttribute('href', seo.url); } })
    .transform(htmlRes);
};
