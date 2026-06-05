import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // @ax-hub/sdk 는 난독화된 단일 번들이라 Turbopack(Next 16 기본 dev 컴파일러)이
  // 파싱 단계에서 100% CPU 로 행에 빠져요. 서버 전용 패키지로 external 처리하면
  // 번들 변환을 건너뛰어 정상 동작합니다. (SDK 는 next/headers 기반 서버 전용 SDK)
  serverExternalPackages: ["@ax-hub/sdk"],
};

export default nextConfig;
