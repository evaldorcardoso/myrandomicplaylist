// Lançador de reprodução com fallback para o dispositivo do app.
//
// Ponto único para iniciar/retomar a reprodução quando o app ainda não sabe qual
// dispositivo está ativo. Sem `device_id`, o Spotify toca no dispositivo ativo da
// conta e responde 404 `NO_ACTIVE_DEVICE` quando não há nenhum — mesmo com o
// dispositivo "MR Playlist" do Web Playback SDK disponível. Aqui a chamada é
// repetida direcionada a esse dispositivo, para que o próprio app assuma a
// reprodução.
//
// O resultado é sempre normalizado (`{ ok, noActiveDevice, error }`): quem chama
// decide o aviso, o fallback para o player web ou o silêncio. `noActiveDevice`
// marca o caso em que a única barreira foi a ausência de dispositivo ativo (e o
// app não pôde assumir), para a UI manter a mensagem específica.

import { useProfile } from '@/support/spotifyApi'
import { useWebPlayback } from '@/composables/useWebPlayback'
import { useNowPlaying } from '@/composables/useNowPlaying'
import { canPlayOnAppDevice, isNoActiveDeviceError } from '@/support/playbackRouting'

export const usePlaybackLauncher = () => {
  const { executePlaylist, startResumePlayback } = useProfile()
  const { deviceId, isReady, degradation, activateElement } = useWebPlayback()
  const { refresh } = useNowPlaying()

  // Executa um comando de play. `run` recebe o `device_id` opcional: `undefined`
  // mantém o alvo atual (dispositivo ativo); o retry passa o id do app.
  const launch = async (run) => {
    // Ainda dentro do gesto do clique que originou o comando: libera o elemento
    // de áudio do app para o caso de ele assumir a reprodução (iOS/Safari). O
    // listener global de primeiro toque faz o mesmo, mas aqui garantimos o gesto
    // específico deste comando — depois de um `await` o gesto já se perdeu.
    await activateElement()
    try {
      await run()
      return { ok: true, noActiveDevice: false }
    } catch (error) {
      const noActiveDevice = isNoActiveDeviceError(error)
      // Só redireciona para o app no erro específico de "nenhum dispositivo
      // ativo"; qualquer outra falha segue como antes.
      if (!noActiveDevice) {
        return { ok: false, noActiveDevice: false, error }
      }
      const canFallback = canPlayOnAppDevice({
        deviceId: deviceId.value,
        isReady: isReady.value,
        degraded: Boolean(degradation.value),
      })
      if (!canFallback) {
        return { ok: false, noActiveDevice: true, error }
      }
      try {
        await run(deviceId.value)
        // O app passou a ser o dispositivo ativo: revalida a fonte compartilhada
        // para os controles trocarem para os métodos locais do SDK.
        await refresh()
        return { ok: true, noActiveDevice: false }
      } catch (fallbackError) {
        console.error('Lançador de reprodução: falha no dispositivo do app', fallbackError)
        return { ok: false, noActiveDevice: false, error: fallbackError }
      }
    }
  }

  // Tocar uma faixa/playlist (contexto ou `uris`).
  const playOnAnyDevice = (formData) =>
    launch((targetDeviceId) => executePlaylist(formData, targetDeviceId))

  // Retomar a reprodução corrente.
  const resumeOnAnyDevice = () => launch((targetDeviceId) => startResumePlayback(targetDeviceId))

  return { playOnAnyDevice, resumeOnAnyDevice }
}
