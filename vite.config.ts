import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_URL = 'https://mgcinishaunporfolio.vercel.app';

const profileTitle = 'Mgcini Shaun Moyo | Software Engineer & Digital Creator';
const profileDescription = 'Meet Mgcini Shaun Moyo, a Software Engineer working in full-stack development, UI/UX and product design, software QA, and digital marketing. Explore the GMA Quiz System project.';
const projectTitle = 'GMA Quiz System | Designed and Developed by Mgcini Shaun Moyo';
const projectDescription = 'Project case study for the GMA Quiz System, an AI-powered, offline-first school assessment platform built for Growing Minds Academy. See features, technology, contributions, and status.';
const profileUrl = `${SITE_URL}/mgcini-shaun-moyo`;
const projectUrl = `${SITE_URL}/projects/gma-quiz-system`;
const personId = `${profileUrl}#person`;
const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: SITE_URL,
  name: 'Mgcini Shaun Moyo | Software Engineer',
  publisher: { '@id': personId },
  inLanguage: 'en',
};
const personSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': personId,
  name: 'Mgcini Shaun Moyo',
  alternateName: 'Shaun Moyo',
  jobTitle: 'Software Engineer',
  description: 'Software Engineer working across full-stack software development, UI/UX and product design, software testing and quality assurance, and digital marketing.',
  url: profileUrl,
  sameAs: ['https://github.com/mgcinishaun524-source'],
  mainEntityOfPage: {
    '@type': 'ProfilePage',
    '@id': `${profileUrl}#profilepage`,
    url: profileUrl,
    name: profileTitle,
    mainEntity: { '@id': personId },
  },
};
const softwareSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  '@id': `${projectUrl}#software`,
  name: 'GMA Quiz System',
  description: 'An AI-powered, offline-first school assessment platform developed for Growing Minds Academy, with quiz generation, assessment management, grading, and offline submission sync.',
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Web',
  url: projectUrl,
  creator: { '@id': personId },
  publisher: { '@type': 'Organization', name: 'Growing Minds Academy' },
};

function profileMarkup() {
  return `<main class="brand-page" aria-labelledby="profile-title"><header class="brand-header"><a class="brand-wordmark" href="/mgcini-shaun-moyo">Mgcini Shaun Moyo</a><nav aria-label="Main navigation"><a href="#about">About</a><a href="#capabilities">Capabilities</a><a href="/projects/gma-quiz-system">Projects</a><a href="#contact">Contact</a></nav></header><article><section class="brand-hero"><p class="brand-eyebrow">Software Engineer · Digital Creator</p><h1 id="profile-title">Mgcini Shaun Moyo</h1><p class="brand-lede">I design and build practical software products, bringing together engineering, thoughtful product design, quality assurance, and digital marketing.</p><div class="brand-actions"><a class="brand-button" href="#projects">Explore my work</a><a class="brand-text-link" href="https://github.com/mgcinishaun524-source" target="_blank" rel="noreferrer">GitHub profile <span aria-hidden="true">↗</span></a></div></section><section class="brand-section" id="about"><p class="brand-eyebrow">Profile</p><h2>Building software for real-world needs</h2><p>Mgcini Shaun Moyo is a Software Engineer involved in full-stack software development, UI/UX and product design, software testing and quality assurance, and digital marketing. The work spans product planning, user-facing interfaces, backend and database integration, offline capability, testing, deployment, and technical documentation.</p><p>This profile focuses on verifiable project work rather than unsubstantiated credentials or employment claims.</p></section><section class="brand-section" id="capabilities"><p class="brand-eyebrow">Capabilities</p><h2>How I contribute</h2><ul class="capability-list"><li><strong>Software engineering</strong><span>Frontend and backend implementation, integrations, and product delivery.</span></li><li><strong>UI/UX and product design</strong><span>Planning user flows and designing usable interfaces for real product needs.</span></li><li><strong>Testing and quality assurance</strong><span>Testing product behaviour and supporting reliable releases.</span></li><li><strong>Digital marketing</strong><span>Digital promotion and communication supporting product reach.</span></li></ul></section><section class="brand-section" id="projects"><p class="brand-eyebrow">Selected project</p><h2>GMA Quiz System</h2><p>An AI-powered, offline-first school assessment platform developed for Growing Minds Academy. It supports AI-assisted quiz creation, assessment workflows, grading, and offline submission sync.</p><a class="project-link-card" href="/projects/gma-quiz-system"><span><strong>GMA Quiz System</strong><small>Product overview, contribution details, technology, and current status</small></span><span aria-hidden="true">↗</span></a></section><section class="brand-contact" id="contact"><p class="brand-eyebrow">Professional profile</p><h2>Connect with me</h2><p>Explore my public software work on GitHub. Contact details and additional professional profiles can be added here when verified and supplied.</p><a class="brand-button" href="https://github.com/mgcinishaun524-source" target="_blank" rel="noreferrer">Visit GitHub</a></section></article><footer class="brand-footer"><span>© Mgcini Shaun Moyo</span><a href="/projects/gma-quiz-system">GMA Quiz System</a></footer></main>`;
}

function projectMarkup() {
  return `<main class="brand-page" aria-labelledby="project-title"><header class="brand-header"><a class="brand-wordmark" href="/mgcini-shaun-moyo">Mgcini Shaun Moyo</a><nav aria-label="Main navigation"><a href="/mgcini-shaun-moyo">Profile</a><a href="#overview">Overview</a><a href="#contributions">Contributions</a><a href="#status">Status</a></nav></header><article><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/mgcini-shaun-moyo">Profile</a><span aria-hidden="true">/</span><span>Projects</span><span aria-hidden="true">/</span><span aria-current="page">GMA Quiz System</span></nav><section class="brand-hero project-hero" id="overview"><p class="brand-eyebrow">Featured software project · Education technology</p><h1 id="project-title">GMA Quiz System</h1><p class="brand-lede">An AI-powered, offline-first school assessment platform developed for Growing Minds Academy.</p><p class="project-attribution"><strong>Designed and Developed by Mgcini Shaun Moyo</strong><br>Built for Growing Minds Academy.</p><p class="project-status" id="status"><span class="status-dot" aria-hidden="true"></span>Submitted to Google Play Console for review. It is not represented as published.</p></section><section class="brand-section"><p class="brand-eyebrow">The need</p><h2>Assessment that can keep working offline</h2><p>Schools need practical ways to prepare assessments, manage learner submissions, and review results. Connectivity interruptions can make digital assessment difficult. GMA Quiz System is designed to support assessment workflows, including offline quiz use and submission sync when connectivity returns.</p></section><section class="brand-section"><p class="brand-eyebrow">Product capabilities</p><h2>Features</h2><ul class="feature-list"><li>AI-assisted quiz generation for teachers.</li><li>Role-based experiences for administrators, teachers, and learners.</li><li>Offline quiz access and queued submission synchronisation.</li><li>Server-side grading and controlled release of results.</li><li>Assessment management and learner performance analytics.</li></ul><p>These are product capabilities; access to a live public demo is not provided on this page.</p></section><section class="brand-section" id="contributions"><p class="brand-eyebrow">My role</p><h2>Product planning through release readiness</h2><p>My contributions to this project include product concept and technical planning, UI/UX design, frontend development, backend integration, offline-first functionality, database integration, software testing and quality assurance, deployment, and technical documentation.</p><h3>Engineering challenges addressed</h3><p>Supporting intermittent connectivity requires keeping quiz experiences usable offline and synchronising submissions when a connection returns. The product also incorporates role-based access and server-side grading so assessment workflows have clear access boundaries.</p></section><section class="brand-section"><p class="brand-eyebrow">Technology</p><h2>Built with</h2><ul class="technology-list" aria-label="Technologies used"><li>React</li><li>TypeScript</li><li>Vite</li><li>Node.js</li><li>Express</li><li>Supabase</li><li>PostgreSQL</li><li>Google Gemini</li><li>IndexedDB</li></ul><p>The existing project repository documents the platform architecture and implementation. <a href="https://github.com/mgcinishaun524-source/GMA_Quiz_Offline_Online_Support" target="_blank" rel="noreferrer">View the GMA Quiz System repository</a>.</p></section><section class="brand-section attribution-panel"><p class="brand-eyebrow">Institutional attribution</p><h2>Built for Growing Minds Academy</h2><p>The project was built for Growing Minds Academy. The school's brand, institutional data, and intellectual property remain attributed to the institution; this page describes my stated design and development contributions and does not claim ownership of those institutional assets.</p><p class="project-attribution"><strong>Designed and Developed by Mgcini Shaun Moyo</strong><br>Built for Growing Minds Academy.</p></section><section class="brand-contact"><h2>More about the developer</h2><p>Read the profile for Mgcini Shaun Moyo, Software Engineer and digital creator.</p><a class="brand-button" href="/mgcini-shaun-moyo">View developer profile</a></section></article><footer class="brand-footer"><span>GMA Quiz System · Built for Growing Minds Academy</span><a href="/mgcini-shaun-moyo">Mgcini Shaun Moyo</a></footer></main>`;
}

function escapeAttribute(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

function createPageHtml(template: string, title: string, description: string, url: string, markup: string, schemas: object[]) {
  const canonical = `<link rel="canonical" href="${url}">`;
  const metadata = `${canonical}<meta name="description" content="${escapeAttribute(description)}"><meta name="robots" content="index, follow"><meta property="og:title" content="${escapeAttribute(title)}"><meta property="og:description" content="${escapeAttribute(description)}"><meta property="og:type" content="website"><meta property="og:url" content="${url}"><meta property="og:site_name" content="Mgcini Shaun Moyo"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escapeAttribute(title)}"><meta name="twitter:description" content="${escapeAttribute(description)}"><script id="public-page-jsonld" type="application/ld+json">${JSON.stringify(schemas).replaceAll('<', '\\u003c')}</script>`;
  return template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace(/<meta\s+name="description"[^>]*>/i, '')
    .replace(/<meta\s+property="og:[^"]+"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:[^"]+"[^>]*>/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>/gi, '')
    .replace('</head>', `${metadata}</head>`)
    .replace('<div id="root"></div>', `<div id="root">${markup}</div>`);
}

function prerenderPublicRoutes(): Plugin {
  return {
    name: 'prerender-public-profile-routes',
    apply: 'build',
    async closeBundle() {
      const outputDir = path.resolve(__dirname, 'dist');
      const template = await readFile(path.join(outputDir, 'index.html'), 'utf8');
      const profileDir = path.join(outputDir, 'mgcini-shaun-moyo');
      const projectDir = path.join(outputDir, 'projects', 'gma-quiz-system');
      await Promise.all([mkdir(profileDir, { recursive: true }), mkdir(projectDir, { recursive: true })]);
      await Promise.all([
        writeFile(path.join(profileDir, 'index.html'), createPageHtml(template, profileTitle, profileDescription, profileUrl, profileMarkup(), [personSchema, websiteSchema])),
        writeFile(path.join(projectDir, 'index.html'), createPageHtml(template, projectTitle, projectDescription, projectUrl, projectMarkup(), [softwareSchema, websiteSchema])),
      ]);
    },
  };
}

export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), prerenderPublicRoutes()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    hmr: process.env.DISABLE_HMR !== 'true',
    // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}));
