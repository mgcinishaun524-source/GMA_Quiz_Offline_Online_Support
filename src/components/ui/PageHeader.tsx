import React from 'react';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
  badge,
}) => (
  <div className="mb-6 pb-5 border-b border-gma-navy/10">
    {breadcrumbs && breadcrumbs.length > 0 && (
      <nav className="flex items-center gap-1 text-xs text-gma-muted mb-2.5 font-medium" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            {crumb.href ? (
              <a href={crumb.href} className="hover:text-gma-navy transition-colors">
                {crumb.label}
              </a>
            ) : (
              <span className="text-slate-700">{crumb.label}</span>
            )}
            {idx < breadcrumbs.length - 1 && (
              <ChevronRight size={12} className="text-slate-300 shrink-0" aria-hidden="true" />
            )}
          </React.Fragment>
        ))}
      </nav>
    )}

    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-[1.7rem] font-extrabold tracking-tight text-gma-navy">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="text-sm text-gma-muted mt-1.5">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>
      )}
    </div>
  </div>
);
