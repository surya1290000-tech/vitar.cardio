const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  webpack: (config, { dev }) => {
    if (dev) {
      // Avoid intermittent EPERM/ENOENT cache corruption on some Windows setups.
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
