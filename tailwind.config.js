/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          50:  '#f0f0ff',
          100: '#e0e0ff',
          800: '#1e1e3a',
          850: '#16162e',
          900: '#0f0f1e',
          950: '#07070e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
