/**
 * WeboldaltMost blog – Astro integráció (astro.config.mjs). A build VÉGÉN, a kész dist mappába ír:
 *
 *   _redirects           a megváltozott cikk-címek 301-es átirányításai (a meglévő _redirects megmarad)
 *   wm-indexnow.txt      az IndexNow kulcs (Bing, Yandex… – a platform szól nekik az új cikkekről)
 *   blog/{cikk}.md       minden cikk Markdownban (az MI-keresők szívesen olvassák)
 *   blog/rss.xml         RSS hírcsatorna
 *   llms.txt             a meglévőhöz hozzáírja a "Blog" részt (ha nincs, létrehoz egy egyszerűt)
 *   llms-full.txt        az összes cikk teljes szövege egy fájlban
 *
 *   import sitemap from '@astrojs/sitemap';
 *   import { wmBlog, blogSitemap } from '@weboldaltmost/astro-kit/integration';
 *   import { WM_SITE } from './src/wm.config';
 *
 *   export default defineConfig({
 *     site: 'https://kovacsfestes.hu',
 *     integrations: [sitemap(await blogSitemap(WM_SITE)), wmBlog({ site: WM_SITE })],
 *   });
 *
 * Sima JavaScript (nem TypeScript), mert az astro.config.mjs a node_modules-ból közvetlenül tölti be.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DEFAULT_API = 'https://app.weboldaltmost.hu';
const START = '<!-- wm-blog:start -->';
const END = '<!-- wm-blog:end -->';
const cache = new Map();

/** A blog adatai (ugyanaz, mint a blog.ts getBlog()) – egy buildben egyszer */
export function fetchBlog(site, apiUrl = process.env.PUBLIC_WM_API_URL || DEFAULT_API) {
  const key = `${apiUrl}|${site}`;
  if (!cache.has(key)) {
    cache.set(key, (async () => {
      const url = `${apiUrl.replace(/\/$/, '')}/api/v1/blog/${encodeURIComponent(site)}`;
      let last = '';
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await fetch(url, { headers: { Accept: 'application/json' } });
          if (res.ok) return await res.json();
          last = `HTTP ${res.status}`;
          if (res.status === 404) break;
        } catch (error) {
          last = error?.message ?? String(error);
        }
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
      throw new Error(`[WeboldaltMost blog] Nem sikerült letölteni a blogot (${last}): ${url}`);
    })());
  }
  return cache.get(key);
}

/**
 * Az @astrojs/sitemap beállításai: a cikkek lastmod dátuma, és kimarad az előnézet, valamint a noindex cikkek.
 * További saját szűrő: blogSitemap(WM_SITE, { filter: (page) => !page.includes('/koszonjuk') })
 */
export async function blogSitemap(site, options = {}) {
  const blog = await fetchBlog(site, options.apiUrl);
  const lastmod = new Map();
  const hidden = new Set();

  for (const post of blog.posts ?? []) {
    if (post.noindex) hidden.add(post.url);
    else lastmod.set(post.url, post.updated_at || post.published_at);
  }
  const newest = (blog.posts ?? []).map((p) => p.updated_at || p.published_at).filter(Boolean).sort().pop();
  if (blog.blog?.url && newest) lastmod.set(blog.blog.url, newest);

  const norm = (url) => url.replace(/\/?$/, '/');
  const lastmodByUrl = new Map([...lastmod].map(([url, date]) => [norm(url), date]));
  const hiddenUrls = new Set([...hidden].map(norm));

  return {
    ...options,
    filter: (page) => !/\/elonezet\/?$/.test(new URL(page).pathname) && !hiddenUrls.has(norm(page)) && (options.filter ? options.filter(page) : true),
    serialize: async (item) => {
      const date = lastmodByUrl.get(norm(item.url));
      const result = date ? { ...item, lastmod: new Date(date).toISOString() } : item;
      return options.serialize ? options.serialize(result) : result;
    },
  };
}

/** Az integráció */
export function wmBlog({ site, apiUrl, llms = true, markdown = true, rss = true } = {}) {
  if (!site) throw new Error('[WeboldaltMost blog] wmBlog({ site }) – add meg a weboldal mérőkódját (src/wm.config.ts → WM_SITE).');

  return {
    name: 'weboldaltmost-blog',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const blog = await fetchBlog(site, apiUrl);
        const out = fileURLToPath(dir);
        const posts = (blog.posts ?? []).filter((p) => !p.noindex);
        const blogPath = (blog.blog?.path ?? '/blog/').replace(/^\/|\/$/g, '');

        // 1. Átirányítások (perjellel és nélküle is)
        const lines = (blog.redirects ?? []).flatMap(({ from, to }) => {
          const target = to.endsWith('/') ? to : `${to}/`;
          return [`${from} ${target} 301`, `${from.replace(/\/$/, '')}/ ${target} 301`];
        });
        await replaceBlock(join(out, '_redirects'), lines.join('\n'), '#');

        // 2. IndexNow kulcs
        if (blog.indexnow_key) await write(join(out, 'wm-indexnow.txt'), blog.indexnow_key);

        // 3. Markdown cikkek
        if (markdown) {
          for (const post of posts) await write(join(out, blogPath, `${post.slug}.md`), post.markdown);
        }

        // 4. RSS
        if (rss && blog.blog?.url) await write(join(out, blogPath, 'rss.xml'), rssXml(blog, posts));

        // 5. llms.txt + llms-full.txt
        if (llms && posts.length) {
          const section = [
            `## ${blog.blog?.title || 'Blog'}`,
            '',
            ...(blog.blog?.description ? [blog.blog.description, ''] : []),
            ...posts.map((p) => `- [${p.title}](${p.url.replace(/\/$/, '')}.md): ${p.description}`),
          ].join('\n');
          await replaceBlock(join(out, 'llms.txt'), section, null, `# ${blog.site?.name ?? ''}\n\n> ${blog.blog?.description || ''}\n`);
          await write(join(out, 'llms-full.txt'), [`# ${blog.site?.name ?? ''} – ${blog.blog?.title || 'Blog'}`, ...posts.map((p) => p.markdown.trim())].join('\n\n---\n\n') + '\n');
        }

        logger.info(`Blog: ${posts.length} cikk, ${blog.redirects?.length ?? 0} átirányítás.`);
      },
    },
  };
}

async function write(path, content) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

/** A fájl saját részét (a jelölők között) cseréli – a fájl többi része (a te tartalmad) megmarad */
async function replaceBlock(path, content, comment, fallback = '') {
  const start = comment ? `${comment} ${START.replace(/<!-- | -->/g, '')}` : START;
  const end = comment ? `${comment} ${END.replace(/<!-- | -->/g, '')}` : END;
  let existing = fallback;
  try { existing = await readFile(path, 'utf8'); } catch { /* még nincs ilyen fájl */ }

  const pattern = new RegExp(`\\n?${escape(start)}[\\s\\S]*?${escape(end)}\\n?`, 'g');
  const cleaned = existing.replace(pattern, '\n').trimEnd();
  if (!content.trim()) {
    if (cleaned !== existing.trimEnd()) await write(path, cleaned + '\n');
    return;
  }
  await write(path, `${cleaned ? cleaned + '\n\n' : ''}${start}\n${content}\n${end}\n`);
}

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function xml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rssXml(blog, posts) {
  const items = posts.slice(0, 50).map((p) => `    <item>
      <title>${xml(p.title)}</title>
      <link>${xml(p.url)}</link>
      <guid isPermaLink="true">${xml(p.url)}</guid>
      <description>${xml(p.description)}</description>
      ${p.published_at ? `<pubDate>${new Date(p.published_at).toUTCString()}</pubDate>` : ''}
      ${p.category ? `<category>${xml(p.category.name)}</category>` : ''}
    </item>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml([blog.blog.title, blog.site?.name].filter(Boolean).join(' – '))}</title>
    <link>${xml(blog.blog.url)}</link>
    <description>${xml(blog.blog.description || blog.site?.name)}</description>
    <language>hu</language>
    <atom:link href="${xml(blog.blog.rss)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}