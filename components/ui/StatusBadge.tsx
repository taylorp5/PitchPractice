import { Badge } from './Badge'

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const statusMap: Record<string, { text: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' }> = {
    uploaded: { text: 'Uploaded', variant: 'warning' },
    transcribing: { text: 'Transcribing', variant: 'primary' },
    transcribed: { text: 'Transcribed', variant: 'primary' },
    analyzing: { text: 'Generating feedback...', variant: 'primary' },
    analyzed: { text: 'Feedback ready', variant: 'primary' },
    error: { text: 'Error', variant: 'danger' },
  }

  const { text, variant } = statusMap[status] || { text: status, variant: 'default' }

  return (
    <Badge variant={variant} className={className}>
      {text}
    </Badge>
  )
}
