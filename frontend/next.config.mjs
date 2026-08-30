/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/admin/:path*',
        destination: 'http://localhost:4000/api/admin/:path*',
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/',
        permanent: false,
      },
      {
        source: '/admin/blogs/:path*',
        destination: '/blogs/:path*',
        permanent: false,
      },
      {
        source: '/admin/logs',
        destination: '/logs',
        permanent: false,
      },
      {
        source: '/admin/revisions',
        destination: '/revisions',
        permanent: false,
      },
      {
        source: '/admin/login',
        destination: '/login',
        permanent: false,
      }
    ];
  }
};

export default nextConfig;
