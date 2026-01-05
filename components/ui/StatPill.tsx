interface StatPillProps {
  label: string
  value: string | number
  className?: string
}

export function StatPill({ label, value, className = '' }: StatPillProps) {
  return (
    <div className={`text-center ${className}`}>
      <p className="text-sm font-medium text-gray-600 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}



