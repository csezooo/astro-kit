/**
 * WeboldaltMost blog – adatlekérés az Astro oldalakhoz (build közben).
 *
 * A platform csak a TARTALMAT adja (cím, szöveg HTML-ben, képek, kategória, SEO adatok, schema).
 * A kinézet a weboldal saját kódjában van: a sablonokat (src/pages/blog/…) és a stílust te írod.
 *
 *   import { getBlog, getPosts, postPaths } from '@weboldaltmost/astro-kit/blog';
 *   import { WM_SITE } from '../../wm.config';
 *
 *   export const getStaticPaths = () => postPaths(WM_SITE);   // src/pages/blog/[slug].astro
 *   const posts = await getPosts(WM_SITE);                     // src/pages/blog/index.astro
 *
 * Egy buildben egyszer kéri le a platformról (/api/v1/blog/{mérőkód}), utána a memóriából adja.
 * Ha a platform nem érhető el, a build HIBÁVAL LEÁLL – így a Cloudflare a régi, működő változatot hagyja kint,
 * és nem kerül ki véletlenül üres blog.
 */
import { WM } from './config';

export interface BlogImage {
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
}

export interface BlogCategory {
  slug: string;
  name: string;
  /** A kategóriaoldal bevezetője (és meta leírása) */
  description: string;
  /** Legyen-e saját oldala (/blog/kategoria/{slug}/) – az ügyfél dönti el a panelen */
  has_page: boolean;
  path: string;
  url: string;
  /** Hány megjelent cikk van benne (csak a getCategories()-ben) */
  count?: number;
  /** schema.org JSON-LD a kategóriaoldalhoz (CollectionPage + BreadcrumbList) */
  schema?: Record<string, unknown>;
}

export interface BlogTocItem {
  id: string;
  text: string;
  level: number;
}

export interface BlogFaqItem {
  question: string;
  answer: string;
}

export interface BlogPost {
  slug: string;
  /** /blog/{slug}/ */
  path: string;
  url: string;
  title: string;
  /** A <title> szövege (a SEO cím, vagy a cím + cégnév, ha belefér) */
  seo_title: string;
  /** Meta leírás (a megadott, vagy az első bekezdésből) – a listában összefoglalónak is jó */
  description: string;
  category: BlogCategory | null;
  tags: string[];
  author: { name: string; type: 'person' | 'organization' };
  cover: BlogImage | null;
  /** A cikk szövege tiszta HTML-ben (h2, h3, p, ul, ol, blockquote, table, figure, img, a) – stílus nélkül */
  html: string;
  /** Az alcímek (h2, h3) – tartalomjegyzékhez; az id a horgony (#…) */
  toc: BlogTocItem[];
  word_count: number;
  reading_minutes: number;
  faq: BlogFaqItem[];
  /** Ne jelenjen meg a Google-ben (az ügyfél kérte) – a BlogSeo noindex-et ír, a sitemapből kimarad */
  noindex: boolean;
  /** ISO 8601 */
  published_at: string | null;
  updated_at: string | null;
  /** schema.org JSON-LD (BlogPosting + BreadcrumbList + FAQPage) */
  schema: Record<string, unknown>;
  /** A cikk Markdownban (/blog/{slug}.md, llms-full.txt) */
  markdown: string;
}

export interface Blog {
  enabled: boolean;
  generated_at?: string;
  site: { name: string; url: string; language: string; logo: string | null; organization_id: string };
  blog: { path: string; url: string; title: string; description: string; rss: string; schema: Record<string, unknown> };
  categories: BlogCategory[];
  tags: { name: string; count: number }[];
  posts: BlogPost[];
  redirects: { from: string; to: string }[];
  indexnow_key: string | null;
}

const cache = new Map<string, Promise<Blog>>();

/** Az egész blog egyben (egy buildben egyszer tölti le) */
export function getBlog(site: string, apiUrl: string = WM.apiUrl): Promise<Blog> {
  const key = `${apiUrl}|${site}`;
  if (!cache.has(key)) cache.set(key, load(site, apiUrl));
  return cache.get(key)!;
}

async function load(site: string, apiUrl: string): Promise<Blog> {
  const url = `${apiUrl.replace(/\/$/, '')}/api/v1/blog/${encodeURIComponent(site)}`;
  let lastError = '';

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.ok) return normalize((await res.json()) as Partial<Blog>);
      lastError = `HTTP ${res.status}`;
      if (res.status === 404) break;   // rossz mérőkód – nincs értelme újrapróbálni
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
  }

  throw new Error(`[WeboldaltMost blog] Nem sikerült letölteni a blogot (${lastError}): ${url} – a build leáll, hogy ne kerüljön ki üres blog.`);
}

function normalize(data: Partial<Blog>): Blog {
  return {
    enabled: Boolean(data.enabled),
    generated_at: data.generated_at,
    site: data.site ?? { name: '', url: '', language: 'hu-HU', logo: null, organization_id: '' },
    blog: data.blog ?? { path: '/blog/', url: '', title: 'Blog', description: '', rss: '', schema: {} },
    categories: data.categories ?? [],
    tags: data.tags ?? [],
    posts: data.posts ?? [],
    redirects: data.redirects ?? [],
    indexnow_key: data.indexnow_key ?? null,
  };
}

/** A megjelent cikkek, a legújabb elöl. Szűrhető kategóriára / címkére. */
export async function getPosts(
  site: string,
  options: { category?: string; tag?: string; limit?: number; exclude?: string } = {},
): Promise<BlogPost[]> {
  const { posts } = await getBlog(site);
  const list = posts.filter(
    (post) =>
      (!options.category || post.category?.slug === options.category) &&
      (!options.tag || post.tags.includes(options.tag)) &&
      (!options.exclude || post.slug !== options.exclude),
  );
  return options.limit ? list.slice(0, options.limit) : list;
}

export async function getPost(site: string, slug: string): Promise<BlogPost | undefined> {
  return (await getBlog(site)).posts.find((post) => post.slug === slug);
}

/** Kapcsolódó cikkek: ugyanabból a kategóriából, aztán a legfrissebbek */
export async function relatedPosts(site: string, post: BlogPost, limit = 3): Promise<BlogPost[]> {
  const others = (await getBlog(site)).posts.filter((p) => p.slug !== post.slug);
  const same = others.filter((p) => post.category && p.category?.slug === post.category.slug);
  return [...same, ...others.filter((p) => !same.includes(p))].slice(0, limit);
}

/** Kategóriák; alapból csak a saját oldallal rendelkezők, amelyekben van cikk */
export async function getCategories(site: string, options: { all?: boolean } = {}): Promise<BlogCategory[]> {
  const { categories } = await getBlog(site);
  return options.all ? categories : categories.filter((c) => c.has_page && (c.count ?? 0) > 0);
}

/** src/pages/blog/[slug].astro → export const getStaticPaths = () => postPaths(WM_SITE); */
export async function postPaths(site: string) {
  return (await getBlog(site)).posts.map((post) => ({ params: { slug: post.slug }, props: { post } }));
}

/** src/pages/blog/kategoria/[slug].astro → export const getStaticPaths = () => categoryPaths(WM_SITE); */
export async function categoryPaths(site: string) {
  const blog = await getBlog(site);
  return (await getCategories(site)).map((category) => ({
    params: { slug: category.slug },
    props: { category, posts: blog.posts.filter((post) => post.category?.slug === category.slug) },
  }));
}

/** "2026. november 3." */
export function formatDate(iso: string | null | undefined, options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('hu-HU', { ...options, timeZone: 'Europe/Budapest' }).format(new Date(iso));
}

/** A <BlogPreview> mintája: az előnézeti oldal (src/pages/blog/elonezet.astro) ezzel rajzolja ki a sablont */
export const PREVIEW_POST: BlogPost = {
  slug: 'elonezet',
  path: '/blog/elonezet/',
  url: '',
  title: 'Előnézet betöltése…',
  seo_title: 'Előnézet',
  description: '',
  category: { slug: '', name: 'Kategória', description: '', has_page: false, path: '#', url: '#' },
  tags: [],
  author: { name: '', type: 'organization' },
  cover: { url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', width: 1600, height: 900, alt: '' },
  html: '<p>Egy pillanat…</p>',
  toc: [],
  word_count: 0,
  reading_minutes: 1,
  faq: [],
  noindex: true,
  published_at: null,
  updated_at: null,
  schema: {},
  markdown: '',
};