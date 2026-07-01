-- 001_init.sql — raw-db 첫 마이그레이션 예시
--
-- raw-db 로 바뀌면서 테이블(DDL)은 이제 *앱의 몫* 이에요 (더 이상 `axhub tables create` 아님).
-- 이 SQL 을 앱의 Postgres(DATABASE_URL)에 psql 로 적용하면 아래 demo 테이블이 생겨요. (적용법은 db/README.md)
--
-- ⚠️ 보안 — 사용자별 데이터 격리는 이제 *앱*이 책임져요:
--   * owner_id 컬럼(uuid, not null)을 꼭 두고,
--   * 런타임에 lib/data.ts 의 ownedTable('todos', ownerId) 로 read/write 하면
--     모든 쿼리에 owner_id 필터가 자동으로 걸려요 (남의 행에 못 닿음).
--   raw-db 는 예전 동적테이블과 달리 owner_id 자동 격리가 없어요 — 이 컬럼 + ownedTable 이 그 역할을 대신해요.

create table if not exists todos (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null,               -- 로그인 사용자 id (currentUserId()) — 격리의 핵심
  title       text not null,
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- owner_id 로 늘 필터하니까 인덱스로 조회를 빠르게. (created_at 은 최신순 목록용)
create index if not exists todos_owner_id_created_at_idx
  on todos (owner_id, created_at desc);
