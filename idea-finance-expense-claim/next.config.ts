import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 영수증 사진(최대 10MB)을 Server Action 으로 받아요. 기본 한도(1MB)를 사진 크기 + 여유분으로 늘려요.
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
};

export default nextConfig;
