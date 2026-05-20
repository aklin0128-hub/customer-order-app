import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/admin/sku-buyers",
        destination: "/admin/top-skus",
        permanent: false,
      },
    ];
  },
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "tesseract.js"],
  outputFileTracingIncludes: {
    "/api/admin/upload-invoice": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    ],
  },
};

export default nextConfig;
