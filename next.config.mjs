/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      { source: '/old-sheet.html', destination: '/vampires/old-sheet.html' },
      { source: '/rules.json', destination: '/vampires/rules.json' },
      { source: '/rules_eng.json', destination: '/vampires/rules_eng.json' },
      { source: '/main.js', destination: '/vampires/main.js' },
      { source: '/creation-wizard.js', destination: '/vampires/creation-wizard.js' },
      { source: '/i18n-dictionary.js', destination: '/vampires/i18n-dictionary.js' },
      { source: '/i18n-runtime.js', destination: '/vampires/i18n-runtime.js' },
      { source: '/supabase.js', destination: '/vampires/supabase.js' },
      { source: '/vtm-health.js', destination: '/vampires/vtm-health.js' },
      { source: '/vtm-humanity.js', destination: '/vampires/vtm-humanity.js' },
      { source: '/static/:path*', destination: '/vampires/static/:path*' },
      { source: '/fonts/:path*', destination: '/vampires/fonts/:path*' },
      { source: '/reference/VtM_v5_new.md', destination: '/vampires/reference/VtM_v5_new.md' },
      { source: '/reference/VtM_v5_new_eng.md', destination: '/vampires/reference/VtM_v5_new_eng.md' },
      { source: '/reference/vtm-v5/:path*', destination: '/vampires/reference/vtm-v5/:path*' },
      { source: '/landing-background.png', destination: '/vampires/landing-background.png' },
      { source: '/card-account.png', destination: '/vampires/card-account.png' },
      { source: '/card-character-sheet.png', destination: '/vampires/card-character-sheet.png' },
      { source: '/card-chronicle.png', destination: '/vampires/card-chronicle.png' },
      { source: '/favicon.ico', destination: '/vampires/favicon.ico' },
    ]
  },
}

export default nextConfig
