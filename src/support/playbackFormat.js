// Formatação pura compartilhada pelas telas de reprodução (#69).
//
// A tela do player e o player flutuante consomem a mesma fonte de "agora
// tocando" (`useNowPlaying`) e formatam posição/duração e data de lançamento
// exatamente do mesmo jeito — sem SDK, rede ou DOM, para manter a lógica
// testável e garantir que as duas telas nunca mostrem rótulos divergentes.

// Milissegundos -> "minutos:segundos" (segundos sempre com dois dígitos).
export const formatDuration = (ms) => {
  const total = Number(ms)
  if (!Number.isFinite(total) || total < 0) return '0:00'
  const totalSeconds = Math.floor(total / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

// Posição (ms) e duração (ms) -> percentual 0..100 da barra de progresso.
// Sem duração válida não há barra; a posição é limitada a [0, duração].
export const progressPercent = (positionMs, durationMs) => {
  const duration = Number(durationMs)
  if (!Number.isFinite(duration) || duration <= 0) return 0
  const position = Number(positionMs)
  if (!Number.isFinite(position)) return 0
  return Math.min(100, (Math.max(position, 0) / duration) * 100)
}

// Data ISO do Spotify ("AAAA-MM-DD", "AAAA-MM" ou "AAAA") -> "DD/MM/AAAA".
// Aceita precisão parcial; sem data, devolve um traço.
export const formatReleaseDate = (date) => {
  if (!date) return '—'
  const [year, month, day] = String(date).split('-')
  const parts = []
  if (day) parts.push(day)
  if (month) parts.push(month)
  if (year) parts.push(year)
  return parts.length ? parts.join('/') : '—'
}
