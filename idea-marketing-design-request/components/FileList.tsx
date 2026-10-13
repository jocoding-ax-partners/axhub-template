import { EmptyState } from '@heroui/react'
import { File as FileBlank, FileImage, FilePdf, FileZip } from '@phosphor-icons/react/ssr'
import { deleteResult } from '@/app/actions'
import { formatBytes, formatDateTime } from '@/lib/design'
import type { FileRow } from '@/lib/design-store'
import { ActionForm } from './ActionForm'
import { ConfirmButton } from './ConfirmButton'

function FileIcon({ type }: { type: string }) {
  const Icon =
    type === 'application/pdf' ? FilePdf : type === 'application/zip' ? FileZip : type.startsWith('image/') ? FileImage : FileBlank
  return <Icon size={20} weight="fill" className="shrink-0 text-muted" aria-hidden />
}

/**
 * 요청에 붙은 파일 목록. 이름을 누르면 app/files/[id] 가 권한을 확인하고 새 탭에서 열어요(이미지 · PDF) 또는 내려받아요.
 * requestId 를 주면 줄마다 지우기 버튼이 붙어요 (맡은 디자이너의 결과물만).
 */
export function FileList({ files, empty, requestId }: { files: FileRow[]; empty: string; requestId?: string }) {
  if (files.length === 0) return <EmptyState>{empty}</EmptyState>
  return (
    <ul className="list-none p-0">
      {files.map((f) => (
        <li key={f.id} className="flex flex-col gap-2 border-b border-default py-3 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <FileIcon type={f.content_type} />
            <div className="min-w-0">
              <a href={`/files/${f.id}`} target="_blank" rel="noreferrer" className="t-small break-all font-semibold text-primary hover:underline">
                {f.file_name}
              </a>
              <p className="t-caption">
                {formatBytes(f.size_bytes)} · {f.uploaded_by ? `${f.uploaded_by} · ` : ''}
                {formatDateTime(f.created_at)}
              </p>
            </div>
          </div>
          {requestId && (
            <ActionForm action={deleteResult}>
              <input type="hidden" name="id" value={requestId} />
              <input type="hidden" name="file_id" value={f.id} />
              <ConfirmButton
                danger
                confirm={{
                  title: `${f.file_name} 을(를) 지울까요?`,
                  description: '요청자도 더 이상 이 파일을 볼 수 없고, 되돌릴 수 없어요.',
                  confirmLabel: '지우기',
                  variant: 'danger',
                }}
              >
                지우기
              </ConfirmButton>
            </ActionForm>
          )}
        </li>
      ))}
    </ul>
  )
}
