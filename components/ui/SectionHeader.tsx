import { ReactNode } from 'react'

interface SectionHeaderProps {
  title: string
  description?: string
  children?: ReactNode
  className?: string
}

export function SectionHeader({ title, description, children, className = '' }: SectionHeaderProps) {
  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#E5E7EB] mb-1">{title}</h2>
          {description && (
            <p className="text-[#9CA3AF] text-sm">{description}</p>
          )}
        </div>
        {children && <div>{children}</div>}
      </div>
    </div>
  )
}
