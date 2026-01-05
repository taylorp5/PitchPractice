'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Check } from 'lucide-react'

export default function UpgradePage() {
  return (
    <div className="min-h-screen bg-[#0B0F14]">
      <div className="max-w-4xl mx-auto py-32 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-[#E6E8EB] mb-4">Upgrade</h1>
          <p className="text-xl text-[#9AA4B2]">Practice longer and get deeper feedback.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Free Plan */}
          <Card className="p-8 bg-[#121826] border-[#22283A]">
            <h2 className="text-2xl font-bold text-[#E6E8EB] mb-4">Free</h2>
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#9AA4B2]">Short practice runs</p>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#9AA4B2]">Transcript + core feedback</p>
              </div>
            </div>
          </Card>

          {/* Pro Plan */}
          <Card className="p-8 bg-[#151C2C] border-[#F59E0B] relative">
            <div className="absolute top-4 right-4">
              <span className="text-xs font-semibold text-[#F59E0B] uppercase tracking-wide bg-[#F59E0B]/10 px-2 py-1 rounded">
                Pro
              </span>
            </div>
            <h2 className="text-2xl font-bold text-[#E6E8EB] mb-4">Pro</h2>
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#9AA4B2]">Longer practice runs</p>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#9AA4B2]">Richer feedback and analysis</p>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#9AA4B2]">Saved history</p>
              </div>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => {
                // TODO: Link to checkout when payments are implemented
                // For now, show a simple message
                alert('Upgrade coming soon!')
              }}
            >
              Upgrade to Pro
            </Button>
          </Card>
        </div>

        <div className="text-center">
          <Button
            variant="ghost"
            size="md"
            asChild
            href="/"
          >
            ← Back to home
          </Button>
        </div>
      </div>
    </div>
  )
}


