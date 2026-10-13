'use client'

// CSV 로 참가 신청자 한 번에 올리기: 파일 고르기 → 미리보기(줄마다 결과) → 등록.
// 엑셀 한글 CSV(UTF-8 · CP949)는 브라우저에서 글자로 읽고, 검사와 등록은 서버가 해요.
import { useState, useTransition } from 'react'
import { Alert, Button, Chip, Table, buttonVariants } from '@heroui/react'
import { commitImport, previewImport, type ImportPreview } from '@/app/actions'
import { decodeCsv, LIMITS, type ClassifiedRow, type RowStatus } from '@/lib/applicants'

const SAMPLE = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿이름,회사,이메일\r\n홍길동,axhub,hong@example.com\r\n')
const PREVIEW_ROWS = 100

const LABEL: Record<RowStatus, string> = {
  ok: '등록 가능',
  invalid: '입력 오류',
  duplicate: '파일 안 중복',
  registered: '이미 신청',
  full: '정원 초과',
}

type Ready = Extract<ImportPreview, { rows: ClassifiedRow[] }> & { text: string; fileName: string }

export function CsvImport({ eventId }: { eventId: string }) {
  const [preview, setPreview] = useState<Ready | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [inputKey, setInputKey] = useState(0)
  const [busy, startTransition] = useTransition()

  const reset = () => {
    setPreview(null)
    setInputKey((k) => k + 1)
  }

  const onFile = (file: File | undefined) => {
    setNotice(null)
    setPreview(null)
    if (!file) return
    if (file.size > LIMITS.fileBytes) {
      setNotice({ ok: false, text: '파일이 너무 커요. 500KB 이하로 나눠서 올려 주세요.' })
      return
    }
    startTransition(async () => {
      try {
        const decoded = decodeCsv(new Uint8Array(await file.arrayBuffer()))
        if ('error' in decoded) return setNotice({ ok: false, text: decoded.error })
        const result = await previewImport(eventId, decoded.text)
        if ('error' in result) return setNotice({ ok: false, text: result.error })
        setPreview({ ...result, text: decoded.text, fileName: file.name })
      } catch {
        setNotice({ ok: false, text: '파일을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.' })
      }
    })
  }

  const onCommit = () => {
    if (!preview) return
    startTransition(async () => {
      try {
        const result = await commitImport(eventId, preview.text)
        setNotice({ ok: result.ok, text: result.message })
        reset()
      } catch {
        setNotice({ ok: false, text: '등록하지 못했어요. 잠시 뒤 다시 시도해 주세요.' })
      }
    })
  }

  const count = (s: RowStatus) => preview?.rows.filter((r) => r.status === s).length ?? 0
  const okCount = count('ok')
  // 문제 있는 줄을 먼저 보여줘요.
  const shown = preview ? [...preview.rows.filter((r) => r.status !== 'ok'), ...preview.rows.filter((r) => r.status === 'ok')].slice(0, PREVIEW_ROWS) : []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* 파일 고르기 칸은 숨기고 <label> 에 버튼 모양만 입혀요 (누르면 파일 창이 열려요). */}
        <label
          className={buttonVariants({ variant: 'outline', className: 'cursor-pointer focus-within:ring-2 focus-within:ring-focus aria-disabled:opacity-60' })}
          aria-disabled={busy}
        >
          {busy && !preview ? '파일 확인 중…' : 'CSV 파일 고르기'}
          <input
            key={inputKey}
            className="sr-only"
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        <a className="text-body-03 text-primary underline" href={SAMPLE} download="참가신청자-양식.csv">
          예시 파일 받기
        </a>
      </div>
      <p className="t-caption m-0">
        첫 줄은 <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-secondary">이름,회사,이메일</code> 머리글이면 좋아요(없으면 이 순서로 읽어요). 엑셀에서 저장한 한글 CSV 도 그대로 올릴 수
        있어요. 한 번에 {LIMITS.rows.toLocaleString('ko-KR')}명까지예요.
      </p>

      {notice && (
        <Alert status={notice.ok ? 'success' : 'danger'} role={notice.ok ? 'status' : 'alert'}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{notice.text}</Alert.Title>
          </Alert.Content>
        </Alert>
      )}

      {preview && (
        <div className="flex flex-col gap-3 rounded-card border border-default p-4">
          <p className="m-0 break-all text-body-03 font-semibold text-default">
            {preview.fileName} — {preview.rows.length}줄 중 {okCount}명 등록 가능
          </p>
          <p className="t-caption m-0">
            남은 자리 {preview.seatsLeft}명 / 정원 {preview.capacity}명
            {(['registered', 'duplicate', 'invalid', 'full'] as const)
              .filter((s) => count(s) > 0)
              .map((s) => ` · ${LABEL[s]} ${count(s)}건`)
              .join('')}
          </p>
          {count('full') > 0 && (
            <p className="m-0 text-caption-01 text-danger" role="alert">
              정원이 모자라 {count('full')}명은 등록하지 않아요. 더 받으려면 정원을 늘린 새 이벤트를 만들거나 신청자를 정리해 주세요.
            </p>
          )}

          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="CSV 미리보기" className="min-w-max">
                <Table.Header>
                  <Table.Column>줄</Table.Column>
                  <Table.Column isRowHeader>이름</Table.Column>
                  <Table.Column>회사</Table.Column>
                  <Table.Column>이메일</Table.Column>
                  <Table.Column>결과</Table.Column>
                </Table.Header>
                <Table.Body>
                  {shown.map((r) => (
                    <Table.Row key={r.line} id={r.line}>
                      <Table.Cell className="text-muted">{r.line}</Table.Cell>
                      <Table.Cell>{r.name || '—'}</Table.Cell>
                      <Table.Cell>{r.company || '—'}</Table.Cell>
                      <Table.Cell>{r.email || '—'}</Table.Cell>
                      <Table.Cell>
                        {r.status === 'ok' ? (
                          <Chip color="success" size="sm">
                            {LABEL.ok}
                          </Chip>
                        ) : (
                          <span className="text-caption-01 text-danger">
                            {LABEL[r.status]} · {r.reason}
                          </span>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
          {preview.rows.length > PREVIEW_ROWS && (
            <p className="m-0 text-caption-01 text-subtle">문제 있는 줄부터 {PREVIEW_ROWS}줄만 보여줘요. 등록은 파일 전체로 해요.</p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button isDisabled={okCount === 0} isPending={busy} onPress={onCommit}>
              {busy ? '등록하는 중…' : okCount === 0 ? '등록할 사람이 없어요' : `${okCount}명 등록하기`}
            </Button>
            <Button variant="outline" isDisabled={busy} onPress={reset}>
              취소
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
