'use client'

import Link from 'next/link'
import { colors } from '@/lib/theme'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen py-12 px-4" style={{ backgroundColor: colors.background.primary }}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4" style={{ color: colors.text.primary }}>
            Privacy Policy
          </h1>
          <p className="text-base leading-relaxed" style={{ color: colors.text.secondary }}>
            We take your privacy seriously.
          </p>
        </div>

        <div 
          className="prose prose-invert max-w-none space-y-8"
          style={{ color: colors.text.primary }}
        >
          {/* What we collect */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: colors.text.primary }}>
              What we collect
            </h2>
            <ul className="list-disc pl-6 space-y-2" style={{ color: colors.text.secondary }}>
              <li>Account information (email, name)</li>
              <li>Audio recordings you upload or record</li>
              <li>Transcripts and feedback generated from your recordings</li>
              <li>Usage data to improve the product</li>
            </ul>
          </section>

          {/* Why we collect it */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: colors.text.primary }}>
              Why we collect it
            </h2>
            <p className="text-base leading-relaxed mb-4" style={{ color: colors.text.secondary }}>
              We use this information to:
            </p>
            <ul className="list-disc pl-6 space-y-2" style={{ color: colors.text.secondary }}>
              <li>Analyze your pitch and provide feedback</li>
              <li>Save your work based on your plan</li>
              <li>Improve accuracy and product quality</li>
            </ul>
          </section>

          {/* Audio & transcript storage */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: colors.text.primary }}>
              Audio & transcript storage
            </h2>
            <p className="text-base leading-relaxed mb-4" style={{ color: colors.text.secondary }}>
              Storage duration depends on your plan:
            </p>
            <ul className="list-disc pl-6 space-y-2" style={{ color: colors.text.secondary }}>
              <li><strong>Free:</strong> audio deleted within 24 hours; transcripts within 7 days</li>
              <li><strong>Starter:</strong> audio stored up to 30 days; transcripts up to 90 days</li>
              <li><strong>Coach:</strong> audio stored up to 180 days; transcripts stored until you delete them</li>
              <li><strong>Day Pass:</strong> audio stored for 24 hours; transcripts for 7 days</li>
            </ul>
          </section>

          {/* Your control */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: colors.text.primary }}>
              Your control
            </h2>
            <ul className="list-disc pl-6 space-y-2" style={{ color: colors.text.secondary }}>
              <li>You can delete your account at any time from Settings</li>
              <li>Deleting your account permanently removes your data</li>
            </ul>
          </section>

          {/* Data sharing */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: colors.text.primary }}>
              Data sharing
            </h2>
            <p className="text-base leading-relaxed" style={{ color: colors.text.secondary }}>
              We do not sell your data. We only share data with trusted service providers required to operate the product.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: colors.text.primary }}>
              Contact
            </h2>
            <p className="text-base leading-relaxed" style={{ color: colors.text.secondary }}>
              For privacy questions, contact us at{' '}
              <Link 
                href="/support"
                className="underline hover:no-underline"
                style={{ color: colors.accent.primary }}
              >
                support
              </Link>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t" style={{ borderColor: colors.border.primary }}>
          <Link 
            href="/"
            className="text-sm font-medium transition-colors"
            style={{ color: colors.accent.primary }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
