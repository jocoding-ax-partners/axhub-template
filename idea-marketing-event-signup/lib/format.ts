// 화면 표시용 포맷. 시간은 언제나 한국 시간(KST)으로 보여줘요.
export const kst = (d: Date | string): string =>
  new Date(d).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })

export const kstTime = (d: Date | string): string =>
  new Date(d).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })

// 출석률 (소수 첫째 자리까지). 신청자가 없으면 '-'.
export const rate = (attended: number, applied: number): string =>
  applied === 0 ? '-' : `${Math.round((attended / applied) * 1000) / 10}%`
