/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    typescript: {
        // For safety: ensure production builds fail when TypeScript errors exist.
        // This enforces the "STRICT TYPE SAFETY" rule from the constitution.
        ignoreBuildErrors: false,
    },
};

module.exports = nextConfig;
