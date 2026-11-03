import React from 'react';

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
  <div className="mb-6 pb-4 border-b border-slate-200">
    {breadcrumbs && breadcrumbs.length > 0 && (
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 font-medium" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            {crumb.href ? (
              <a href={crumb.href} className="hover:text-[#0B1F4B] transition-colors">
                {crumb.label}
              </a>
            ) : (
              <span className="text-slate-800">{crumb.label}</span>
            )}
            {idx < breadcrumbs.length - 1 && <span className="text-slate-300">/</span>}
          </React.Fragment>
        ))}
      </nav>
    )}

    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1F4B]">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>
      )}
    </div>
  </div>
);
