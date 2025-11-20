/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Fix PDFKit font loading in Next.js
    if (isServer) {
      config.resolve.alias.canvas = false
      config.resolve.alias.encoding = false
      
      // Exclude PDFKit from webpack bundling - it will be loaded from node_modules at runtime
      config.externals = config.externals || []
      config.externals.push({
        'pdfkit': 'commonjs pdfkit',
      })
      
      // Ensure PDFKit font files are accessible
      // PDFKit loads fonts from node_modules/pdfkit/js/data/ at runtime
      config.module.rules.push({
        test: /pdfkit[\\/]js[\\/]data[\\/].*\.afm$/,
        type: 'asset/resource',
        generator: {
          filename: 'static/fonts/[name][ext]',
        },
      })
    }
    
    return config
  },
}

module.exports = nextConfig

