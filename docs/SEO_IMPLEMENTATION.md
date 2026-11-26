# SEO audit and implementation notes

## Second review and confirmed production origin

The owner confirmed the personal portfolio production origin as `https://mgcinishaunporfolio.vercel.app`. This is distinct from the GMA application origin. The Vercel rewrite configuration was inspected and left unchanged: `/api/:path*` is sent to `/api/index`, followed by the SPA fallback. The build will create static route files in `dist` so Vercel's normal static-file lookup can serve them before the catch-all rewrite. No merge or production deployment was performed.

## Implementation

- Updated `src/features/public/seo.ts` to use the confirmed personal origin. Client-side route navigation continues to update canonical, description, Open Graph, X/Twitter, robots, and JSON-LD metadata.
- Added a Vite build plugin in `vite.config.ts`. After the standard Vite build it writes static HTML at `dist/mgcini-shaun-moyo/index.html` and `dist/projects/gma-quiz-system/index.html`. Each generated page contains its own title, description, canonical, robots directive, Open Graph URL/title/description, X/Twitter title/description, JSON-LD, and meaningful semantic page content in the initial response. The normal React entry assets remain in each document, so client-side hydration is not required for initial reading and React can still mount the existing SPA.
- Updated `public/sitemap.xml` and `public/robots.txt` to the confirmed domain.
- Removed `isAccessibleForFree` from SoftwareApplication JSON-LD because product access terms have not been verified.
- Kept the existing Vercel rewrites, React authentication, offline/service-worker code, and application routes unchanged in behavior. No dependencies were added.

## Build and verification status

The sitemap structure and robots directives were reviewed in source. The Vite plugin emits the static page files and metadata described above by construction. However, the GitHub integration available in this task does not provide a shell, local checkout, browser, network HTTP client, or validator. Therefore `npm run build`, TypeScript checks, tests, generated output inspection, actual route HTTP status checks, and automated XML/JSON-LD validation have **not** been run here. Do not treat those checks as passed. Run `npm run build`, `npm run lint`, and `npm test` in CI or a developer environment; inspect the two generated HTML files, validate JSON-LD, and confirm the Vercel static assets take precedence over the existing catch-all rewrite before deployment.

## Profiles, contact, and manual actions

- GitHub is the only `sameAs` profile because it is verified from the repository owner metadata. No LinkedIn profile or contact information was supplied. Add verified LinkedIn URL to `sameAs` in `src/features/public/seo.ts` and to the visible profile page in `src/features/public/PublicPages.tsx` when provided; add a verified email/contact method to that profile's contact section then.
- No screenshots were present in repository source; no placeholders were invented. Add permission-cleared screenshots and meaningful alt text when available.
- The Google Play status remains “submitted to Google Play Console for review,” not published.
- After review, deploy only with separate approval. Then test direct route requests and confirm returned HTML contains each route's metadata and rendered content, submit the sitemap in Search Console, and monitor indexing and Core Web Vitals.
- Credentials, qualifications, awards, employment, LinkedIn, email, and location were not fabricated.
