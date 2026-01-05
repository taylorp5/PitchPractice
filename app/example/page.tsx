'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Download, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { StatPill } from '@/components/ui/StatPill'
import { useState } from 'react'

const sampleAnalysis = {
  summary: {
    overall_score: 7.5,
    overall_notes: "This is a solid pitch with a strong opening and clear value proposition. The pacing is good, but there are opportunities to add more pauses and tighten some sections.",
    top_strengths: [
      "Clear and engaging opening hook",
      "Strong value proposition stated early",
      "Good use of concrete examples"
    ],
    top_improvements: [
      "Add more strategic pauses after key points",
      "Cut the backstory section - it's too long",
      "Strengthen the call to action at the end"
    ]
  },
  rubric_scores: [
    { criterion: "Hook/Opening", score: 9, notes: "Excellent attention-grabbing start" },
    { criterion: "Clarity", score: 8, notes: "Message is clear and easy to follow" },
    { criterion: "Structure", score: 7, notes: "Well-organized but could be tighter" },
    { criterion: "Conciseness", score: 6, notes: "Some sections run too long" },
    { criterion: "Confidence/Delivery", score: 8, notes: "Confident and engaging delivery" },
    { criterion: "Call to Action", score: 6, notes: "Could be more compelling" }
  ],
  line_by_line: [
    {
      quote: "Hi, I'm excited to share our product with you today.",
      type: "praise",
      priority: "high",
      comment: "Strong, confident opening that immediately engages the listener.",
      action: "Keep this approach for future pitches"
    },
    {
      quote: "Let me tell you a story about how we got started... It was a rainy Tuesday in 2019 when our founder had this idea...",
      type: "issue",
      priority: "high",
      comment: "This backstory is too long and doesn't add value. The audience cares more about the solution than the origin story.",
      action: "Cut this entire section or reduce to one sentence"
    },
    {
      quote: "Our solution is simple, powerful, and easy to use.",
      type: "suggestion",
      priority: "medium",
      comment: "This is a good transition point. Consider pausing here to let the previous point sink in.",
      action: "Add a 2-3 second pause after this line"
    }
  ],
  pause_suggestions: [
    {
      after_quote: "We've built something that will revolutionize how teams collaborate.",
      why: "This is a key value statement. A pause here gives listeners time to process the claim.",
      duration_ms: 2000
    },
    {
      after_quote: "Our solution is simple, powerful, and easy to use.",
      why: "Natural transition point. A pause creates anticipation for what comes next.",
      duration_ms: 2500
    }
  ],
  cut_suggestions: [
    {
      quote: "Let me tell you a story about how we got started... It was a rainy Tuesday in 2019...",
      why: "This backstory doesn't add value and takes up valuable time. The audience wants to hear about the solution, not the origin story.",
      replacement: "After years of research, we've built a platform that solves this problem."
    }
  ],
  timing: {
    notes: "Total duration: 3:45. Word count: 487. Pace: 132 WPM (slightly fast). Consider slowing down by 10-15% for better comprehension."
  }
}

const sampleTranscript = `Hi, I'm excited to share our product with you today. We've built something that will revolutionize how teams collaborate. Let me tell you a story about how we got started. It was a rainy Tuesday in 2019 when our founder had this idea. After seeing teams struggle with communication, we decided to build a platform that solves this problem. Our solution is simple, powerful, and easy to use. It integrates seamlessly with your existing tools and requires no training. Would you like to see a demo?`

export default function ExamplePage() {
  const [copied, setCopied] = useState(false)

  const copyShareSummary = () => {
    const summary = `Pitch Practice Results:
Duration: 3:45 | WPM: 132
Overall Score: 7.5/10

Top Strengths:
✓ Clear and engaging opening hook
✓ Strong value proposition stated early
✓ Good use of concrete examples

Top Improvements:
→ Add more strategic pauses after key points
→ Cut the backstory section - it's too long
→ Strengthen the call to action at the end`
    
    navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" size="sm" href="/" asChild>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card padding="lg" className="mb-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Example Pitch Feedback
                </h1>
                <p className="text-sm text-gray-500">
                  This is a sample analysis to show you what feedback looks like
                </p>
              </div>
            </div>
          </Card>

          {/* Metrics */}
          <Card className="mb-6">
            <SectionHeader title="Metrics" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatPill label="Duration" value="3:45" />
              <StatPill label="Word Count" value="487" />
              <StatPill label="WPM" value="132" />
            </div>
          </Card>

          {/* Transcript */}
          <Card className="mb-6">
            <SectionHeader title="Transcript" />
            <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
              <pre className="text-gray-700 whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {sampleTranscript}
              </pre>
            </div>
          </Card>

          {/* Analysis Section */}
          <div className="mb-6 space-y-6">
            <SectionHeader 
              title="Feedback & Analysis"
            >
              <div className="flex gap-2">
                <Button
                  onClick={copyShareSummary}
                  variant="primary"
                  size="sm"
                >
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy Summary'}
                </Button>
              </div>
            </SectionHeader>

            {/* Scorecard */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Overall Score</h3>
                <div className="text-4xl font-bold text-blue-600">
                  {sampleAnalysis.summary.overall_score}/10
                </div>
              </div>
              {sampleAnalysis.summary.overall_notes && (
                <p className="text-gray-700 mb-4">{sampleAnalysis.summary.overall_notes}</p>
              )}

              {/* Rubric Scores */}
              {sampleAnalysis.rubric_scores && sampleAnalysis.rubric_scores.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h4 className="font-semibold text-gray-900">Rubric Scores</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sampleAnalysis.rubric_scores.map((item: any, idx: number) => (
                      <div key={idx} className="p-3 bg-white rounded border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{item.criterion}</span>
                          <span className="text-lg font-semibold text-blue-600">
                            {item.score}/10
                          </span>
                        </div>
                        {item.notes && (
                          <p className="text-sm text-gray-600">{item.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Top Strengths & Improvements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sampleAnalysis.summary.top_strengths?.length > 0 && (
                <Card className="border-green-200 bg-green-50">
                  <h3 className="font-semibold text-green-900 mb-3">Top Strengths</h3>
                  <ul className="space-y-2">
                    {sampleAnalysis.summary.top_strengths.map((strength: string, idx: number) => (
                      <li key={idx} className="text-sm text-green-800 flex items-start">
                        <span className="mr-2">✓</span>
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {sampleAnalysis.summary.top_improvements?.length > 0 && (
                <Card className="border-amber-200 bg-amber-50">
                  <h3 className="font-semibold text-amber-900 mb-3">Top Improvements</h3>
                  <ul className="space-y-2">
                    {sampleAnalysis.summary.top_improvements.map((improvement: string, idx: number) => (
                      <li key={idx} className="text-sm text-amber-800 flex items-start">
                        <span className="mr-2">→</span>
                        <span>{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>

            {/* Line-by-Line Feedback */}
            {sampleAnalysis.line_by_line && sampleAnalysis.line_by_line.length > 0 && (
              <Card>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Line-by-Line Feedback</h3>
                <div className="space-y-4">
                  {sampleAnalysis.line_by_line.map((item: any, idx: number) => {
                    const typeColors = {
                      praise: 'bg-green-50 border-green-200',
                      issue: 'bg-red-50 border-red-200',
                      suggestion: 'bg-blue-50 border-blue-200',
                    }
                    const priorityColors = {
                      high: 'text-red-600',
                      medium: 'text-amber-600',
                      low: 'text-gray-600',
                    }
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border ${typeColors[item.type as keyof typeof typeColors] || 'bg-gray-50 border-gray-200'}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <blockquote className="text-sm font-medium text-gray-800 italic flex-1">
                            "{item.quote}"
                          </blockquote>
                          <span className={`text-xs font-semibold ml-2 ${priorityColors[item.priority as keyof typeof priorityColors] || 'text-gray-600'}`}>
                            {item.priority?.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-1">
                          <strong>Comment:</strong> {item.comment}
                        </p>
                        {item.action && (
                          <p className="text-sm text-gray-700">
                            <strong>Action:</strong> {item.action}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* Suggested Pauses */}
            {sampleAnalysis.pause_suggestions && sampleAnalysis.pause_suggestions.length > 0 && (
              <Card className="border-purple-200 bg-purple-50">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Suggested Pauses</h3>
                <div className="space-y-3">
                  {sampleAnalysis.pause_suggestions.map((pause: any, idx: number) => (
                    <div key={idx} className="p-3 bg-white rounded border border-purple-200">
                      <p className="text-sm font-medium text-gray-800 mb-1">
                        After: <span className="italic">"{pause.after_quote}"</span>
                      </p>
                      <p className="text-sm text-gray-600 mb-1">{pause.why}</p>
                      <p className="text-xs text-gray-500">
                        Suggested duration: {pause.duration_ms}ms
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Cut Suggestions */}
            {sampleAnalysis.cut_suggestions && sampleAnalysis.cut_suggestions.length > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Suggested Cuts</h3>
                <div className="space-y-3">
                  {sampleAnalysis.cut_suggestions.map((cut: any, idx: number) => (
                    <div key={idx} className="p-3 bg-white rounded border border-orange-200">
                      <p className="text-sm font-medium text-gray-800 mb-1">
                        Remove: <span className="italic line-through">"{cut.quote}"</span>
                      </p>
                      <p className="text-sm text-gray-600 mb-1">{cut.why}</p>
                      {cut.replacement && (
                        <p className="text-sm text-green-700 mt-2">
                          <strong>Replace with:</strong> "{cut.replacement}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Timing Analysis */}
            {sampleAnalysis.timing && (
              <Card className="border-indigo-200 bg-indigo-50">
                <h3 className="font-semibold text-gray-900 mb-2">Timing Analysis</h3>
                {sampleAnalysis.timing.notes && (
                  <p className="text-sm text-gray-700">{sampleAnalysis.timing.notes}</p>
                )}
              </Card>
            )}
          </div>

          {/* CTA */}
          <Card className="text-center bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Ready to try it yourself?</h3>
            <p className="text-gray-600 mb-6">
              Record your own pitch and get personalized feedback
            </p>
            <Button variant="primary" size="lg" asChild href="/app">
              Start Recording <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

