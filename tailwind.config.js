/** @type {import('tailwindcss').Config} */
const c = (v) => `rgb(var(--${v}) / <alpha-value>)`
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'),
        panel: c('panel'),
        panel2: c('panel2'),
        ink: c('ink'),
        muted: c('muted'),
        accent: c('accent'), // hazard amber
        toxic: c('toxic'), // infected green
        mist: c('mist'), // the Mist, teal
        danger: c('danger'),
      },
      fontFamily: {
        display: ['Rajdhani', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Noto Sans SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
