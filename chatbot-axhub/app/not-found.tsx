import Link from 'next/link'
import { AppShell } from '@/components/AppShell'

/**
 * 없는 주소로 들어왔을 때 보이는 화면. 코드에서 notFound() 를 불러도 여기로 와요.
 *   import { notFound } from 'next/navigation'
 *   if (!row) notFound()
 */
export default function NotFound() {
  return (
    <AppShell>
      <section className="ax-card mx-auto max-w-xl text-center">
        <p className="ax-caption ax-subtle m-0">404</p>
        <h1 className="ax-card-title mt-2">페이지를 찾을 수 없어요</h1>
        <p className="ax-card-desc">주소가 바뀌었거나 지워진 페이지예요. 왼쪽 메뉴에서 다시 찾아보세요.</p>
        <Link className="ax-btn ax-btn-primary mt-6" href="/">
          홈으로
        </Link>
      </section>
    </AppShell>
  )
}
