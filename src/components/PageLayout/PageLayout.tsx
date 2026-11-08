import type { ReactNode } from 'react'

interface PageLayoutProps {
  title?: string
  subtitle?: ReactNode
  icon?: ReactNode
  // A wide header image above the title, such as a channel's banner.
  banner?: string
  actions?: ReactNode
  extra?: ReactNode
  tabs?: ReactNode
  children: ReactNode
  className?: string
}

// A page with Halon's heading: an optional banner, the title with its icon and subtitle, and the page's buttons.
export default function PageLayout({ title, subtitle, icon, banner, actions, extra, tabs, children, className }: PageLayoutProps) {
  return (
    <div className={className ? `page ${className}` : 'page'}>
      {banner && <img className="page-banner" src={banner} alt="" loading="lazy" />}
      {(title || icon || actions) && (
        <div className="page-head">
          <div className="page-title spread">
            <div className="page-identity">
              {icon}
              <div>
                {title && <h1>{title}</h1>}
                {subtitle && <p className="muted">{subtitle}</p>}
              </div>
            </div>
            {actions && <div className="head-actions">{actions}</div>}
          </div>
        </div>
      )}
      {extra}
      {tabs}
      {children}
    </div>
  )
}
