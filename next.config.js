/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    if (dev) {
      // Avoid intermittent EPERM/ENOENT cache corruption on some Windows setups.
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
