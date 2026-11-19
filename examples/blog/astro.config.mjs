// Minta: astro.config.mjs egy blogos WeboldaltMost oldalhoz.
// A meglévő configodba csak a két import és a két integráció kell (a sitemap valószínűleg már megvan).
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { wmBlog, blogSitemap } from '@weboldaltmost/astro-kit/integration';

// Ugyanaz a mérőkód, mint a src/wm.config.ts-ben (onnan is importálhatod: import { WM_SITE } from './src/wm.config';)
const WM_SITE = 'abc123def456';

export default defineConfig({
  site: 'https://kovacsfestes.hu',
  integrations: [
    // A cikkek lastmod dátuma a sitemapben; az előnézet és a "Ne jelenjen meg a Google-ben" cikkek kimaradnak
    sitemap(await blogSitemap(WM_SITE)),
    // _redirects, wm-indexnow.txt, blog/{cikk}.md, blog/rss.xml, llms.txt (Blog rész), llms-full.txt
    wmBlog({ site: WM_SITE }),
  ],
});