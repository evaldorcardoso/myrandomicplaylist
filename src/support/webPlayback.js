// Suporte puro ao dispositivo do Web Playback SDK (#66).
//
// O SDK registra o app como um dispositivo Spotify Connect ("MR Playlist") e,
// no evento `ready`, devolve o id desse dispositivo. Este módulo só cuida da
// identificação/destaque desse item na lista de dispositivos — sem SDK, rede ou
// DOM — para manter a lógica testável e reutilizável pela UI.

export const APP_DEVICE_NAME = 'MR Playlist'

// URL oficial do script do SDK (sem nova dependência de runtime).
export const SDK_SCRIPT_URL = 'https://sdk.scdn.co/spotify-player.js'

// Verdadeiro quando o dispositivo listado é o próprio app.
export const isAppDevice = (device, appDeviceId) =>
  Boolean(device && appDeviceId && device.id === appDeviceId)

// Anota a lista de dispositivos com a marca do app, sem mutar a entrada.
export const markAppDevice = (devices, appDeviceId) =>
  (Array.isArray(devices) ? devices : []).map((device) => ({
    ...device,
    is_app_device: isAppDevice(device, appDeviceId),
  }))
