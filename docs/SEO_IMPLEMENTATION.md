# SEO audit and implementation notes

## Confirmed domain and branch state

The owner confirmed the personal portfolio production origin as `https://mgcinishaunporfolio.vercel.app`, distinct from the GMA Quiz System application. The SEO feature branch is `seo/mgcini-shaun-moyo-profile`; its initial SEO commit is based on `main`. Subsequent changes were committed on the same feature branch. Nothing has been merged to `main` or deployed.

## Implementation

- `src/features/public/seo.ts` uses the confirmed portfolio origin for client-side canonical, Open Graph, X/Twitter, and JSON-LD URLs.
- `vite.config.ts` generates static route documents during production builds at `dist/mgcini-shaun-moyo/index.html` and `dist/projects/gma-quiz-system/index.html`. Each includes a unique title, description, canonical, robots directive, Open Graph metadata, X/Twitter metadata, JSON-LD, and semantic page content in the initial response.
- `public/sitemap.xml` and `public/robots.txt` reference the confirmed personal portfolio host.
- `SoftwareApplication` JSON-LD omits `isAccessibleForFree` because actual access terms are unverified.
- `vercel.json` keeps the API rewrite first and catch-all SPA rewrite last, adding explicit static-page rewrites for the two generated HTML files before the catch-all.
- `src/main.tsx` detects those prerendered public routes and does not call `createRoot` over their static markup. This avoids React clearing/replacing the prerendered content and causing an initial visual flash. Their navigation uses standard anchors. It registers the existing service worker on these routes; other routes continue to boot the React app as before.
- No LinkedIn, email, location, qualifications, employment or other unsupplied personal details were added. Add a verified LinkedIn URL to `sameAs` in `src/features/public/seo.ts` and a visible link in `src/features/public/PublicPages.tsx` only once supplied. Add contact information to the profile's contact section in `PublicPages.tsx` only when verified.

## Validation status

Source review confirms the sitemap entries and robots sitemap reference use the confirmed host. The Vercel rules explicitly route the two public paths to their generated static HTML before the fallback, while preserving the API rule and fallback. The build plugin is configured to emit the route files.

The GitHub repository integration used for these edits does not provide a local shell, browser, or HTTP client. Therefore `npm run build`, TypeScript checks, tests, generated HTML inspection, XML/JSON-LD validator execution, route HTTP status checks, and deployed Vercel rewrite behavior have **not** been run or independently verified. Do not treat them as passing. Run `npm run build`, `npm run lint`, and `npm test` in CI or a developer environment; inspect both generated HTML files and check JSON-LD and direct-route responses in a non-production preview before requesting merge or deployment approval.

## Remaining manual actions

- Run the build, type-check, tests, sitemap/JSON-LD validation and preview route checks above.
- Confirm direct route responses and static rewrite behavior in a Vercel preview deployment. No production deployment has occurred.
- Add authentic, permission-cleared screenshots and descriptive alt text when available; the repository contained no application screenshots during source review.
- Keep the Google Play Console status accurate: submitted for review, not claimed published.
- After separate approval, submit the sitemap in Search Console and monitor indexing and Core Web Vitals.
