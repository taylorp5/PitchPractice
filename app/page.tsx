'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Mic, CheckCircle2, Clock, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useState } from 'react'
import { colors, gradients } from '@/lib/theme'

export default function LandingPage() {
  // Interactive example state
  const [showFeedback, setShowFeedback] = useState(false)
  const [visibleHighlights, setVisibleHighlights] = useState<{ type: string; lineIdx: number }[]>([])
  const [hoveredHighlight, setHoveredHighlight] = useState<number | null>(null)
  const [focusedInsight, setFocusedInsight] = useState<string | null>(null)

  const testimonials = [
    { quote: "Helped me realize where I was rambling without noticing.", author: "Jamie, Sales" },
    { quote: "I cut almost a minute from my presentation and it still felt complete.", author: "Aimee, Educator" },
    { quote: "The pacing feedback was way more useful than I expected.", author: "Marcus, Student" },
    { quote: "Finally practiced without having to bug someone for feedback.", author: "Taylor, Business" },
    { quote: "I didn't realize how fast I was talking until I saw it written out.", author: "James, Founder" },
    { quote: "Simple, but surprisingly effective before a big meeting.", author: "Chris, Product" },
    { quote: "This caught things I wouldn't have thought to fix.", author: "Elena, Graduate Student" },
  ]

  const exampleTranscript = [
    { text: "Hi, I'm excited to share our product with you today.", type: null },
    { text: "We've built something that will revolutionize how teams collaborate.", type: 'strength', insightKey: 'strength' },
    { text: "Let me tell you a story about how we got started.", type: null },
    { text: "It was a rainy Tuesday in 2019 when our founder had this idea.", type: 'cut', insightKey: 'cut' },
    { text: "So we decided to build a platform that solves this problem.", type: null },
    { text: "Our solution is simple, powerful, and easy to use.", type: 'pacing', insightKey: 'pacing' },
  ]

  // Coach-like insights
  const analysisInsights = {
    strength: {
      title: "What's working",
      text: "Clear value statement early. You explain what you've built within the first 10 seconds, which helps listeners quickly understand your direction.",
    },
    pacing: {
      title: "What to improve",
      text: "Story comes too early. The personal backstory appears before you establish why the problem matters.",
    },
    cut: {
      title: "Suggested focus",
      text: "Cut the origin story for now. Removing this section would shorten your pitch by ~15 seconds without losing clarity.",
    },
  }

  // Handle getting feedback on example
  const handleGetFeedback = () => {
    setShowFeedback(true)
    
    // Show highlights sequentially
    const highlights = exampleTranscript
      .map((line, lineIdx) => line.type ? { type: line.type, lineIdx } : null)
      .filter((h): h is { type: string; lineIdx: number } => h !== null)
    
    // Show strength first
    setTimeout(() => {
      setVisibleHighlights([highlights[0]])
    }, 500)
    
    // Show pacing issue
    setTimeout(() => {
      setVisibleHighlights([highlights[0], highlights[2]])
    }, 2000)
    
    // Show suggested cut
    setTimeout(() => {
      setVisibleHighlights([highlights[0], highlights[2], highlights[1]])
    }, 3500)
  }

  // Reset example
  const handleResetExample = () => {
    setShowFeedback(false)
    setVisibleHighlights([])
    setHoveredHighlight(null)
    setFocusedInsight(null)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.background.primary }}>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-32 md:py-40 px-4">
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
            <h1 className="text-7xl md:text-8xl lg:text-9xl font-bold mb-8 md:mb-10 leading-[1.05] tracking-tight" style={{ color: colors.text.primary }}>
              <span>Practice once.</span>
              <br />
              <span>Perform better everywhere.</span>
            </h1>
            <p className="text-xl md:text-2xl lg:text-3xl mb-12 md:mb-16 max-w-2xl mx-auto leading-relaxed" style={{ color: colors.text.secondary }}>
              Get instant feedback on clarity, pacing, and structure.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
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
                  aria-label="See an example of PitchPractice feedback"
                >
                  See an example ↓
                </Button>
              </motion.div>
            </div>
            <p className="text-sm md:text-base" style={{ color: colors.text.tertiary }}>Free practice run · No signup required</p>
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

      {/* Interactive Example Section */}
      <section 
        id="interactive-example" 
        className="py-32 px-4"
        style={{ backgroundColor: colors.background.primary }}
      >
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-16 text-center"
          >
            <h2 
              className="text-4xl font-bold mb-4"
              style={{ color: colors.text.primary }}
            >
              See what feedback looks like
            </h2>
            <p 
              className="text-xl"
              style={{ color: colors.text.secondary }}
            >
              Watch how a short practice run turns into clear, actionable feedback.
            </p>
          </motion.div>

          <div 
            className="p-8 rounded-lg border"
            style={{
              backgroundColor: colors.background.tertiary,
              borderColor: colors.border.primary,
            }}
          >
            {/* Default state: Show transcript only */}
            {!showFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="mb-6">
                  <p 
                    className="text-xs uppercase tracking-wide mb-4"
                    style={{ color: colors.text.tertiary }}
                  >
                    Example: Elevator pitch (45 seconds)
                  </p>
                  <div className="space-y-3 mb-6">
                    {exampleTranscript.map((line, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-lg border"
                        style={{
                          backgroundColor: colors.background.primary,
                          borderColor: colors.border.primary,
                          color: colors.text.primary,
                        }}
                      >
                        {line.text}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-center">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleGetFeedback}
                  >
                    Get feedback on example
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Feedback state: Show highlights and analysis */}
            {showFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="mb-6">
                  <p 
                    className="text-xs uppercase tracking-wide mb-4"
                    style={{ color: colors.text.tertiary }}
                  >
                    Example: Elevator pitch (45 seconds)
                  </p>
                  <div className="space-y-3 mb-6">
                    {exampleTranscript.map((line, idx) => {
                      const highlight = visibleHighlights.find(h => h.lineIdx === idx)
                      const isHovered = hoveredHighlight === idx
                      const insightKey = line.insightKey
                      const isInsightFocused = focusedInsight === insightKey && insightKey === line.insightKey
                      
                      // Colors are handled via inline styles using theme tokens below

                      const highlightIcons = {
                        strength: CheckCircle2,
                        pacing: Clock,
                        cut: Scissors,
                      }

                      const highlightLabels = {
                        strength: 'Strength',
                        pacing: 'Pacing issue',
                        cut: 'Suggested cut',
                      }

                      const Icon = highlight ? highlightIcons[highlight.type as keyof typeof highlightIcons] : null

                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3 }}
                          onMouseEnter={() => {
                            if (insightKey) {
                              setHoveredHighlight(idx)
                              setFocusedInsight(insightKey)
                            }
                          }}
                          onMouseLeave={() => {
                            setHoveredHighlight(null)
                            setFocusedInsight(null)
                          }}
                          className="p-4 rounded-lg border transition-all cursor-pointer"
                          style={{
                            backgroundColor: highlight 
                              ? (highlight.type === 'strength' ? colors.success.light : highlight.type === 'pacing' ? colors.warning.light : colors.error.light)
                              : colors.background.primary,
                            borderColor: highlight
                              ? (highlight.type === 'strength' ? colors.success.border : highlight.type === 'pacing' ? colors.warning.border : colors.error.border)
                              : colors.border.primary,
                            color: highlight
                              ? (highlight.type === 'strength' ? colors.success.primary : highlight.type === 'pacing' ? colors.warning.primary : colors.error.primary)
                              : colors.text.primary,
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              {line.text}
                            </div>
                            {highlight && Icon && (
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <Icon className="h-4 w-4" />
                                <span className="text-xs font-medium">
                                  {highlightLabels[highlight.type as keyof typeof highlightLabels]}
                                </span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>

                {/* Analysis Summary Panel */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="mb-6"
                >
                  <div 
                    className="p-6 rounded-lg border"
                    style={{
                      backgroundColor: colors.background.secondary,
                      borderColor: colors.border.primary,
                    }}
                  >
                    <h4 
                      className="text-lg font-bold mb-4"
                      style={{ color: colors.text.primary }}
                    >
                      Analysis Summary
                    </h4>
                    
                    <div className="space-y-6">
                      {/* What's working */}
                      <div
                        onMouseEnter={() => {
                          setFocusedInsight('strength')
                          setHoveredHighlight(1)
                        }}
                        onMouseLeave={() => {
                          setFocusedInsight(null)
                          setHoveredHighlight(null)
                        }}
                        className="p-4 rounded-lg border transition-all cursor-pointer"
                        style={{
                          backgroundColor: focusedInsight === 'strength' ? colors.success.light : colors.background.primary,
                          borderColor: focusedInsight === 'strength' ? colors.success.border : colors.border.primary,
                          boxShadow: focusedInsight === 'strength' ? `0 0 0 2px ${colors.success.border}` : 'none',
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4" style={{ color: colors.success.primary }} />
                          <h5 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.success.primary }}>
                            {analysisInsights.strength.title}
                          </h5>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: colors.text.primary }}>
                          {analysisInsights.strength.text}
                        </p>
                      </div>

                      {/* What to improve */}
                      <div
                        onMouseEnter={() => {
                          setFocusedInsight('pacing')
                          setHoveredHighlight(5)
                        }}
                        onMouseLeave={() => {
                          setFocusedInsight(null)
                          setHoveredHighlight(null)
                        }}
                        className="p-4 rounded-lg border transition-all cursor-pointer"
                        style={{
                          backgroundColor: focusedInsight === 'pacing' ? colors.warning.light : colors.background.primary,
                          borderColor: focusedInsight === 'pacing' ? colors.warning.border : colors.border.primary,
                          boxShadow: focusedInsight === 'pacing' ? `0 0 0 2px ${colors.warning.border}` : 'none',
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4" style={{ color: colors.warning.primary }} />
                          <h5 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.warning.primary }}>
                            {analysisInsights.pacing.title}
                          </h5>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: colors.text.primary }}>
                          {analysisInsights.pacing.text}
                        </p>
                      </div>

                      {/* Suggested focus */}
                      <div
                        onMouseEnter={() => {
                          setFocusedInsight('cut')
                          setHoveredHighlight(3)
                        }}
                        onMouseLeave={() => {
                          setFocusedInsight(null)
                          setHoveredHighlight(null)
                        }}
                        className="p-4 rounded-lg border transition-all cursor-pointer"
                        style={{
                          backgroundColor: focusedInsight === 'cut' ? colors.error.light : colors.background.primary,
                          borderColor: focusedInsight === 'cut' ? colors.error.border : colors.border.primary,
                          boxShadow: focusedInsight === 'cut' ? `0 0 0 2px ${colors.error.border}` : 'none',
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Scissors className="h-4 w-4" style={{ color: colors.error.primary }} />
                          <h5 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.error.primary }}>
                            {analysisInsights.cut.title}
                          </h5>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: colors.text.primary }}>
                          {analysisInsights.cut.text}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>

                <div className="text-center">
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={handleResetExample}
                  >
                    Reset example
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
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
