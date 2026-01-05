/**
 * Theme colors and design tokens
 * Modern minimal design with warm amber accent
 */

export const colors = {
  // Backgrounds
  background: {
    primary: '#0B0F14',      // Deep navy/charcoal
    secondary: '#121826',    // Slightly lighter for cards
    tertiary: '#151C2C',     // Even lighter for nested cards
  },
  
  // Foreground text
  text: {
    primary: '#E6E8EB',      // Off-white
    secondary: '#9AA4B2',   // Muted gray
    tertiary: '#6B7280',    // Subtle gray
  },
  
  // Borders
  border: {
    primary: '#22283A',      // Subtle border
    secondary: '#181F2F',   // Lighter border
  },
  
  // Accent colors
  accent: {
    primary: '#F59E0B',      // Warm amber (less neon than #F97316)
    hover: '#D97706',       // Darker amber on hover
    light: '#FCD34D',       // Light amber for highlights
  },
  
  // Status colors
  success: {
    primary: '#22C55E',      // Muted green
    light: '#22C55E20',     // 20% opacity
    border: '#22C55E30',    // 30% opacity border
  },
  
  warning: {
    primary: '#F59E0B',      // Amber (same as accent)
    light: '#F59E0B20',
    border: '#F59E0B30',
  },
  
  error: {
    primary: '#EF4444',      // Only for critical errors
    light: '#EF444420',
    border: '#EF444430',
  },
} as const

export const gradients = {
  hero: 'linear-gradient(135deg, #0B0F14 0%, #0F172A 30%, #1E293B 60%, #0B0F14 100%)',
  vignette: 'radial-gradient(ellipse at center, transparent 0%, rgba(11, 15, 20, 0.6) 100%)',
} as const

