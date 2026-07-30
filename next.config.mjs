/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Ensure server-only code isn't bundled for the client
  serverExternalPackages: ['firebase-admin'],
};

export default nextConfig;
