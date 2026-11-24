/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B0D10',
        panel: '#12161B',
        accent: '#B5F542',
        ink: '#F5F7FA',
        muted: '#A1A7AE',
      },
    },
  },
  plugins: [],
}
