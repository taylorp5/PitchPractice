'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Mic, FileText, TrendingUp, ArrowRight, Play, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useState } from 'react'

export default function LandingPage() {
  const [showRecorder, setShowRecorder] = useState(false)

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-20 px-4">
        {/* Animated background gradient glow */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -top-40 -right-40 w-96 h-96 bg-blue-400 rounded-full blur-3xl opacity-20"
            animate={{
              x: [0, 100, 0],
              y: [0, 50, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-400 rounded-full blur-3xl opacity-20"
            animate={{
              x: [0, -100, 0],
              y: [0, -50, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 10,
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
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Practice your pitch.<br />
              Get precise feedback.
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Record a run-through and get an instant transcript, pacing stats, and clear suggestions to improve.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  variant="primary"
                  size="lg"
                  asChild
                  href="/app"
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
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How it works</h2>
            <p className="text-xl text-gray-600">Three simple steps to better pitches</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Mic,
                title: 'Record',
                description: 'Record your pitch using your microphone or upload an audio file. We support up to 2 minutes for free.',
                color: 'from-blue-500 to-blue-600',
              },
              {
                icon: FileText,
                title: 'Get Transcript',
                description: 'Get an instant, accurate transcript with word count, pacing metrics, and timing analysis.',
                color: 'from-indigo-500 to-indigo-600',
              },
              {
                icon: TrendingUp,
                title: 'Improve',
                description: 'Receive actionable feedback with specific suggestions, pause recommendations, and areas to cut or strengthen.',
                color: 'from-purple-500 to-purple-600',
              },
            ].map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
              >
                <Card className="text-center h-full hover:shadow-xl transition-shadow">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} text-white mb-6 shadow-lg`}>
                    <step.icon className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{step.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{step.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Animated Demo Preview */}
      <section className="py-20 px-4 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">See it in action</h2>
            <p className="text-xl text-gray-600">Watch how feedback appears in real-time</p>
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
                <DemoTranscriptLine delay={0.3} text="We've built something that will revolutionize how teams collaborate." highlight="Strong hook" highlightColor="green" />
                <DemoTranscriptLine delay={0.6} text="Let me tell you a story about how we got started..." />
                <DemoTranscriptLine delay={0.9} text="It was a rainy Tuesday in 2019 when our founder had this idea..." highlight="Cut this story" highlightColor="red" />
                <DemoTranscriptLine delay={1.2} text="So we decided to build a platform that solves this problem." />
                <DemoTranscriptLine delay={1.5} text="Our solution is simple, powerful, and easy to use." highlight="Pause here" highlightColor="blue" />
                <DemoTranscriptLine delay={1.8} text="Would you like to see a demo?" />
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Try it free embedded */}
      <section id="try-it" className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Try it free</h2>
            <p className="text-xl text-gray-600">No sign-up required. Get instant feedback on your pitch.</p>
            <p className="text-sm text-gray-500 mt-2">Free: up to 2 minutes</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Card className="p-8 text-center">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white mb-4 shadow-lg">
                  <Mic className="h-10 w-10" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Ready to improve your pitch?</h3>
                <p className="text-gray-600 mb-6">
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
      <footer className="bg-gray-900 text-gray-300 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-md">
                  <span className="text-white font-bold text-lg">P</span>
                </div>
                <span className="font-bold text-white text-lg">PitchPractice</span>
              </div>
              <p className="text-sm text-gray-400">Practice your pitch. Get precise feedback.</p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <Link href="/app" className="hover:text-white transition-colors">
                Try Free
              </Link>
              <Link href="/example" className="hover:text-white transition-colors">
                Example
              </Link>
              <Link href="/#try-it" className="hover:text-white transition-colors">
                How it Works
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm text-gray-500">
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
  highlightColor = 'blue' 
}: { 
  text: string
  delay: number
  highlight?: string
  highlightColor?: 'green' | 'red' | 'blue'
}) {
  const colorClasses = {
    green: 'bg-green-100 text-green-800 border-green-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <div className="flex-1 text-gray-700">{text}</div>
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
