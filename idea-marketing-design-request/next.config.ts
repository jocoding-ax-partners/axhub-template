import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 참고 자료 · 결과물 파일(한 번에 합쳐서 50MB, lib/design.ts 의 UPLOAD_MAX_BYTES)을 Server Action 으로 받아요.
  // 기본 한도(1MB)를 그 크기 + 여유분으로 늘려요.
  experimental: { serverActions: { bodySizeLimit: "51mb" } },
};

export default nextConfig;
