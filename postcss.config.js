/**
 * Tailwind CSS v4+ requires the separate PostCSS plugin package.
 * If you previously saw an error about using `tailwindcss` directly as a PostCSS plugin,
 * this file resolves it.
 */
module.exports = {
    plugins: {
        '@tailwindcss/postcss': {},
    },
};