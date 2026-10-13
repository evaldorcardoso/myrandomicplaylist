// "Agora tocando" normalizado (#67).
//
// Camada de lógica pura que transforma o payload de mudança de estado do Web
// Playback SDK e o estado REST (`/me/player`) num formato interno único,
// decide a fonte de verdade (o app é o dispositivo ativo?) e define a regra de
// merge/cache dos metadados que o SDK não fornece (popularidade e data de
// lançamento) — sem rede, SDK ou DOM, para manter a lógica testável.
//
// O objeto normalizado de "agora tocando" é sempre:
//   { track, position, duration, playing }
// e a faixa normalizada é sempre:
//   { id, uri, name, artists, image, duration, popularity, release_date }

import { isAppDevice } from '@/support/webPlayback'

// Campos que o SDK não fornece e que precisam ser buscados por faixa.
const METADATA_FIELDS = ['popularity', 'release_date']

const artistNames = (artists) =>
  Array.isArray(artists)
    ? artists.map((artist) => artist?.name).filter(Boolean)
    : []

const firstImageUrl = (album) =>
  Array.isArray(album?.images) && album.images.length > 0
    ? album.images[0]?.url ?? null
    : null

// Normaliza uma faixa (SDK `current_track` ou REST `item`) no formato interno.
// Faixas locais/anúncios não têm `id` e não são reproduzíveis: devolve null.
export const normalizeTrack = (rawTrack) => {
  if (!rawTrack || !rawTrack.id) return null
  return {
    id: rawTrack.id,
    uri: rawTrack.uri ?? null,
    name: rawTrack.name ?? '',
    artists: artistNames(rawTrack.artists),
    image: firstImageUrl(rawTrack.album),
    duration: rawTrack.duration_ms ?? null,
    popularity: rawTrack.popularity ?? null,
    release_date: rawTrack.album?.release_date ?? null,
  }
}

// Converte o payload de `player_state_changed` do SDK no formato interno.
export const normalizeSdkState = (state) => {
  const track = normalizeTrack(state?.track_window?.current_track)
  if (!track) return null
  return {
    track,
    position: state?.position ?? 0,
    duration: state?.duration ?? track.duration ?? 0,
    playing: state?.paused === false,
  }
}

// Converte o payload REST (`/me/player`) no formato interno.
export const normalizeRestState = (state) => {
  const track = normalizeTrack(state?.item)
  if (!track) return null
  return {
    track,
    position: state?.progress_ms ?? 0,
    duration: track.duration ?? 0,
    playing: Boolean(state?.is_playing),
  }
}

// Decide a fonte de verdade: os eventos do SDK só valem quando o dispositivo do
// app é o que está ativo na conta (o REST informa o `device.id` ativo). Sem essa
// confirmação — ou sem evento com faixa — cai no REST.
export const resolveNowPlayingSource = ({ sdkState, restState, appDeviceId }) => {
  const appDeviceActive = isAppDevice(restState?.device, appDeviceId)
  if (appDeviceActive && normalizeSdkState(sdkState)) return 'sdk'
  if (normalizeRestState(restState)) return 'rest'
  return null
}

// Resolve o "agora tocando" a partir da fonte de verdade escolhida. Cada fonte
// tem o seu normalizador; a escolha vem de `resolveNowPlayingSource`.
const NORMALIZE_BY_SOURCE = {
  sdk: (input) => normalizeSdkState(input.sdkState),
  rest: (input) => normalizeRestState(input.restState),
}

export const resolveNowPlaying = (input) => {
  const source = resolveNowPlayingSource(input)
  if (!source) return null
  return { source, ...NORMALIZE_BY_SOURCE[source](input) }
}

// Só os metadados que a faixa ainda não traz (popularidade/data de lançamento).
const missingMetadataFields = (track) =>
  track ? METADATA_FIELDS.filter((field) => track[field] == null) : []

// Extrai apenas os metadados relevantes de um objeto de faixa/metadados.
const pickMetadata = (source) => {
  const picked = {}
  if (!source) return picked
  for (const field of METADATA_FIELDS) {
    if (source[field] != null) picked[field] = source[field]
  }
  return picked
}

// Combina metadados na faixa sem mutar a entrada e sem sobrescrever o que já
// existe (o que veio do REST é mais autoritativo que uma busca avulsa).
const applyTrackMetadata = (track, metadata) => {
  if (!track || !metadata) return track
  const missing = missingMetadataFields(track)
  if (missing.length === 0) return track

  const merged = { ...track }
  let changed = false
  for (const field of missing) {
    if (metadata[field] != null) {
      merged[field] = metadata[field]
      changed = true
    }
  }
  return changed ? merged : track
}

// Decide se vale buscar os metadados desta faixa: só quando ainda falta algum
// campo que o cache também não cobre. A faixa vinda do REST já chega completa.
export const shouldFetchTrackMetadata = (track, cache) => {
  if (!track?.id) return false
  const cached = cache?.get(track.id) ?? null
  return missingMetadataFields(track).some((field) => cached?.[field] == null)
}

// Regra de merge/cache: reaproveita o que já está no cache, combina os
// metadados recém-buscados e guarda o resultado para as próximas aparições da
// mesma faixa — buscando cada faixa uma única vez por sessão.
export const resolveTrackMetadata = (track, { cache, metadata } = {}) => {
  if (!track?.id) return track
  const cached = cache?.get(track.id) ?? null
  const resolved = applyTrackMetadata(applyTrackMetadata(track, cached), metadata)
  if (cache && metadata) {
    const merged = { ...pickMetadata(cached), ...pickMetadata(metadata) }
    if (Object.keys(merged).length > 0) cache.set(track.id, merged)
  }
  return resolved
}

// Cache em memória, por identificador de faixa. Metadados de faixa não mudam
// durante a sessão; o cache evita rebuscar a cada evento do SDK.
export const createTrackMetadataCache = () => {
  const entries = new Map()
  return {
    get: (trackId) => (trackId && entries.has(trackId) ? entries.get(trackId) : null),
    set: (trackId, metadata) => {
      if (trackId) entries.set(trackId, metadata)
    },
    has: (trackId) => Boolean(trackId) && entries.has(trackId),
    clear: () => entries.clear(),
    get size() {
      return entries.size
    },
  }
}
