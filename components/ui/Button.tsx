import { ButtonHTMLAttributes, ReactNode } from 'react'
import Link from 'next/link'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
  isLoading?: boolean
  asChild?: boolean
  href?: string
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  isLoading = false,
  className = '',
  disabled,
  asChild = false,
  href,
  ...props
}: ButtonProps) {
  const baseClasses = 'font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B0E14] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center'
  
  const variantClasses = {
    primary: 'bg-[#F59E0B] hover:bg-[#D97706] text-[#0B0E14] focus:ring-[#F59E0B]',
    secondary: 'bg-transparent hover:bg-[#121826] border border-[#64748B] text-[#9CA3AF] hover:text-[#E5E7EB] hover:border-[#9CA3AF] focus:ring-[#64748B]',
    ghost: 'bg-transparent hover:bg-[#121826] text-[#E5E7EB] hover:text-[#F59E0B] focus:ring-[#64748B]',
    danger: 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-md hover:shadow-lg focus:ring-red-500',
  }
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  }

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`

  if (asChild && href) {
    return (
      <Link href={href} className={classes}>
        {isLoading ? (
          <span className="flex items-center gap-2">
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
            <span>Loading...</span>
          </span>
        ) : (
          children
        )}
      </Link>
    )
  }

  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
          <span>Loading...</span>
        </span>
      ) : (
        children
      )}
    </button>
  )
}
