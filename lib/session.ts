'use client'

import { v4 as uuidv4 } from 'uuid'

const SESSION_ID_KEY = 'pp_session_id'
const LEGACY_SESSION_ID_KEY = 'pitchpractice_session_id'

export function getSessionId(): string {
  if (typeof window === 'undefined') {
    return ''
  }

  let sessionId = localStorage.getItem(SESSION_ID_KEY)
  if (!sessionId) {
    const legacySessionId = localStorage.getItem(LEGACY_SESSION_ID_KEY)
    if (legacySessionId) {
      sessionId = legacySessionId
      localStorage.setItem(SESSION_ID_KEY, legacySessionId)
    }
  }
  
  if (!sessionId) {
    sessionId = uuidv4()
    localStorage.setItem(SESSION_ID_KEY, sessionId)
  }
  
  return sessionId
}








