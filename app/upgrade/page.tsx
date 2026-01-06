'use client'

import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function UpgradePage() {
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

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Practice (Starter) */}
          <div className="bg-white rounded-xl border border-[rgba(17,24,39,0.10)] shadow-sm p-8 flex flex-col">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-[#111827]">Practice</h2>
                <span className="text-xs font-semibold text-[#F59E0B] uppercase tracking-wide bg-[#F59E0B]/10 px-2 py-1 rounded">
                  Included
                </span>
              </div>
              <div className="mt-4">
                <span className="text-4xl font-bold text-[#111827]">Free</span>
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
              variant="secondary"
              size="lg"
              className="w-full bg-gray-100 text-[#6B7280] border-[rgba(17,24,39,0.10)] hover:bg-gray-100 hover:text-[#6B7280]"
              disabled
            >
              Current plan
            </Button>
          </div>

          {/* Coach (Pro) */}
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
              onClick={() => {
                // Placeholder - no checkout wiring
              }}
            >
              Upgrade to Coach
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
              onClick={() => {
                // Placeholder - no checkout wiring
              }}
            >
              Get Day Pass
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}


