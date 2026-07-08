/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0B0E14',
        'bg-secondary': '#111827',
        'bg-tertiary': '#1F2937',
        'border-default': 'rgba(255,255,255,0.06)',
        'border-hover': 'rgba(255,255,255,0.12)',
        'text-primary': '#F3F4F6',
        'text-secondary': '#9CA3AF',
        'text-tertiary': '#6B7280',
        'accent-gold': '#D4A853',
        'accent-gold-glow': 'rgba(212,168,83,0.15)',
        'up': '#10B981',
        'down': '#EF4444',
        'up-bg': 'rgba(16,185,129,0.08)',
        'down-bg': 'rgba(239,68,68,0.08)',
      },
      fontFamily: {
        mono: ['Inter', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
