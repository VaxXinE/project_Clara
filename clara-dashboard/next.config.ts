import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.146", "localhost", "127.0.0.1"],
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/workspace",
        permanent: false,
      },
      {
        source: "/dashboard/:path*",
        destination: "/:path*",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    const backendBaseUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

    return [
      {
        source: "/workspace",
        destination: "/dashboard",
      },
      {
        source: "/profile",
        destination: "/dashboard/profile",
      },
      {
        source: "/start",
        destination: "/dashboard/start",
      },
      {
        source: "/sales",
        destination: "/dashboard/sales",
      },
      {
        source: "/sales/:path*",
        destination: "/dashboard/sales/:path*",
      },
      {
        source: "/follow-up",
        destination: "/dashboard/follow-up",
      },
      {
        source: "/upload",
        destination: "/dashboard/upload",
      },
      {
        source: "/crm",
        destination: "/dashboard/crm",
      },
      {
        source: "/crm/:path*",
        destination: "/dashboard/crm/:path*",
      },
      {
        source: "/customers/:path*",
        destination: "/dashboard/customers/:path*",
      },
      {
        source: "/notifications",
        destination: "/dashboard/notifications",
      },
      {
        source: "/approvals",
        destination: "/dashboard/approvals",
      },
      {
        source: "/manager-insights",
        destination: "/dashboard/manager-insights",
      },
      {
        source: "/marketing",
        destination: "/dashboard/marketing",
      },
      {
        source: "/knowledge",
        destination: "/dashboard/knowledge",
      },
      {
        source: "/kpi",
        destination: "/dashboard/kpi",
      },
      {
        source: "/channels",
        destination: "/dashboard/channels",
      },
      {
        source: "/admin/:path*",
        destination: "/dashboard/admin/:path*",
      },
      {
        source: "/api/:path*",
        destination: `${backendBaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
