'use client'

import { Check } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { Button } from '@/components/ui/Button'
import { getUserPlan, UserPlan, setDevPlanOverride } from '@/lib/plan'

function UpgradePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentPlan, setCurrentPlan] = useState<UserPlan>('free')
  const [isLoading, setIsLoading] = useState(true)
  const [devOverrideMessage, setDevOverrideMessage] = useState<string | null>(null)
  const isDev = typeof window !== 'undefined' && process.env.NODE_ENV !== 'production'
  
  useEffect(() => {
    getUserPlan().then(plan => {
      setCurrentPlan(plan)
      setIsLoading(false)
    })
  }, [])
  
  // Get plan from query param if present (for highlighting)
  const highlightedPlan = searchParams.get('plan') as UserPlan | null
  
  // Handle dev simulate upgrade
  const handleDevSimulate = (plan: UserPlan) => {
    if (!isDev) return
    setDevPlanOverride(plan)
    setDevOverrideMessage(`Dev plan override set to ${plan}`)
    setTimeout(() => {
      router.push('/app/practice')
    }, 1000)
  }
  
  // Handle clear dev override
  const handleClearDevOverride = () => {
    if (!isDev) return
    setDevPlanOverride(null)
    setDevOverrideMessage('Dev plan override cleared')
    getUserPlan().then(plan => {
      setCurrentPlan(plan)
    })
  }

  return (
    <div className="min-h-screen bg-[#F7F7F8] py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-[#111827] mb-4">
            Upgrade your practice
          </h1>
          <p className="text-lg text-[#6B7280] max-w-2xl mx-auto">
            Unlock deeper feedback, custom rubrics, and coaching-level insights.
          </p>
        </div>
        
        {/* Dev Override Message */}
        {devOverrideMessage && (
          <div className="mb-6 p-4 bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-lg text-center">
            <p className="text-sm text-[#22C55E] font-medium">{devOverrideMessage}</p>
          </div>
        )}
        
        {/* Dev Simulate Upgrade Section */}
        {isDev && highlightedPlan && ['starter', 'coach', 'daypass'].includes(highlightedPlan) && (
          <div className="mb-8 p-4 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#F59E0B] mb-1">DEV MODE: Simulate Upgrade</p>
                <p className="text-xs text-[#6B7280]">Click to set plan override and test features</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDevSimulate(highlightedPlan)}
                >
                  Simulate {highlightedPlan === 'daypass' ? 'Day Pass' : highlightedPlan.charAt(0).toUpperCase() + highlightedPlan.slice(1)}
                </Button>
                {localStorage.getItem('pp_dev_plan_override') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearDevOverride}
                  >
                    Clear Override
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pricing Cards - 4 cards: Free, Starter, Coach, Day Pass */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {/* Free (Try) */}
          <div className="bg-white rounded-xl border border-[rgba(17,24,39,0.10)] shadow-sm p-8 flex flex-col">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-2xl font-bold text-[#111827]">Free</h2>
                  <p className="text-sm text-[#6B7280] mt-0.5">Try</p>
                </div>
                {currentPlan === 'free' && (
                  <span className="text-xs font-semibold text-[#F59E0B] uppercase tracking-wide bg-[#F59E0B]/10 px-2 py-1 rounded">
                    Included
                  </span>
                )}
              </div>
              <div className="mt-4">
                <span className="text-4xl font-bold text-[#111827]">$0</span>
              </div>
            </div>

            <ul className="space-y-3 mb-8 flex-grow">
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-[#6B7280]">Up to 2-minute recordings</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-[#6B7280]">Transcript + basic feedback summary</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-[#6B7280]">Basic pacing metrics</span>
              </li>
            </ul>

            {currentPlan === 'free' ? (
              <Button
                variant="secondary"
                size="lg"
                className="w-full bg-gray-100 text-[#6B7280] border-[rgba(17,24,39,0.10)] hover:bg-gray-100 hover:text-[#6B7280]"
                disabled
              >
                Current plan
              </Button>
            ) : (
              <Link href="/try" className="block">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                >
                  Try it free
                </Button>
              </Link>
            )}
          </div>

          {/* Starter */}
          <div className="bg-white rounded-xl border border-[rgba(17,24,39,0.10)] shadow-sm p-8 flex flex-col">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-[#111827]">Starter</h2>
                {currentPlan === 'starter' && (
                  <span className="text-xs font-semibold text-[#F59E0B] uppercase tracking-wide bg-[#F59E0B]/10 px-2 py-1 rounded">
                    Included
                  </span>
                )}
              </div>
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-[#111827]">$</span>
                  <span className="text-4xl font-bold text-[#111827]">—</span>
                </div>
                <p className="text-sm text-[#6B7280] mt-1">Monthly / Yearly</p>
              </div>
            </div>

            <ul className="space-y-3 mb-8 flex-grow">
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-[#6B7280]">Up to 30-minute recordings</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-[#6B7280]">Prompt-based rubrics (Elevator pitch, Class intro, Sales opener)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-[#6B7280]">Transcript + feedback summary</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-[#6B7280]">Prompt question grading with evidence</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-[#6B7280]">Basic pacing metrics</span>
              </li>
            </ul>

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => router.push('/upgrade?plan=starter')}
            >
              {currentPlan === 'starter' ? 'Current Plan' : 'Upgrade to Starter'}
            </Button>
          </div>

          {/* Coach */}
          <div className="bg-white rounded-xl border border-[rgba(17,24,39,0.10)] shadow-sm p-8 flex flex-col relative">
            <div className="absolute top-4 right-4">
              <span className="text-xs font-semibold text-[#F59E0B] uppercase tracking-wide bg-[#F59E0B]/10 px-2 py-1 rounded">
                Most popular
              </span>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[#111827] mb-2">Coach</h2>
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-[#111827]">$</span>
                  <span className="text-4xl font-bold text-[#111827]">—</span>
                </div>
                <p className="text-sm text-[#6B7280] mt-1">Monthly / Yearly</p>
              </div>
            </div>

            <ul className="space-y-3 mb-8 flex-grow">
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-[#6B7280]">Up to 90-minute recordings</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-[#6B7280]">Custom AI-generated rubrics</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-[#6B7280]">Editable rubric builder (before recording)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-[#6B7280]">Sentence-level feedback & rewrite suggestions</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-[#6B7280]">Compare multiple attempts</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-[#6B7280]">Export scripts & feedback</span>
              </li>
            </ul>

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => router.push('/upgrade?plan=coach')}
            >
              {currentPlan === 'coach' ? 'Current Plan' : 'Upgrade to Coach'}
            </Button>
          </div>

          {/* Day Pass */}
          <div className="bg-white rounded-xl border border-[rgba(17,24,39,0.10)] shadow-sm p-8 flex flex-col">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-[#111827]">Day Pass</h2>
                <span className="text-xs font-semibold text-[#F59E0B] uppercase tracking-wide bg-[#F59E0B]/10 px-2 py-1 rounded">
                  One-time
                </span>
              </div>
              <div className="mt-4">
                <span className="text-4xl font-bold text-[#111827]">$</span>
                <span className="text-4xl font-bold text-[#111827]">—</span>
                <p className="text-sm text-[#6B7280] mt-1">One-day access</p>
              </div>
            </div>

            <ul className="space-y-3 mb-8 flex-grow">
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-[#6B7280]">Full Coach features for 24 hours</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-[#6B7280]">Unlimited recordings during access window</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-[#6B7280]">Ideal for interviews, presentations, or demos</span>
              </li>
            </ul>

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => router.push('/upgrade?plan=daypass')}
            >
              {currentPlan === 'daypass' ? 'Current Plan' : 'Get Day Pass'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function UpgradePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F7F8] py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-[#6B7280]">Loading...</p>
        </div>
      </div>
    }>
      <UpgradePageContent />
    </Suspense>
  )
}



