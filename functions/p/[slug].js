/* Album page middleware — rewrites meta tags in index.html so link previews
   (iMessage, WhatsApp, Twitter, LinkedIn) show the album's cover + title +
   statement instead of the default homepage preview. */

const HOME_IMG = 'https://pub-c5c6ce447a9d43b9b89788a2510fbbac.r2.dev/photos/architecture/000.jpg';

/* Public page names that differ from the album id in content.json. Must match
   URL_NAME in index.html. The old address redirects to the new one. */
const URL_NAME = { residential: 'interiors' };
const ID_FOR = Object.fromEntries(Object.entries(URL_NAME).map(([id, name]) => [name, id]));

export const onRequest = async (context) => {
  const { request, env, params } = context;
  const slug = String(params.slug || '').replace(/\/$/, '');
  const url = new URL(request.url);

  if (URL_NAME[slug]) return Response.redirect(new URL('/p/' + URL_NAME[slug], url).toString(), 301);
  const id = ID_FOR[slug] || slug;

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
      proj = c?.projects?.[id] || null;
    } catch (_) {}
  }

  if (!proj) return htmlRes;                                            // unknown slug → default preview

  const title = (proj.title || id) + ' — Tonality';
  const desc  = String(proj.statement || '').replace(/\s+/g,' ').trim().slice(0, 200) || 'Photography by Anand Mohapatra.';
  /* Prefer the explicit cover override, otherwise the album's first photo,
     otherwise the site-wide default. */
  const image = proj.cover
              || (Array.isArray(proj.photos) && proj.photos[0] && proj.photos[0].u)
              || HOME_IMG;
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
