import { useEffect } from 'react';

export const SITE_URL = 'https://gma-tau.vercel.app';
export const PERSON_URL = `${SITE_URL}/mgcini-shaun-moyo`;
export const PROJECT_URL = `${SITE_URL}/projects/gma-quiz-system`;
export const GITHUB_PROFILE = 'https://github.com/mgcinishaun524-source';

interface PageSeoOptions {
  title: string;
  description: string;
  path: string;
  schema: Record<string, unknown> | Record<string, unknown>[];
  noIndex?: boolean;
}

function setMeta(attribute: 'name' | 'property', key: string, value: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = value;
}

/** Updates share, canonical, indexing, and JSON-LD metadata for public routes. */
export function usePageSeo({ title, description, path, schema, noIndex = false }: PageSeoOptions) {
  useEffect(() => {
    const canonicalUrl = `${SITE_URL}${path}`;
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:site_name', 'Mgcini Shaun Moyo');
    setMeta('name', 'twitter:card', 'summary');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    let jsonLd = document.getElementById('public-page-jsonld') as HTMLScriptElement | null;
    if (!jsonLd) {
      jsonLd = document.createElement('script');
      jsonLd.id = 'public-page-jsonld';
      jsonLd.type = 'application/ld+json';
      document.head.appendChild(jsonLd);
    }
    jsonLd.textContent = JSON.stringify(schema);
  }, [title, description, path, schema, noIndex]);
}

export const personEntity = {
  '@type': 'Person',
  '@id': `${PERSON_URL}#person`,
  name: 'Mgcini Shaun Moyo',
  alternateName: 'Shaun Moyo',
  jobTitle: 'Software Engineer',
  description: 'Software Engineer working across full-stack software development, UI/UX and product design, software testing and quality assurance, and digital marketing.',
  url: PERSON_URL,
  sameAs: [GITHUB_PROFILE],
};

export const websiteEntity = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: SITE_URL,
  name: 'Mgcini Shaun Moyo | Software Engineer',
  publisher: { '@id': `${PERSON_URL}#person` },
  inLanguage: 'en',
};
