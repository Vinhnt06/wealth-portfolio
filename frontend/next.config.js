/** @type {import('next').NextConfig} */
const nextConfig = {
    // API proxy to backend
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'http://localhost:8080/api/:path*', // Proxy to Backend
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
