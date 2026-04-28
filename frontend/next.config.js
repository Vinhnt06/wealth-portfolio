/** @type {import('next').NextConfig} */
const nextConfig = {
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
