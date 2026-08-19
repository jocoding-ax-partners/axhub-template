'use client'

// 데모용 할 일 목록 — 브라우저 localStorage 에만 저장해요.
//
// 이 템플릿은 기본으로 데이터베이스를 켜지 않아요. 서버에 데이터를 남기려면
// axhub.yaml 에 아래 두 줄을 추가하세요 — 배포 시 axhub 가 전용 Postgres 를
// 발급하고 DATABASE_URL / DIRECT_DATABASE_URL 을 파드에 자동 주입해요.
//
//   database:
//     engine: postgres
//
// 그 뒤엔 이 컴포넌트 대신 서버(Server Component / Route Handler / Server
// Action)에서 쿼리하면 돼요. 전체 필드 목록은 axhub.yaml.example 참고.
import { useEffect, useState } from 'react'

type Todo = { id: string; title: string; done: boolean }

const STORAGE_KEY = 'axhub-template-todos'

function load(): Todo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Todo[]) : []
  } catch {
    return [] // 손상된 값은 버리고 빈 목록으로 시작
  }
}

export default function TodoDemo() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')
  // 서버 렌더에는 localStorage 가 없어요 — 첫 마운트 뒤에만 저장해야
  // 빈 배열이 기존 데이터를 덮어쓰지 않아요.
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setTodos(load())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  }, [todos, hydrated])

  function add(e: React.FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    setTodos((prev) => [{ id: String(Date.now()), title: t, done: false }, ...prev].slice(0, 50))
    setTitle('')
  }

  function toggle(id: string) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  return (
    <>
      <form onSubmit={add} className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="할 일을 입력하고 Enter"
          className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          autoComplete="off"
        />
        <button
          type="submit"
          className="rounded-lg bg-[var(--primary)] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)]"
        >
          추가
        </button>
      </form>

      <ul className="mt-3 flex flex-col gap-1.5">
        {todos.length === 0 ? (
          <li className="py-2 text-center text-sm text-[var(--fg-subtle)]">아직 없어요 — 위에서 하나 추가해 보세요.</li>
        ) : (
          todos.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 py-2"
            >
              <button
                type="button"
                onClick={() => toggle(t.id)}
                aria-label="완료 토글"
                className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] text-white ${
                  t.done
                    ? 'border-[var(--success)] bg-[var(--success)]'
                    : 'border-[var(--border-default)] bg-transparent'
                }`}
              >
                {t.done ? '✓' : ''}
              </button>
              <span className={`text-sm ${t.done ? 'text-[var(--fg-subtle)] line-through' : ''}`}>{t.title}</span>
            </li>
          ))
        )}
      </ul>
    </>
  )
}
