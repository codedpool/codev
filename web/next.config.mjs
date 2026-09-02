/** @type {import('next').NextConfig} */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  turbopack: { root: __dirname },
  reactStrictMode: true,
  // Server-only packages that should not be bundled by Turbopack/webpack.
  serverExternalPackages: ['mongoose', 'ws'],
};

export default nextConfig;
