/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // FIMCON 2026 brand palette (sampled from the official logo)
        brand: {
          navy: '#0d4d8c',
          navydark: '#0a3d70',
          navydeep: '#072c52',
          green: '#6CB142',
          greendark: '#4e8f2f',
          greenlight: '#eaf4e2',
          orange: '#F58220',
          orangelight: '#fdeedd',
        },
      },
    },
  },
  plugins: [],
};
