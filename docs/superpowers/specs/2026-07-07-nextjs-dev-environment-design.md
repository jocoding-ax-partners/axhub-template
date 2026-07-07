# nextjs-axhub 개발(dev) 환경 지원 — 설계

날짜: 2026-07-07
대상: `nextjs-axhub/` 템플릿만 (astro/vite 는 범위 밖 — 필요 시 후속 작업으로 동일 적용)

## 목표

로컬 개발 환경(핫리로드, DB 연결/리셋)을 문서와 편의 스크립트로 1급 지원한다.
런타임 코드 변경은 dev 전용 경로 1건(HMR 커넥션 누수 방지)뿐이며, 프로덕션 동작은 변하지 않는다.

## 배경

- 로컬 지원 자체는 이미 동작: docker compose Postgres + `.env.local`, `isDbConfigured()` 게이트,
  axhub 미설정 시 `'local-dev'` 사용자 폴백.
- 그러나 (1) dev 환경 문서 없음, (2) DB 조작이 전부 docker 명령 직접 타이핑,
  (3) `lib/db.ts` 의 모듈 레벨 커넥션 싱글톤이 HMR 재평가마다 새 풀을 만들어 로컬 Postgres 커넥션 누수.

## 변경 사항

### 1. `package.json` 편의 스크립트 (nextjs-axhub)

```jsonc
"setup":    "[ -f .env.local ] || cp .env.example .env.local; docker compose up -d",
"db:up":    "docker compose up -d",
"db:down":  "docker compose down",
"db:reset": "docker compose down -v && docker compose up -d",
"db:psql":  "docker compose exec db psql -U postgres -d app"
```

- `setup` 은 `.env.local` 이 **없을 때만** 예시를 복사 (기존 파일 절대 미덮어쓰기).
- 배포 빌드(`Dockerfile` → `npm run build`)는 이 스크립트들을 호출하지 않음 → 프로덕션 영향 없음.
- POSIX sh 전제 (템플릿이 이미 docker/unix 계열 전제).

### 2. README "개발(dev) 환경" 섹션 신설

§2(바이브코딩 흐름) 뒤에 새 §3 으로 삽입, 이후 섹션 번호 재조정(§3-A 참조 포함). 내용:

- **핫리로드**: `npm run dev` = Turbopack dev 서버, 저장 즉시 Fast Refresh 반영.
  화면/빌드가 꼬이면 `rm -rf .next` 후 재시작.
- **로컬 DB 라이프사이클**: `db:up` / `db:down`(데이터 유지) / `db:reset`(초기화) / `db:psql`(콘솔).
  스키마는 `ensureSchema()` 가 자동 생성 — 마이그레이션 파일 불필요.
- **dev vs 프로덕션**: dev 는 Turbopack 즉석 컴파일, 배포는 `next build` standalone
  (`NODE_ENV=production`, `Dockerfile:13`). 배포 전 프로덕션 모드 검증은 `npm run build && npm start`.
- **로컬의 한계**: axhub 세션 쿠키(`_hub_access`)가 없어 로그인/gateway 는 로컬 단독으론 미동작 →
  사용자 `'local-dev'` 폴백, 실제 로그인·connector 조회는 배포 후 확인.

### 3. README §자주 막히는 곳 2행 추가

- DB `ECONNREFUSED`(5432 연결 실패) → Docker 실행 확인 후 `npm run db:up`
- 테이블/데이터 꼬임 → `npm run db:reset` (로컬 데이터 전부 삭제됨을 명시)

### 4. AGENTS.md D4 보강

로컬 항목에 npm 스크립트(`db:up`/`db:reset` 등) 우선 사용을 한 줄로 안내.

### 5. `lib/db.ts` HMR 커넥션 누수 방지

- 문제: dev HMR 이 모듈을 재평가하면 `_sql` 이 초기화되고 이전 postgres 풀은 `.end()` 없이 방치 →
  장시간 개발 시 `too many connections`.
- 해법: `NODE_ENV !== 'production'` 일 때만 풀을 `globalThis` 에 캐시해 HMR 을 견딤.
  프로덕션(`Dockerfile` 의 `ENV NODE_ENV=production` + Next.js 자체 강제)은 기존 모듈 레벨 싱글톤 경로 그대로.
- **`_schema`(스키마 초기화 promise)는 모듈 레벨 유지** — HMR 재실행이 오히려 바람직함
  (개발 중 `ensureSchema()` 에 테이블을 추가하면 재시작 없이 반영). 마이그레이션 커넥션은
  `finally` 에서 `.end()` 로 닫히므로 누수 아님.

## 하지 않는 것

- 로컬 사용자 시뮬레이션(`AXHUB_DEV_USER` 류), gateway 로컬 스텁 — 범위 밖 (사용자 결정).
- ~~astro/vite 템플릿 반영 — 후속.~~ → 같은 날 후속 적용 완료: astro 는 전체 동일 적용
  (스크립트·db.ts HMR·문서, `.env` 사용), vite 는 정적 SPA(DB 없음)라 `setup`(env 복사)과
  dev 문서(HMR·dev vs nginx 정적 서빙)만 적용.
- 런타임 코드의 그 외 변경 — 없음.

## 검증

- `npm run build` 성공 (프로덕션 경로 무손상 확인).
- `npm run lint` 통과.
- docker 가용 시: `npm run db:reset` → `npm run dev` → localhost:3000 에서 할 일 추가/조회 동작.
