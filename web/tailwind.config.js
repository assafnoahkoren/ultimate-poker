/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: '#0d4a2a',
        feltDark: '#073019',
      },
      gridTemplateColumns: {
        13: 'repeat(13, minmax(0, 1fr))',
      },
    },
  },
  plugins: [],
}
