/* Album page middleware — rewrites meta tags in index.html so link previews
   (iMessage, WhatsApp, Twitter, LinkedIn) show the album's cover + title +
   statement instead of the default homepage preview. */

const HOME_IMG = 'https://pub-c5c6ce447a9d43b9b89788a2510fbbac.r2.dev/photos/architecture/000.jpg';

export const onRequest = async (context) => {
  const { request, env, params } = context;
  const slug = String(params.slug || '').replace(/\/$/, '');
  const url = new URL(request.url);

  const setContent = value => ({ element(el) { el.setAttribute('content', value); } });

  /* Load the base HTML and the live content.json in parallel. */
  const [htmlRes, contentRes] = await Promise.all([
    env.ASSETS.fetch(new URL('/index.html', url).toString()),
    env.ASSETS.fetch(new URL('/content.json', url).toString()).catch(() => null)
  ]);

  let proj = null;
  if (contentRes && contentRes.ok) {
    try {
      const c = await contentRes.json();
      proj = c?.projects?.[slug] || null;
    } catch (_) {}
  }

  if (!proj) return htmlRes;                                            // unknown slug → default preview

  const title = (proj.title || slug) + ' — Tonality';
  const desc  = String(proj.statement || '').replace(/\s+/g,' ').trim().slice(0, 200) || 'Photography by Anand Mohapatra.';
  const image = proj.cover || HOME_IMG;
  const canon = 'https://amtonality.com/p/' + slug;

  return new HTMLRewriter()
    .on('title',                            { element(el) { el.setInnerContent(title); } })
    .on('meta[name="description"]',         setContent(desc))
    .on('meta[property="og:title"]',        setContent(title))
    .on('meta[property="og:description"]',  setContent(desc))
    .on('meta[property="og:image"]',        setContent(image))
    .on('meta[property="og:url"]',          setContent(canon))
    .on('meta[name="twitter:title"]',       setContent(title))
    .on('meta[name="twitter:description"]', setContent(desc))
    .on('meta[name="twitter:image"]',       setContent(image))
    .on('link[rel="canonical"]',            { element(el) { el.setAttribute('href', canon); } })
    .transform(new Response(htmlRes.body, htmlRes));
};
