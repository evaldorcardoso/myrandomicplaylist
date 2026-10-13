// Roteamento da reprodução entre o dispositivo ativo e o do próprio app.
//
// O endpoint `PUT /me/player/play`, sem `device_id`, toca no dispositivo ativo
// da conta. Se não houver nenhum ativo, o Spotify responde 404 com
// `reason: "NO_ACTIVE_DEVICE"` — mesmo existindo o dispositivo "MR Playlist" do
// Web Playback SDK. Este módulo concentra as duas perguntas puras que decidem o
// fallback para o app: "é o erro de dispositivo inativo?" e "o app pode tocar
// agora?". Sem SDK, rede ou DOM, para manter a lógica testável.

export const NO_ACTIVE_DEVICE = 'NO_ACTIVE_DEVICE'

// É o 404 específico de "nenhum dispositivo ativo"? Outros 404 (recurso ausente,
// etc.) não devem redirecionar a reprodução para o app.
export const isNoActiveDeviceError = (error) =>
  error?.response?.status === 404 &&
  error.response.data?.error?.reason === NO_ACTIVE_DEVICE

// O app pode assumir a reprodução agora? Só com o id do dispositivo já emitido
// no evento `ready`, o SDK pronto e sem degradação (navegador sem DRM/EME, conta
// inelegível ou falha de conexão).
export const canPlayOnAppDevice = ({ deviceId, isReady, degraded } = {}) =>
  Boolean(deviceId) && Boolean(isReady) && !degraded
