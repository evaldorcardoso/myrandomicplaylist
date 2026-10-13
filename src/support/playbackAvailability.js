// Disponibilidade da reprodução no app (#72).
//
// Traduz os sinais crus do Web Playback SDK em um estado de degradação
// normalizado. Quando o SDK não pode tocar no app — navegador sem proteção de
// conteúdo (DRM/EME) ou conta sem o requisito de reprodução — o app **não
// quebra**: continua como controle remoto e a UI mostra um aviso discreto a
// partir daqui. Sem SDK, DOM ou rede, para manter a lógica testável.

// Causas de degradação, da mais específica (navegador) para a genérica (falha
// ao carregar/conectar o SDK).
export const PLAYBACK_DEGRADATION = {
  UNSUPPORTED: 'unsupported',
  ACCOUNT: 'account',
  UNAVAILABLE: 'unavailable'
}

// Avisos discretos exibidos quando a reprodução no app não está disponível.
// Todos deixam claro que o controle remoto continua funcionando.
const DEGRADATION_MESSAGES = {
  [PLAYBACK_DEGRADATION.UNSUPPORTED]:
    'Este navegador não suporta a reprodução no app. Você continua no controle remoto.',
  [PLAYBACK_DEGRADATION.ACCOUNT]:
    'Sua conta Spotify não atende ao requisito de reprodução no app. Você continua no controle remoto.',
  [PLAYBACK_DEGRADATION.UNAVAILABLE]:
    'Não foi possível iniciar a reprodução no app. Você continua no controle remoto.'
}

// Decide se a reprodução no app está degradada. A ordem reflete a causa mais
// específica: sem suporte no navegador vem antes de conta inelegível, que vem
// antes da falha genérica de inicialização. Devolve `null` quando está tudo
// disponível.
export const resolvePlaybackDegradation = ({ supported, accountError, unavailable } = {}) => {
  let reason = null
  if (supported === false) reason = PLAYBACK_DEGRADATION.UNSUPPORTED
  else if (accountError) reason = PLAYBACK_DEGRADATION.ACCOUNT
  else if (unavailable) reason = PLAYBACK_DEGRADATION.UNAVAILABLE
  if (!reason) return null
  return { reason, message: DEGRADATION_MESSAGES[reason] }
}

// Causas em que conceder o escopo de reprodução não resolve: o navegador não
// toca de jeito nenhum.
const CONSENT_FUTILE_REASONS = [
  PLAYBACK_DEGRADATION.UNSUPPORTED,
  PLAYBACK_DEGRADATION.ACCOUNT
]

// Precisa oferecer o consentimento de reprodução (`streaming`)? Sim quando falta
// o escopo — e mesmo que a conexão tenha falhado, pois a falha genérica pode ser
// justamente o escopo ausente. Só não oferece quando a barreira é intransponível
// (navegador sem DRM/EME ou conta inelegível), casos em que o aviso de
// degradação é a mensagem certa.
export const shouldOfferConsent = ({ requiresConsent, degradation } = {}) =>
  Boolean(requiresConsent) && !CONSENT_FUTILE_REASONS.includes(degradation?.reason)
