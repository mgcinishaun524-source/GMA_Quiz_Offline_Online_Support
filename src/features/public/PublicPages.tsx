import { Link } from 'react-router-dom';
import { GITHUB_PROFILE, PERSON_URL, PROJECT_URL, SITE_URL, personEntity, usePageSeo, websiteEntity } from './seo';
import './public-pages.css';

const profileTitle = 'Mgcini Shaun Moyo | Software Engineer & Digital Creator';
const profileDescription = 'Meet Mgcini Shaun Moyo, a Software Engineer working in full-stack development, UI/UX and product design, software QA, and digital marketing. Explore the GMA Quiz System project.';

export function DeveloperProfilePage() {
  const schema = [
    { '@context': 'https://schema.org', ...personEntity, mainEntityOfPage: { '@type': 'ProfilePage', '@id': `${PERSON_URL}#profilepage`, url: PERSON_URL, name: profileTitle, mainEntity: { '@id': `${PERSON_URL}#person` } } },
    { '@context': 'https://schema.org', ...websiteEntity },
  ];
  usePageSeo({ title: profileTitle, description: profileDescription, path: '/mgcini-shaun-moyo', schema });

  return (
    <main className="brand-page" aria-labelledby="profile-title">
      <header className="brand-header">
        <Link className="brand-wordmark" to="/mgcini-shaun-moyo">Mgcini Shaun Moyo</Link>
        <nav aria-label="Main navigation">
          <a href="#about">About</a><a href="#capabilities">Capabilities</a><Link to="/projects/gma-quiz-system">Projects</Link><a href="#contact">Contact</a>
        </nav>
      </header>
      <article>
        <section className="brand-hero">
          <p className="brand-eyebrow">Software Engineer · Digital Creator</p>
          <h1 id="profile-title">Mgcini Shaun Moyo</h1>
          <p className="brand-lede">I design and build practical software products, bringing together engineering, thoughtful product design, quality assurance, and digital marketing.</p>
          <div className="brand-actions"><a className="brand-button" href="#projects">Explore my work</a><a className="brand-text-link" href={GITHUB_PROFILE} target="_blank" rel="noreferrer">GitHub profile <span aria-hidden="true">↗</span></a></div>
        </section>

        <section className="brand-section" id="about">
          <p className="brand-eyebrow">Profile</p>
          <h2>Building software for real-world needs</h2>
          <p>Mgcini Shaun Moyo is a Software Engineer involved in full-stack software development, UI/UX and product design, software testing and quality assurance, and digital marketing. The work spans product planning, user-facing interfaces, backend and database integration, offline capability, testing, deployment, and technical documentation.</p>
          <p>This profile focuses on verifiable project work rather than unsubstantiated credentials or employment claims.</p>
        </section>

        <section className="brand-section" id="capabilities">
          <p className="brand-eyebrow">Capabilities</p>
          <h2>How I contribute</h2>
          <ul className="capability-list">
            <li><strong>Software engineering</strong><span>Frontend and backend implementation, integrations, and product delivery.</span></li>
            <li><strong>UI/UX and product design</strong><span>Planning user flows and designing usable interfaces for real product needs.</span></li>
            <li><strong>Testing and quality assurance</strong><span>Testing product behaviour and supporting reliable releases.</span></li>
            <li><strong>Digital marketing</strong><span>Digital promotion and communication supporting product reach.</span></li>
          </ul>
        </section>

        <section className="brand-section" id="projects">
          <p className="brand-eyebrow">Selected project</p>
          <h2>GMA Quiz System</h2>
          <p>An AI-powered, offline-first school assessment platform developed for Growing Minds Academy. It supports AI-assisted quiz creation, assessment workflows, grading, and offline submission sync.</p>
          <Link className="project-link-card" to="/projects/gma-quiz-system"><span><strong>GMA Quiz System</strong><small>Product overview, contribution details, technology, and current status</small></span><span aria-hidden="true">↗</span></Link>
        </section>

        <section className="brand-contact" id="contact">
          <p className="brand-eyebrow">Professional profile</p>
          <h2>Connect with me</h2>
          <p>Explore my public software work on GitHub. Contact details and additional professional profiles can be added here when verified and supplied.</p>
          <a className="brand-button" href={GITHUB_PROFILE} target="_blank" rel="noreferrer">Visit GitHub</a>
          <p className="brand-credit">Portfolio profile for <strong>Mgcini Shaun Moyo</strong> · <a href={SITE_URL}>Home</a></p>
        </section>
      </article>
      <footer className="brand-footer"><span>© Mgcini Shaun Moyo</span><Link to="/projects/gma-quiz-system">GMA Quiz System</Link></footer>
    </main>
  );
}

const projectTitle = 'GMA Quiz System | Designed and Developed by Mgcini Shaun Moyo';
const projectDescription = 'Project case study for the GMA Quiz System, an AI-powered, offline-first school assessment platform built for Growing Minds Academy. See features, technology, contributions, and status.';

export function GmaQuizProjectPage() {
  const projectSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${PROJECT_URL}#software`,
    name: 'GMA Quiz System',
    description: 'An AI-powered, offline-first school assessment platform developed for Growing Minds Academy, with quiz generation, assessment management, grading, and offline submission sync.',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    url: PROJECT_URL,
    creator: { '@id': `${PERSON_URL}#person` },
    publisher: { '@type': 'Organization', name: 'Growing Minds Academy' },
    isAccessibleForFree: false,
  };
  const schema = [projectSchema, { '@context': 'https://schema.org', ...websiteEntity }];
  usePageSeo({ title: projectTitle, description: projectDescription, path: '/projects/gma-quiz-system', schema });

  return (
    <main className="brand-page" aria-labelledby="project-title">
      <header className="brand-header">
        <Link className="brand-wordmark" to="/mgcini-shaun-moyo">Mgcini Shaun Moyo</Link>
        <nav aria-label="Main navigation"><Link to="/mgcini-shaun-moyo">Profile</Link><a href="#overview">Overview</a><a href="#contributions">Contributions</a><a href="#status">Status</a></nav>
      </header>
      <article>
        <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/mgcini-shaun-moyo">Profile</Link><span aria-hidden="true">/</span><span>Projects</span><span aria-hidden="true">/</span><span aria-current="page">GMA Quiz System</span></nav>
        <section className="brand-hero project-hero" id="overview">
          <p className="brand-eyebrow">Featured software project · Education technology</p>
          <h1 id="project-title">GMA Quiz System</h1>
          <p className="brand-lede">An AI-powered, offline-first school assessment platform developed for Growing Minds Academy.</p>
          <p className="project-attribution"><strong>Designed and Developed by Mgcini Shaun Moyo</strong><br />Built for Growing Minds Academy.</p>
          <p className="project-status" id="status"><span className="status-dot" aria-hidden="true" /> Submitted to Google Play Console for review. It is not represented as published.</p>
        </section>

        <section className="brand-section">
          <p className="brand-eyebrow">The need</p>
          <h2>Assessment that can keep working offline</h2>
          <p>Schools need practical ways to prepare assessments, manage learner submissions, and review results. Connectivity interruptions can make digital assessment difficult. GMA Quiz System is designed to support assessment workflows, including offline quiz use and submission sync when connectivity returns.</p>
        </section>

        <section className="brand-section">
          <p className="brand-eyebrow">Product capabilities</p>
          <h2>Features</h2>
          <ul className="feature-list">
            <li>AI-assisted quiz generation for teachers.</li>
            <li>Role-based experiences for administrators, teachers, and learners.</li>
            <li>Offline quiz access and queued submission synchronisation.</li>
            <li>Server-side grading and controlled release of results.</li>
            <li>Assessment management and learner performance analytics.</li>
          </ul>
          <p>These are product capabilities; access to a live public demo is not provided on this page.</p>
        </section>

        <section className="brand-section" id="contributions">
          <p className="brand-eyebrow">My role</p>
          <h2>Product planning through release readiness</h2>
          <p>My contributions to this project include product concept and technical planning, UI/UX design, frontend development, backend integration, offline-first functionality, database integration, software testing and quality assurance, deployment, and technical documentation.</p>
          <h3>Engineering challenges addressed</h3>
          <p>Supporting intermittent connectivity requires keeping quiz experiences usable offline and synchronising submissions when a connection returns. The product also incorporates role-based access and server-side grading so assessment workflows have clear access boundaries.</p>
        </section>

        <section className="brand-section">
          <p className="brand-eyebrow">Technology</p>
          <h2>Built with</h2>
          <ul className="technology-list" aria-label="Technologies used"><li>React</li><li>TypeScript</li><li>Vite</li><li>Node.js</li><li>Express</li><li>Supabase</li><li>PostgreSQL</li><li>Google Gemini</li><li>IndexedDB</li></ul>
          <p>The existing project repository documents the platform architecture and implementation. <a href="https://github.com/mgcinishaun524-source/GMA_Quiz_Offline_Online_Support" target="_blank" rel="noreferrer">View the GMA Quiz System repository</a>.</p>
        </section>

        <section className="brand-section attribution-panel">
          <p className="brand-eyebrow">Institutional attribution</p>
          <h2>Built for Growing Minds Academy</h2>
          <p>The project was built for Growing Minds Academy. The school's brand, institutional data, and intellectual property remain attributed to the institution; this page describes my stated design and development contributions and does not claim ownership of those institutional assets.</p>
          <p className="project-attribution"><strong>Designed and Developed by Mgcini Shaun Moyo</strong><br />Built for Growing Minds Academy.</p>
        </section>

        <section className="brand-contact">
          <h2>More about the developer</h2>
          <p>Read the profile for Mgcini Shaun Moyo, Software Engineer and digital creator.</p>
          <Link className="brand-button" to="/mgcini-shaun-moyo">View developer profile</Link>
        </section>
      </article>
      <footer className="brand-footer"><span>GMA Quiz System · Built for Growing Minds Academy</span><Link to="/mgcini-shaun-moyo">Mgcini Shaun Moyo</Link></footer>
    </main>
  );
}
