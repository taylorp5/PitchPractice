'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Mic, CheckCircle2, Clock, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useState } from 'react'

export default function LandingPage() {
  // Interactive walkthrough state
  const [walkthroughStep, setWalkthroughStep] = useState<'idle' | 'recording' | 'recorded' | 'analyzing' | 'analyzed'>('idle')
  const [recordingTime, setRecordingTime] = useState(0) // in seconds
  const [visibleTranscriptLines, setVisibleTranscriptLines] = useState<number[]>([])
  const [showMetrics, setShowMetrics] = useState(false)
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

  // Handle recording simulation
  const handleStartRecording = () => {
    setWalkthroughStep('recording')
    setRecordingTime(0)
    setVisibleTranscriptLines([])
    
    // Simulate recording timer
    const timerInterval = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= 45) {
          clearInterval(timerInterval)
          setWalkthroughStep('recorded')
          return 45
        }
        return prev + 1
      })
    }, 100)

    // Type transcript line by line
    exampleTranscript.forEach((_, idx) => {
      setTimeout(() => {
        setVisibleTranscriptLines(prev => [...prev, idx])
      }, idx * 800) // ~800ms per line
    })
  }

  // Handle analysis
  const handleAnalyze = () => {
    setWalkthroughStep('analyzing')
    
    // Lock transcript, show metrics
    setTimeout(() => {
      setShowMetrics(true)
      setWalkthroughStep('analyzed')
      
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
    }, 800)
  }

  // Reset walkthrough
  const handleReset = () => {
    setWalkthroughStep('idle')
    setRecordingTime(0)
    setVisibleTranscriptLines([])
    setShowMetrics(false)
    setVisibleHighlights([])
  }

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-[#0B0E14]">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-32 px-4">
        {/* Very subtle radial amber glow */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute w-[800px] h-[800px] bg-[#F3B34C] rounded-full blur-[200px] opacity-[0.08]"></div>
        </div>
        
        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-5xl md:text-6xl font-bold mb-8 leading-tight">
              <span className="text-[#E5E7EB]">Practice once.</span>
              <br />
              <span className="text-[#F3B34C]">Perform better everywhere.</span>
            </h1>
            <p className="text-xl md:text-2xl text-[#9CA3AF] mb-12 max-w-3xl mx-auto leading-relaxed">
              Whether you're a student presenting, a founder pitching investors, or a sales professional closing deals—get instant, actionable feedback on your pitch.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group"
              >
                <Button
                  variant="primary"
                  size="lg"
                  asChild
                  href="/app"
                  className="shadow-none group-hover:shadow-lg group-hover:shadow-[#F59E0B]/30"
                >
                  Start Recording <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  variant="secondary"
                  size="lg"
                  asChild
                  href="/example"
                >
                  See example
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Moving Testimonial Banner */}
      <section className="py-10 px-4 border-y border-[#181F2F] overflow-hidden bg-[#0B0E14]">
        <div className="relative">
          <p className="text-xs text-[#64748B] text-center mb-6 tracking-wide uppercase">
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
                  <p className="text-sm text-[#9CA3AF] italic">"{testimonial.quote}"</p>
                  <p className="text-xs text-[#64748B] mt-2">— {testimonial.author}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Practice once. See what happens. */}
      <section className="py-32 px-4 bg-[#121826]">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-16 text-center"
          >
            <h2 className="text-4xl font-bold text-[#E5E7EB] mb-4">Practice once. See what happens.</h2>
            <p className="text-xl text-[#9CA3AF]">Walk through a sample pitch step by step — no microphone required.</p>
          </motion.div>

          <Card className="p-8">
            {/* STEP 1 — Record */}
            {walkthroughStep === 'idle' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <h3 className="text-2xl font-bold text-[#E5E7EB] mb-6">STEP 1 — Record</h3>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleStartRecording}
                  className="mb-3"
                >
                  <Mic className="mr-2 h-5 w-5" />
                  Record your pitch
                </Button>
                <p className="text-sm text-[#9CA3AF]">Example mode — no microphone needed</p>
              </motion.div>
            )}

            {/* Recording in progress */}
            {(walkthroughStep === 'recording' || walkthroughStep === 'recorded') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-[#E5E7EB] mb-4">STEP 1 — Record</h3>
                  <div className="flex items-center justify-center gap-3 mb-6">
                    <div className="w-3 h-3 bg-[#FB7185] rounded-full animate-pulse"></div>
                    <span className="text-lg font-medium text-[#E5E7EB]">
                      {walkthroughStep === 'recording' ? 'Recording…' : 'Recording complete'}
                    </span>
                    <span className="text-lg text-[#9CA3AF]">{formatTime(recordingTime)}</span>
                  </div>
                </div>

                {/* Transcript appears line by line */}
                <div className="space-y-3 mb-6">
                  {exampleTranscript.map((line, idx) => {
                    const isVisible = visibleTranscriptLines.includes(idx)
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{
                          opacity: isVisible ? 1 : 0,
                          y: isVisible ? 0 : 10,
                        }}
                        transition={{ duration: 0.3 }}
                        className={`p-4 rounded-lg border ${
                          isVisible
                            ? 'bg-[#0B0E14] border-[#181F2F] text-[#E5E7EB]'
                            : 'bg-transparent border-transparent text-transparent'
                        }`}
                      >
                        {line.text}
                      </motion.div>
                    )
                  })}
                </div>

                {/* STEP 2 — Analyze button appears after recording */}
                {walkthroughStep === 'recorded' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="text-center"
                  >
                    <h3 className="text-2xl font-bold text-[#E5E7EB] mb-6">STEP 2 — Analyze</h3>
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={handleAnalyze}
                    >
                      Analyze my pitch
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* STEP 2 — Analysis results */}
            {(walkthroughStep === 'analyzing' || walkthroughStep === 'analyzed') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <h3 className="text-2xl font-bold text-[#E5E7EB] mb-6">STEP 2 — Analyze</h3>
                
                {/* Locked transcript with highlights */}
                <div className="space-y-3 mb-6">
                  {exampleTranscript.map((line, idx) => {
                    const highlight = visibleHighlights.find(h => h.lineIdx === idx)
                    const isHovered = hoveredHighlight === idx
                    const insightKey = line.insightKey
                    const isInsightFocused = focusedInsight === insightKey && insightKey === line.insightKey
                    
                    const highlightClasses = {
                      strength: 'bg-[#84CC16]/20 border-[#84CC16]/30 text-[#84CC16]',
                      pacing: 'bg-[#F3B34C]/20 border-[#F3B34C]/30 text-[#F3B34C]',
                      cut: 'bg-[#FB7185]/20 border-[#FB7185]/30 text-[#FB7185]',
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
                            : 'bg-[#0B0E14] border-[#181F2F] text-[#E5E7EB]'
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

                {/* Metrics with interpretation */}
                {showMetrics && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-6"
                  >
                    <div className="flex gap-6 justify-center mb-2 text-sm text-[#9CA3AF]">
                      <span>87 words</span>
                      <span>•</span>
                      <span>{formatTime(45)}</span>
                    </div>
                    <p className="text-sm text-[#9CA3AF] text-center">
                      This length is solid for an elevator pitch. You could aim for 30–35 seconds for more impact.
                    </p>
                  </motion.div>
                )}

                {/* Analysis Summary Panel */}
                {walkthroughStep === 'analyzed' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="mb-6"
                  >
                    <Card className="p-6 bg-[#181F2F] border-[#22283A]">
                      <h4 className="text-lg font-bold text-[#E5E7EB] mb-4">Analysis Summary</h4>
                      
                      <div className="space-y-6">
                        {/* What's working */}
                        <div
                          onMouseEnter={() => {
                            setFocusedInsight('strength')
                            // Highlight the corresponding transcript line (line 1)
                            setHoveredHighlight(1)
                          }}
                          onMouseLeave={() => {
                            setFocusedInsight(null)
                            setHoveredHighlight(null)
                          }}
                          className={`p-4 rounded-lg border transition-all cursor-pointer ${
                            focusedInsight === 'strength'
                              ? 'bg-[#84CC16]/10 border-[#84CC16]/30 ring-2 ring-[#84CC16]/20'
                              : 'bg-[#0B0E14] border-[#181F2F]'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-4 w-4 text-[#84CC16]" />
                            <h5 className="text-sm font-semibold text-[#84CC16] uppercase tracking-wide">
                              {analysisInsights.strength.title}
                            </h5>
                          </div>
                          <p className="text-sm text-[#E5E7EB] leading-relaxed">
                            {analysisInsights.strength.text}
                          </p>
                        </div>

                        {/* What to improve */}
                        <div
                          onMouseEnter={() => {
                            setFocusedInsight('pacing')
                            // Highlight the corresponding transcript line (line 5)
                            setHoveredHighlight(5)
                          }}
                          onMouseLeave={() => {
                            setFocusedInsight(null)
                            setHoveredHighlight(null)
                          }}
                          className={`p-4 rounded-lg border transition-all cursor-pointer ${
                            focusedInsight === 'pacing'
                              ? 'bg-[#F3B34C]/10 border-[#F3B34C]/30 ring-2 ring-[#F3B34C]/20'
                              : 'bg-[#0B0E14] border-[#181F2F]'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-[#F3B34C]" />
                            <h5 className="text-sm font-semibold text-[#F3B34C] uppercase tracking-wide">
                              {analysisInsights.pacing.title}
                            </h5>
                          </div>
                          <p className="text-sm text-[#E5E7EB] leading-relaxed">
                            {analysisInsights.pacing.text}
                          </p>
                        </div>

                        {/* Suggested focus */}
                        <div
                          onMouseEnter={() => {
                            setFocusedInsight('cut')
                            // Highlight the corresponding transcript line (line 3)
                            setHoveredHighlight(3)
                          }}
                          onMouseLeave={() => {
                            setFocusedInsight(null)
                            setHoveredHighlight(null)
                          }}
                          className={`p-4 rounded-lg border transition-all cursor-pointer ${
                            focusedInsight === 'cut'
                              ? 'bg-[#FB7185]/10 border-[#FB7185]/30 ring-2 ring-[#FB7185]/20'
                              : 'bg-[#0B0E14] border-[#181F2F]'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Scissors className="h-4 w-4 text-[#FB7185]" />
                            <h5 className="text-sm font-semibold text-[#FB7185] uppercase tracking-wide">
                              {analysisInsights.cut.title}
                            </h5>
                          </div>
                          <p className="text-sm text-[#E5E7EB] leading-relaxed">
                            {analysisInsights.cut.text}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )}

                <p className="text-xs text-[#64748B] text-center mb-6">Based on an elevator pitch</p>

                {/* STEP 3 — Your turn */}
                {walkthroughStep === 'analyzed' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="text-center pt-6 border-t border-[#22283A]"
                  >
                    <h3 className="text-2xl font-bold text-[#E5E7EB] mb-4">STEP 3 — Your turn</h3>
                    <p className="text-lg text-[#9CA3AF] mb-6">Ready to try your own?</p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                      <Button
                        variant="primary"
                        size="lg"
                        asChild
                        href="/app"
                      >
                        Start recording (2 min free)
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={handleReset}
                      >
                        Reset example
                      </Button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </Card>
        </div>
      </section>

      {/* Try it now */}
      <section className="py-32 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold text-[#E5E7EB] mb-4">Try it now</h2>
            <p className="text-xl text-[#9CA3AF]">We'll give you a simple prompt to get started. No prep required.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Card className="p-8 bg-[#181F2F] border-[#22283A]">
              <h3 className="text-2xl font-bold text-[#E5E7EB] mb-4">Elevator pitch</h3>
              <p className="text-lg text-[#9CA3AF] mb-6 leading-relaxed">
                Imagine you're explaining what you're working on to someone new.
              </p>
              
              <div className="space-y-2 mb-8">
                <div className="flex items-start gap-2 text-sm text-[#64748B]">
                  <span className="mt-1">•</span>
                  <span>What are you working on?</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-[#64748B]">
                  <span className="mt-1">•</span>
                  <span>Who is it for?</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-[#64748B]">
                  <span className="mt-1">•</span>
                  <span>Why does it matter?</span>
                </div>
              </div>

              <div className="pt-6 border-t border-[#181F2F]">
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
                    <Mic className="mr-2 h-5 w-5" />
                    Start recording (2 min free)
                  </Button>
                </motion.div>
                <p className="text-xs text-[#64748B] text-center">
                  Aim for 30–60 seconds. There's no right answer.
                </p>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="try-it" className="py-32 px-4 bg-[#121826]">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-[#E5E7EB] mb-6">
              Ready to speak with confidence?
            </h2>
            <p className="text-xl text-[#9CA3AF] mb-12 max-w-2xl mx-auto leading-relaxed">
              Stop wondering if your pitch hits. Record once, get instant feedback, and walk into your next presentation knowing you're ready.
            </p>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="primary"
                size="lg"
                asChild
                href="/app"
                className="text-lg px-8 py-4"
              >
                <Mic className="mr-2 h-5 w-5" />
                Start Recording
              </Button>
            </motion.div>
            <p className="text-sm text-[#64748B] mt-6">Free for up to 2 minutes • No sign-up required</p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0B0E14] border-t border-[#181F2F] text-[#9CA3AF] py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-[#F59E0B] rounded-lg flex items-center justify-center">
                  <span className="text-[#0B0E14] font-bold text-lg">P</span>
                </div>
                <span className="font-bold text-[#E5E7EB] text-lg">PitchPractice</span>
              </div>
              <p className="text-sm text-[#64748B]">Practice your pitch. Get precise feedback.</p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <Link href="/app" className="hover:text-[#F59E0B] transition-colors">
                Try Free
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-[#181F2F] text-center text-sm text-[#64748B]">
            © {new Date().getFullYear()} PitchPractice. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
