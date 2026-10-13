# jocoding-ax-partners / axhub-template

조코딩 AX 파트너스 **axhub** 위에서 바로 굴러가는 바이브코딩 템플릿 모음이에요.
비전공자, 비개발자, 사무직, 기획자가 **Claude Code** 로 자연어로 부탁만 해도
배포까지 굴러가도록 디자인됐어요.

## 어떤 걸 골라야 하나

뇌 아프지 않게 한 줄로:

| 템플릿 | 언제 쓰면 좋아요 | Stack | 분류 |
|--------|-----------------|-------|------|
| [**nextjs-axhub**](./nextjs-axhub) | 풀스택 웹앱 (가장 흔한 선택) | Next 16 + React 19 + Tailwind 4 + HeroUI v3 + axhub 디자인 시스템 | 서버 (SSR) |
| [**chatbot-axhub**](./chatbot-axhub) | AI 챗봇 (사내 도우미, 상담, Q&A) | nextjs-axhub 와 같음 + Claude (`@anthropic-ai/sdk`) | 서버 (SSR) |

### 업무 앱 템플릿 (아이디어 카드 「바로 시작」 전용)

axhub 콘솔의 아이디어 카드에서 「바로 시작」 을 누르면 아래 완성된 업무 앱으로 시작해요. 「처음부터 만들기」 템플릿 목록에는 보이지 않아요. 바탕은 `nextjs-axhub` 와 같고 DB 를 켜 둔 상태예요.

| 직군 | 템플릿 | 하는 일 |
|------|--------|--------|
| 인사 | [**idea-hr-leave-request**](./idea-hr-leave-request) | 휴가 신청 · 관리자 승인 · 남은 연차 |
| 인사 | [**idea-hr-notice-read**](./idea-hr-notice-read) | 사내 공지 · 읽음 확인 · 공지별 읽음률 |
| 인사 | [**idea-hr-onboarding-checklist**](./idea-hr-onboarding-checklist) | 입사자 온보딩 체크리스트 · 진행률 |
| 인사 | [**idea-hr-training-signup**](./idea-hr-training-signup) | 사내 교육 신청 · 정원 마감 · 명단 CSV |
| 인사 | [**idea-hr-interview-scorecard**](./idea-hr-interview-scorecard) | 면접 평가표 · 면접관별 점수 · 결과 기록 |
| 영업 | [**idea-sales-meeting-log**](./idea-sales-meeting-log) | 고객사별 미팅 기록 · 다음 연락일 |
| 영업 | [**idea-sales-quote-request**](./idea-sales-quote-request) | 견적 요청 접수 · 담당자 배정 · 상태 |
| 영업 | [**idea-sales-pipeline-board**](./idea-sales-pipeline-board) | 영업 파이프라인 보드 · 단계별 합계 |
| 영업 | [**idea-sales-monthly-results**](./idea-sales-monthly-results) | 계약 입력 · 월간 실적 · 담당자별 비중 |
| 영업 | [**idea-sales-sample-shipping**](./idea-sales-sample-shipping) | 샘플·자료 발송 기록 · 후속 연락일 |
| 총무 | [**idea-ops-room-booking**](./idea-ops-room-booking) | 회의실 시간표 예약 · 겹침 방지 |
| 총무 | [**idea-ops-equipment-rental**](./idea-ops-equipment-rental) | 장비 대여·반납 · 반납 지연 표시 |
| 총무 | [**idea-ops-supply-request**](./idea-ops-supply-request) | 비품 신청 · 지급·반려 · 재고 부족 표시 |
| 총무 | [**idea-ops-facility-report**](./idea-ops-facility-report) | 시설 고장 신고 · 사진 · 처리 상태 (파일 저장 사용) |
| 총무 | [**idea-ops-parcel-pickup**](./idea-ops-parcel-pickup) | 택배·우편 도착 등록 · 수령 처리 |
| 재무 | [**idea-finance-expense-claim**](./idea-finance-expense-claim) | 경비·영수증 사진 · 승인 · 월별 정산 CSV (파일 저장 사용) |
| 재무 | [**idea-finance-corporate-card**](./idea-finance-corporate-card) | 법인카드 사용 내역 · 용도 미기재 · 월별 합계 CSV |
| 재무 | [**idea-finance-purchase-approval**](./idea-finance-purchase-approval) | 구매 요청 · 결재 · 고액 표시 |
| 재무 | [**idea-finance-department-budget**](./idea-finance-department-budget) | 부서 예산 대비 집행률 · 90% 경고 |
| 재무 | [**idea-finance-vendor-payments**](./idea-finance-vendor-payments) | 거래처 지급 일정 · 이번 주·지연 · 지급 완료 |
| 마케팅 | [**idea-marketing-event-signup**](./idea-marketing-event-signup) | 이벤트 참가자 등록·CSV 가져오기 · 출석 체크 |
| 마케팅 | [**idea-marketing-content-calendar**](./idea-marketing-content-calendar) | 콘텐츠 발행 캘린더 · 채널별 일정 |
| 마케팅 | [**idea-marketing-campaign-results**](./idea-marketing-campaign-results) | 캠페인 일별 실적 · 클릭률·전환당 비용 비교 |
| 마케팅 | [**idea-marketing-customer-survey**](./idea-marketing-customer-survey) | 고객 설문 만들기 · 응답 · 결과 집계 |
| 마케팅 | [**idea-marketing-design-request**](./idea-marketing-design-request) | 디자인 요청 접수 · 작업 단계 · 결과 파일 (파일 저장 사용) |

> 모든 템플릿은 Next.js 하나를 바탕으로 해요. 용도별 템플릿은 화면과 기능만 다르고 뼈대·디자인·배포 방식은 같아요.
>
> 모두 각자 **Dockerfile** 로 빌드돼요. axhub backend 는 repo 루트의 `Dockerfile` 로 이미지를 만들고, `axhub.yaml` 로 포트·헬스체크와 Dockerfile 우선순위를 고정해요.

처음이면 **`nextjs-axhub`** 부터 시작하세요. 가장 보편적이고 LLM 도 가장 잘 짜요.

## 5분 안에 시작

```bash
# 1) 원하는 템플릿만 내 컴퓨터로 가져오기
npx degit jocoding-ax-partners/axhub-template/nextjs-axhub my-app
cd my-app

# 2) 의존성 설치 (Node 20+ 필요)
npm install

# 3) (로컬 테스트용) 환경변수 채우기
cp .env.example .env.local
# 로컬에선 비워 두면 "로컬 실행 중" 으로 동작해요. DB·로그인 값은 axhub 가 채워 줘요 (아래 "설정 주입")

# 4) 로컬 서버 띄우기
npm run dev
```

`degit` 은 git 히스토리 없이 폴더만 가져와요 (`npm i -g degit` 으로 미리 설치하면 더 빨라요).

> 보통은 직접 가져올 필요 없이 axhub 웹에서 **[템플릿 + 앱 이름] 선택 → 한 클릭**이면 GitHub repo 생성 + 배포까지 끝나요.

## 바이브코딩 흐름

1. Claude Code 를 열어요.
2. "메인 페이지에 입력 폼이랑 결과 카드 넣어줘" 같은 자연어 요청을 던져요.
3. AI 가 적절한 파일을 고쳐요 (각 템플릿의 `prompts/getting-started.md` 참고).
4. 저장하면 브라우저가 자동 새로고침 → 결과 확인.
5. 마음에 들면 다음 기능, 안 들면 다시 부탁.

각 템플릿엔 다음이 미리 들어 있어요:

- **`Dockerfile`** — axhub 가 이걸로 빌드해요
- **`axhub.yaml`** — 포트·헬스체크, Dockerfile, 배포 방식 설정
- **`axhub.yaml.example`** — 에이전트가 새 axhub.yaml 을 쓸 때 참고하는 전체 필드 예시
- **`.env.example`** — 로컬 테스트용 환경변수 템플릿
- **`lib/axhub-server.ts` / `src/lib/axhub.ts`** — Hub API 호출 경계 (Server SDK / 브라우저 세션 fetch 헬퍼)
- **`CLAUDE.md`** — Claude Code 가이드 / 행동 규칙
- **`AGENTS.md`** — AI 에이전트 공통 규칙
- **`prompts/`** — 시작용 프롬프트 모음 (한국어)

## axhub 에 배포

### A. Claude Code 사용자 (가장 쉬움)

```
/axhub:deploy
```

배포 미리보기 카드 → 동의 → 끝. 한국어로 진행 상황을 알려줘요.

### B. CLI 직접

```bash
# 한 번만: axhub 콘솔에서 앱 등록 후 슬러그 복사
axhub apps list                                   # 내 앱 목록
axhub deploy create --app my-app-slug --execute   # 배포 (--execute 없으면 미리보기)
axhub deploy status --app my-app-slug --watch     # 진행 상황 보기
```

자세한 건 [axhub 가이드](https://github.com/jocoding-ax-partners/axhub) 참고.

## 설정 주입 (axhub 가 알아서 채워줘요)

axhub bootstrap 으로 앱을 만들면, 저장소에 올리기 전에 템플릿 소스의 `{{...}}` placeholder 가 **실제 값으로 치환**돼요 (DB 주소처럼 배포 때 넣어 주는 값과는 달라요):

| placeholder | 치환값 | 용도 |
|------|--------|------|
| `{{API_BASE}}` | `https://api.axhub.ai` | Hub API origin |
| `{{APP_SLUG}}` | 내 앱 슬러그 | 앱 식별자 |
| `{{TENANT}}` | 내 테넌트 슬러그 | data API 경로 |

로컬에서 직접 돌릴 땐 `.env.local` 로 우선 채울 수 있어요.

> **인증엔 별도 API key 가 필요 없어요.** 방문자 신원은 axhub 문(ingress 게이트)이 요청마다 실어 주는 `X-AxHub-*` 헤더로 알아요 — 아래 "신뢰 모델" 참고. 챗봇처럼 외부 AI 를 부르는 템플릿만 그 서비스의 키(`ANTHROPIC_API_KEY`)를 직접 넣어요.

## 기여하기

새 템플릿을 추가하고 싶으세요?

1. `nextjs-axhub` 를 복사해서 시작해요. 디자인 파일(`app/axhub.css` · `scripts/check-design.sh` · `AXHUB.md`)은 `node scripts/sync-design.mjs` 가 뿌려요 — `nextjs-axhub`·`chatbot-axhub`·`idea-*` 폴더는 자동으로 잡혀요. 다른 이름이면 그 스크립트의 `TEMPLATES` 에 추가해요.
2. repo 루트에 **`Dockerfile`** 이 있어 `docker build` 로 떠야 해요 (axhub 는 framework 자동생성 안 함 — Dockerfile 필수).
3. 다음 파일이 모두 있어야 해요:
   - `Dockerfile`, `axhub.yaml`, `.env.example`, `lib/axhub.*` (또는 동등 위치)
   - `CLAUDE.md`, `AGENTS.md`
   - `prompts/getting-started.md`
   - 한국어 `README.md`
4. 모든 문서는 한국어, vibe coder 친화적인 톤으로.
5. axhub 백엔드 템플릿 카탈로그(`templates` 표)에 폴더 이름으로 등록해야 앱 만들기 화면에 떠요.
6. PR 보내주세요.

## FAQ

**Q. 왜 프레임워크가 Next.js 하나뿐?**
입문 vibe coder 가 프레임워크를 고르느라 헷갈리지 않게 Next.js 하나로 모았어요. 대신 "무엇을 만들지"(웹앱·챗봇 …)로 템플릿을 나눠요. 예전엔 Vite SPA·Astro 도 있었지만 정리했어요.

**Q. 다른 framework 도 axhub 에 올릴 수 있나요?**
네. repo 루트에 `Dockerfile` 만 있으면 돼요. axhub 가 그걸로 빌드해요. (`axhub.yaml` 로 포트/헬스체크와 Dockerfile 우선순위 조정)

**Q. 왜 Tailwind 4 + HeroUI v3 인가요?**
axhub 콘솔과 같은 스택이라 앱이 콘솔과 같은 모양이 되고, AI 가 버튼·입력·표를 손으로 그리지 않고 컴포넌트(`@heroui/react`)를 가져다 써요. 색·글자는 `@jocoding-ax-partners/design-system` 이 콘솔 값으로 맞춰 줘요. 규칙은 각 템플릿 `AGENTS.md` 「디자인」, 정본 파일은 [design/README.md](./design/README.md).
(Tailwind 3 를 골랐던 [ADR-0001](./docs/adr/0001-version-floors.md) 의 해당 항목은 이 변경으로 대체돼요.)

**Q. AI 가 자꾸 server 전용 헬퍼를 클라이언트에서 쓰려 해요.**
각 템플릿의 `CLAUDE.md` / `AGENTS.md` 에 명확히 금지돼 있어요.
AI 가 무시하면 그 규칙을 다시 보여주면서 "이거 어겼다" 라고 알려주세요.

## axhub.ts 신뢰 모델 (모든 템플릿 공통)

**방문자 신원은 모든 템플릿에서 axhub 문(ingress 게이트)이 요청마다 실어 주는 `X-AxHub-*` 헤더로 알아요.** 허브 API 에 "이 사람 누구야?" 라고 다시 묻지 않아요 — 허브 로그인 쿠키는 `axhub.ai` 계열 주소에만 실리기 때문에, 퍼블릭 앱(`{앱}.axhub.app`)·커스텀 도메인에서 허브 `/api/v1/me` 나 `sdk.identity.me` 로 방문자를 알아내는 방식은 구조적으로 안 돼요. 헤더 계약·로그인/로그아웃·익명 처리 규칙은 각 템플릿 README 의 "로그인 사용자 알기 (axhub 신원 계약)" 절에 있어요. 정적 API key 는 안 써요.

| 템플릿 | 위치 | 분류 | 신원 (`me()`) | 허브 SDK/API 직접 호출 |
|--------|------|------|----------------|----------------|
| nextjs-axhub | `lib/axhub-server.ts` | server | `headers()` 에서 `X-AxHub-*` 읽기 | `makeAxhub` / `makeGateway` / `queryConnector` — 사용자 쿠키 필요, **회사 앱 주소에서만** |
| chatbot-axhub | `lib/axhub-server.ts` (+ `lib/ai.ts`) | server | nextjs 와 같아요 | nextjs 와 같아요. Claude 호출은 `lib/ai.ts` — 서버에서만 |

**규칙:** 빌드 결과물엔 어떤 시크릿도 박지 않아요. 서버 전용 SDK 는 절대 클라이언트 번들에 넣지 마세요. 서버 템플릿에서 SDK 를 쓸 땐 요청별로 factory 를 새로 만들고 모듈 레벨 client 캐싱을 하지 않아요. `/__axhub/auth/*` 는 플랫폼 예약 경로라 앱 라우트로 쓸 수 없어요.

## 라이선스

MIT — 자유롭게 쓰세요. 자세한 건 [LICENSE](./LICENSE).

---

조코딩 AX 파트너스 — 누구나 AI 로 만들 수 있는 세상.

<!-- 이 파일은 axhub-mono 에서 자동 동기화됩니다. 여기에 직접 커밋하지 마세요. -->
