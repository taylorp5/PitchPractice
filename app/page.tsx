'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Mic, FileText, TrendingUp, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useState } from 'react'

export default function LandingPage() {
  const [showRecorder, setShowRecorder] = useState(false)

  return (
    <div className="min-h-screen bg-[#0E1117]">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4">
        {/* Radial orange glow behind headline */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="absolute w-[600px] h-[600px] bg-[#F97316] rounded-full blur-[120px] opacity-20"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.2, 0.25, 0.2],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        <div className="relative max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.h1
              className="text-5xl md:text-6xl font-bold text-[#E5E7EB] mb-6"
              animate={{
                textShadow: [
                  '0 0 20px rgba(249, 115, 22, 0.3)',
                  '0 0 30px rgba(249, 115, 22, 0.4)',
                  '0 0 20px rgba(249, 115, 22, 0.3)',
                ],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              Practice your pitch.<br />
              Get precise feedback.
            </motion.h1>
            <p className="text-xl md:text-2xl text-[#9CA3AF] mb-8 max-w-3xl mx-auto">
              Record a run-through and get an instant transcript, pacing stats, and clear suggestions to improve.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(249, 115, 22, 0.3)',
                    '0 0 30px rgba(249, 115, 22, 0.5)',
                    '0 0 20px rgba(249, 115, 22, 0.3)',
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <Button
                  variant="primary"
                  size="lg"
                  asChild
                  href="/app"
                  className="relative"
                >
                  Try free (2 minutes) <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  variant="secondary"
                  size="lg"
                  asChild
                  href="/example"
                >
                  See example feedback
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4">
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
                color: 'bg-[#F97316]',
              },
              {
                icon: FileText,
                title: 'Get Transcript',
                description: 'Get an instant, accurate transcript with word count, pacing metrics, and timing analysis.',
                color: 'bg-[#F97316]',
              },
              {
                icon: TrendingUp,
                title: 'Improve',
                description: 'Receive actionable feedback with specific suggestions, pause recommendations, and areas to cut or strengthen.',
                color: 'bg-[#F97316]',
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
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${step.color} text-[#0E1117] mb-6 shadow-lg shadow-[#F97316]/30`}>
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

      {/* Animated Demo Preview */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold text-[#E5E7EB] mb-4">See it in action</h2>
            <p className="text-xl text-[#9CA3AF]">Watch how feedback appears in real-time</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Card className="p-8">
              <div className="space-y-4">
                <DemoTranscriptLine delay={0} text="Hi, I'm excited to share our product with you today." />
                <DemoTranscriptLine delay={0.3} text="We've built something that will revolutionize how teams collaborate." highlight="Strong hook" highlightColor="orange" />
                <DemoTranscriptLine delay={0.6} text="Let me tell you a story about how we got started..." />
                <DemoTranscriptLine delay={0.9} text="It was a rainy Tuesday in 2019 when our founder had this idea..." highlight="Cut this story" highlightColor="red" />
                <DemoTranscriptLine delay={1.2} text="So we decided to build a platform that solves this problem." />
                <DemoTranscriptLine delay={1.5} text="Our solution is simple, powerful, and easy to use." highlight="Pause here" highlightColor="orange" />
                <DemoTranscriptLine delay={1.8} text="Would you like to see a demo?" />
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Try it free embedded */}
      <section id="try-it" className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold text-[#E5E7EB] mb-4">Try it free</h2>
            <p className="text-xl text-[#9CA3AF]">No sign-up required. Get instant feedback on your pitch.</p>
            <p className="text-sm text-[#9CA3AF] mt-2">Free: up to 2 minutes</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Card className="p-8 text-center">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#F97316] text-[#0E1117] mb-4 shadow-lg shadow-[#F97316]/30">
                  <Mic className="h-10 w-10" />
                </div>
                <h3 className="text-2xl font-bold text-[#E5E7EB] mb-2">Ready to improve your pitch?</h3>
                <p className="text-[#9CA3AF] mb-6">
                  Record a quick 2-minute pitch and get instant feedback with transcript, pacing analysis, and actionable suggestions.
                </p>
              </div>
              <Button
                variant="primary"
                size="lg"
                asChild
                href="/app"
              >
                Start Recording <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#151A23] border-t border-[#22283A] text-[#9CA3AF] py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-[#F97316] rounded-lg flex items-center justify-center shadow-md shadow-[#F97316]/30">
                  <span className="text-[#0E1117] font-bold text-lg">P</span>
                </div>
                <span className="font-bold text-[#E5E7EB] text-lg">PitchPractice</span>
              </div>
              <p className="text-sm text-[#9CA3AF]">Practice your pitch. Get precise feedback.</p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <Link href="/app" className="hover:text-[#F97316] transition-colors">
                Try Free
              </Link>
              <Link href="/example" className="hover:text-[#F97316] transition-colors">
                Example
              </Link>
              <Link href="/#try-it" className="hover:text-[#F97316] transition-colors">
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

function DemoTranscriptLine({ 
  text, 
  delay, 
  highlight, 
  highlightColor = 'orange' 
}: { 
  text: string
  delay: number
  highlight?: string
  highlightColor?: 'green' | 'red' | 'blue' | 'orange'
}) {
  const colorClasses = {
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    orange: 'bg-[#F97316]/20 text-[#F97316] border-[#F97316]/30',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#151A23] transition-colors"
    >
      <div className="flex-1 text-[#E5E7EB]">{text}</div>
      {highlight && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: delay + 0.2 }}
          className={`px-3 py-1 rounded-full text-xs font-medium border ${colorClasses[highlightColor]}`}
        >
          {highlight}
        </motion.span>
      )}
    </motion.div>
  )
}
