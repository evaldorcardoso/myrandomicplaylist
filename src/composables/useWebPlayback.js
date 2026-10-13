// Player do Spotify dentro do app (#66).
//
// Composable singleton que injeta o script oficial do Web Playback SDK e
// instancia um único player ("MR Playlist") para toda a aplicação. O boot é
// feito uma vez na camada de layout autenticado, de modo que o dispositivo
// exista em qualquer rota.
//
// O dispositivo **nunca** assume o controle sozinho: ele apenas aparece na lista
// de dispositivos da conta e o usuário transfere a reprodução quando quiser.
//
// Também expõe os controles locais do player (#71): quando o app é o
// dispositivo ativo, play/pause/próxima/anterior/seek/volume falam direto com o
// SDK — sem ida e volta à API do Spotify.
//
// Degradação graciosa (#72): se o SDK não puder tocar no app — navegador sem
// DRM/EME, conta sem o requisito de reprodução ou falha ao carregar/conectar —
// o app continua funcionando como controle remoto e expõe um aviso discreto
// (`degradation`). Nenhum erro do SDK derruba a interface: todos são capturados
// e registrados.

import { computed, ref, shallowRef } from 'vue'
import { getSpotifyToken, getGrantedSpotifyScope } from '@/support/spotifyToken'
import { hasStreamingScope } from '@/support/spotifyAuth'
import { APP_DEVICE_NAME, SDK_SCRIPT_URL } from '@/support/webPlayback'
import { clampVolume } from '@/support/playbackControls'
import { resolvePlaybackDegradation } from '@/support/playbackAvailability'

const DEFAULT_VOLUME = 0.8

let sdkPromise = null
let booted = false
let player = null
// `activateElement()` só vale dentro de um gesto do usuário. Guardamos se já
// houve um gesto para replicar a ativação quando o player ficar pronto.
let userGestureSeen = false
// O elemento de áudio só é ativado uma vez; até conseguir, seguimos tentando a
// cada gesto para não prender a reprodução em pausa no iOS/Safari (#72).
let elementActivated = false

const deviceId = ref(null)
const isReady = ref(false)
const supported = ref(true)
const requiresConsent = ref(false)
// Causas de degradação (#72): conta sem o requisito de reprodução e falha ao
// carregar/conectar o SDK. `supported` (DRM/EME) já existe desde #66.
const accountError = ref(false)
const unavailable = ref(false)
const lastError = ref(null)
// Estado bruto do SDK. `shallowRef` porque o objeto é reescrito a cada evento e
// não deve virar profundamente reativo.
const playbackState = shallowRef(null)
// Volume local do SDK (0..1). O SDK não emite evento de volume, então a UI lê
// daqui: sincronizado no `ready` e atualizado de forma otimista nos controles.
const volume = ref(DEFAULT_VOLUME)

// Aviso discreto quando a reprodução no app não está disponível (#72). É nulo
// no caso normal; a UI usa este estado para continuar no controle remoto sem
// quebrar.
const degradation = computed(() =>
  resolvePlaybackDegradation({
    supported: supported.value,
    accountError: accountError.value,
    unavailable: unavailable.value,
  })
)

// Injeta o script do SDK uma única vez. Resolve quando `window.Spotify` está
// pronto; em recargas/duplicidade reaproveita o que já está na página.
export const loadWebPlaybackSdk = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Web Playback SDK indisponível fora do navegador'))
  }
  if (window.Spotify) return Promise.resolve(window.Spotify)
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve(window.Spotify)
    const script = document.createElement('script')
    script.src = SDK_SCRIPT_URL
    script.async = true
    script.onerror = () => {
      sdkPromise = null
      reject(new Error('Falha ao carregar o Web Playback SDK'))
    }
    document.head.appendChild(script)
  })
  return sdkPromise
}

const getOAuthToken = (callback) => {
  getSpotifyToken()
    .then((token) => {
      // Um token concedido antes de o escopo `streaming` existir não o carrega:
      // o SDK conecta, mas a licença DRM falha com 403. Detectamos pelo `scope`
      // devolvido na renovação (quando conhecido) e antecipamos o aviso.
      const scope = getGrantedSpotifyScope()
      if (typeof scope === 'string' && !hasStreamingScope(scope)) {
        requiresConsent.value = true
      }
      callback(token)
    })
    .catch((error) => {
      lastError.value = error?.message ?? String(error)
      console.error('Web Playback: falha ao obter o access token', error)
    })
}

const registerError = (scope, message) => {
  lastError.value = message ?? scope
  console.error(`Web Playback (${scope}):`, message)
}

const createPlayer = (Spotify) => {
  const instance = new Spotify.Player({
    name: APP_DEVICE_NAME,
    getOAuthToken,
    volume: DEFAULT_VOLUME,
    // Habilita teclas de mídia e tela de bloqueio quando o app é o player.
    enableMediaSession: true,
  })

  instance.addListener('ready', ({ device_id }) => {
    deviceId.value = device_id
    isReady.value = true
    // Conectou: limpa a falha genérica de inicialização, caso tenha havido.
    unavailable.value = false
    // O volume inicial vem do SDK. No iOS a leitura sempre devolve 1 (o volume
    // é físico); a UI não oferece o controle nessa plataforma.
    Promise.resolve(instance.getVolume())
      .then((value) => {
        if (Number.isFinite(value)) volume.value = clampVolume(value)
      })
      .catch((error) => console.error('Web Playback: falha ao ler o volume', error))
  })

  instance.addListener('not_ready', ({ device_id }) => {
    if (!deviceId.value || device_id === deviceId.value) isReady.value = false
  })

  instance.addListener('player_state_changed', (state) => {
    playbackState.value = state
  })

  // Sem o escopo `streaming` o SDK não autentica: sinaliza para a UI oferecer
  // o caminho de reconexão com consentimento (settings / tela do player).
  instance.addListener('authentication_error', ({ message }) => {
    requiresConsent.value = true
    registerError('authentication_error', message)
  })

  instance.addListener('initialization_error', ({ message }) => {
    // Ambiente sem proteção de conteúdo (DRM/EME): reprodução no app indisponível.
    // Derruba o modo local para os controles caírem no REST (controle remoto).
    supported.value = false
    isReady.value = false
    registerError('initialization_error', message)
  })

  instance.addListener('account_error', ({ message }) => {
    // Conta sem o requisito de reprodução (ex.: sem Premium): segue no controle
    // remoto com aviso discreto, sem quebrar a interface.
    accountError.value = true
    isReady.value = false
    registerError('account_error', message)
  })

  instance.addListener('playback_error', ({ message }) => {
    registerError('playback_error', message)
  })

  instance.addListener('autoplay_failed', () => {
    registerError('autoplay_failed', 'O navegador bloqueou o autoplay')
  })

  return instance
}

// Executa um comando no player local. O SDK devolve promises que podem rejeitar
// (e, no iOS, alguns métodos não são sequer setáveis) — nunca deixamos o erro
// vazar para a UI: apenas loga e informa `false`.
const runLocalCommand = (action) => {
  if (!player) return Promise.resolve(false)
  try {
    return Promise.resolve(action(player))
      .then(() => true)
      .catch((error) => {
        console.error('Web Playback: falha no controle local', error)
        return false
      })
  } catch (error) {
    console.error('Web Playback: falha no controle local', error)
    return Promise.resolve(false)
  }
}

export const toggleLocalPlay = () => runLocalCommand((instance) => instance.togglePlay())
export const nextLocalTrack = () => runLocalCommand((instance) => instance.nextTrack())
export const previousLocalTrack = () => runLocalCommand((instance) => instance.previousTrack())
export const seekLocalPlayback = (positionMs) =>
  runLocalCommand((instance) => instance.seek(positionMs))

// O volume é otimista: a UI responde na hora. Se o SDK recusar (no iOS o volume
// é físico), o valor volta ao anterior sem quebrar a tela.
export const setLocalVolume = (value) => {
  const next = clampVolume(value)
  const previous = volume.value
  volume.value = next
  return runLocalCommand((instance) => instance.setVolume(next)).then((ok) => {
    if (!ok) volume.value = previous
    return ok
  })
}

// Tenta ativar o elemento de áudio do SDK. Fora de um gesto (retry do boot) é
// só best-effort: **não** marca a ativação como concluída, pois no iOS ela só
// vale dentro do gesto — assim os listeners seguem armados para o próximo toque.
const tryActivateElement = async ({ fromGesture = false } = {}) => {
  // Sem reprodução possível no app (degradação), não há o que ativar: solta o
  // listener para não repetir tentativas a cada toque.
  if (degradation.value) {
    detachGestureActivation()
    return
  }
  if (!player || elementActivated) return
  try {
    await player.activateElement()
    if (fromGesture) {
      elementActivated = true
      detachGestureActivation()
    }
  } catch (error) {
    console.error('Web Playback: falha ao ativar o elemento de áudio', error)
  }
}

// Deve ser chamado dentro de um gesto do usuário (clique de transferência ou o
// primeiro toque, pelo listener global) para liberar o autoplay — sobretudo no
// iOS/Safari, onde a reprodução ficaria presa em pausa.
export const activateWebPlaybackElement = () => {
  userGestureSeen = true
  return tryActivateElement({ fromGesture: true })
}

// O SDK não inicia a reprodução sozinho após a transferência: é preciso um
// gesto do usuário. Armamos um listener de primeiro gesto (toque/clique/tecla)
// para ativar o elemento — mesmo quando a transferência vem de outro aparelho,
// sem clique no app. O listener só é solto depois de uma ativação de verdade.
const onFirstGesture = () => {
  activateWebPlaybackElement()
}

const detachGestureActivation = () => {
  if (typeof window === 'undefined') return
  window.removeEventListener('pointerdown', onFirstGesture, true)
  window.removeEventListener('keydown', onFirstGesture, true)
}

const attachGestureActivation = () => {
  if (typeof window === 'undefined') return
  window.addEventListener('pointerdown', onFirstGesture, true)
  window.addEventListener('keydown', onFirstGesture, true)
}

// Boot único: carrega o SDK, cria e conecta o player.
export const bootWebPlayback = async () => {
  if (booted) return
  booted = true
  attachGestureActivation()
  try {
    const Spotify = await loadWebPlaybackSdk()
    player = createPlayer(Spotify)
    const connected = await player.connect()
    if (!connected) {
      unavailable.value = true
      lastError.value = 'Não foi possível conectar o player'
    }
    // O gesto pode ter acontecido antes de o player existir: tenta reaplicar
    // (best-effort, fora do gesto; a ativação válida vem no próximo toque).
    if (userGestureSeen) {
      await tryActivateElement()
    }
  } catch (error) {
    booted = false
    detachGestureActivation()
    unavailable.value = true
    lastError.value = error?.message ?? String(error)
    console.error('Web Playback: falha ao inicializar', error)
  }
}

export const useWebPlayback = () => ({
  deviceId,
  isReady,
  supported,
  requiresConsent,
  degradation,
  lastError,
  playbackState,
  volume,
  boot: bootWebPlayback,
  activateElement: activateWebPlaybackElement,
  // Controles locais (#71): só valem quando o app é o dispositivo ativo.
  togglePlay: toggleLocalPlay,
  next: nextLocalTrack,
  previous: previousLocalTrack,
  seek: seekLocalPlayback,
  setVolume: setLocalVolume,
})
