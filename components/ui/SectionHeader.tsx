import { ReactNode } from 'react'

interface SectionHeaderProps {
  title: string
  description?: string
  children?: ReactNode
}

export function SectionHeader({ title, description, children }: SectionHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">{title}</h2>
          {description && (
            <p className="text-gray-600 text-sm">{description}</p>
          )}
        </div>
        {children && <div>{children}</div>}
      </div>
    </div>
  )
}



