// Controles unificados de reprodução (#71).
//
// Ponto único que a UI chama para play/pause, próxima, anterior, seek e volume.
// A regra: quando o dispositivo do app ("MR Playlist") é o ativo, os comandos
// falam com os métodos locais do SDK (resposta imediata, sem ida à API REST);
// caso contrário, seguem pela API REST, como antes.
//
// Seek e volume existem apenas no player do app. No iOS/Safari o volume local
// não é setável pela JavaScript — o controle é escondido (`canSetVolume`), e o
// SDK continua sem erro.

import { computed } from 'vue'
import { useProfile } from '@/support/spotifyApi'
import { useWebPlayback } from '@/composables/useWebPlayback'
import { useNowPlaying } from '@/composables/useNowPlaying'
import {
  canControlLocalVolume,
  resolveControlTarget,
  seekPositionFromPercent,
  toVolumePercent,
  volumeFromPercent,
} from '@/support/playbackControls'

// Informações do navegador para decidir se o volume é controlável. Isolado para
// o render não tocar `navigator` em ambientes sem DOM (SSR/testes).
const browserEnvironment = () => ({
  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  maxTouchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
})

export const usePlaybackControls = () => {
  const {
    isReady,
    volume,
    togglePlay: toggleLocal,
    next: nextLocal,
    previous: previousLocal,
    seek: seekLocal,
    setVolume: setLocalVolume,
  } = useWebPlayback()

  const { nowPlaying, appDeviceActive, refresh } = useNowPlaying()
  const { skipToNext, skipToPrevious, pausePlayback, startResumePlayback } = useProfile()

  // O app só manda localmente quando é o dispositivo ativo E o SDK está pronto.
  const isLocal = computed(
    () => resolveControlTarget({ appDeviceActive: appDeviceActive.value && isReady.value }) === 'local'
  )

  // Comando pelo fallback REST: loga a falha e revalida a fonte compartilhada
  // uma única vez, como o resto do app faz.
  const runRemote = async (action, message) => {
    try {
      await action()
    } catch (error) {
      console.error(message, error)
    } finally {
      await refresh()
    }
  }

  const togglePlay = () =>
    isLocal.value
      ? toggleLocal()
      : runRemote(
          () => (nowPlaying.value?.playing ? pausePlayback() : startResumePlayback()),
          'Falha ao alternar a reprodução:'
        )

  const next = () =>
    isLocal.value ? nextLocal() : runRemote(skipToNext, 'Falha ao avançar a faixa:')

  const previous = () =>
    isLocal.value ? previousLocal() : runRemote(skipToPrevious, 'Falha ao retroceder a faixa:')

  // Seek só no player do app, ancorado na duração real da fonte compartilhada.
  const canSeek = computed(() => isLocal.value && Boolean(nowPlaying.value?.duration))

  const seekFromPercent = (percent) => {
    if (!isLocal.value) return Promise.resolve(false)
    const position = seekPositionFromPercent(percent, nowPlaying.value?.duration)
    if (position == null) return Promise.resolve(false)
    return seekLocal(position)
  }

  // Volume: só no player do app e onde o navegador permite (fora do iOS).
  const canSetVolume = computed(() => isLocal.value && canControlLocalVolume(browserEnvironment()))
  const volumePercent = computed(() => toVolumePercent(volume.value))

  const changeVolume = (percent) => {
    if (!canSetVolume.value) return Promise.resolve(false)
    return setLocalVolume(volumeFromPercent(percent))
  }

  return {
    isLocal,
    togglePlay,
    next,
    previous,
    canSeek,
    seekFromPercent,
    canSetVolume,
    volumePercent,
    changeVolume,
  }
}
