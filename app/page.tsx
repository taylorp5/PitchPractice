'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { CheckCircle2, Clock, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { colors, gradients } from '@/lib/theme'

export default function LandingPage() {

  const testimonials = [
    { quote: "Helped me realize where I was rambling without noticing.", author: "Jamie, Sales" },
    { quote: "I cut almost a minute from my presentation and it still felt complete.", author: "Aimee, Educator" },
    { quote: "The pacing feedback was way more useful than I expected.", author: "Marcus, Student" },
    { quote: "Finally practiced without having to bug someone for feedback.", author: "Taylor, Business" },
    { quote: "I didn't realize how fast I was talking until I saw it written out.", author: "James, Founder" },
    { quote: "Simple, but surprisingly effective before a big meeting.", author: "Chris, Product" },
    { quote: "This caught things I wouldn't have thought to fix.", author: "Elena, Graduate Student" },
  ]

  // Static example data
  const staticExample = {
    transcript: [
      {
        text: "Hi, I'm excited to share our product with you today. We've built something that will revolutionize how teams collaborate.",
        highlight: 'strength',
      },
      {
        text: "Let me tell you a story about how we got started. It was a rainy Tuesday in 2019 when our founder had this idea. After seeing teams struggle with communication, we decided to build a platform that solves this problem.",
        highlight: 'cut',
      },
      {
        text: "Our solution is simple, powerful, and easy to use. It integrates seamlessly with your existing tools and requires no training.",
        highlight: null,
      },
    ],
    feedback: {
      working: {
        title: "What's working",
        text: "Clear value statement early. You explain what you've built within the first 10 seconds, which helps listeners quickly understand your direction.",
      },
      improve: {
        title: "What to improve",
        text: "Story comes too early. The personal backstory appears before you establish why the problem matters.",
      },
      focus: {
        title: "Next focus",
        text: "Cut the origin story for now. Removing this section would shorten your pitch by ~15 seconds without losing clarity.",
      },
    },
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.background.primary }}>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 md:py-32 px-4">
        {/* Background gradient and vignette */}
        <div 
          className="absolute inset-0"
          style={{
            background: gradients.hero,
          }}
        />
        <div 
          className="absolute inset-0"
          style={{
            background: gradients.vignette,
          }}
        />
        {/* Subtle noise overlay (CSS only) */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
        
        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-8 md:mb-10 leading-[1.05] tracking-tight" style={{ color: colors.text.primary }}>
              Practice once.
              <br />
              Perform better everywhere.
            </h1>
            <p className="text-xl md:text-2xl mb-12 md:mb-16 max-w-2xl mx-auto leading-relaxed font-light" style={{ color: colors.text.secondary }}>
              Get instant feedback on clarity, pacing, and structure.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-3">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  variant="primary"
                  size="lg"
                  asChild
                  href="/try"
                  aria-label="Try PitchPractice free"
                >
                  Try it free
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => {
                    document.getElementById('interactive-example')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  aria-label="See an example of feedback"
                >
                  See an example ↓
                </Button>
              </motion.div>
            </div>
            <p className="text-sm tracking-wide" style={{ color: colors.text.tertiary }}>Free practice run · No signup required</p>
          </motion.div>
        </div>
      </section>

      {/* Moving Testimonial Banner */}
      <section 
        className="py-10 px-4 border-y overflow-hidden"
        style={{
          borderColor: colors.border.secondary,
          backgroundColor: colors.background.primary,
        }}
      >
        <div className="relative">
          <p 
            className="text-xs text-center mb-6 tracking-wide uppercase"
            style={{ color: colors.text.tertiary }}
          >
            Trusted by students, professionals, and founders preparing for real moments.
          </p>
          <div className="relative overflow-hidden">
            <motion.div
              className="flex gap-16"
              animate={{
                x: [0, -50 * testimonials.length + '%'],
              }}
              transition={{
                duration: 60,
                repeat: Infinity,
                ease: 'linear',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.animationPlayState = 'paused'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.animationPlayState = 'running'
              }}
            >
              {[...testimonials, ...testimonials, ...testimonials].map((testimonial, idx) => (
                <div
                  key={idx}
                  className="flex-shrink-0 text-center opacity-70 hover:opacity-100 transition-opacity min-w-[300px]"
                >
                  <p 
                    className="text-sm italic"
                    style={{ color: colors.text.secondary }}
                  >
                    "{testimonial.quote}"
                  </p>
                  <p 
                    className="text-xs mt-2"
                    style={{ color: colors.text.tertiary }}
                  >
                    — {testimonial.author}
                  </p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Example Section */}
      <section 
        id="interactive-example" 
        className="py-24 md:py-32 px-4"
        style={{ backgroundColor: colors.background.primary }}
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-12 md:mb-16 text-center"
          >
            <h2 
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ color: colors.text.primary }}
            >
              See an example
            </h2>
            <p 
              className="text-lg md:text-xl max-w-2xl mx-auto"
              style={{ color: colors.text.secondary }}
            >
              Here's what feedback looks like after one practice run.
            </p>
          </motion.div>

          {/* Two-column layout: Transcript (left) + Feedback (right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-8">
            {/* Left: Static Transcript Preview */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-4"
            >
              <div 
                className="p-6 rounded-lg border"
                style={{
                  backgroundColor: colors.background.secondary,
                  borderColor: colors.border.primary,
                }}
              >
                <p 
                  className="text-xs uppercase tracking-wide mb-4"
                  style={{ color: colors.text.tertiary }}
                >
                  Example: Elevator pitch (45 seconds)
                </p>
                <div className="space-y-4">
                  {staticExample.transcript.map((para, idx) => {
                    const isHighlighted = para.highlight !== null
                    const highlightColor = para.highlight === 'strength' 
                      ? colors.success 
                      : para.highlight === 'cut' 
                      ? colors.error 
                      : null
                    
                    return (
                      <p
                        key={idx}
                        className="leading-relaxed"
                        style={{
                          color: colors.text.primary,
                          padding: isHighlighted ? '0.75rem' : '0',
                          borderRadius: isHighlighted ? '0.375rem' : '0',
                          backgroundColor: isHighlighted && highlightColor ? highlightColor.light : 'transparent',
                          borderLeft: isHighlighted && highlightColor ? `3px solid ${highlightColor.border}` : 'none',
                          paddingLeft: isHighlighted ? '0.75rem' : '0',
                        }}
                      >
                        {para.text}
                      </p>
                    )
                  })}
                </div>
              </div>
            </motion.div>

            {/* Right: Compact Feedback Summary */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-4"
            >
              {/* What's working */}
              <div
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: colors.background.secondary,
                  borderColor: colors.border.primary,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4" style={{ color: colors.success.primary }} />
                  <h5 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.success.primary }}>
                    {staticExample.feedback.working.title}
                  </h5>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: colors.text.secondary }}>
                  {staticExample.feedback.working.text}
                </p>
              </div>

              {/* What to improve */}
              <div
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: colors.background.secondary,
                  borderColor: colors.border.primary,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4" style={{ color: colors.warning.primary }} />
                  <h5 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.warning.primary }}>
                    {staticExample.feedback.improve.title}
                  </h5>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: colors.text.secondary }}>
                  {staticExample.feedback.improve.text}
                </p>
              </div>

              {/* Next focus */}
              <div
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: colors.background.secondary,
                  borderColor: colors.border.primary,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Scissors className="h-4 w-4" style={{ color: colors.error.primary }} />
                  <h5 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.error.primary }}>
                    {staticExample.feedback.focus.title}
                  </h5>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: colors.text.secondary }}>
                  {staticExample.feedback.focus.text}
                </p>
              </div>
            </motion.div>
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center"
          >
            <Button
              variant="primary"
              size="lg"
              asChild
              href="/try"
              aria-label="Try PitchPractice free"
            >
              Try it free
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer 
        className="border-t py-12 px-4"
        style={{
          backgroundColor: colors.background.primary,
          borderColor: colors.border.primary,
          color: colors.text.secondary,
        }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: colors.accent.primary }}
                >
                  <span 
                    className="font-bold text-lg"
                    style={{ color: colors.background.primary }}
                  >
                    P
                  </span>
                </div>
                <span 
                  className="font-bold text-lg"
                  style={{ color: colors.text.primary }}
                >
                  PitchPractice
                </span>
              </div>
              <p 
                className="text-sm"
                style={{ color: colors.text.tertiary }}
              >
                Practice your pitch. Get precise feedback.
              </p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <Link 
                href="/try" 
                className="transition-colors"
                style={{ 
                  color: colors.text.secondary,
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = colors.accent.primary}
                onMouseLeave={(e) => e.currentTarget.style.color = colors.text.secondary}
              >
                Try Free
              </Link>
            </div>
          </div>
          <div 
            className="mt-8 pt-8 border-t text-center text-sm"
            style={{
              borderColor: colors.border.primary,
              color: colors.text.tertiary,
            }}
          >
            © {new Date().getFullYear()} PitchPractice. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
