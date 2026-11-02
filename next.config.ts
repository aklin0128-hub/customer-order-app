import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/admin/sku-buyers",
        destination: "/admin/top-skus",
        permanent: false,
      },
      {
        source: "/admin/price-history",
        destination: "/admin/price-compare",
        permanent: false,
      },
    ];
  },
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "tesseract.js", "xlsx"],
  outputFileTracingIncludes: {
    "/api/admin/upload-invoice": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    ],
    "/api/credit/parse": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    ],
  },
};

export default nextConfig;
