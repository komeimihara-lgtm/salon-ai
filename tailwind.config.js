/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: '#1A2F5A',
        gold: '#C8962A',
        rose: '#C4728A',
        lavender: '#9B8EC4',
        deep: '#5A4A6E',
        'off-white': '#FDFAF7',
        'light-lav': '#F8F5FF',
      },
      fontFamily: {
        sans: ['var(--font-noto-sans)', 'Noto Sans JP', 'sans-serif'],
        serif: ['var(--font-noto-serif)', 'Noto Serif JP', 'serif'],
      },
    },
  },
  plugins: [],
}
