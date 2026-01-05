interface DividerProps {
  className?: string
}

export function Divider({ className = '' }: DividerProps) {
  return <div className={`border-t border-gray-200 ${className}`} />
}



