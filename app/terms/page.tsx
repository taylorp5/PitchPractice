'use client'

import Link from 'next/link'
import { colors } from '@/lib/theme'

export default function TermsPage() {
  return (
    <div className="min-h-screen py-12 px-4" style={{ backgroundColor: colors.background.primary }}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4" style={{ color: colors.text.primary }}>
            Terms & Conditions
          </h1>
          <p className="text-base leading-relaxed" style={{ color: colors.text.secondary }}>
            By using PitchPractice, you agree to these terms.
          </p>
        </div>

        <div 
          className="prose prose-invert max-w-none space-y-8"
          style={{ color: colors.text.primary }}
        >
          {/* Use of the service */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: colors.text.primary }}>
              Use of the service
            </h2>
            <p className="text-base leading-relaxed" style={{ color: colors.text.secondary }}>
              PitchPractice provides automated feedback based on audio analysis and AI-generated insights. Feedback is informational only and not guaranteed to be accurate or suitable for all purposes.
            </p>
          </section>

          {/* No guarantees */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: colors.text.primary }}>
              No guarantees
            </h2>
            <p className="text-base leading-relaxed" style={{ color: colors.text.secondary }}>
              We do not guarantee outcomes, performance, or results from using the service.
            </p>
          </section>

          {/* Account responsibility */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: colors.text.primary }}>
              Account responsibility
            </h2>
            <p className="text-base leading-relaxed" style={{ color: colors.text.secondary }}>
              You are responsible for maintaining the confidentiality of your account.
            </p>
          </section>

          {/* Subscriptions & payments */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: colors.text.primary }}>
              Subscriptions & payments
            </h2>
            <p className="text-base leading-relaxed" style={{ color: colors.text.secondary }}>
              Paid plans renew automatically unless canceled. One-time purchases (Day Pass) do not renew.
            </p>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: colors.text.primary }}>
              Termination
            </h2>
            <p className="text-base leading-relaxed" style={{ color: colors.text.secondary }}>
              We reserve the right to suspend or terminate accounts that violate these terms.
            </p>
          </section>

          {/* Limitation of liability */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: colors.text.primary }}>
              Limitation of liability
            </h2>
            <p className="text-base leading-relaxed" style={{ color: colors.text.secondary }}>
              PitchPractice is not liable for indirect or consequential damages arising from use of the service.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-semibold mb-4" style={{ color: colors.text.primary }}>
              Contact
            </h2>
            <p className="text-base leading-relaxed" style={{ color: colors.text.secondary }}>
              Questions can be directed to{' '}
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
