interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
    uploaded: { label: 'Uploaded', variant: 'warning' },
    transcribing: { label: 'Transcribing', variant: 'info' },
    transcribed: { label: 'Transcribed', variant: 'success' },
    analyzing: { label: 'Analyzing', variant: 'info' },
    analyzed: { label: 'Analyzed', variant: 'success' },
    error: { label: 'Error', variant: 'error' },
  }

  const config = statusConfig[status] || { label: status, variant: 'default' as const }

  return (
    <span className={`
      inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
      ${config.variant === 'success' ? 'bg-green-100 text-green-800' : ''}
      ${config.variant === 'warning' ? 'bg-yellow-100 text-yellow-800' : ''}
      ${config.variant === 'error' ? 'bg-red-100 text-red-800' : ''}
      ${config.variant === 'info' ? 'bg-blue-100 text-blue-800' : ''}
      ${config.variant === 'default' ? 'bg-gray-100 text-gray-800' : ''}
    `}>
      {config.label}
    </span>
  )
}



