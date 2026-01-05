import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg' | 'none'
  shadow?: 'sm' | 'md' | 'lg'
}

export function Card({ 
  children, 
  className = '', 
  padding = 'md',
  shadow = 'md'
}: CardProps) {
  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    none: 'p-0',
  }
  
  const shadowClasses = {
    sm: 'shadow-sm shadow-black/20',
    md: 'shadow-lg shadow-black/30',
    lg: 'shadow-xl shadow-black/40',
  }

  return (
    <div className={`
      bg-[#121826] rounded-xl border border-[#181F2F]
      ${paddingClasses[padding]}
      ${shadowClasses[shadow]}
      transition-all duration-200
      ${className}
    `}>
      {children}
    </div>
  )
}
