/**
 * Típusok az integration.mjs-hez (astro.config.mjs) – így az `astro check` és a VS Code is ismeri a függvényeket.
 */
import type { AstroIntegration } from 'astro';
import type { Blog } from './blog';

export interface WmBlogOptions {
  /** A weboldal mérőkódja (src/wm.config.ts → WM_SITE) */
  site: string;
  /** A platform címe (alapból https://app.weboldaltmost.hu, vagy a PUBLIC_WM_API_URL) */
  apiUrl?: string;
  /** llms.txt + llms-full.txt kiegészítése (alapból igen) */
  llms?: boolean;
  /** blog/{cikk}.md fájlok (alapból igen) */
  markdown?: boolean;
  /** blog/rss.xml (alapból igen) */
  rss?: boolean;
}

export interface BlogSitemapOptions {
  apiUrl?: string;
  filter?: (page: string) => boolean;
  serialize?: (item: { url: string; lastmod?: string; [key: string]: unknown }) => unknown;
  [key: string]: unknown;
}

/** A blog adatai (ugyanaz, mint a blog.ts getBlog()) – egy buildben egyszer tölti le */
export function fetchBlog(site: string, apiUrl?: string): Promise<Blog>;

/** Az @astrojs/sitemap beállításai: a cikkek lastmod dátuma, az előnézet és a noindex cikkek kimaradnak */
export function blogSitemap(site: string, options?: BlogSitemapOptions): Promise<Record<string, unknown>>;

/** Az integráció: _redirects, wm-indexnow.txt, blog/{cikk}.md, blog/rss.xml, llms.txt, llms-full.txt */
export function wmBlog(options: WmBlogOptions): AstroIntegration;