/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}', // For Next.js App Router
  ],
  darkMode: 'class', // Enable dark mode with a class
  theme: {
    extend: {
      colors: {
        primary: '#1A237E', // Deep Indigo
        secondary: '#FFD700', // Gold
        background: '#121212', // Dark background
        text: '#E0E0E0',
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      const newUtilities = {
        '.glass': {
          'background-color': 'rgba(255, 255, 255, 0.1)',
          'backdrop-filter': 'blur(10px)',
          '-webkit-backdrop-filter': 'blur(10px)',
          'border': '1px solid rgba(255, 255, 255, 0.18)',
          'box-shadow': 'var(--tw-shadow-glass)',
        },
      }
      addUtilities(newUtilities, ['responsive', 'hover'])
    }
  ],
}