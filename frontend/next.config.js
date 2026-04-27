/** @type {import('next').NextConfig} */
const nextConfig = {
    // API proxy to backend (exclude /api/auth for NextAuth)
    async rewrites() {
        return [
            {
                source: '/api/market/:path*',
                destination: 'http://localhost:8080/api/market/:path*',
            },
            {
                source: '/api/health',
                destination: 'http://localhost:8080/api/health',
            },
            {
                source: '/api/status',
                destination: 'http://localhost:8080/api/status',
            },
        ];
    },
    // Other Next.js config...
    reactStrictMode: true,
    swcMinify: true,
    images: {
        domains: ['prod.spline.design', 'localhost'],
    },
    // Fix for turbopack cache issues
    experimental: {
        turbo: {
            rules: {
                '*.svg': {
                    loaders: ['@svgr/webpack'],
                    as: 'js',
                },
            },
        },
    },
};

module.exports = nextConfig;
