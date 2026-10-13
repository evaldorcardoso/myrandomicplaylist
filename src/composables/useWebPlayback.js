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
// O estado exposto aqui é a base para as issues seguintes (fonte de "agora
// tocando" #67/#68, controles locais #71, degradação graciosa #72).

import { ref, shallowRef } from 'vue'
import { getSpotifyToken } from '@/support/spotifyToken'
import { APP_DEVICE_NAME, SDK_SCRIPT_URL } from '@/support/webPlayback'

const DEFAULT_VOLUME = 0.8

let sdkPromise = null
let booted = false
let player = null

const deviceId = ref(null)
const isReady = ref(false)
const supported = ref(true)
const requiresConsent = ref(false)
const lastError = ref(null)
// Estado bruto do SDK. `shallowRef` porque o objeto é reescrito a cada evento e
// não deve virar profundamente reativo.
const playbackState = shallowRef(null)

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
    .then(callback)
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
    supported.value = false
    registerError('initialization_error', message)
  })

  instance.addListener('account_error', ({ message }) => {
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

// Boot único: carrega o SDK, cria e conecta o player.
export const bootWebPlayback = async () => {
  if (booted) return
  booted = true
  try {
    const Spotify = await loadWebPlaybackSdk()
    player = createPlayer(Spotify)
    const connected = await player.connect()
    if (!connected) {
      lastError.value = 'Não foi possível conectar o player'
    }
  } catch (error) {
    booted = false
    lastError.value = error?.message ?? String(error)
    console.error('Web Playback: falha ao inicializar', error)
  }
}

// Deve ser chamado dentro de um gesto do usuário (ex.: clique de transferência)
// para liberar o autoplay — sobretudo no iOS/Safari.
export const activateWebPlaybackElement = async () => {
  if (!player) return
  try {
    await player.activateElement()
  } catch (error) {
    console.error('Web Playback: falha ao ativar o elemento de áudio', error)
  }
}

export const useWebPlayback = () => ({
  deviceId,
  isReady,
  supported,
  requiresConsent,
  lastError,
  playbackState,
  boot: bootWebPlayback,
  activateElement: activateWebPlaybackElement,
})
