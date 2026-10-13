// Fonte compartilhada de "agora tocando" (#68).
//
// Um único estado normalizado alimenta o player flutuante (e, adiante, a tela do
// player). Quando o dispositivo do app ("MR Playlist") é o ativo, posição/estado/
// faixa vêm dos eventos reais do Web Playback SDK; caso contrário, de um fallback
// REST que só roda quando é necessário e com a aba visível.
//
// O ciclo de vida é único e pertence à camada de layout autenticado: `start()`
// registra o fallback e o observador de visibilidade, `stop()` encerra tudo.
//
// Regras de consumo:
// - `nowPlaying`: estado normalizado `{ track, position, duration, playing }`, ou
//   `null` quando nada está tocando.
// - `position`: posição real projetada para o instante atual, ancorada no último
//   evento (a barra avança entre eventos, mas nunca é simulada do zero).
// - `rawTrack`: faixa crua do Spotify da fonte de verdade (para os modais).
// - `refresh()`: força uma leitura REST (ex.: depois de um play/pause manual).
//
// Metadados que o SDK não fornece (#70): a faixa do SDK não traz popularidade
// nem data de lançamento. Ao trocar de faixa, o app busca esses campos uma única
// vez pelo endpoint de faixa e os combina em `nowPlaying` a partir de um cache
// por identificador — sem polling e reaproveitado em repetição/seek.

import { computed, ref, shallowRef, watch } from 'vue'
import { useGeneral, useProfile } from '@/support/spotifyApi'
import { useWebPlayback } from '@/composables/useWebPlayback'
import { isAppDevice } from '@/support/webPlayback'
import {
  cacheTrackMetadata,
  createTrackMetadataCache,
  extractTrackMetadata,
  projectPosition,
  resolveNowPlaying,
  resolveRawTrack,
  resolveTrackMetadata,
  shouldFetchTrackMetadata,
} from '@/support/nowPlaying'

// O fallback REST do layout rodava a cada 10s. Mantemos o mesmo passo enquanto o
// app não é o player; quando o SDK assume, ele para.
const POLL_INTERVAL_MS = 10000
// Re-renderização local da projeção de posição (não fala com a rede).
const TICK_INTERVAL_MS = 500

const { playbackState, deviceId, isReady } = useWebPlayback()

// Último estado REST conhecido (`/me/player`).
const restState = shallowRef(null)

// Os utilitários de API (`useProfile`/`useGeneral`) injetam o axios da aplicação
// e tocam a store de settings; não podem rodar no topo do módulo (antes de o
// app/plugin existirem), então são criados sob demanda na primeira leitura.
let profileApi = null
const getProfileApi = () => (profileApi ??= useProfile())

let generalApi = null
const getGeneralApi = () => (generalApi ??= useGeneral())

// O app é o dispositivo ativo? O REST informa o `device.id` ativo da conta.
const appDeviceActive = computed(() =>
  isAppDevice(restState.value?.device, deviceId.value)
)

// Estado normalizado da fonte de verdade, antes do enriquecimento de metadados.
const baseNowPlaying = computed(() =>
  resolveNowPlaying({
    sdkState: playbackState.value,
    restState: restState.value,
    appDeviceId: deviceId.value,
  })
)

// Metadados que o SDK não fornece (#70): popularidade e data de lançamento são
// buscados uma vez por faixa e guardados em cache. Como o cache é um `Map` não
// reativo, o contador força `nowPlaying` a recomputar quando ele é preenchido.
const metadataCache = createTrackMetadataCache()
const metadataVersion = ref(0)

const nowPlaying = computed(() => {
  metadataVersion.value // dependência explícita: o cache é um Map não-reativo
  const base = baseNowPlaying.value
  if (!base) return null
  const track = resolveTrackMetadata(base.track, { cache: metadataCache })
  return track === base.track ? base : { ...base, track }
})

const rawTrack = computed(() =>
  resolveRawTrack({
    sdkState: playbackState.value,
    restState: restState.value,
    appDeviceId: deviceId.value,
  })
)

// Âncora do último evento real. A posição exibida é sempre derivada daqui.
const anchorPosition = ref(0)
const anchorDuration = ref(0)
const anchorPlaying = ref(false)
const anchorAt = ref(0)
const now = ref(Date.now())

watch(nowPlaying, (state) => {
  const stamp = Date.now()
  anchorPlaying.value = Boolean(state?.playing)
  anchorPosition.value = state?.position ?? 0
  anchorDuration.value = state?.duration ?? 0
  anchorAt.value = stamp
  now.value = stamp
}, { immediate: true })

const position = computed(() =>
  projectPosition(
    {
      position: anchorPosition.value,
      duration: anchorDuration.value,
      playing: anchorPlaying.value,
    },
    anchorPlaying.value ? now.value - anchorAt.value : 0
  )
)

// Ticker local só enquanto há reprodução: re-renderiza a posição projetada sem
// nenhuma chamada de rede.
let ticker = null
const startTicker = () => {
  if (ticker == null) {
    ticker = setInterval(() => { now.value = Date.now() }, TICK_INTERVAL_MS)
  }
}
const stopTicker = () => {
  if (ticker != null) {
    clearInterval(ticker)
    ticker = null
  }
}
watch(anchorPlaying, (playing) => (playing ? startTicker() : stopTicker()))

// Leitura REST deduplicada: chamadas concorrentes compartilham a mesma promise.
let inFlight = null
const refresh = () => {
  if (inFlight) return inFlight
  inFlight = getProfileApi()
    .getPlaybackState()
    .then(({ data }) => {
      // 204 (nada tocando) chega como corpo vazio; normaliza para `null`.
      restState.value = data || null
      return restState.value
    })
    .catch((error) => {
      console.error('Agora tocando: falha ao buscar o estado REST', error)
      return null
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

// Busca única por faixa (#70): o SDK não traz popularidade nem data de
// lançamento. A busca é dirigida pela troca de faixa — nunca por timer — e
// deduplicada enquanto está em andamento. Em caso de falha, só loga: a tela
// segue funcional com os campos vazios.
const metadataInFlight = new Map()
const fetchTrackMetadata = (trackId) => {
  if (metadataInFlight.has(trackId)) return metadataInFlight.get(trackId)
  const request = getGeneralApi()
    .getTrack(trackId)
    .then(({ data }) => {
      const metadata = extractTrackMetadata(data)
      if (Object.keys(metadata).length > 0) {
        cacheTrackMetadata(metadataCache, trackId, metadata)
        metadataVersion.value++
      }
      return metadata
    })
    .catch((error) => {
      console.error('Agora tocando: falha ao buscar metadados da faixa', error)
      return null
    })
    .finally(() => metadataInFlight.delete(trackId))
  metadataInFlight.set(trackId, request)
  return request
}

// Dispara só quando muda a faixa (ou a fonte de verdade). Repetição/seek da
// mesma faixa — e faixas já cobertas pelo cache — não geram nova busca.
watch(
  () => {
    const state = baseNowPlaying.value
    return state?.track?.id ? `${state.source}:${state.track.id}` : null
  },
  () => {
    const track = baseNowPlaying.value?.track
    if (track?.id && shouldFetchTrackMetadata(track, metadataCache)) {
      fetchTrackMetadata(track.id)
    }
  },
  { immediate: true }
)

const isVisible = () =>
  typeof document === 'undefined' || document.visibilityState !== 'hidden'

// O SDK deixou de tocar localmente: pode ser pausa ou uma transferência para
// outro aparelho feita por fora. Uma única releitura confirma quem está ativo —
// dirigido por evento, não polling.
watch([playbackState, isReady], () => {
  if (!appDeviceActive.value) return
  const stillPlayingLocally = isReady.value !== false && playbackState.value?.paused === false
  if (stillPlayingLocally) return
  refresh()
})

// O fallback só roda enquanto é necessário: aba visível e o app fora do ar.
const shouldPoll = () => started && isVisible() && !appDeviceActive.value

let started = false
let pollTimer = null

const stopPolling = () => {
  if (pollTimer != null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const startPolling = () => {
  if (pollTimer != null) return
  pollTimer = setInterval(() => {
    if (!isVisible() || appDeviceActive.value) {
      stopPolling()
      return
    }
    refresh()
  }, POLL_INTERVAL_MS)
}

const syncPolling = () => (shouldPoll() ? startPolling() : stopPolling())

// O dispositivo ativo mudou (ou o SDK ficou pronto): liga/desliga o fallback.
watch(appDeviceActive, syncPolling)

const onResume = () => {
  // Ao voltar o foco, revalida uma vez: cobre uma transferência feita por fora
  // (celular) que não gerou evento no SDK.
  if (isVisible()) refresh()
  syncPolling()
}

const attachResumeListeners = () => {
  if (typeof document === 'undefined') return
  document.addEventListener('visibilitychange', onResume)
  if (typeof window !== 'undefined') window.addEventListener('focus', onResume)
}

const detachResumeListeners = () => {
  if (typeof document === 'undefined') return
  document.removeEventListener('visibilitychange', onResume)
  if (typeof window !== 'undefined') window.removeEventListener('focus', onResume)
}

export const startNowPlaying = () => {
  if (started) return
  started = true
  attachResumeListeners()
  // Só busca com a aba visível; se começar em segundo plano, o próprio
  // observador de visibilidade faz a primeira leitura quando ela aparecer.
  if (isVisible()) refresh()
  if (anchorPlaying.value) startTicker()
  syncPolling()
}

export const stopNowPlaying = () => {
  if (!started) return
  started = false
  detachResumeListeners()
  stopPolling()
  stopTicker()
}

export const useNowPlaying = () => ({
  nowPlaying,
  rawTrack,
  position,
  // O app é o dispositivo ativo na conta? É a informação que os controles usam
  // para decidir entre os métodos locais do SDK e a API REST (#71).
  appDeviceActive,
  refresh,
  start: startNowPlaying,
  stop: stopNowPlaying,
})
