# SEO audit and implementation notes

## Audit summary

Repository review found a React 19 + TypeScript single-page application built with Vite and React Router, deployed via Vercel rewrites. The app root redirects to login or a protected portal, and the existing document title/description identify the school quiz product, not the developer. Public, indexable person and project pages did not exist. There was no sitemap or robots.txt. The project README states that no application screenshots are currently in the repository, so this implementation does not add fabricated imagery.

## Prioritised plan and work completed

1. Add public, indexable developer and GMA project routes without changing the app root or existing authenticated workflows.
2. Add useful, distinct page titles and descriptions, canonical URLs, Open Graph and X/Twitter metadata, and route-specific JSON-LD.
3. Add sitemap and robots.txt for the two public routes only; exclude protected product portals from the sitemap.
4. Provide human-readable profile/project content, cross-links, explicit product/institution attribution, and an honest app-review status.
5. Keep existing Vite/React/TypeScript/Vercel architecture and styling independent from existing application styles.

## Metadata and entity notes

The public website origin in repository metadata is `https://gma-tau.vercel.app`. Route canonical URLs and sitemap entries use that origin. The profile uses Person and ProfilePage JSON-LD; project route uses SoftwareApplication JSON-LD. The only `sameAs` link is the repository owner's GitHub profile, verified from the repository metadata. LinkedIn was not supplied, so no profile link was invented. No qualifications, employers, awards, reviews, or app publication claims are added.

Metadata is set client-side when the public route mounts. This SPA has no server-side rendering or prerender pipeline; HTML crawlers that do not execute JavaScript may initially see the existing app shell metadata. For stronger first-response SEO, add Vercel-compatible prerendering or server rendering in a separately tested change.

## Google Search Console checklist

1. Confirm `https://gma-tau.vercel.app` is the canonical production hostname (or update `SITE_URL`, sitemap, and canonical values if not).
2. Add the domain or URL-prefix property in Google Search Console and verify it using a DNS TXT record or the HTML-file method. The repository already has a Google verification tag/token in `index.html`; confirm that token belongs to this Search Console property and that the deployed page serves it before relying on it.
3. Deploy the branch to the production hostname, then open `/robots.txt` and `/sitemap.xml` to confirm both return successfully.
4. Submit `https://gma-tau.vercel.app/sitemap.xml` in Search Console.
5. Use URL Inspection on `/mgcini-shaun-moyo` and `/projects/gma-quiz-system`, run a live test, and request indexing if Google permits.
6. Monitor Page indexing, enhancements/structured-data reports where applicable, and Search results performance after crawl data accumulates.

No Search Console ownership verification or URL submission is claimed by this implementation.

## Remaining manual actions and validation

- Confirm the deployed canonical domain; repository homepage metadata may not be the intended personal portfolio domain.
- Supply verified LinkedIn, contact email, location, and any additional genuine professional profiles if they should be published. No email or Zimbabwe location was inferred.
- Add authentic, permission-cleared screenshots and descriptive alt text when available. No screenshot was found in the repository.
- Test all routes and existing sign-in, role guards, dashboards, offline mode, and API routes after deployment.
- Run the production build, TypeScript check, accessibility checks, and field Core Web Vitals measurements on the deployed site. Repository tools in this workflow do not provide a local shell/browser, so those checks must run in CI or a developer environment.
- Keep the Google Play Console status current; the page says submitted for review and explicitly does not say published.
