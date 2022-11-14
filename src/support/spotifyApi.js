import axios from "axios";

export default {
      authorize: async(clientId, clientSecret, formData) => (
        (await axios
            .post(`https://accounts.spotify.com/api/token`, formData, {
              headers: {
                Authorization: 'Basic ' + btoa(`${clientId}:${clientSecret}`),
                "Content-type": "application/x-www-form-urlencoded"
              }
            })
        ).data
    ),
    getAuthorizeUrl: () => (
      `https://accounts.spotify.com/authorize?` +
      `client_id=${import.meta.env.VITE_SPOTIFY_CLIENT_ID}` +
      `&response_type=code` +
      `&redirect_uri=${window.location.origin}` +
      `&scope=user-read-private user-read-email playlist-read-private playlist-modify-public playlist-modify-private user-read-playback-state user-modify-playback-state user-top-read` +
      `&state=34fFs29kd09`
    ),
    getPlaylists: async (accessToken) => (
        (await axios
            .get('https://api.spotify.com/v1/me/playlists?limit=50', {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            })
        ).data
    ),
    getProfile: async(accessToken) => (
        (await axios
            .get('https://api.spotify.com/v1/me', {
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            })
        ).data
    ),
    getRecommendations: async(accessToken) => (
      (await axios
          .get('https://api.spotify.com/v1/recommendations', {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          })
      ).data
    ),
    getTracks: async (accessToken, playlistId) => (
      (await axios
          .get(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
              headers: {
                  Authorization: `Bearer ${accessToken}`
              }
          })
      ).data
    ),
    getDevices: async(accessToken) => (
        (await axios
            .get('https://api.spotify.com/v1/me/player/devices', {
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            })
        ).data
    ),
    getPlaybackState: async(accessToken) => (
        (await axios
            .get('https://api.spotify.com/v1/me/player', {
              headers: { Authorization: `Bearer ${accessToken}` }
            })
        ).data
    ),
    getUserRecommendations: async(accessToken, topTracks) => (
      (await axios
        .get(`https://api.spotify.com/v1/recommendations?seed_tracks=${topTracks}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
      ).data.tracks
    ),
    getUserTopItens: async(accessToken, limit = 10) => (
      (await axios
        .get(`https://api.spotify.com/v1/me/top/tracks?limit=${limit}&time_range=short_term`, {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        })
      ).data.items
    ),
    startResumePlayback: async(accessToken) => (
        (await axios
            .put(`https://api.spotify.com/v1/me/player/play`, {}, {
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            })
        ).data
    ),
    skipToNext: async(accessToken) => (
        (await axios
            .post(`https://api.spotify.com/v1/me/player/next`, {}, {
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            })
        ).data
    ),
    transferPlayback: async(accessToken, formData) => (
        (await axios
            .put(`https://api.spotify.com/v1/me/player`, JSON.stringify(formData), {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-type": "application/json"
                }
            })
        ).data
    ),
    savePlaylist: async(accessToken, userId, formData) => (
        (await axios
            .post(`https://api.spotify.com/v1/users/${userId}/playlists`, JSON.stringify(formData), {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-type": "application/json"
              }
            })
        ).data
    ),
    addTracksToPlaylist: async(accessToken, playlistId, formData) => (
        (await axios
            .post(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, JSON.stringify(formData), {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-type": "application/json"
              }
            })
        ).data
    ),
    addTrackToQueue: async(accessToken, track) => (        
        (await axios
            .post(`https://api.spotify.com/v1/me/player/queue?uri=${track}`, null, {
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            })
        ).data
    ),
    executePlaylist: async(accessToken, formData) => (
        (await axios
            .put(`https://api.spotify.com/v1/me/player/play`, JSON.stringify(formData), {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-type": "application/json"
              }
            })
        ).data
    ),
    getRefreshedToken: async(formData, clientId, clientSecret) => (
        (await axios
            .post('https://accounts.spotify.com/api/token', formData, {
                headers: {
                //Authorization: 'Basic ' + btoa(`${client_id}:${client_secret}`),
                Authorization: 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
                "Content-type": "application/x-www-form-urlencoded"
                }
            })
        ).data
    ),
}
