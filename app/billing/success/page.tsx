'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { getSessionId } from '@/lib/session'

function BillingSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const syncEntitlement = async () => {
      const sessionId = searchParams.get('session_id')

      if (!sessionId) {
        setStatus('error')
        setErrorMessage('Missing session ID. Please contact support if you completed payment.')
        return
      }

      try {
        // Get client session ID for fallback
        const clientSessionId = getSessionId()

        const response = await fetch('/api/stripe/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            session_id: sessionId,
            client_session_id: clientSessionId,
          }),
        })

        const data = await response.json()

        if (!data.ok) {
          throw new Error(data.error || 'Failed to sync entitlement')
        }

        console.log(`[Billing Success] Successfully synced plan: ${data.plan}`)
        setStatus('success')

        // Redirect to practice page after a short delay
        setTimeout(() => {
          router.push('/app/practice')
        }, 2000)
      } catch (error: any) {
        console.error('[Billing Success] Error:', error)
        setStatus('error')
        setErrorMessage(error.message || 'Failed to unlock your plan. Please contact support.')
      }
    }

    syncEntitlement()
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-[#F7F7F8] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-[rgba(17,24,39,0.10)] shadow-sm p-8 text-center">
        {status === 'loading' && (
          <>
            <LoadingSpinner className="mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[#111827] mb-2">
              Success! Unlocking your plan...
            </h1>
            <p className="text-sm text-[#6B7280]">
              Please wait while we activate your features.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-[#22C55E] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#111827] mb-2">
              Plan Activated!
            </h1>
            <p className="text-sm text-[#6B7280] mb-4">
              Redirecting you to your practice page...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#111827] mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-[#6B7280] mb-4">
              {errorMessage}
            </p>
            <button
              onClick={() => router.push('/app/practice')}
              className="text-sm text-[#F59E0B] hover:underline"
            >
              Go to Practice Page
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F7F8] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    }>
      <BillingSuccessContent />
    </Suspense>
  )
}

