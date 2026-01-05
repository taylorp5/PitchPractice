'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Mic, FileText, TrendingUp, ArrowRight, GraduationCap, Briefcase, Rocket, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useState } from 'react'

export default function LandingPage() {
  const [activeDemo, setActiveDemo] = useState<'pacing' | 'cuts' | 'strengths' | null>(null)

  const testimonials = [
    { quote: "Helped me land my first client pitch", author: "Sarah, Founder" },
    { quote: "My presentation scores improved by 30%", author: "Marcus, Student" },
    { quote: "Finally got feedback I could actually use", author: "Jamie, Sales" },
    { quote: "Cut my pitch time without losing impact", author: "Alex, Educator" },
    { quote: "The pause suggestions were game-changing", author: "Taylor, Business" },
  ]

  const useCases = [
    {
      icon: GraduationCap,
      title: 'Students',
      description: 'Nail your presentations and class pitches. Get confident before you step in front of the room.',
      outcome: 'Present with confidence',
    },
    {
      icon: Briefcase,
      title: 'Sales & Business',
      description: 'Refine your client pitches and team presentations. Every word counts when closing deals.',
      outcome: 'Close more deals',
    },
    {
      icon: Rocket,
      title: 'Founders',
      description: 'Perfect your investor pitches and product demos. Make every minute count.',
      outcome: 'Raise with clarity',
    },
    {
      icon: Users,
      title: 'Educators',
      description: 'Improve your teaching presentations and conference talks. Engage your audience better.',
      outcome: 'Inspire your audience',
    },
  ]

  const demoTranscript = [
    { text: "Hi, I'm excited to share our product with you today.", type: null },
    { text: "We've built something that will revolutionize how teams collaborate.", type: 'strength' },
    { text: "Let me tell you a story about how we got started...", type: null },
    { text: "It was a rainy Tuesday in 2019 when our founder had this idea...", type: 'cut' },
    { text: "So we decided to build a platform that solves this problem.", type: null },
    { text: "Our solution is simple, powerful, and easy to use.", type: 'pacing' },
    { text: "Would you like to see a demo?", type: null },
  ]

  return (
    <div className="min-h-screen bg-[#0E1117]">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 px-4">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0E1117] via-[#151A23] to-[#0E1117] opacity-50"></div>
        
        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-5xl md:text-6xl font-bold text-[#E5E7EB] mb-6 leading-tight">
              Practice once.<br />
              <span className="text-[#D97706]">Perform better everywhere.</span>
            </h1>
            <p className="text-xl md:text-2xl text-[#9CA3AF] mb-10 max-w-3xl mx-auto leading-relaxed">
              Whether you're a student presenting, a founder pitching investors, or a sales professional closing deals—get instant, actionable feedback on your pitch.
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
      <section className="py-8 px-4 border-y border-[#22283A] overflow-hidden">
        <div className="relative">
          <motion.div
            className="flex gap-12"
            animate={{
              x: [0, -50 * testimonials.length + '%'],
            }}
            transition={{
              duration: 30,
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
            {[...testimonials, ...testimonials].map((testimonial, idx) => (
              <div
                key={idx}
                className="flex-shrink-0 text-center opacity-60 hover:opacity-100 transition-opacity"
              >
                <p className="text-sm text-[#9CA3AF] italic">"{testimonial.quote}"</p>
                <p className="text-xs text-[#6B7280] mt-1">— {testimonial.author}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Who uses this */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-[#E5E7EB] mb-4">Who uses this</h2>
            <p className="text-xl text-[#9CA3AF]">Built for anyone who needs to communicate with confidence</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {useCases.map((useCase, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                whileHover={{ y: -4 }}
              >
                <Card className="h-full text-center cursor-pointer group">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#D97706]/20 text-[#D97706] mb-4 group-hover:bg-[#D97706]/30 transition-colors">
                    <useCase.icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-xl font-bold text-[#E5E7EB] mb-2">{useCase.title}</h3>
                  <p className="text-[#9CA3AF] text-sm mb-4 leading-relaxed">{useCase.description}</p>
                  <p className="text-sm font-medium text-[#D97706]">{useCase.outcome}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 bg-gradient-to-b from-[#0E1117] to-[#151A23]">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-[#E5E7EB] mb-4">How it works</h2>
            <p className="text-xl text-[#9CA3AF]">Three simple steps to better pitches</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Mic,
                title: 'Record',
                description: 'Record your pitch using your microphone or upload an audio file. We support up to 2 minutes for free.',
              },
              {
                icon: FileText,
                title: 'Get Transcript',
                description: 'Get an instant, accurate transcript with word count, pacing metrics, and timing analysis.',
              },
              {
                icon: TrendingUp,
                title: 'Improve',
                description: 'Receive actionable feedback with specific suggestions, pause recommendations, and areas to cut or strengthen.',
              },
            ].map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
              >
                <Card className="text-center h-full">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#D97706]/20 text-[#D97706] mb-6">
                    <step.icon className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#E5E7EB] mb-3">{step.title}</h3>
                  <p className="text-[#9CA3AF] leading-relaxed">{step.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demo */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold text-[#E5E7EB] mb-4">See how feedback works</h2>
            <p className="text-xl text-[#9CA3AF]">Toggle highlights to see different types of insights</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Card className="p-8">
              {/* Toggle buttons */}
              <div className="flex flex-wrap gap-3 mb-6 justify-center">
                <button
                  onClick={() => setActiveDemo(activeDemo === 'strengths' ? null : 'strengths')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeDemo === 'strengths'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                      : 'bg-[#151A23] text-[#9CA3AF] border border-[#22283A] hover:border-[#D97706]/50'
                  }`}
                >
                  Strengths
                </button>
                <button
                  onClick={() => setActiveDemo(activeDemo === 'pacing' ? null : 'pacing')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeDemo === 'pacing'
                      ? 'bg-[#F97316]/20 text-[#F97316] border border-[#F97316]/50'
                      : 'bg-[#151A23] text-[#9CA3AF] border border-[#22283A] hover:border-[#D97706]/50'
                  }`}
                >
                  Pacing
                </button>
                <button
                  onClick={() => setActiveDemo(activeDemo === 'cuts' ? null : 'cuts')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeDemo === 'cuts'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                      : 'bg-[#151A23] text-[#9CA3AF] border border-[#22283A] hover:border-[#D97706]/50'
                  }`}
                >
                  Suggested Cuts
                </button>
              </div>

              {/* Transcript */}
              <div className="space-y-3">
                {demoTranscript.map((line, idx) => {
                  const shouldHighlight = activeDemo && line.type === activeDemo
                  const highlightClasses = {
                    strength: 'bg-green-500/20 border-green-500/50 text-green-400',
                    pacing: 'bg-[#F97316]/20 border-[#F97316]/50 text-[#F97316]',
                    cut: 'bg-red-500/20 border-red-500/50 text-red-400 line-through',
                  }

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                      className={`p-4 rounded-lg border transition-all ${
                        shouldHighlight
                          ? highlightClasses[line.type as keyof typeof highlightClasses]
                          : 'bg-[#151A23] border-[#22283A] text-[#E5E7EB]'
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
      </section>

      {/* Final CTA */}
      <section id="try-it" className="py-24 px-4 bg-gradient-to-b from-[#151A23] to-[#0E1117]">
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
            <p className="text-xl text-[#9CA3AF] mb-10 max-w-2xl mx-auto">
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
            <p className="text-sm text-[#6B7280] mt-4">Free for up to 2 minutes • No sign-up required</p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#151A23] border-t border-[#22283A] text-[#9CA3AF] py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-[#D97706] rounded-lg flex items-center justify-center">
                  <span className="text-[#0E1117] font-bold text-lg">P</span>
                </div>
                <span className="font-bold text-[#E5E7EB] text-lg">PitchPractice</span>
              </div>
              <p className="text-sm text-[#9CA3AF]">Practice your pitch. Get precise feedback.</p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <Link href="/app" className="hover:text-[#D97706] transition-colors">
                Try Free
              </Link>
              <Link href="/example" className="hover:text-[#D97706] transition-colors">
                Example
              </Link>
              <Link href="/#try-it" className="hover:text-[#D97706] transition-colors">
                How it Works
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-[#22283A] text-center text-sm text-[#9CA3AF]">
            © {new Date().getFullYear()} PitchPractice. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
