/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#f8fafc',
        sidebar: '#ffffff',
        card: '#ffffff',
        'card-hover': '#f1f5f9',
        border: '#e2e8f0',
        primary: '#0f172a',
        secondary: '#475569',
        muted: '#64748b',
        accent: '#d97706',
        'accent-hover': '#b45309',
        success: '#059669',
        info: '#2563eb',
        danger: '#dc2626',
        warning: '#d97706',
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', 'sans-serif'],
        display: ['"Space Grotesk"', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
      },
    },
  },
  plugins: [],
};
