// Controles de reprodução (#71).
//
// Lógica pura por trás dos controles do player: conversões de volume entre o
// formato do SDK (0..1) e o da UI (0..100), conversão de um clique na barra de
// progresso em posição (seek) e a regra que decide se um comando fala com o SDK
// local (o app é o player ativo) ou com a API REST (outro aparelho manda).
//
// Sem Vue, DOM, SDK ou rede — para manter a lógica testável. A detecção de iOS
// recebe o `userAgent`/`maxTouchPoints` como entrada, não lê `navigator`.

// O volume do SDK é um float entre 0 e 1. Valores ausentes/inválidos viram 0 em
// vez de propagar NaN para a API do SDK.
export const clampVolume = (value) =>
  Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0

// Volume do SDK -> percentual inteiro da UI.
export const toVolumePercent = (volume) => Math.round(clampVolume(volume) * 100)

// Percentual da UI -> volume do SDK, já limitado ao intervalo válido.
export const volumeFromPercent = (percent) =>
  clampVolume(Number.isFinite(percent) ? percent / 100 : 0)

// Posição do clique na barra (0..100%) -> posição em ms, limitada à duração.
// Devolve null quando não há duração válida — não dá para calcular o destino e o
// seek deve ser ignorado em vez de mandar uma posição arbitrária.
export const seekPositionFromPercent = (percent, duration) => {
  if (!Number.isFinite(duration) || duration <= 0) return null
  const ratio = Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 100) / 100 : 0
  return Math.round(ratio * duration)
}

// iOS/iPadOS não permite ajustar o volume local via JavaScript: a leitura sempre
// retorna 1 e a escrita é ignorada. Detectamos pelo user agent — inclusive o
// iPadOS 13+, que se apresenta como "Macintosh" e se denuncia pelo toque.
export const isIosLikePlatform = ({ userAgent = '', maxTouchPoints = 0 } = {}) => {
  if (typeof userAgent !== 'string') return false
  if (/iPad|iPhone|iPod/.test(userAgent)) return true
  return /Macintosh/.test(userAgent) && Number(maxTouchPoints) > 1
}

// Se o volume local pode ser controlado por JavaScript nesta plataforma.
export const canControlLocalVolume = (env = {}) => !isIosLikePlatform(env)

// Decide o alvo de um comando: os métodos locais do SDK quando o app é o player
// ativo (resposta imediata), ou a API REST caso contrário (como hoje).
export const resolveControlTarget = ({ appDeviceActive } = {}) =>
  appDeviceActive ? 'local' : 'remote'
