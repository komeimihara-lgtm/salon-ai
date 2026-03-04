/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        rose: '#C4728A',
        lavender: '#9B8EC4',
        deep: '#5A4A6E',
        'off-white': '#FDFAF7',
        'light-lav': '#F8F5FF',
        'text-main': '#2C2C2C',
        'text-sub': '#6B7280',
      },
      fontFamily: {
        'serif-jp': ['Noto Serif JP', 'serif'],
        'sans-jp': ['Noto Sans JP', 'sans-serif'],
        'dm-sans': ['DM Sans', 'sans-serif'],
      },
      boxShadow: {
        'sola': '0 4px 24px rgba(90, 74, 110, 0.08)',
      },
    },
  },
  plugins: [],
}
