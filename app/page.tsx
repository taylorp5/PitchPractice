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
    { quote: "I didn't realize how many filler phrases I used until I saw it highlighted.", author: "Maya, Student" },
    { quote: "The pacing notes were the difference between 'okay' and actually confident.", author: "Chris, Sales" },
    { quote: "Helped me cut 30 seconds without losing the point.", author: "Elena, Founder" },
    { quote: "I practiced twice and felt way calmer walking into the meeting.", author: "Jordan, Product" },
    { quote: "Seeing my transcript made it obvious where I rambled.", author: "Sam, Consultant" },
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
      <section className="relative overflow-hidden py-32 md:py-48 lg:py-56 px-4">
        {/* Background gradient - deep navy */}
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
        {/* Subtle noise overlay */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
        {/* Very subtle glow behind hero text */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-[0.08] blur-3xl pointer-events-none"
          style={{
            background: `radial-gradient(ellipse, ${colors.accent.primary} 0%, transparent 70%)`,
          }}
        />
        
        <div className="relative max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold mb-10 md:mb-12 leading-[1.1] tracking-tight" style={{ color: colors.text.primary }}>
              <span className="block mb-3">Practice once.</span>
              <span className="block">Perform better everywhere.</span>
            </h1>
            <p className="text-xl md:text-2xl lg:text-3xl mb-16 md:mb-20 max-w-3xl mx-auto leading-relaxed font-normal" style={{ color: colors.text.secondary }}>
              Record yourself speaking and get instant feedback on clarity, pacing, and structure — before it actually matters.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Button
                  variant="primary"
                  size="lg"
                  asChild
                  href="/try"
                  className="shadow-md shadow-[#F59E0B]/15 hover:shadow-lg hover:shadow-[#F59E0B]/25 transition-all"
                >
                  Start practicing
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => {
                    document.getElementById('interactive-example')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="border border-[#1E293B] hover:border-[#334155] hover:bg-[#0F172A]/50 transition-all"
                >
                  See an example
                </Button>
              </motion.div>
            </div>
            <div className="flex flex-wrap justify-center items-center gap-6 md:gap-8 mb-8" style={{ color: colors.text.secondary }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">🎙</span>
                <div>
                  <div className="text-sm font-medium" style={{ color: colors.text.primary }}>Record</div>
                  <div className="text-xs" style={{ color: colors.text.tertiary }}>Say it out loud</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">✍</span>
                <div>
                  <div className="text-sm font-medium" style={{ color: colors.text.primary }}>Transcript</div>
                  <div className="text-xs" style={{ color: colors.text.tertiary }}>See exactly what you said</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🎯</span>
                <div>
                  <div className="text-sm font-medium" style={{ color: colors.text.primary }}>Feedback</div>
                  <div className="text-xs" style={{ color: colors.text.tertiary }}>Get clear suggestions</div>
                </div>
              </div>
            </div>
            <p className="text-sm md:text-base" style={{ color: colors.text.tertiary }}>
              Free practice run · No signup required
            </p>
          </motion.div>
        </div>
      </section>

      {/* Moving Testimonial Banner */}
      <section 
        className="py-16 px-4 border-y overflow-hidden relative"
        style={{
          borderColor: `${colors.border.primary}30`,
          backgroundColor: colors.background.primary,
        }}
      >
        <div className="absolute inset-0 opacity-5" style={{ background: `linear-gradient(90deg, ${colors.accent.primary} 0%, transparent 50%, ${colors.accent.primary} 100%)` }} />
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <p 
              className="text-sm md:text-base font-medium tracking-wide"
              style={{ color: colors.text.secondary }}
            >
              Trusted by students, professionals, and founders preparing for real moments
            </p>
          </div>
          <div className="relative overflow-hidden">
            {/* Gradient fades at edges */}
            <div 
              className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none"
              style={{
                background: `linear-gradient(to right, ${colors.background.primary}, transparent)`,
              }}
            />
            <div 
              className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none"
              style={{
                background: `linear-gradient(to left, ${colors.background.primary}, transparent)`,
              }}
            />
            <div className="marquee-container">
              <div className="flex gap-16 marquee-animate">
                {/* Render testimonials twice for seamless loop */}
                {[...testimonials, ...testimonials].map((testimonial, idx) => (
                  <div
                    key={idx}
                    className="flex-shrink-0 text-center min-w-[380px] px-4"
                  >
                    <div 
                      className="p-7 rounded-xl border backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100"
                      style={{
                        backgroundColor: `${colors.background.secondary}70`,
                        borderColor: `${colors.border.primary}40`,
                        opacity: 0.85,
                      }}
                    >
                      <p 
                        className="text-lg md:text-xl font-normal mb-4 leading-relaxed"
                        style={{ color: colors.text.primary }}
                      >
                        "{testimonial.quote}"
                      </p>
                      <p 
                        className="text-sm font-medium"
                        style={{ color: colors.text.secondary }}
                      >
                        — {testimonial.author}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Example Section */}
      <section 
        id="interactive-example" 
        className="py-40 md:py-48 px-4"
        style={{ backgroundColor: colors.background.primary }}
      >
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-24 text-center"
          >
            <h2 
              className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 leading-tight"
              style={{ color: colors.text.primary }}
            >
              See what feedback looks like
            </h2>
            <p 
              className="text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed"
              style={{ color: colors.text.secondary }}
            >
              Watch how a short practice run transforms into clear, actionable insights you can use immediately.
            </p>
          </motion.div>

          <div 
            className="p-8 md:p-12 rounded-2xl border"
            style={{
              backgroundColor: colors.background.secondary,
              borderColor: `${colors.border.primary}40`,
            }}
          >
            {/* Default state: Show transcript only */}
            {!showFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p 
                        className="text-sm font-semibold mb-1"
                        style={{ color: colors.text.primary }}
                      >
                        Example: Elevator pitch
                      </p>
                      <p 
                        className="text-xs"
                        style={{ color: colors.text.tertiary }}
                      >
                        45 seconds · 6 sentences
                      </p>
                    </div>
                    <div 
                      className="px-3 py-1.5 rounded-lg border"
                      style={{
                        backgroundColor: `${colors.accent.primary}08`,
                        borderColor: `${colors.accent.primary}25`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4" style={{ color: colors.accent.primary }} />
                        <span className="text-xs font-medium" style={{ color: colors.accent.primary }}>Recorded</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 mb-8">
                    {exampleTranscript.map((line, idx) => (
                      <div
                        key={idx}
                        className="p-5 rounded-xl border transition-all hover:border-[#334155]"
                        style={{
                          backgroundColor: colors.background.primary,
                          borderColor: `${colors.border.primary}40`,
                          color: colors.text.primary,
                        }}
                      >
                        <span className="text-sm leading-relaxed">{line.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-center">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleGetFeedback}
                    className="shadow-lg shadow-[#F59E0B]/20 hover:shadow-xl hover:shadow-[#F59E0B]/30"
                  >
                    <span className="flex items-center gap-2">
                      Get feedback on example
                      <ArrowRight className="w-5 h-5" />
                    </span>
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
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p 
                        className="text-sm font-semibold mb-1"
                        style={{ color: colors.text.primary }}
                      >
                        Example: Elevator pitch
                      </p>
                      <p 
                        className="text-xs"
                        style={{ color: colors.text.tertiary }}
                      >
                        45 seconds · 6 sentences
                      </p>
                    </div>
                    <div 
                      className="px-3 py-1.5 rounded-lg border"
                      style={{
                        backgroundColor: `${colors.accent.primary}08`,
                        borderColor: `${colors.accent.primary}25`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4" style={{ color: colors.accent.primary }} />
                        <span className="text-xs font-medium" style={{ color: colors.accent.primary }}>Analyzed</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 mb-8">
                    {exampleTranscript.map((line, idx) => {
                      const highlight = visibleHighlights.find(h => h.lineIdx === idx)
                      const isHovered = hoveredHighlight === idx
                      const insightKey = line.insightKey
                      const isInsightFocused = focusedInsight === insightKey && insightKey === line.insightKey
                      
                      const highlightClasses = {
                        strength: 'bg-[#22C55E]/20 border-[#22C55E]/30 text-[#22C55E]',
                        pacing: 'bg-[#F97316]/20 border-[#F97316]/30 text-[#F97316]',
                        cut: 'bg-[#EF4444]/20 border-[#EF4444]/30 text-[#EF4444]',
                      }

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
                              : `${colors.border.primary}40`,
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
                  className="mb-8"
                >
                  <div 
                    className="p-8 rounded-xl border"
                    style={{
                      backgroundColor: colors.background.secondary,
                      borderColor: `${colors.border.primary}40`,
                    }}
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${colors.accent.primary}20` }}
                      >
                        <CheckCircle2 className="w-5 h-5" style={{ color: colors.accent.primary }} />
                      </div>
                      <h4 
                        className="text-2xl font-bold"
                        style={{ color: colors.text.primary }}
                      >
                        Analysis Summary
                      </h4>
                    </div>
                    
                    <div className="space-y-4">
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
                        className={`p-5 rounded-xl border transition-all cursor-pointer ${
                          focusedInsight === 'strength'
                            ? 'bg-[#22C55E]/10 border-[#22C55E]/40 ring-2 ring-[#22C55E]/20 shadow-lg'
                            : 'bg-[#0B0F14] border-[#1E293B] hover:border-[#22C55E]/20'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`p-2 rounded-lg ${focusedInsight === 'strength' ? 'bg-[#22C55E]/20' : 'bg-[#22C55E]/10'}`}>
                            <CheckCircle2 className="h-5 w-5 text-[#22C55E]" />
                          </div>
                          <h5 className="text-base font-bold text-[#22C55E]">
                            {analysisInsights.strength.title}
                          </h5>
                        </div>
                        <p className="text-sm text-[#E6E8EB] leading-relaxed ml-11">
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
                        className={`p-5 rounded-xl border transition-all cursor-pointer ${
                          focusedInsight === 'pacing'
                            ? 'bg-[#F59E0B]/10 border-[#F59E0B]/40 ring-2 ring-[#F59E0B]/20 shadow-lg'
                            : 'bg-[#0B0F14] border-[#1E293B] hover:border-[#F59E0B]/20'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`p-2 rounded-lg ${focusedInsight === 'pacing' ? 'bg-[#F59E0B]/20' : 'bg-[#F59E0B]/10'}`}>
                            <Clock className="h-5 w-5 text-[#F59E0B]" />
                          </div>
                          <h5 className="text-base font-bold text-[#F59E0B]">
                            {analysisInsights.pacing.title}
                          </h5>
                        </div>
                        <p className="text-sm text-[#E6E8EB] leading-relaxed ml-11">
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
                        className={`p-5 rounded-xl border transition-all cursor-pointer ${
                          focusedInsight === 'cut'
                            ? 'bg-[#EF4444]/10 border-[#EF4444]/40 ring-2 ring-[#EF4444]/20 shadow-lg'
                            : 'bg-[#0B0F14] border-[#1E293B] hover:border-[#EF4444]/20'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`p-2 rounded-lg ${focusedInsight === 'cut' ? 'bg-[#EF4444]/20' : 'bg-[#EF4444]/10'}`}>
                            <Scissors className="h-5 w-5 text-[#EF4444]" />
                          </div>
                          <h5 className="text-base font-bold text-[#EF4444]">
                            {analysisInsights.cut.title}
                          </h5>
                        </div>
                        <p className="text-sm text-[#E6E8EB] leading-relaxed ml-11">
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
        className="border-t py-16 px-4"
        style={{
          backgroundColor: colors.background.primary,
          borderColor: `${colors.border.primary}30`,
          color: colors.text.secondary,
        }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
            <div className="mb-8 md:mb-0">
              <div className="flex items-center gap-3 mb-4">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                  style={{ 
                    backgroundColor: colors.accent.primary,
                    boxShadow: `0 4px 12px ${colors.accent.primary}30`,
                  }}
                >
                  <span 
                    className="font-bold text-xl"
                    style={{ color: colors.background.primary }}
                  >
                    P
                  </span>
                </div>
                <span 
                  className="font-bold text-xl"
                  style={{ color: colors.text.primary }}
                >
                  PitchPractice
                </span>
              </div>
              <p 
                className="text-base max-w-md leading-relaxed"
                style={{ color: colors.text.secondary }}
              >
                Practice your pitch. Get precise feedback. Perform with confidence.
              </p>
            </div>
            <div className="flex flex-wrap gap-8 text-sm">
              <Link 
                href="/try" 
                className="transition-all font-medium hover:scale-105 inline-block"
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
            className="pt-8 border-t text-center text-sm"
            style={{
              borderColor: `${colors.border.primary}30`,
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
