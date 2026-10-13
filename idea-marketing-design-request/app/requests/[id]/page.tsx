import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { Card } from '@heroui/react'
import { changeStatus, takeRequest } from '@/app/actions'
import { ActionForm } from '@/components/ActionForm'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/ax'
import { CancelRequestButton } from '@/components/CancelRequestButton'
import { ConfirmButton } from '@/components/ConfirmButton'
import { FileList } from '@/components/FileList'
import { DbNotice, LoginCard } from '@/components/Notices'
import { DueText, StatusBadge } from '@/components/RequestList'
import { ResultUploadForm } from '@/components/ResultUploadForm'
import { me } from '@/lib/axhub-server'
import { isDbConfigured } from '@/lib/db'
import {
  KIND_LABEL,
  NEXT_STATUS,
  STATUS_LABEL,
  canEditResults,
  formatDateTime,
  isDesigner,
  kstToday,
  type DesignStatus,
} from '@/lib/design'
import { getRequest, listFiles } from '@/lib/design-store'
import { isStorageConfigured } from '@/lib/storage'

export const dynamic = 'force-dynamic'

const STEPS = Object.keys(STATUS_LABEL) as DesignStatus[]

/** 단계 버튼 이름 — 어디서 어디로 가는지에 따라 달라요. */
function moveLabel(from: DesignStatus, to: DesignStatus): string {
  if (to === 'review') return '검토 요청하기'
  if (to === 'done') return '완료하기'
  return from === 'done' ? '다시 작업하기' : '작업 중으로 되돌리기'
}

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const visitor = await me()
  if (!visitor.authenticated) {
    return (
      <AppShell>
        <LoginCard title="디자인 요청" desc="axhub 계정으로 로그인하면 요청 내용과 결과물을 볼 수 있어요." returnTo={`/requests/${encodeURIComponent(id)}`} />
      </AppShell>
    )
  }
  if (!isDbConfigured()) {
    return (
      <AppShell>
        <DbNotice />
      </AppShell>
    )
  }

  const r = await getRequest(id)
  const designer = isDesigner(visitor)
  const own = r?.requester_key === visitor.user_id
  // 남의 요청은 "없는 페이지" 와 같은 화면을 보여 줘요 (있는지조차 알 수 없게).
  if (!r || (!own && !designer)) notFound()

  const files = await listFiles(r.id)
  const references = files.filter((f) => f.role === 'reference')
  const results = files.filter((f) => f.role === 'result')
  const mine = r.designer_key === visitor.user_id
  const editable = mine && canEditResults(r.status)
  const storageReady = isStorageConfigured()
  const current = STEPS.indexOf(r.status)
  const moves = NEXT_STATUS[r.status].filter((to) => to === 'in_progress' || results.length > 0)

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <PageHeader
          title={`${KIND_LABEL[r.kind]} 요청 #${r.id}`}
          description={`${r.requester_name || r.requester_email} · ${formatDateTime(r.created_at)} 요청`}
          backTo={own ? '/' : '/manage'}
          backLabel={own ? '내 요청' : '요청 관리'}
          actions={own && r.status === 'received' ? <CancelRequestButton id={r.id} /> : undefined}
        />

        <Card>
          <Card.Header className="flex-row flex-wrap items-center justify-between gap-2">
            <Card.Title>진행 단계</Card.Title>
            <StatusBadge status={r.status} />
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <ol className="grid list-none grid-cols-4 gap-2 p-0" aria-label="진행 단계">
              {STEPS.map((s, i) => (
                <li key={s} className="flex min-w-0 flex-col gap-2" aria-current={i === current ? 'step' : undefined}>
                  <span className={`h-1.5 rounded-full ${i <= current ? 'bg-primary' : 'bg-default'}`} />
                  <span className={`t-caption break-keep ${i === current ? 'font-semibold text-default' : ''}`}>{STATUS_LABEL[s]}</span>
                </li>
              ))}
            </ol>
            <p className="t-small">
              {r.designer_name ? (
                <>
                  담당 디자이너 <span className="font-semibold">{r.designer_name}</span>
                  {mine && ' (나)'}
                </>
              ) : (
                '아직 맡은 디자이너가 없어요. 디자이너가 맡으면 작업 중으로 바뀌어요.'
              )}
            </p>
            {own && r.status === 'review' && (
              <p className="t-small text-muted">디자이너가 결과물 검토를 요청했어요. 아래 결과물을 확인하고 고칠 점이 있으면 디자이너에게 알려 주세요.</p>
            )}
          </Card.Content>
          {designer && (
            <Card.Footer className="flex-col items-stretch gap-3 border-t border-default pt-4">
              {!mine ? (
                <ActionForm action={takeRequest} align="start">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="designer" value={r.designer_key ?? ''} />
                  {r.designer_key ? (
                    <ConfirmButton
                      confirm={{
                        title: '이 요청을 내가 이어받을까요?',
                        description: `지금은 ${r.designer_name}님이 맡고 있어요. 이어받으면 담당자가 나로 바뀌어요.`,
                        confirmLabel: '이어받기',
                      }}
                    >
                      내가 이어받기
                    </ConfirmButton>
                  ) : (
                    <ConfirmButton variant="primary">이 요청 맡기</ConfirmButton>
                  )}
                </ActionForm>
              ) : (
                <ActionForm action={changeStatus} align="start">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="from" value={r.status} />
                  {moves.map((to) => (
                    <ConfirmButton key={to} name="to" value={to} variant={to === 'in_progress' ? 'outline' : 'primary'}>
                      {moveLabel(r.status, to)}
                    </ConfirmButton>
                  ))}
                  {results.length === 0 && <p className="t-caption w-full">결과물을 올리면 검토 요청 · 완료로 바꿀 수 있어요.</p>}
                </ActionForm>
              )}
            </Card.Footer>
          )}
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>요청 내용</Card.Title>
          </Card.Header>
          <Card.Content>
            <dl className="flex flex-col">
              <Row label="종류">{KIND_LABEL[r.kind]}</Row>
              <Row label="크기">{r.size}</Row>
              <Row label="희망 마감일">
                <DueText due={r.due_date} status={r.status} today={kstToday()} />
              </Row>
              <Row label="들어갈 문구">
                <span className="whitespace-pre-wrap">{r.copy_text}</span>
              </Row>
              <Row label="요청자">
                {r.requester_name || r.requester_email}
                {r.requester_name && r.requester_email && <span className="text-muted"> · {r.requester_email}</span>}
              </Row>
            </dl>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>참고 자료</Card.Title>
            <Card.Description>요청할 때 함께 올린 파일이에요.</Card.Description>
          </Card.Header>
          <Card.Content>
            <FileList files={references} empty="올린 참고 자료가 없어요." />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>결과물</Card.Title>
            <Card.Description>
              {results.length > 0 ? '이름을 누르면 이미지 · PDF 는 새 탭에서 열리고, 나머지는 내려받아져요.' : '디자이너가 결과물을 올리면 여기에 보여요.'}
            </Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-6">
            <FileList files={results} empty="아직 올라온 결과물이 없어요." requestId={editable ? r.id : undefined} />
            {editable && (
              <div className="border-t border-default pt-4">
                <ResultUploadForm id={r.id} storageReady={storageReady} />
              </div>
            )}
            {mine && r.status === 'done' && <p className="t-caption">완료된 요청이에요. 결과물을 바꾸려면 「다시 작업하기」 를 눌러 주세요.</p>}
          </Card.Content>
        </Card>
      </div>
    </AppShell>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-default py-3 first:pt-0 last:border-0 last:pb-0 sm:grid-cols-4 sm:gap-4">
      <dt className="t-caption">{label}</dt>
      <dd className="t-small m-0 min-w-0 break-words sm:col-span-3">{children}</dd>
    </div>
  )
}
