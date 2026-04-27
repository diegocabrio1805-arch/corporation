/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.tsx",
    "./*.ts",
    "./components/**/*.{tsx,ts}",
    "./hooks/**/*.{tsx,ts}",
    "./utils/**/*.{tsx,ts}",
    "./services/**/*.{tsx,ts}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
