'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Mic, CheckCircle2, Clock, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useState } from 'react'

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
    <div className="min-h-screen bg-[#0B0F14]">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-32 px-4">
        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-5xl md:text-6xl font-bold mb-8 leading-tight">
              <span className="text-[#E6E8EB]">Practice once.</span>
              <br />
              <span className="text-[#E6E8EB]">Perform better everywhere.</span>
            </h1>
            <p className="text-xl md:text-2xl text-[#9AA4B2] mb-12 max-w-3xl mx-auto leading-relaxed">
              Get instant feedback on clarity, pacing, and structure — whether you're presenting in class, pitching investors, or closing a deal.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  variant="primary"
                  size="lg"
                  asChild
                  href="/app"
                >
                  Try it free (2 min recording)
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
                >
                  See how it works ↓
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Moving Testimonial Banner */}
      <section className="py-10 px-4 border-y border-[#181F2F] overflow-hidden bg-[#0B0E14]">
        <div className="relative">
          <p className="text-xs text-[#6B7280] text-center mb-6 tracking-wide uppercase">
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
                  <p className="text-sm text-[#9AA4B2] italic">"{testimonial.quote}"</p>
                  <p className="text-xs text-[#6B7280] mt-2">— {testimonial.author}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Interactive Example Section */}
      <section id="interactive-example" className="py-32 px-4 bg-[#0B0F14]">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-16 text-center"
          >
            <h2 className="text-4xl font-bold text-[#E6E8EB] mb-4">See what feedback looks like</h2>
            <p className="text-xl text-[#9AA4B2]">Watch how a short practice run turns into clear, actionable feedback.</p>
          </motion.div>

          <Card className="p-8 bg-[#151C2C] border-[#22283A]">
            {/* Default state: Show transcript only */}
            {!showFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="mb-6">
                  <p className="text-xs text-[#6B7280] uppercase tracking-wide mb-4">Example: Elevator pitch (45 seconds)</p>
                  <div className="space-y-3 mb-6">
                    {exampleTranscript.map((line, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-lg border bg-[#0B0F14] border-[#22283A] text-[#E6E8EB]"
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
                  <p className="text-xs text-[#6B7280] uppercase tracking-wide mb-4">Example: Elevator pitch (45 seconds)</p>
                  <div className="space-y-3 mb-6">
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
                          className={`p-4 rounded-lg border transition-all cursor-pointer ${
                            highlight
                              ? `${highlightClasses[highlight.type as keyof typeof highlightClasses]} ${
                                  isHovered || isInsightFocused ? 'ring-2 ring-offset-2 ring-offset-[#121826]' : ''
                                }`
                              : 'bg-[#0B0F14] border-[#22283A] text-[#E6E8EB]'
                          } ${
                            isHovered || isInsightFocused ? 'ring-[#F59E0B] shadow-lg shadow-[#F59E0B]/20' : ''
                          }`}
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
                  <Card className="p-6 bg-[#121826] border-[#22283A]">
                    <h4 className="text-lg font-bold text-[#E6E8EB] mb-4">Analysis Summary</h4>
                    
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
                        className={`p-4 rounded-lg border transition-all cursor-pointer ${
                          focusedInsight === 'strength'
                            ? 'bg-[#22C55E]/10 border-[#22C55E]/30 ring-2 ring-[#22C55E]/20'
                            : 'bg-[#0B0F14] border-[#22283A]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
                          <h5 className="text-sm font-semibold text-[#22C55E] uppercase tracking-wide">
                            {analysisInsights.strength.title}
                          </h5>
                        </div>
                        <p className="text-sm text-[#E6E8EB] leading-relaxed">
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
                        className={`p-4 rounded-lg border transition-all cursor-pointer ${
                          focusedInsight === 'pacing'
                            ? 'bg-[#F97316]/10 border-[#F97316]/30 ring-2 ring-[#F97316]/20'
                            : 'bg-[#0B0F14] border-[#22283A]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-[#F97316]" />
                          <h5 className="text-sm font-semibold text-[#F97316] uppercase tracking-wide">
                            {analysisInsights.pacing.title}
                          </h5>
                        </div>
                        <p className="text-sm text-[#E6E8EB] leading-relaxed">
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
                        className={`p-4 rounded-lg border transition-all cursor-pointer ${
                          focusedInsight === 'cut'
                            ? 'bg-[#EF4444]/10 border-[#EF4444]/30 ring-2 ring-[#EF4444]/20'
                            : 'bg-[#0B0F14] border-[#22283A]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Scissors className="h-4 w-4 text-[#EF4444]" />
                          <h5 className="text-sm font-semibold text-[#EF4444] uppercase tracking-wide">
                            {analysisInsights.cut.title}
                          </h5>
                        </div>
                        <p className="text-sm text-[#E6E8EB] leading-relaxed">
                          {analysisInsights.cut.text}
                        </p>
                      </div>
                    </div>
                  </Card>
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
          </Card>
        </div>
      </section>

      {/* Analysis Summary Section */}
      <section className="py-32 px-4 bg-[#0B0F14]">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-12 text-center"
          >
            <h2 className="text-4xl font-bold text-[#E6E8EB] mb-4">Here's what we analyze for every pitch</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* What's Working */}
            <Card className="p-6 bg-[#121826] border-[#22283A]">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="h-5 w-5 text-[#22C55E]" />
                <h3 className="text-lg font-bold text-[#E6E8EB]">WHAT'S WORKING</h3>
              </div>
              <p className="text-sm text-[#9AA4B2] leading-relaxed">
                Emphasize strengths and clarity. We highlight what you're doing well so you can build on it.
              </p>
            </Card>

            {/* What to Improve */}
            <Card className="p-6 bg-[#121826] border-[#22283A]">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-[#F97316]" />
                <h3 className="text-lg font-bold text-[#E6E8EB]">WHAT TO IMPROVE</h3>
              </div>
              <p className="text-sm text-[#9AA4B2] leading-relaxed">
                Pacing, order, clarity. We identify areas where small changes can make a big difference.
              </p>
            </Card>

            {/* Suggested Focus */}
            <Card className="p-6 bg-[#121826] border-[#22283A]">
              <div className="flex items-center gap-2 mb-4">
                <Scissors className="h-5 w-5 text-[#EF4444]" />
                <h3 className="text-lg font-bold text-[#E6E8EB]">SUGGESTED FOCUS</h3>
              </div>
              <p className="text-sm text-[#9AA4B2] leading-relaxed">
                What to cut or shorten. Clear time-based impact so you know exactly how much you'll save.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Your Turn Section */}
      <section className="py-32 px-4 bg-[#121826]">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold text-[#E6E8EB] mb-4">Try it on your own</h2>
            <p className="text-xl text-[#9AA4B2]">We'll give you a simple prompt to get started. No prep required.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Card className="p-8 bg-[#151C2C] border-[#22283A]">
              <h3 className="text-2xl font-bold text-[#E6E8EB] mb-4">Elevator pitch</h3>
              <p className="text-lg text-[#9AA4B2] mb-6 leading-relaxed">
                Imagine you're explaining what you're working on to someone new.
              </p>
              
              <div className="space-y-2 mb-8">
                <div className="flex items-start gap-2 text-sm text-[#6B7280]">
                  <span className="mt-1">•</span>
                  <span>What are you working on?</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-[#6B7280]">
                  <span className="mt-1">•</span>
                  <span>Who is it for?</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-[#6B7280]">
                  <span className="mt-1">•</span>
                  <span>Why does it matter?</span>
                </div>
              </div>

              <div className="pt-6 border-t border-[#22283A]">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="mb-4"
                >
                  <Button
                    variant="primary"
                    size="lg"
                    asChild
                    href="/app"
                    className="w-full"
                  >
                    Try it free (2 min recording)
                  </Button>
                </motion.div>
                <p className="text-xs text-[#6B7280] text-center">
                  Aim for 30–60 seconds · No signup required
                </p>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0B0F14] border-t border-[#22283A] text-[#9AA4B2] py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-[#F59E0B] rounded-lg flex items-center justify-center">
                  <span className="text-[#0B0F14] font-bold text-lg">P</span>
                </div>
                <span className="font-bold text-[#E6E8EB] text-lg">PitchPractice</span>
              </div>
              <p className="text-sm text-[#6B7280]">Practice your pitch. Get precise feedback.</p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <Link href="/app" className="hover:text-[#F59E0B] transition-colors">
                Try Free
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-[#22283A] text-center text-sm text-[#6B7280]">
            © {new Date().getFullYear()} PitchPractice. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
