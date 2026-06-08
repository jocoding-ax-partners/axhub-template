// 동적 테이블 접근 헬퍼 (서버 전용). 앱 데이터 read/write 의 단일 진입점이에요.
//
// 에이전트 규칙 (AGENTS.md 의 R1~R3 와 짝):
//   - 동적 테이블은 이 table() 로만 접근해요. raw fetch('/data/...') 금지.
//   - 테이블은 코드보다 먼저 `axhub tables create` 로 만들어야 해요 (R1).
//   - 사용자별 데이터는 테이블을 owner_id 로 만들고, 코드에서 owner_id 를
//     직접 넣거나 필터링하지 마세요 — backend 가 자동 격리해요 (R2).
//   - 호출은 요청 스코프(Route Handler / Server Action / 요청 중 렌더) 안에서만 (R3).
//
// 서버 전용: makeApp() 이 next/headers 를 쓰므로 "use client" 에서 import 하면 빌드가 깨져요.
import { makeApp } from './axhub-server'

// 테이블 핸들 하나. 행 타입을 제네릭으로 지정해요.
//
//   const todos = await table<{ id: string; title: string; created_at: string }>('todos')
//   await todos.insert({ title: '장보기' })  // owner_id 는 backend 가 자동 — 넣지 마세요
//   const page = await todos.list({          // 내 행만 자동 반환 (owner_id 격리)
//     orderBy: [{ field: 'created_at', dir: 'desc' }],
//     limit: 50,
//   })
//   // page.items: Row[]
export async function table<Row extends Record<string, unknown>>(name: string) {
  const app = await makeApp()
  return app.data.table<Row>(name)
}
