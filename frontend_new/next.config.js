/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    typescript: {
        // For safety: ensure production builds fail when TypeScript errors exist.
        // This enforces the "STRICT TYPE SAFETY" rule from the constitution.
        ignoreBuildErrors: false,
    },
    async rewrites() {
        return [
            { source: '/api/:path*', destination: 'http://127.0.0.1:8000/api/:path*' }
        ]
    },
};

module.exports = nextConfig;
