import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
    eslint: {
        ignoreDuringBuilds: true // ✅ Skip all ESLint errors/warnings in build
    },

    typescript: {
        ignoreBuildErrors: true // ✅ Skip TS type-checking errors in build
    }
};

export default nextConfig;
