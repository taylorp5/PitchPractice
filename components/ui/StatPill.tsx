interface StatPillProps {
  label: string
  value: string | number | null | undefined
  className?: string
}

export function StatPill({ label, value, className = '' }: StatPillProps) {
  return (
    <div className={`inline-flex flex-col items-center px-4 py-3 rounded-lg bg-[#151A23] border border-[#22283A] ${className}`}>
      <p className="text-xs font-medium text-[#9CA3AF] mb-1">{label}</p>
      <p className="text-xl font-bold text-[#E5E7EB]">{value !== null && value !== undefined ? value : '—'}</p>
    </div>
  )
}
