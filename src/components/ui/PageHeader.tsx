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
}) => {
  return (
    <div className="mb-6 pb-4 border-b border-[#CBD5E1]/70">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-[#64748B] mb-2 font-medium">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {crumb.href ? (
                <a href={crumb.href} className="hover:text-[#1C2C5B] transition-colors">
                  {crumb.label}
                </a>
              ) : (
                <span className="text-[#0F172A]">{crumb.label}</span>
              )}
              {idx < breadcrumbs.length - 1 && <span className="text-[#CBD5E1]">/</span>}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className="text-sm text-[#64748B] mt-1">{subtitle}</p>}
        </div>

        {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
      </div>
    </div>
  );
};
