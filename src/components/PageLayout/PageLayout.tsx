import type { ReactNode } from 'react'
import { PageHeading } from '@x-tech-laboratories/x-libs/web/react/layout'

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
      {(title || icon || actions) && <PageHeading title={title} subtitle={subtitle} icon={icon} banner={banner} actions={actions} />}
      {extra}
      {tabs}
      {children}
    </div>
  )
}
