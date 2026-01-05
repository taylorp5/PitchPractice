'use client'

import { motion, useInView } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, ArrowDown, Mic } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useRef, useState, useEffect } from 'react'

export default function LandingPage() {
  const [autoPlayStarted, setAutoPlayStarted] = useState(false)
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null)
  const demoRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(demoRef, { once: true, margin: '-100px' })

  const testimonials = [
    { quote: "Helped me realize where I was rambling without noticing.", author: "Jamie, Sales" },
    { quote: "I cut almost a minute from my presentation and it still felt complete.", author: "Aimee, Educator" },
    { quote: "The pacing feedback was way more useful than I expected.", author: "Marcus, Student" },
    { quote: "Finally practiced without having to bug someone for feedback.", author: "Taylor, Business" },
    { quote: "I didn't realize how fast I was talking until I saw it written out.", author: "James, Founder" },
    { quote: "Simple, but surprisingly effective before a big meeting.", author: "Chris, Product" },
    { quote: "This caught things I wouldn't have thought to fix.", author: "Elena, Graduate Student" },
  ]

  const useCases = [
    {
      situation: 'Before class',
      description: 'Nail your presentations. Get confident before you step in front of the room.',
    },
    {
      situation: 'Before the pitch',
      description: 'Perfect your investor pitches. Make every minute count.',
    },
    {
      situation: 'Before the meeting',
      description: 'Refine your client pitches. Every word counts when closing deals.',
    },
  ]

  const demoTranscript = [
    { text: "Hi, I'm excited to share our product with you today.", type: null, delay: 0 },
    { text: "We've built something that will revolutionize how teams collaborate.", type: 'strength', delay: 0.5 },
    { text: "Let me tell you a story about how we got started...", type: null, delay: 1 },
    { text: "It was a rainy Tuesday in 2019 when our founder had this idea...", type: 'cut', delay: 1.5 },
    { text: "So we decided to build a platform that solves this problem.", type: null, delay: 2 },
    { text: "Our solution is simple, powerful, and easy to use.", type: 'pacing', delay: 2.5 },
    { text: "Would you like to see a demo?", type: null, delay: 3 },
  ]

  useEffect(() => {
    if (isInView && !autoPlayStarted) {
      setAutoPlayStarted(true)
      // Animate lines appearing
      demoTranscript.forEach((line, idx) => {
        setTimeout(() => {
          setHighlightedLine(idx)
          if (line.type) {
            // Keep highlight for a moment, then fade
            setTimeout(() => {
              if (idx === demoTranscript.length - 1) {
                // Reset after full sequence
                setTimeout(() => {
                  setHighlightedLine(null)
                  setAutoPlayStarted(false)
                }, 2000)
              }
            }, 1500)
          }
        }, line.delay * 1000)
      })
    }
  }, [isInView, autoPlayStarted])

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
                duration: 40,
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

      {/* Situational Use Cases */}
      <section className="py-32 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-20"
          >
            <h2 className="text-4xl font-bold text-[#E5E7EB] mb-4">When you need it</h2>
            <p className="text-xl text-[#9CA3AF]">Practice before it matters</p>
          </motion.div>

          <div className="space-y-12">
            {useCases.map((useCase, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                className="flex items-start gap-6"
              >
                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-[#F59E0B] mt-3"></div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-[#E5E7EB] mb-2">{useCase.situation}</h3>
                  <p className="text-lg text-[#9CA3AF] leading-relaxed">{useCase.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Typography-led Flow Section */}
      <section className="py-32 px-4 bg-[#121826]">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-16"
          >
            <div>
              <h2 className="text-4xl font-bold text-[#E5E7EB] mb-6">How it works</h2>
            </div>

            <div className="space-y-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="flex items-start gap-6"
              >
                <div className="flex-shrink-0 text-4xl font-bold text-[#64748B]">01</div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-[#E5E7EB] mb-3">Record</h3>
                  <p className="text-lg text-[#9CA3AF] leading-relaxed">
                    Record your pitch using your microphone or upload an audio file. We support up to 2 minutes for free.
                  </p>
                </div>
                <ArrowDown className="flex-shrink-0 text-[#64748B] mt-2" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="flex items-start gap-6"
              >
                <div className="flex-shrink-0 text-4xl font-bold text-[#64748B]">02</div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-[#E5E7EB] mb-3">Get Transcript</h3>
                  <p className="text-lg text-[#9CA3AF] leading-relaxed">
                    Get an instant, accurate transcript with word count, pacing metrics, and timing analysis.
                  </p>
                </div>
                <ArrowDown className="flex-shrink-0 text-[#64748B] mt-2" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="flex items-start gap-6"
              >
                <div className="flex-shrink-0 text-4xl font-bold text-[#64748B]">03</div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-[#E5E7EB] mb-3">Improve</h3>
                  <p className="text-lg text-[#9CA3AF] leading-relaxed">
                    Receive actionable feedback with specific suggestions, pause recommendations, and areas to cut or strengthen.
                  </p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Interactive Demo - Asymmetrical Section */}
      <section className="py-32 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl font-bold text-[#E5E7EB] mb-6">See how feedback works</h2>
              <p className="text-xl text-[#9CA3AF] leading-relaxed mb-8">
                Watch as our system identifies strengths, pacing opportunities, and areas to cut—all in real-time.
              </p>
              <p className="text-[#64748B] text-sm">
                Scroll to see the demo auto-play
              </p>
            </motion.div>

            <motion.div
              ref={demoRef}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Card className="p-8 bg-[#181F2F]">
                {/* Progress indicator */}
                {autoPlayStarted && (
                  <motion.div
                    className="h-1 bg-[#64748B]/20 rounded-full mb-6 overflow-hidden"
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 3.5, ease: 'linear' }}
                  >
                    <motion.div
                      className="h-full bg-[#F59E0B]"
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 3.5, ease: 'linear' }}
                    />
                  </motion.div>
                )}

                {/* Transcript */}
                <div className="space-y-3">
                  {demoTranscript.map((line, idx) => {
                    const isVisible = highlightedLine !== null && idx <= highlightedLine
                    const isHighlighted = highlightedLine === idx && line.type
                    
                    const highlightClasses = {
                      strength: 'bg-[#84CC16]/20 border-[#84CC16]/50 text-[#84CC16]',
                      pacing: 'bg-[#F59E0B]/20 border-[#F59E0B]/50 text-[#F59E0B]',
                      cut: 'bg-[#FB7185]/20 border-[#FB7185]/50 text-[#FB7185] line-through',
                    }

                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{
                          opacity: isVisible ? 1 : 0.3,
                          x: isVisible ? 0 : -10,
                        }}
                        transition={{ duration: 0.4 }}
                        className={`p-4 rounded-lg border transition-all ${
                          isHighlighted && line.type
                            ? highlightClasses[line.type as keyof typeof highlightClasses]
                            : 'bg-[#121826] border-[#181F2F] text-[#E5E7EB]'
                        }`}
                      >
                        {line.text}
                      </motion.div>
                    )
                  })}
                </div>
              </Card>
            </motion.div>
          </div>
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
