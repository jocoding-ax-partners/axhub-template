// axhub 파일 저장소 (S3 호환 · 서버 전용). 고장 사진을 여기에 둬요.
// axhub.yaml 의 `storage: enabled: true` 로 배포하면 STORAGE_* 값이 자동으로 들어와요 (AXHUB.md §4).
// 버킷은 비공개예요 — 사진은 app/photos/[id]/route.ts 가 권한을 확인한 뒤 5분짜리 임시 주소로만 열어 줘요.
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const BUCKET = process.env.STORAGE_BUCKET ?? ''

// 로컬 실행처럼 저장소 값이 없으면 false — 화면이 사진 칸을 숨겨요.
export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.STORAGE_ENDPOINT && BUCKET && process.env.STORAGE_ACCESS_KEY && process.env.STORAGE_SECRET_KEY,
  )
}

let _s3: S3Client | null = null
function s3(): S3Client {
  _s3 ??= new S3Client({
    endpoint: process.env.STORAGE_ENDPOINT,
    region: 'auto',
    credentials: { accessKeyId: process.env.STORAGE_ACCESS_KEY ?? '', secretAccessKey: process.env.STORAGE_SECRET_KEY ?? '' },
    // 두 옵션을 빼면 업로드가 SignatureDoesNotMatch 로 실패해요.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  return _s3
}

export async function putFile(key: string, body: Uint8Array, contentType: string): Promise<void> {
  await s3().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }))
}

export async function deleteFile(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

// 5분 동안만 열리는 주소. 권한 확인을 마친 뒤에만 만들어요.
export function signedUrl(key: string): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 300 })
}
