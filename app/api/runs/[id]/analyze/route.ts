import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server-auth'
import { getUserPlanFromDB } from '@/lib/plan-server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

interface RubricCriterion {
  name: string
  description: string
}

interface AnalysisOutput {
  meta?: {
    plan_at_time?: 'free' | 'starter' | 'coach' | 'daypass'
    generated_at?: string
  }
  summary: {
    overall_score: number
    overall_notes: string
    top_strengths: string[]
    top_improvements: string[]
  }
  timing: {
    target_seconds: number | null
    max_seconds: number | null
    estimated_seconds: number | null
    pacing_wpm: number | null
    notes: string
  }
  rubric_scores: Array<{
    criterion_id: string
    criterion_label: string
    score: number
    notes: string
    evidence_quotes: string[]
    missing: boolean
  }>
  question_grading?: Array<{
    question: string
    answered: boolean
    evidence_quotes: string[]
    improvement: string | null
  }>
  chunks: Array<{
    text: string
    purpose: string
    purpose_label: string
    score: number | null
    status: 'strong' | 'needs_work' | 'missing'
    feedback: string
    rewrite_suggestion: string | null
  }>
  line_by_line: Array<{
    quote: string
    type: 'strength' | 'issue'
    comment: string
    action: string
    priority: 'high' | 'medium' | 'low'
    category?: string
  }>
  pause_suggestions: Array<{
    after_quote: string
    why: string
    duration_ms: number
  }>
  cut_suggestions: Array<{
    quote: string
    why: string
    replacement: string | null
  }>
  premium_insights?: {
    filler_words: {
      total_count: number
      by_word: Array<{
        word: string
        count: number
        examples: string[]
        suggestions: string[]
      }>
      coaching_notes: string[]
    }
    pacing: {
      wpm_overall: number | null
      segments: Array<{
        label: 'slow' | 'good' | 'fast'
        start_sec: number | null
        end_sec: number | null
        wpm: number | null
        note: string
      }>
      pauses: {
        longest_pause_sec: number | null
        long_pause_count: number
        notes: string
      }
    }
    structure: {
      detected_sections: string[]
      missing_sections: string[]
      suggested_lines: { [section: string]: string }
      one_sentence_pitch: string
    }
    coaching_plan: {
      next_attempt_focus: string[]
      drills: Array<{ title: string; steps: string[] }>
    }
  }
  premium?: {
    signature_insight: string
    coach_take: string
    next_focus: string[]
    filler?: {
      total: number
      by_word: Record<string, number>
      sections: {
        intro: number
        middle: number
        close: number
      }
      insight: string
      drill: {
        title: string
        steps: string[]
      }
    }
  } | null
}

interface PromptRubricItem {
  id: string
  label: string
  weight: number
  optional?: boolean
}

// Detect filler words and hesitation patterns in transcript
function detectFillerWordsAndHesitation(
  transcript: string,
  existingQuotes: Set<string>
): Array<{
  quote: string
  type: 'issue'
  comment: string
  action: string
  priority: 'high' | 'medium' | 'low'
  category: 'delivery'
}> {
  const issues: Array<{
    quote: string
    type: 'issue'
    comment: string
    action: string
    priority: 'high' | 'medium' | 'low'
    category: 'delivery'
  }> = []

  if (!transcript || transcript.trim().length === 0) {
    return issues
  }

  // Normalize transcript for matching (preserve original for quotes)
  const transcriptLower = transcript.toLowerCase()
  
  // Filler words to detect (case-insensitive)
  const fillerWords = [
    /\bum\b/gi,
    /\buh\b/gi,
    /\blike\b/gi,
    /\byeah\b/gi,
    /\bkind of\b/gi,
    /\bsort of\b/gi,
  ]

  // Hesitant phrase patterns at sentence start
  const hesitantStartPatterns = [
    /^so\s*,\s*um\s*[,.]/i,
    /^so\s*,\s*uh\s*[,.]/i,
    /^i\s+guess\s*[,.]/i,
    /^kind\s+of\s*[,.]/i,
    /^sort\s+of\s*[,.]/i,
    /^well\s*,\s*um\s*[,.]/i,
    /^well\s*,\s*uh\s*[,.]/i,
  ]

  // Softening phrases
  const softeningPhrases = [
    /\bkind of\b/gi,
    /\bsort of\b/gi,
    /\bi guess\b/gi,
    /\bi think\b/gi, // Only when used as hesitation, not as opinion
    /\bmaybe\b/gi,
    /\bprobably\b/gi,
  ]

  // Split transcript into sentences for better context
  // Split on sentence endings, but preserve punctuation with the sentence
  const sentenceParts = transcript.split(/([.!?]+\s+)/)
  const sentences: string[] = []
  for (let i = 0; i < sentenceParts.length; i += 2) {
    const sentence = (sentenceParts[i] || '').trim()
    const punctuation = (sentenceParts[i + 1] || '').trim()
    if (sentence.length > 0) {
      sentences.push(sentence + punctuation)
    }
  }
  
  // Track found quotes to avoid duplicates
  const foundQuotes = new Set<string>()

  // Check each sentence for issues
  sentences.forEach((sentence, idx) => {
    const sentenceTrimmed = sentence.trim()
    if (sentenceTrimmed.length === 0) return

    const sentenceLower = sentenceTrimmed.toLowerCase()
    
    // Check for hesitant starts
    for (const pattern of hesitantStartPatterns) {
      const match = sentenceTrimmed.match(pattern)
      if (match) {
        // Extract quote (max 120 chars, prefer sentence start)
        let quote = sentenceTrimmed.substring(0, Math.min(120, sentenceTrimmed.length))
        // Try to end at a natural break
        const lastSpace = quote.lastIndexOf(' ')
        if (lastSpace > 80) {
          quote = quote.substring(0, lastSpace) + '...'
        }
        
        // Skip if already in existing quotes or found quotes
        const quoteKey = quote.toLowerCase().trim()
        if (existingQuotes.has(quoteKey) || foundQuotes.has(quoteKey)) continue
        foundQuotes.add(quoteKey)

        // Determine priority based on pattern
        let priority: 'high' | 'medium' | 'low' = 'medium'
        if (match[0].toLowerCase().includes('um') || match[0].toLowerCase().includes('uh')) {
          priority = 'high'
        }

        issues.push({
          quote: quote.trim(),
          type: 'issue',
          comment: 'Filler words at the start reduce clarity and confidence.',
          action: 'Remove fillers and start with a direct statement of what you are building.',
          priority,
          category: 'delivery',
        })
        break // Only flag once per sentence
      }
    }

    // Check for filler words (not at sentence start, or if we didn't catch it above)
    let fillerCount = 0
    const fillerMatches: Array<{ word: string; index: number }> = []

    fillerWords.forEach((pattern, patternIdx) => {
      const matches = [...sentenceTrimmed.matchAll(pattern)]
      matches.forEach(match => {
        if (match.index !== undefined) {
          fillerMatches.push({ word: match[0], index: match.index })
          fillerCount++
        }
      })
    })

    // Only flag if there are multiple fillers or one at a critical position
    if (fillerCount >= 2 || (fillerCount === 1 && fillerMatches[0].index < 50)) {
      // Extract quote around the filler(s)
      const firstFillerIndex = Math.min(...fillerMatches.map(m => m.index))
      const lastFillerIndex = Math.max(...fillerMatches.map(m => m.index + m.word.length))
      
      // Get context around fillers (max 120 chars)
      const start = Math.max(0, firstFillerIndex - 20)
      const end = Math.min(sentenceTrimmed.length, lastFillerIndex + 40)
      let quote = sentenceTrimmed.substring(start, end).trim()
      
      // Ensure quote is not too long
      if (quote.length > 120) {
        quote = quote.substring(0, 117) + '...'
      }

      const quoteKey = quote.toLowerCase().trim()
      if (existingQuotes.has(quoteKey) || foundQuotes.has(quoteKey)) return
      foundQuotes.add(quoteKey)

      const priority: 'high' | 'medium' | 'low' = fillerCount >= 3 ? 'high' : 'medium'

      issues.push({
        quote: quote.trim(),
        type: 'issue',
        comment: fillerCount >= 3 
          ? 'Multiple filler words reduce clarity and confidence.'
          : 'Filler words reduce clarity and confidence.',
        action: 'Remove fillers and speak more directly.',
        priority,
        category: 'delivery',
      })
    }

    // Check for excessive softening phrases (only if not already flagged)
    if (fillerCount === 0) {
      let softeningCount = 0
      softeningPhrases.forEach(pattern => {
        const matches = sentenceTrimmed.match(pattern)
        if (matches) {
          softeningCount += matches.length
        }
      })

      // Flag if 2+ softening phrases in one sentence
      if (softeningCount >= 2) {
        let quote = sentenceTrimmed.substring(0, Math.min(120, sentenceTrimmed.length))
        const lastSpace = quote.lastIndexOf(' ')
        if (lastSpace > 80) {
          quote = quote.substring(0, lastSpace) + '...'
        }

        const quoteKey = quote.toLowerCase().trim()
        if (existingQuotes.has(quoteKey) || foundQuotes.has(quoteKey)) return
        foundQuotes.add(quoteKey)

        issues.push({
          quote: quote.trim(),
          type: 'issue',
          comment: 'Softening phrases reduce clarity and confidence.',
          action: 'Remove softening phrases and state your points more directly.',
          priority: 'low',
          category: 'delivery',
        })
      }
    }
  })

  // Limit to top 3-5 most important issues to avoid overwhelming
  return issues
    .sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
    .slice(0, 5)
}

// Premium Insights: Filler Words Analysis
function analyzeFillerWords(transcript: string): {
  total_count: number
  by_word: Array<{
    word: string
    count: number
    examples: string[]
    suggestions: string[]
  }>
  coaching_notes: string[]
} {
  // Filler words list (case-insensitive, count whole words)
  const fillerWordPatterns: { [key: string]: RegExp } = {
    'um': /\bum\b/gi,
    'uh': /\buh\b/gi,
    'like': /\blike\b/gi,
    'you know': /\byou\s+know\b/gi,
    'sort of': /\bsort\s+of\b/gi,
    'kind of': /\bkind\s+of\b/gi,
    'basically': /\bbasically\b/gi,
    'actually': /\bactually\b/gi,
    'literally': /\bliterally\b/gi,
    'so': /\bso\b/gi,
    'right': /\bright\b/gi,
    'okay': /\bokay\b/gi,
  }

  // Normalize transcript (preserve original for examples)
  const normalized = transcript.replace(/\s+/g, ' ').trim()
  
  // Track matches with their positions for example extraction
  const wordMatches: { [word: string]: Array<{ index: number; match: string }> } = {}
  
  // Find all matches for each filler word
  Object.entries(fillerWordPatterns).forEach(([word, pattern]) => {
    const matches: Array<{ index: number; match: string }> = []
    let match
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0
    while ((match = pattern.exec(normalized)) !== null) {
      matches.push({
        index: match.index,
        match: match[0]
      })
    }
    wordMatches[word] = matches
  })

  // Build by_word array
  const by_word: Array<{
    word: string
    count: number
    examples: string[]
    suggestions: string[]
  }> = []

  Object.entries(wordMatches).forEach(([word, matches]) => {
    const count = matches.length
    if (count === 0) return

    // Extract up to 3 examples with context (~35 chars before/after)
    const examples: string[] = []
    const contextLength = 35
    
    matches.slice(0, 3).forEach(({ index }) => {
      const start = Math.max(0, index - contextLength)
      const end = Math.min(normalized.length, index + word.length + contextLength)
      let snippet = normalized.substring(start, end)
      
      // Add ellipses if not at start/end
      if (start > 0) snippet = '...' + snippet
      if (end < normalized.length) snippet = snippet + '...'
      
      examples.push(snippet)
    })

    // Generate suggestions based on word type
    const suggestions: string[] = []
    if (word === 'um' || word === 'uh') {
      suggestions.push('remove', 'pause', 'take a breath')
    } else if (word === 'like') {
      suggestions.push('remove', 'pause', 'replace with a precise verb')
    } else if (word === 'you know') {
      suggestions.push('remove', 'pause', 'assume the listener understands')
    } else if (word === 'sort of' || word === 'kind of') {
      suggestions.push('remove', 'be more direct', 'use precise language')
    } else if (word === 'basically' || word === 'actually' || word === 'literally') {
      suggestions.push('remove', 'pause', 'use only when necessary')
    } else if (word === 'so') {
      suggestions.push('remove', 'pause', 'start directly with your point')
    } else if (word === 'right' || word === 'okay') {
      suggestions.push('remove', 'pause', 'avoid seeking validation')
    } else {
      suggestions.push('remove', 'pause', 'replace with a brief pause')
    }

    by_word.push({
      word,
      count,
      examples: examples.slice(0, 3),
      suggestions: suggestions.slice(0, 3),
    })
  })

  // Sort by count descending
  by_word.sort((a, b) => b.count - a.count)

  // Calculate total count
  const total_count = by_word.reduce((sum, item) => sum + item.count, 0)

  // Generate coaching notes (2-4 bullets)
  const coaching_notes: string[] = []
  
  if (total_count === 0) {
    coaching_notes.push('No filler words detected. Your delivery is clean and confident.')
    coaching_notes.push('Continue practicing to maintain this level of clarity.')
  } else {
    const topWord = by_word[0]
    if (topWord) {
      if (total_count >= 10) {
        coaching_notes.push(`You used ${total_count} filler words total, with "${topWord.word}" appearing ${topWord.count} times.`)
        coaching_notes.push('Practice replacing fillers with brief pauses (1-2 seconds) to maintain flow.')
        coaching_notes.push('Record yourself speaking for 30 seconds and count fillers, then re-record aiming for 0-1 fillers.')
      } else if (total_count >= 5) {
        coaching_notes.push(`You used ${total_count} filler words, with "${topWord.word}" being the most common (${topWord.count} times).`)
        coaching_notes.push('Focus on eliminating your top filler word by practicing brief pauses instead.')
        coaching_notes.push('Before speaking, take a moment to think about your next point to reduce fillers.')
      } else {
        coaching_notes.push(`You used ${total_count} filler word${total_count > 1 ? 's' : ''} total.`)
        coaching_notes.push('Practice pausing briefly instead of using fillers when you need thinking time.')
      }
    }
    
    // Add a general tip if we have space
    if (coaching_notes.length < 4 && total_count > 0) {
      coaching_notes.push('Aim to reduce filler words to 0-2 per minute for maximum clarity and confidence.')
    }
  }

  return {
    total_count,
    by_word,
    coaching_notes: coaching_notes.slice(0, 4), // Ensure max 4 bullets
  }
}

// Premium Filler Word Analysis: Breakdown by section and pattern
function analyzePremiumFillerWords(transcript: string): {
  total: number
  by_word: Record<string, number>
  sections: {
    intro: number
    middle: number
    close: number
  }
  insight: string
  drill: {
    title: string
    steps: string[]
  }
} {
  // Words to track (case-insensitive, whole word matches)
  const fillerWordPatterns: { [key: string]: RegExp } = {
    'um': /\bum\b/gi,
    'uh': /\buh\b/gi,
    'like': /\blike\b/gi,
    'so': /\bso\b/gi,
    'well': /\bwell\b/gi,
    'you know': /\byou\s+know\b/gi,
    'basically': /\bbasically\b/gi,
    'actually': /\bactually\b/gi,
  }

  // Normalize transcript
  const normalized = transcript.replace(/\s+/g, ' ').trim()
  const totalLength = normalized.length
  
  // Calculate section boundaries (text-position based)
  const introEnd = Math.floor(totalLength * 0.2) // First 20%
  const closeStart = Math.floor(totalLength * 0.8) // Last 20%
  
  const introText = normalized.substring(0, introEnd)
  const middleText = normalized.substring(introEnd, closeStart)
  const closeText = normalized.substring(closeStart)

  // Count by word (total)
  const by_word: Record<string, number> = {}
  Object.entries(fillerWordPatterns).forEach(([word, pattern]) => {
    const matches = normalized.match(pattern)
    by_word[word] = matches ? matches.length : 0
  })

  // Count by section
  const sections = {
    intro: 0,
    middle: 0,
    close: 0,
  }

  Object.entries(fillerWordPatterns).forEach(([word, pattern]) => {
    const introMatches = introText.match(pattern)
    const middleMatches = middleText.match(pattern)
    const closeMatches = closeText.match(pattern)
    
    sections.intro += introMatches ? introMatches.length : 0
    sections.middle += middleMatches ? middleMatches.length : 0
    sections.close += closeMatches ? closeMatches.length : 0
  })

  const total = Object.values(by_word).reduce((sum, count) => sum + count, 0)

  // Generate insight (1-2 sentences about pattern)
  let insight = ''
  
  if (total === 0) {
    insight = 'No filler words detected. Your delivery is clean and confident.'
  } else {
    // Find dominant word
    const sortedWords = Object.entries(by_word)
      .filter(([_, count]) => count > 0)
      .sort(([_, a], [__, b]) => b - a)
    
    const dominantWord = sortedWords[0]?.[0] || ''
    const dominantCount = sortedWords[0]?.[1] || 0
    
    // Find section pattern
    const maxSection = Math.max(sections.intro, sections.middle, sections.close)
    let sectionPattern = ''
    if (sections.intro === maxSection && sections.intro > 0) {
      sectionPattern = 'intro'
    } else if (sections.close === maxSection && sections.close > 0) {
      sectionPattern = 'close'
    } else if (sections.middle === maxSection && sections.middle > 0) {
      sectionPattern = 'middle'
    }
    
    // Build insight
    if (sectionPattern === 'intro' && dominantWord) {
      insight = `You use "${dominantWord}" ${dominantCount} time${dominantCount > 1 ? 's' : ''}, mostly in the opening. Practice your first 20 seconds to start confidently without fillers.`
    } else if (sectionPattern === 'close' && dominantWord) {
      insight = `You use "${dominantWord}" ${dominantCount} time${dominantCount > 1 ? 's' : ''}, mostly in the closing. Focus on ending strong without fillers to leave a lasting impression.`
    } else if (sectionPattern === 'middle' && dominantWord) {
      insight = `You use "${dominantWord}" ${dominantCount} time${dominantCount > 1 ? 's' : ''} throughout the middle section. Practice pausing instead of using fillers during transitions.`
    } else if (dominantWord) {
      insight = `You use "${dominantWord}" ${dominantCount} time${dominantCount > 1 ? 's' : ''} throughout your pitch. Replace fillers with brief pauses for a more confident delivery.`
    } else {
      insight = `You use ${total} filler word${total > 1 ? 's' : ''} total. Practice replacing them with brief pauses.`
    }
  }

  // Generate drill based on pattern
  let drillTitle = 'Filler Word Elimination'
  let drillSteps: string[] = []

  if (total === 0) {
    drillTitle = 'Maintain Clean Delivery'
    drillSteps = [
      'Continue practicing without filler words',
      'Focus on maintaining your clean delivery style',
      'Use brief pauses when you need thinking time',
    ]
  } else {
    // Determine drill based on section pattern
    const maxSection = Math.max(sections.intro, sections.middle, sections.close)
    
    if (sections.intro === maxSection && sections.intro > 0) {
      drillTitle = 'Strong Opening Practice'
      drillSteps = [
        'Practice your opening 3-4 sentences 5 times out loud',
        'Focus on the first 20 seconds - eliminate all fillers',
        'Record yourself and count fillers in the opening',
        'Re-record until you have 0 fillers in the first 20 seconds',
        'Apply this clean opening to your full pitch',
      ]
    } else if (sections.close === maxSection && sections.close > 0) {
      drillTitle = 'Strong Closing Practice'
      drillSteps = [
        'Practice your closing 3-4 sentences 5 times out loud',
        'Focus on the last 20% of your pitch - eliminate all fillers',
        'Record yourself and count fillers in the closing',
        'Re-record until you have 0 fillers in the closing',
        'End with confidence and clarity',
      ]
    } else {
      drillTitle = 'Filler Word Elimination'
      drillSteps = [
        'Record yourself speaking for 30 seconds',
        `Count every filler word you use (focus on "${Object.entries(by_word).sort(([_, a], [__, b]) => b - a)[0]?.[0] || 'fillers'}")`,
        'Re-record, replacing each filler with a 1-second pause',
        'Repeat until you use 0-1 fillers per 30 seconds',
        'Apply this technique to your full pitch practice',
      ]
    }
  }

  return {
    total,
    by_word,
    sections,
    insight,
    drill: {
      title: drillTitle,
      steps: drillSteps,
    },
  }
}

// Premium Insights: Pacing Analysis
function analyzePacing(
  transcript: string,
  durationMs: number | null,
  wpm: number | null
): {
  wpm_overall: number | null
  segments: Array<{
    label: 'slow' | 'good' | 'fast'
    start_sec: number | null
    end_sec: number | null
    wpm: number | null
    note: string
  }>
  pauses: {
    longest_pause_sec: number | null
    long_pause_count: number
    notes: string
  }
} {
  const wpm_overall = wpm

  // Approximate segments using sentence order + duration
  const segments: Array<{
    label: 'slow' | 'good' | 'fast'
    start_sec: number | null
    end_sec: number | null
    wpm: number | null
    note: string
  }> = []

  if (durationMs && durationMs > 0) {
    const durationSec = durationMs / 1000
    const sentences = transcript.split(/([.!?]+\s+)/).filter((part, i) => i % 2 === 0 && part.trim().length > 0)
    const totalWords = transcript.split(/\s+/).filter(w => w.length > 0).length
    const avgWpm = wpm || (totalWords / (durationSec / 60))

    // Divide into 3 segments
    const segmentCount = 3
    const wordsPerSegment = Math.ceil(totalWords / segmentCount)
    const secPerSegment = durationSec / segmentCount

    let wordCount = 0
    for (let i = 0; i < segmentCount; i++) {
      const startSec = i * secPerSegment
      const endSec = (i + 1) * secPerSegment
      
      // Approximate words in this segment (rough estimate)
      const segmentWords = Math.min(wordsPerSegment, totalWords - wordCount)
      const segmentWpm = segmentWords / (secPerSegment / 60)
      
      let label: 'slow' | 'good' | 'fast'
      let note: string
      
      if (segmentWpm < 120) {
        label = 'slow'
        note = 'Pace is slower than ideal. Consider speaking slightly faster to maintain engagement.'
      } else if (segmentWpm > 180) {
        label = 'fast'
        note = 'Pace is faster than ideal. Slow down slightly for better comprehension.'
      } else {
        label = 'good'
        note = 'Pace is within the ideal range for clear communication.'
      }

      segments.push({
        label,
        start_sec: i === 0 ? 0 : startSec,
        end_sec: i === segmentCount - 1 ? null : endSec,
        wpm: segmentWpm,
        note,
      })

      wordCount += segmentWords
    }
  } else {
    // No duration data - provide null segments
    segments.push({
      label: 'good',
      start_sec: null,
      end_sec: null,
      wpm: null,
      note: 'Duration data unavailable for segment analysis.',
    })
  }

  // Pause analysis (approximate from punctuation and sentence breaks)
  const pauses = {
    longest_pause_sec: null,
    long_pause_count: 0,
    notes: 'Pause analysis requires word-level timestamps. Estimated from sentence structure.',
  }

  // Count sentence breaks (potential pauses)
  const sentenceBreaks = (transcript.match(/[.!?]+\s+/g) || []).length
  if (durationMs && durationMs > 0 && sentenceBreaks > 0) {
    const avgPauseSec = (durationMs / 1000) / (sentenceBreaks + 1)
    // Consider pauses > 1 second as "long"
    pauses.long_pause_count = Math.max(0, sentenceBreaks - Math.floor((durationMs / 1000) / sentenceBreaks))
    pauses.notes = `Estimated ${sentenceBreaks} natural pauses. Aim for 0.5-1 second pauses between key points.`
  }

  return {
    wpm_overall,
    segments,
    pauses,
  }
}

// Premium Insights: Structure Analysis
function analyzeStructure(
  transcript: string,
  chunks: Array<{ text: string; purpose_label: string }>,
  rubricScores: Array<{ criterion_label: string; missing: boolean }>
): {
  detected_sections: string[]
  missing_sections: string[]
  suggested_lines: { [section: string]: string }
  one_sentence_pitch: string
} {
  // Common pitch sections
  const commonSections = ['hook', 'problem', 'solution', 'value', 'cta', 'who', 'what', 'why', 'how']
  
  // Detect sections from chunks and rubric scores
  const detectedSections: string[] = []
  const missingSections: string[] = []
  
  chunks.forEach(chunk => {
    const label = chunk.purpose_label.toLowerCase()
    commonSections.forEach(section => {
      if (label.includes(section) && !detectedSections.includes(section)) {
        detectedSections.push(section)
      }
    })
  })

  // Check rubric scores for missing sections
  rubricScores.forEach(score => {
    const label = score.criterion_label.toLowerCase()
    commonSections.forEach(section => {
      if (label.includes(section)) {
        if (score.missing && !missingSections.includes(section)) {
          missingSections.push(section)
        }
      }
    })
  })

  // Generate suggested lines for missing sections
  const suggestedLines: { [section: string]: string } = {}
  
  missingSections.forEach(section => {
    switch (section) {
      case 'hook':
        suggestedLines[section] = "Start with a compelling question or surprising statistic that grabs attention."
        break
      case 'problem':
        suggestedLines[section] = "Clearly state the problem your audience faces. What pain point are you solving?"
        break
      case 'solution':
        suggestedLines[section] = "Explain your solution in simple terms. What do you offer?"
        break
      case 'value':
        suggestedLines[section] = "Articulate the unique value proposition. Why should they care?"
        break
      case 'cta':
        suggestedLines[section] = "End with a clear call to action. What's the next step?"
        break
      case 'who':
        suggestedLines[section] = "Define your target audience. Who is this for?"
        break
      case 'what':
        suggestedLines[section] = "Describe what you're building or offering."
        break
      case 'why':
        suggestedLines[section] = "Explain why this matters. What's the motivation?"
        break
      case 'how':
        suggestedLines[section] = "Explain how it works or how you'll deliver value."
        break
      default:
        suggestedLines[section] = `Add a clear ${section} section to strengthen your pitch.`
    }
  })

  // Generate one-sentence pitch (compressed version)
  const sentences = transcript.split(/([.!?]+\s+)/).filter((part, i) => i % 2 === 0 && part.trim().length > 0)
  const oneSentencePitch = sentences.length > 0
    ? sentences.slice(0, 3).join(' ').substring(0, 200) + (sentences.length > 3 ? '...' : '')
    : transcript.substring(0, 200) + (transcript.length > 200 ? '...' : '')

  return {
    detected_sections: detectedSections,
    missing_sections: missingSections,
    suggested_lines: suggestedLines,
    one_sentence_pitch: oneSentencePitch,
  }
}

// Premium Insights: Coaching Plan
function generateCoachingPlan(
  analysis: AnalysisOutput,
  fillerCount: number,
  wpm: number | null
): {
  next_attempt_focus: string[]
  drills: Array<{ title: string; steps: string[] }>
} {
  const focus: string[] = []
  const drills: Array<{ title: string; steps: string[] }> = []

  // Determine focus areas based on analysis
  if (fillerCount > 5) {
    focus.push('Reduce filler words by practicing pauses instead')
  }

  if (wpm !== null) {
    if (wpm < 120) {
      focus.push('Increase speaking pace slightly for better engagement')
    } else if (wpm > 180) {
      focus.push('Slow down to improve clarity and comprehension')
    }
  }

  if (analysis.summary.top_improvements.length > 0) {
    const topImprovement = analysis.summary.top_improvements[0]
    if (topImprovement.length < 100) {
      focus.push(topImprovement.substring(0, 80) + '...')
    } else {
      focus.push('Address the key improvement areas identified in feedback')
    }
  }

  // Limit to 3 focus items
  const next_attempt_focus = focus.slice(0, 3)

  // Generate drills
  if (fillerCount > 0) {
    drills.push({
      title: 'Filler Word Elimination',
      steps: [
        'Record yourself speaking for 30 seconds',
        'Count every "um", "uh", "like" you use',
        'Re-record, replacing fillers with a 1-second pause',
        'Repeat until you use 0-1 fillers per 30 seconds',
      ],
    })
  }

  if (wpm !== null && (wpm < 120 || wpm > 180)) {
    drills.push({
      title: 'Pace Control Practice',
      steps: [
        wpm < 120
          ? 'Read a paragraph at 140-150 WPM (use a metronome app)'
          : 'Read a paragraph at 150-160 WPM (use a metronome app)',
        'Practice the same paragraph 3 times, matching the target pace',
        'Record yourself and verify your pace matches',
        'Apply this pace to your pitch practice',
      ],
    })
  }

  drills.push({
    title: 'Structure Reinforcement',
    steps: [
      'Write out your pitch in 3-5 bullet points',
      'Practice each section separately',
      'Connect sections with transition phrases',
      'Record the full pitch and check for all key sections',
    ],
  })

  return {
    next_attempt_focus: next_attempt_focus,
    drills: drills.slice(0, 3), // Limit to 3 drills
  }
}

// Premium Content: Generate Signature Insight and Coach's Take
function generatePremiumContent(
  analysis: AnalysisOutput,
  fillerCount: number,
  wpm: number | null,
  pacingSegments: Array<{ label: 'slow' | 'good' | 'fast'; start_sec: number | null; end_sec: number | null; note: string }>,
  missingSections: string[]
): {
  signature_insight: string
  coach_take: string
  next_focus: string[]
  filler?: {
    total: number
    by_word: Record<string, number>
    sections: {
      intro: number
      middle: number
      close: number
    }
    insight: string
    drill: {
      title: string
      steps: string[]
    }
  }
} {
  // Generate Signature Insight (1-2 sentences: the most memorable takeaway)
  let signature_insight = ''
  
  // Priority 1: Pacing issues (especially dramatic changes)
  if (pacingSegments.length > 0) {
    const slowSegments = pacingSegments.filter(s => s.label === 'slow')
    const fastSegments = pacingSegments.filter(s => s.label === 'fast')
    
    if (slowSegments.length > 0 && slowSegments[0].start_sec !== null) {
      const startSec = Math.round(slowSegments[0].start_sec)
      signature_insight = `Your pacing slows dramatically in the first ${startSec} seconds → warm up before recording to maintain consistent energy.`
    } else if (fastSegments.length > 0) {
      signature_insight = `Your pace is too fast in key sections → slow down slightly for better comprehension and impact.`
    } else if (wpm !== null && wpm < 120) {
      signature_insight = `Your overall pace is slower than ideal (${Math.round(wpm)} WPM) → aim for 140-160 WPM to maintain engagement.`
    } else if (wpm !== null && wpm > 180) {
      signature_insight = `Your overall pace is too fast (${Math.round(wpm)} WPM) → slow down to 140-160 WPM for clarity.`
    }
  }
  
  // Priority 2: Missing critical sections
  if (!signature_insight && missingSections.length > 0) {
    const criticalSections = missingSections.filter(s => 
      ['cta', 'call to action', 'problem', 'solution'].includes(s.toLowerCase())
    )
    if (criticalSections.length > 0) {
      const section = criticalSections[0]
      signature_insight = `Your ${section} section is missing even when the rest is strong → add a clear ${section} to complete your pitch.`
    } else {
      signature_insight = `You're missing ${missingSections.length} key section${missingSections.length > 1 ? 's' : ''} (${missingSections.join(', ')}) → address these gaps to strengthen your pitch.`
    }
  }
  
  // Priority 3: Filler words
  if (!signature_insight && fillerCount > 5) {
    signature_insight = `You used ${fillerCount} filler words throughout → practice replacing "um" and "uh" with brief pauses for a more confident delivery.`
  }
  
  // Priority 4: High-priority line-by-line issues
  if (!signature_insight && analysis.line_by_line.length > 0) {
    const highPriorityIssues = analysis.line_by_line
      .filter(item => item.type === 'issue' && item.priority === 'high')
      .slice(0, 1)
    
    if (highPriorityIssues.length > 0) {
      const issue = highPriorityIssues[0]
      signature_insight = `${issue.comment.substring(0, 100)}${issue.comment.length > 100 ? '...' : ''}`
    }
  }
  
  // Fallback: Use top improvement
  if (!signature_insight && analysis.summary.top_improvements.length > 0) {
    const topImprovement = analysis.summary.top_improvements[0]
    signature_insight = topImprovement.substring(0, 150) + (topImprovement.length > 150 ? '...' : '')
  }
  
  // Final fallback
  if (!signature_insight) {
    signature_insight = `Focus on the key improvement areas identified in your feedback to strengthen your next attempt.`
  }
  
  // Generate Coach's Take (paragraph with 2 focus bullets + goal)
  const coachTakeParts: string[] = []
  
  // Opening sentence: overall delivery assessment
  const overallScore = analysis.summary.overall_score
  if (overallScore >= 7) {
    coachTakeParts.push(`Your pitch shows strong fundamentals with a solid structure and clear messaging.`)
  } else if (overallScore >= 5) {
    coachTakeParts.push(`Your pitch has good potential but needs refinement in key areas to maximize impact.`)
  } else {
    coachTakeParts.push(`Your pitch needs work, but with focused practice on the areas below, you'll see significant improvement.`)
  }
  
  // Generate next_focus array (2 items)
  const nextFocus: string[] = []
  
  // Focus 1: Based on pacing
  if (wpm !== null) {
    if (wpm < 120) {
      nextFocus.push(`Increase your speaking pace to 140-160 WPM for better engagement`)
    } else if (wpm > 180) {
      nextFocus.push(`Slow down your speaking pace to 140-160 WPM for better clarity`)
    }
  }
  
  // Focus 2: Based on missing sections
  if (nextFocus.length < 2 && missingSections.length > 0) {
    const criticalSection = missingSections.find(s => 
      ['cta', 'call to action', 'problem', 'solution'].includes(s.toLowerCase())
    ) || missingSections[0]
    nextFocus.push(`Add a clear ${criticalSection} section to complete your pitch structure`)
  }
  
  // Focus 3: Based on filler words
  if (nextFocus.length < 2 && fillerCount > 5) {
    nextFocus.push(`Reduce filler words by practicing brief pauses instead of "um" and "uh"`)
  }
  
  // Focus 4: Based on high-priority issues
  if (nextFocus.length < 2 && analysis.line_by_line.length > 0) {
    const highPriorityIssue = analysis.line_by_line
      .find(item => item.type === 'issue' && item.priority === 'high')
    if (highPriorityIssue) {
      const focusText = highPriorityIssue.action.substring(0, 80)
      if (focusText.length > 0) {
        nextFocus.push(focusText + (highPriorityIssue.action.length > 80 ? '...' : ''))
      }
    }
  }
  
  // Fill remaining slots with top improvements
  while (nextFocus.length < 2 && analysis.summary.top_improvements.length > 0) {
    const improvement = analysis.summary.top_improvements[nextFocus.length - 1]
    if (improvement) {
      const focusText = improvement.substring(0, 80)
      if (focusText.length > 0 && !nextFocus.includes(focusText)) {
        nextFocus.push(focusText + (improvement.length > 80 ? '...' : ''))
      }
    }
    if (nextFocus.length >= 2) break
  }
  
  // Ensure we have at least 2 focus items
  if (nextFocus.length === 0) {
    nextFocus.push('Review the feedback and practice the key improvement areas')
    nextFocus.push('Record another attempt to measure your progress')
  } else if (nextFocus.length === 1) {
    nextFocus.push('Review the detailed feedback and practice the identified areas')
  }
  
  // Build coach_take with bullets
  coachTakeParts.push(`\n\nFocus next:`)
  nextFocus.forEach((focus, idx) => {
    coachTakeParts.push(`• ${focus}`)
  })
  
  // Closing sentence: next attempt goal
  if (overallScore >= 7) {
    coachTakeParts.push(`\n\nNext attempt goal: Refine the details and polish your delivery to reach a 9-10 score.`)
  } else if (overallScore >= 5) {
    coachTakeParts.push(`\n\nNext attempt goal: Address the focus areas above to push your score from ${overallScore} to 7+.`)
  } else {
    coachTakeParts.push(`\n\nNext attempt goal: Focus on the two areas above to improve your score from ${overallScore} to 5+.`)
  }
  
  const coach_take = coachTakeParts.join('\n')
  
  return {
    signature_insight,
    coach_take,
    next_focus: nextFocus.slice(0, 2), // Ensure exactly 2 items
  }
}

function buildAnalysisPrompt(
  transcript: string,
  criteria: RubricCriterion[],
  promptRubric: PromptRubricItem[] | null,
  targetDurationSeconds: number | null,
  maxDurationSeconds: number | null,
  audioSeconds: number | null,
  wpm: number | null,
  pitchContext: string | null = null,
  guidingQuestions: string[] = [],
  userPlan: 'free' | 'starter' | 'coach' | 'daypass' = 'free',
  rubricName: string | null = null
): string {
  // Use prompt-specific rubric if provided, otherwise use generic criteria
  const rubricItems: PromptRubricItem[] = promptRubric || criteria.map((c, i) => ({
    id: `criterion_${i}`,
    label: c.name,
    weight: 1.0,
    optional: false,
  }))
  
  const criteriaList = rubricItems
    .map((item, i) => {
      const weightNote = item.weight !== 1.0 ? ` (weight: ${item.weight})` : ''
      const optionalNote = item.optional ? ' (optional)' : ''
      return `${i + 1}. ${item.label}${weightNote}${optionalNote}`
    })
    .join('\n')

  const rubricWeights = rubricItems.map(item => ({
    id: item.id,
    label: item.label,
    weight: item.weight,
  }))

  // Check if this is Free plan + Elevator Pitch rubric with "Call to action" criterion
  const isFreeElevatorPitch = userPlan === 'free' && (
    rubricName?.toLowerCase().includes('elevator') ||
    rubricItems.some(item => 
      item.label?.toLowerCase().includes('call to action') || 
      item.label?.toLowerCase().includes('cta') ||
      item.id === 'cta'
    )
  )

  const pitchContextSection = pitchContext 
    ? `\nPITCH CONTEXT (Additional information about what the user is pitching):
${pitchContext}

Use this context to better understand the pitch goals and provide more relevant feedback.`
    : ''

  const guidingQuestionsSection = guidingQuestions.length > 0
    ? `\nGUIDING QUESTIONS (Evaluate whether the pitch addresses these questions):
${guidingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

For each question, determine:
- Was it answered? (answered: true/false)
- What evidence supports your answer? (evidence_quotes: array of verbatim quotes from transcript, ≤120 characters each)
- If not answered or partially answered, what improvement is needed? (improvement: specific suggestion with quote citation)`
    : ''

  const callToActionSpecialInstructions = isFreeElevatorPitch
    ? `\n\nSPECIAL INSTRUCTIONS FOR "CALL TO ACTION" CRITERION (Free Elevator Pitch Only):
This criterion should be evaluated as "Close or Next Step" (not just explicit ask).

Scoring Guidelines (Free Plan Only):
- 8-10: Explicit next step or ask (e.g., "I'm looking for...", "The next step is...")
- 5-7: Clear implied next step or strong takeaway (e.g., "This gives people a repeatable way to improve how they communicate.")
- 4: Soft close with purpose/value (e.g., "do better when it matters", summary of value)
- 0-3: Abrupt stop or trailing off with no conclusion

IMPORTANT RULES (Free Plan Only):
- MINIMUM SCORE = 4 if the pitch ends with:
  * a summary of value OR
  * an implied outcome (e.g., "do better when it matters")
- If the pitch ends with a clear summary or value statement, do NOT score below 4.
- Only score below 4 (0-3) if the ending is abrupt or trails off with no conclusion.
- When giving partial credit (5-7), include the closing sentence as an evidence quote.
- When giving minimum score (4), include the closing sentence as an evidence quote.
- Feedback text: 
  * If score is 4: "The pitch ends with a purpose, but could be stronger with a clear next step."
  * If there's a summary but no explicit ask (score 5-7): "The pitch ends with a summary, but could be strengthened by adding a clear next step or ask."
  * Only say "lacks a call to action" when there is no close at all (score 0-3).

Example evidence quote for score 4: "do better when it matters"
Example evidence quote for score 5-7: "PitchPractice gives people a repeatable way to improve how they communicate."`
    : ''

  return `You are an expert pitch coach providing detailed, actionable feedback on a pitch presentation.
${callToActionSpecialInstructions}

CRITICAL RULES (STRICTLY ENFORCED):
1. ALL feedback MUST cite specific quotes from the transcript. If you cannot cite a quote, do not make the claim.
2. Quotes must be verbatim excerpts (≤120 characters) from the transcript - copy them exactly as they appear.
3. Be specific and actionable. Avoid generic advice like "be more engaging" - instead say "When you said '[quote]', try [specific action]."
4. Reference exact transcript segments for every point. No exceptions.
5. If you cannot find a specific quote to support a point, omit that point entirely rather than making a generic claim.
6. EVIDENCE QUOTES ARE MANDATORY: For every criterion in rubric_scores, always include evidence_quotes array.
   - If score >= 1: Include 1-2 verbatim quotes from transcript (≤120 characters each)
   - If score = 0: Include empty array [] and explain what was missing in notes
7. LINE-BY-LINE COACHING: Provide 3-8 items (fewer for shorter pitches). Each quote must be a verbatim substring from transcript (≤120 characters).
8. TRANSCRIPT SENTENCE ALIGNMENT: Prefer quotes that align to single sentences or short phrases for UI hover matching. Avoid combining multiple sentences.

TRANSCRIPT:
${transcript}${pitchContextSection}${guidingQuestionsSection}

RUBRIC CRITERIA (Evaluate how well the pitch addresses each):
${criteriaList}

RUBRIC WEIGHTS (for overall score calculation):
${JSON.stringify(rubricWeights, null, 2)}

TIMING INFO:
${targetDurationSeconds ? `Target duration: ${targetDurationSeconds}s (${Math.floor(targetDurationSeconds / 60)} min)` : 'No target duration specified'}
${maxDurationSeconds ? `Max duration: ${maxDurationSeconds}s (${Math.floor(maxDurationSeconds / 60)} min)` : ''}
${audioSeconds ? `Actual duration: ${audioSeconds.toFixed(1)}s` : 'Duration unknown'}
${wpm ? `Speaking pace: ${wpm} WPM` : ''}

OUTPUT REQUIREMENTS:
Return a JSON object with this exact structure:

{
  "summary": {
    "overall_score": <0-10 integer, calculated from weighted rubric scores>,
    "overall_notes": "<2-3 sentences summarizing the pitch>",
    "top_strengths": ["<specific strength with quote>", ...],
    "top_improvements": ["<specific improvement with quote>", ...]
  },
  "timing": {
    "target_seconds": ${targetDurationSeconds || 'null'},
    "max_seconds": ${maxDurationSeconds || 'null'},
    "estimated_seconds": ${audioSeconds ? audioSeconds.toFixed(1) : 'null'},
    "pacing_wpm": ${wpm || 'null'},
    "notes": "<specific timing feedback with quotes if relevant>"
  },
  "rubric_scores": [
    {
      "criterion_id": "<criterion id from rubric>",
      "criterion_label": "<criterion label>",
      "score": <0-10 integer>,
      "notes": "<specific feedback with quote citation. If score=0, explain what was missing>",
      "evidence_quotes": <MANDATORY: If score >= 1, include 1-2 verbatim quotes (≤120 chars each) from transcript. If score = 0, use empty array []>,
      "missing": <boolean, true if this criterion is not addressed at all>
    },
    ... (one for each criterion in rubric)
  ],${guidingQuestions.length > 0 ? `
  "question_grading": [
    {
      "question": "<guiding question text>",
      "answered": <boolean, true if the question is addressed in the pitch>,
      "evidence_quotes": ["<verbatim quote 1 (≤120 chars)>", "<verbatim quote 2 (≤120 chars)>"],
      "improvement": "<specific suggestion if not answered, or null if fully answered>"
    },
    ... (one for each guiding question)
  ],` : ''}
  "chunks": [
    {
      "text": "<verbatim excerpt from transcript, 1-3 sentences forming one idea unit>",
      "purpose": "<criterion_id this chunk addresses>",
      "purpose_label": "<human-readable label like 'Hook', 'What', 'Who', 'Why'>",
      "score": <0-10 integer or null if not applicable>,
      "status": "<strong|needs_work|missing>",
      "feedback": "<why this needs work / what's good about it>",
      "rewrite_suggestion": "<improved version of this chunk or null>"
    },
    ... (break transcript into 3-8 idea units/chunks)
  ],
  "line_by_line": [
    {
      "quote": "<verbatim excerpt ≤120 characters, must be exact substring from transcript>",
      "type": "<strength|issue>",
      "comment": "<what's good/bad about this>",
      "action": "<what to change/keep>",
      "priority": "<high|medium|low>"
    },
    ... (3-8 items covering key moments, fewer for shorter pitches)
  ],
  "pause_suggestions": [
    {
      "after_quote": "<verbatim excerpt ≤120 characters where pause should occur>",
      "why": "<reason for pause>",
      "duration_ms": <300-900>
    },
    ... (2-5 suggestions)
  ],
  "cut_suggestions": [
    {
      "quote": "<verbatim excerpt ≤120 characters to remove>",
      "why": "<reason to cut>",
      "replacement": "<optional rewrite or null>"
    },
    ... (0-5 suggestions)
  ]
}

CHUNKING INSTRUCTIONS:
- Break the transcript into 3-8 idea units (chunks)
- Each chunk should be 1-3 sentences that form one coherent idea
- Map each chunk to a rubric criterion (purpose field)
- If a chunk doesn't clearly map to any criterion, use purpose "other" or "transition"
- Chunks should cover the entire transcript with minimal overlap

EVIDENCE + LINE-BY-LINE REQUIREMENTS (MANDATORY):
You must produce outputs that are directly grounded in the transcript.

Evidence quotes:
- For EVERY criterion in rubric_scores, always include evidence_quotes array.
- If score >= 1: Include 1-2 verbatim quotes from transcript (≤120 characters each, exact substrings)
- If score = 0: Use empty array [] and explain what was missing in notes
- Each quote must be verbatim and appear in the transcript exactly
- If criterion is missing/not addressed (missing=true or score=0), set evidence_quotes: [] and explain in notes

Line-by-line coaching:
- Provide 3-8 items (fewer for shorter pitches)
- Every line_by_line[i].quote MUST be a verbatim substring from the transcript (≤120 characters)
- Prefer quotes that align to single sentences or short phrases for UI hover matching
- Each item must include: type ("strength" or "issue"), quote (exact transcript substring), comment, action, priority
- If you cannot find a good quote, DO NOT invent one; omit the item

REMEMBER (STRICT ENFORCEMENT):
- Every claim must have a quote. No exceptions. If you cannot cite a quote, do not include that feedback.
- Quotes must be exact verbatim excerpts from the transcript (≤120 characters).
- Be specific and actionable. Generic advice will be rejected.
- Focus on the most impactful feedback first.
- For chunks: Break transcript naturally by idea, not just by sentence count.
- For rubric_scores: Calculate overall_score as weighted average: sum(score * weight) / sum(weight) for non-optional items. ALWAYS include evidence_quotes for every criterion.
- For line_by_line: Each item MUST have a quote that appears exactly in the transcript. Provide 3-8 items.
- For pause_suggestions: The "after_quote" must be an exact excerpt from the transcript (≤120 characters).
- For cut_suggestions: The "quote" must be an exact excerpt from the transcript (≤120 characters).
- NO HALLUCINATIONS: Do not invent evidence. If a criterion is not supported by transcript content, set score low and evidence_quotes empty.

VALIDATION: Before including any feedback item, verify that the quote appears verbatim in the transcript.`
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Parse request body for rubric_id (if provided)
    // Note: We'll use the run's rubric_id from the database, but this allows
    // the client to specify a different rubric_id if needed
    let requestRubricId: string | null = null
    let promptRubric: PromptRubricItem[] | null = null
    let pitchContext: string | null = null
    try {
      const body = await request.json().catch(() => ({}))
      requestRubricId = body.rubric_id || null
      promptRubric = body.prompt_rubric || null
      pitchContext = body.pitch_context || null
      if (requestRubricId) {
        console.log('[Analyze] Request specified rubric_id:', requestRubricId)
      }
      if (promptRubric) {
        console.log('[Analyze] Using prompt-specific rubric:', promptRubric)
      }
      if (pitchContext) {
        console.log('[Analyze] Pitch context provided:', pitchContext.substring(0, 100))
      }
    } catch (e) {
      // Request body is optional, continue with run's rubric_id
    }

    // Set status to 'analyzing' immediately
    await getSupabaseAdmin()
      .from('pitch_runs')
      .update({ status: 'analyzing' })
      .eq('id', id)

    // Fetch the run (include duration_ms and pitch_context)
    const { data: run, error: fetchError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .select('*')
      .eq('id', id)
      .single()
    
    // Use pitch_context from request body if provided, otherwise from run
    const finalPitchContext = pitchContext || run?.pitch_context || null

    if (fetchError || !run) {
      console.error('[Analyze] Run not found:', { id, error: fetchError })
      return NextResponse.json(
        { 
          ok: false,
          error: 'Run not found',
          details: fetchError?.message || 'Run with this ID does not exist',
          runId: id,
        },
        { status: 404 }
      )
    }

    // Check transcript exists and has content (more robust than just checking status)
    const transcriptLength = run.transcript?.length || 0
    if (!run.transcript || transcriptLength === 0) {
      console.error('[Analyze] Missing or empty transcript:', {
        runId: id,
        status: run.status,
        hasTranscript: !!run.transcript,
        transcriptLength,
      })
      return NextResponse.json(
        { 
          ok: false,
          error: 'Transcript is required for analysis',
          details: `Transcript is missing or empty. Status: ${run.status}, Transcript length: ${transcriptLength}`,
          runId: id,
          runStatus: run.status,
          transcriptLength,
          fieldsChecked: ['transcript', 'transcript.length'],
        },
        { status: 400 }
      )
    }

    // Warn if status is not 'transcribed' but allow analysis if transcript exists
    if (run.status !== 'transcribed') {
      console.warn('[Analyze] Run status is not "transcribed", but transcript exists:', {
        runId: id,
        status: run.status,
        transcriptLength,
      })
      // Don't block - transcript exists, so we can analyze
    }

    // Fetch rubric: check rubric_snapshot_json first, then rubric_id
    let rubric: any = null
    let criteria: RubricCriterion[] = []
    let guidingQuestions: string[] = []
    let rubricJson: any = null
    
    // Priority 1: Use rubric_snapshot_json if present (from rubric_json upload)
    if (run.rubric_snapshot_json) {
      rubricJson = run.rubric_snapshot_json
      
      // Extract criteria from snapshot
      if (rubricJson.criteria && Array.isArray(rubricJson.criteria)) {
        criteria = rubricJson.criteria.map((c: any) => ({
          name: c.name || c.label || 'Unknown',
          description: c.description || c.desc || '',
        }))
      }
      
      // Extract guiding_questions from snapshot
      if (rubricJson.guiding_questions && Array.isArray(rubricJson.guiding_questions)) {
        guidingQuestions = rubricJson.guiding_questions.filter((q: any) => 
          typeof q === 'string' && q.trim().length > 0
        )
      }
      
      // Create a virtual rubric object for compatibility
      rubric = {
        name: rubricJson.name || rubricJson.title || 'Custom Rubric',
        title: rubricJson.title || rubricJson.name || 'Custom Rubric',
        description: rubricJson.description || null,
        target_duration_seconds: rubricJson.target_duration_seconds || null,
        max_duration_seconds: rubricJson.max_duration_seconds || null,
      }
      
      console.log('[Analyze] Using rubric_snapshot_json:', {
        runId: id,
        name: rubric.name,
        criteriaCount: criteria.length,
      })
    }
    // Priority 2: Use rubric_id from database (existing behavior)
    else {
      // Use requestRubricId if provided, otherwise use run.rubric_id
      const rubricIdToUse = requestRubricId || run.rubric_id

      if (rubricIdToUse) {
        // Fetch from unified rubrics table
        const { data: fetchedRubric } = await getSupabaseAdmin()
          .from('rubrics')
          .select('*')
          .eq('id', rubricIdToUse)
          .single()
        
        if (fetchedRubric) {
          rubric = fetchedRubric
          rubricJson = rubric.rubric_json || null

          // Extract criteria from rubric_json if available, otherwise fall back to criteria field
          if (rubricJson && rubricJson.criteria && Array.isArray(rubricJson.criteria)) {
            criteria = rubricJson.criteria.map((c: any) => ({
              name: c.name || c.label || 'Unknown',
              description: c.description || '',
            }))
          } else if (rubric.criteria && Array.isArray(rubric.criteria)) {
            // Fallback to legacy criteria field
            criteria = rubric.criteria.map((c: any) => ({
              name: c.name || c.label || 'Unknown',
              description: c.description || '',
            }))
          }

          // Extract guiding_questions from rubric_json
          if (rubricJson && rubricJson.guiding_questions && Array.isArray(rubricJson.guiding_questions)) {
            guidingQuestions = rubricJson.guiding_questions.filter((q: any) => 
              typeof q === 'string' && q.trim().length > 0
            )
          }
        }
      }
    }

    // Fallback to default template rubric if not found
    if (!rubric) {
      const rubricIdToUse = requestRubricId || run.rubric_id
      console.warn('[Analyze] Rubric not found, using default template:', { 
        runId: id, 
        rubricId: rubricIdToUse 
      })
      
      // Fetch first template rubric as fallback
      const { data: defaultRubrics } = await getSupabaseAdmin()
        .from('rubrics')
        .select('*')
        .eq('is_template', true)
        .order('created_at', { ascending: true })
        .limit(1)
      
      if (defaultRubrics && defaultRubrics.length > 0) {
        rubric = defaultRubrics[0]
        rubricJson = rubric.rubric_json || null

        // Extract criteria from rubric_json if available
        if (rubricJson && rubricJson.criteria && Array.isArray(rubricJson.criteria)) {
          criteria = rubricJson.criteria.map((c: any) => ({
            name: c.name || c.label || 'Unknown',
            description: c.description || '',
          }))
        } else if (rubric.criteria && Array.isArray(rubric.criteria)) {
          criteria = rubric.criteria.map((c: any) => ({
            name: c.name || c.label || 'Unknown',
            description: c.description || '',
          }))
        }

        // Extract guiding_questions
        if (rubricJson && rubricJson.guiding_questions && Array.isArray(rubricJson.guiding_questions)) {
          guidingQuestions = rubricJson.guiding_questions.filter((q: any) => 
            typeof q === 'string' && q.trim().length > 0
          )
        }
      }
    }

    if (!rubric || criteria.length === 0) {
      const rubricIdToUse = requestRubricId || run.rubric_id
      console.error('[Analyze] No valid rubric found (including fallback):', { 
        runId: id, 
        rubricId: rubricIdToUse,
        hasRubric: !!rubric,
        criteriaCount: criteria.length,
        hasSnapshot: !!run.rubric_snapshot_json,
      })
      return NextResponse.json(
        { 
          ok: false,
          error: 'Rubric not found',
          details: `No valid rubric found. Rubric ID: ${rubricIdToUse || 'null'}`,
          runId: id,
          rubricId: rubricIdToUse,
          runStatus: run.status,
          transcriptLength,
        },
        { status: 400 }
      )
    }


    // Use duration_ms as source of truth, fallback to audio_seconds
    const audioSeconds = run.duration_ms ? run.duration_ms / 1000 : run.audio_seconds

    // Get user plan from database (source of truth) - prioritize authenticated user
    // getUserPlanFromDB already checks authenticated user first, then falls back to session_id
    // If no authenticated user, it returns 'free'
    const userPlan = await getUserPlanFromDB(run.session_id)
    
    // Verify: if run has user_id, ensure we're using the authenticated user's plan
    // (getUserPlanFromDB already does this, but we log it for debugging)
    let authenticatedUserId: string | null = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        authenticatedUserId = user.id
      }
    } catch (err) {
      // Not authenticated - that's fine, plan will be 'free'
    }
    
    console.log('[Analyze] Resolved user plan from database:', {
      runId: id,
      sessionId: run.session_id,
      runUserId: run.user_id,
      authenticatedUserId,
      plan: userPlan,
      note: authenticatedUserId ? 'Using authenticated user plan' : 'No authenticated user, using session_id or free',
    })

    // Build the analysis prompt
    // Use prompt-specific rubric if provided, otherwise use generic criteria
    // Handle both rubrics table (has 'name' field) and unified table (has 'title' field)
    const rubricName = rubric.name || rubric.title || 'Unknown Rubric'
    
    // Extract target_duration_seconds from rubric_json if available
    const targetDurationSeconds = rubricJson?.target_duration_seconds ?? rubric.target_duration_seconds ?? null
    const maxDurationSeconds = rubricJson?.max_duration_seconds ?? rubric.max_duration_seconds ?? null
    
    const prompt = buildAnalysisPrompt(
      run.transcript,
      criteria,
      promptRubric,
      targetDurationSeconds,
      maxDurationSeconds,
      audioSeconds,
      run.words_per_minute,
      finalPitchContext,
      guidingQuestions,
      userPlan,
      rubricName
    )

    // Call OpenAI for analysis
    let analysisJson: AnalysisOutput
    try {
      const openai = getOpenAIClient()
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert pitch coach. You provide detailed, actionable feedback that ALWAYS cites specific verbatim quotes from the transcript. You NEVER make generic claims without evidence. If you cannot cite an exact quote (≤120 characters) from the transcript, you must omit that feedback point entirely. Every piece of feedback must be anchored to a specific transcript excerpt. For rubric_scores, ALWAYS include evidence_quotes: if score >= 1, provide 1-2 quotes; if score = 0, use empty array [] and explain in notes. For line_by_line, provide 3-8 items with exact transcript substrings (≤120 characters each).',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      })

      const responseText = completion.choices[0]?.message?.content
      if (!responseText) {
        throw new Error('Empty response from OpenAI')
      }

      analysisJson = JSON.parse(responseText) as AnalysisOutput

      // Validate the structure
      if (!analysisJson.summary || !analysisJson.rubric_scores || !analysisJson.line_by_line) {
        throw new Error('Invalid analysis structure returned from OpenAI')
      }

      // Validate question_grading if guiding questions were provided
      if (guidingQuestions.length > 0 && !analysisJson.question_grading) {
        console.warn('[Analyze] Guiding questions provided but question_grading missing from response')
        // Don't fail - make it optional
      }

      // Add metadata to analysis_json
      analysisJson.meta = {
        plan_at_time: userPlan,
        generated_at: new Date().toISOString(),
      }

      // Generate premium insights for Coach plan
      if (userPlan === 'coach') {
        const fillerWordsAnalysis = analyzeFillerWords(run.transcript)
        const pacingAnalysis = analyzePacing(
          run.transcript,
          run.duration_ms,
          run.words_per_minute || null
        )
        const structureAnalysis = analyzeStructure(
          run.transcript,
          analysisJson.chunks,
          analysisJson.rubric_scores
        )
        const coachingPlan = generateCoachingPlan(
          analysisJson,
          fillerWordsAnalysis.total_count,
          run.words_per_minute || null
        )

        analysisJson.premium_insights = {
          filler_words: fillerWordsAnalysis,
          pacing: pacingAnalysis,
          structure: structureAnalysis,
          coaching_plan: coachingPlan,
        }

        // Generate premium content (Signature Insight + Coach's Take)
        const premiumContent = generatePremiumContent(
          analysisJson,
          fillerWordsAnalysis.total_count,
          run.words_per_minute || null,
          pacingAnalysis.segments,
          structureAnalysis.missing_sections
        )
        
        // Generate premium filler word breakdown
        const premiumFiller = analyzePremiumFillerWords(run.transcript)
        premiumContent.filler = premiumFiller
        
        analysisJson.premium = premiumContent
      } else {
        // Non-coach users: explicitly set premium to null
        analysisJson.premium = null
      }

      // Add filler word and hesitation detection for Free and Starter plans
      if (userPlan === 'free' || userPlan === 'starter') {
        // Collect existing quotes to avoid duplicates
        const existingQuotes = new Set<string>()
        analysisJson.line_by_line.forEach(item => {
          existingQuotes.add(item.quote.toLowerCase().trim())
        })

        // Detect filler words and hesitation
        const deliveryIssues = detectFillerWordsAndHesitation(
          run.transcript,
          existingQuotes
        )

        // Add delivery issues to line_by_line (limit to avoid overwhelming)
        if (deliveryIssues.length > 0) {
          // Insert delivery issues at the beginning or mix them in
          // Limit total line_by_line items to reasonable number (max 10-12)
          const maxItems = 12
          const currentCount = analysisJson.line_by_line.length
          const availableSlots = Math.max(0, maxItems - currentCount)
          
          if (availableSlots > 0) {
            // Add top delivery issues
            const issuesToAdd = deliveryIssues.slice(0, Math.min(availableSlots, 3))
            analysisJson.line_by_line = [
              ...issuesToAdd,
              ...analysisJson.line_by_line,
            ]
          } else {
            // Replace lowest priority items if we're at max
            const sortedByPriority = [...analysisJson.line_by_line].sort((a, b) => {
              const priorityOrder = { high: 3, medium: 2, low: 1 }
              return priorityOrder[a.priority] - priorityOrder[b.priority]
            })
            
            // Replace up to 2 lowest priority items with top delivery issues
            const topDeliveryIssues = deliveryIssues.slice(0, 2)
            if (topDeliveryIssues.length > 0) {
              const lowestPriorityItems = sortedByPriority.slice(-2)
              const lowestPriorityQuotes = new Set(
                lowestPriorityItems.map(item => item.quote.toLowerCase().trim())
              )
              
              analysisJson.line_by_line = analysisJson.line_by_line
                .filter(item => !lowestPriorityQuotes.has(item.quote.toLowerCase().trim()))
                .concat(topDeliveryIssues)
            }
          }
        }
      }
    } catch (error: any) {
      console.error('OpenAI analysis error:', error)
      
      await getSupabaseAdmin()
        .from('pitch_runs')
        .update({
          status: 'error',
          error_message: error.message || 'Analysis failed',
        })
        .eq('id', id)

      return NextResponse.json(
        { error: 'Analysis failed', details: error.message },
        { status: 500 }
      )
    }

    // Update the run with analysis and plan_at_time
    const { data: updatedRun, error: updateError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .update({
        analysis_json: analysisJson,
        plan_at_time: userPlan, // Store plan_at_time on run record for reliable UI gating
        status: 'analyzed',
        error_message: null,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      console.error('Database update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to save analysis', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      run: updatedRun,
      success: true,
      analysis: analysisJson,
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)

    // Try to update status to error
    try {
      await getSupabaseAdmin()
        .from('pitch_runs')
        .update({
          status: 'error',
          error_message: error.message || 'Unexpected error during analysis',
        })
        .eq('id', params.id)
    } catch (updateErr) {
      console.error('Failed to update error status:', updateErr)
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

