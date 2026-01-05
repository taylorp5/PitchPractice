'use client'

import { motion, useInView } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, ArrowDown, Mic } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useRef, useState, useEffect } from 'react'

export default function LandingPage() {
  // "From first take to ready" section state
  const [currentStage, setCurrentStage] = useState<'record' | 'transcript' | 'improve' | null>(null)
  const [visibleLines, setVisibleLines] = useState<number[]>([])
  const [showMetrics, setShowMetrics] = useState(false)
  const [showHighlights, setShowHighlights] = useState<{ type: string; lineIdx: number }[]>([])
  const howItWorksRef = useRef<HTMLDivElement>(null)
  const howItWorksInView = useInView(howItWorksRef, { once: true, margin: '-100px' })

  const testimonials = [
    { quote: "Helped me realize where I was rambling without noticing.", author: "Jamie, Sales" },
    { quote: "I cut almost a minute from my presentation and it still felt complete.", author: "Aimee, Educator" },
    { quote: "The pacing feedback was way more useful than I expected.", author: "Marcus, Student" },
    { quote: "Finally practiced without having to bug someone for feedback.", author: "Taylor, Business" },
    { quote: "I didn't realize how fast I was talking until I saw it written out.", author: "James, Founder" },
    { quote: "Simple, but surprisingly effective before a big meeting.", author: "Chris, Product" },
    { quote: "This caught things I wouldn't have thought to fix.", author: "Elena, Graduate Student" },
  ]

  const narrativeTranscript = [
    { text: "Hi, I'm excited to share our product with you today.", type: null },
    { text: "We've built something that will revolutionize how teams collaborate.", type: 'strength' },
    { text: "Let me tell you a story about how we got started.", type: null },
    { text: "It was a rainy Tuesday in 2019 when our founder had this idea.", type: 'cut' },
    { text: "So we decided to build a platform that solves this problem.", type: null },
    { text: "Our solution is simple, powerful, and easy to use.", type: 'pacing' },
    { text: "Would you like to see a demo?", type: null },
  ]

  // "From first take to ready" section animation
  useEffect(() => {
    if (howItWorksInView && currentStage === null) {
      // Stage 1: Record - lines appear one by one
      setCurrentStage('record')
      narrativeTranscript.forEach((_, idx) => {
        setTimeout(() => {
          setVisibleLines(prev => [...prev, idx])
          if (idx === narrativeTranscript.length - 1) {
            // Move to transcript stage after 1 second
            setTimeout(() => {
              setCurrentStage('transcript')
              setTimeout(() => {
                setShowMetrics(true)
                // Move to improve stage after 1.5 seconds
                setTimeout(() => {
                  setCurrentStage('improve')
                  // Show highlights sequentially
                  narrativeTranscript.forEach((line, lineIdx) => {
                    if (line.type) {
                      setTimeout(() => {
                        setShowHighlights(prev => [...prev, { type: line.type!, lineIdx }])
                      }, lineIdx * 400)
                    }
                  })
                }, 1500)
              }, 500)
            }, 1000)
          }
        }, idx * 300)
      })
    }
  }, [howItWorksInView, currentStage])

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

      {/* From first take to ready */}
      <section ref={howItWorksRef} className="py-32 px-4 bg-[#121826]">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <h2 className="text-4xl font-bold text-[#E5E7EB] mb-4">From first take to ready</h2>
            <p className="text-xl text-[#9CA3AF]">See how one practice run turns into clear, actionable feedback.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-16 items-start">
            {/* Left: Animated transcript demo */}
            <div className="relative">
              {/* Playhead line */}
              {currentStage && (
                <motion.div
                  className="absolute left-0 top-0 w-0.5 bg-[#F59E0B] opacity-30"
                  initial={{ height: 0 }}
                  animate={{
                    height: currentStage === 'record' ? '40%' : currentStage === 'transcript' ? '70%' : '100%',
                  }}
                  transition={{ duration: 0.8, ease: 'easeInOut' }}
                />
              )}

              <div className="space-y-3 pl-8">
                {narrativeTranscript.map((line, idx) => {
                  const isVisible = visibleLines.includes(idx)
                  const highlight = showHighlights.find(h => h.lineIdx === idx)
                  
                  const highlightClasses = {
                    strength: 'bg-[#84CC16]/20 border-[#84CC16]/30 text-[#84CC16]',
                    pacing: 'bg-[#F3B34C]/20 border-[#F3B34C]/30 text-[#F3B34C]',
                    cut: 'bg-[#FB7185]/20 border-[#FB7185]/30 text-[#FB7185]',
                  }

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{
                        opacity: isVisible ? 1 : 0,
                        y: isVisible ? 0 : 10,
                      }}
                      transition={{ duration: 0.4 }}
                      className={`p-4 rounded-lg border transition-all ${
                        highlight
                          ? highlightClasses[highlight.type as keyof typeof highlightClasses]
                          : currentStage === 'transcript'
                          ? 'bg-[#0B0E14] border-[#181F2F] text-[#E5E7EB]'
                          : 'bg-transparent border-transparent text-[#9CA3AF]'
                      }`}
                    >
                      {line.text}
                    </motion.div>
                  )
                })}

                {/* Metrics */}
                {showMetrics && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex gap-6 pt-4 text-sm text-[#9CA3AF]"
                  >
                    <span>487 words</span>
                    <span>•</span>
                    <span>3:45</span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Right: Stage indicators */}
            <div className="space-y-12">
              {/* Record */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="relative"
              >
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-3 h-3 rounded-full mt-2 transition-all ${
                    currentStage === 'record' ? 'bg-[#F59E0B]' : 'bg-[#64748B]'
                  }`} />
                  <div className="flex-1">
                    <motion.div
                      animate={{
                        color: currentStage === 'record' ? '#F59E0B' : '#64748B',
                      }}
                      className="text-sm font-medium mb-2 uppercase tracking-wide"
                    >
                      {currentStage === 'record' ? 'Recording your pitch…' : 'Record'}
                    </motion.div>
                    <p className="text-lg text-[#9CA3AF] leading-relaxed">
                      Say it out loud. No scripts. No pressure.
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Transcript */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="relative"
              >
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-3 h-3 rounded-full mt-2 transition-all ${
                    currentStage === 'transcript' ? 'bg-[#F59E0B]' : 'bg-[#64748B]'
                  }`} />
                  <div className="flex-1">
                    <motion.div
                      animate={{
                        color: currentStage === 'transcript' ? '#F59E0B' : '#64748B',
                      }}
                      className="text-sm font-medium mb-2 uppercase tracking-wide"
                    >
                      {currentStage === 'transcript' ? 'Transcript generated' : 'Transcript'}
                    </motion.div>
                    <p className="text-lg text-[#9CA3AF] leading-relaxed">
                      See exactly what you said — and how long it took.
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Improve */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative"
              >
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-3 h-3 rounded-full mt-2 transition-all ${
                    currentStage === 'improve' ? 'bg-[#F59E0B]' : 'bg-[#64748B]'
                  }`} />
                  <div className="flex-1">
                    <motion.div
                      animate={{
                        color: currentStage === 'improve' ? '#F59E0B' : '#64748B',
                      }}
                      className="text-sm font-medium mb-2 uppercase tracking-wide"
                    >
                      {currentStage === 'improve' ? 'Actionable feedback' : 'Improve'}
                    </motion.div>
                    <p className="text-lg text-[#9CA3AF] leading-relaxed">
                      Clear suggestions on pacing, clarity, and cuts.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
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
              <Link href="/example" className="hover:text-[#F59E0B] transition-colors">
                Example
              </Link>
              <Link href="/#try-it" className="hover:text-[#F59E0B] transition-colors">
                How it Works
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
