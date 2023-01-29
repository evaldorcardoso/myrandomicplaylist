import { inject } from "vue"

export function useProfile() {
    const $axios = inject("useAxios")

    const getProfile = async () => {
        return $axios
            .get(`${import.meta.env.VITE_API_URL}/me`)
    }

    const getTopItens = async(limit = 10) => {
        return $axios
            .get(`${import.meta.env.VITE_API_URL}/me/top/tracks?limit=${limit}&time_range=short_term`)
    }

    const getRecommendations = async(topTracks) => {
        return $axios
            .get(`${import.meta.env.VITE_API_URL}/recommendations?seed_tracks=${topTracks}`)
    }

    const getPlaylists = async() => {
        return $axios
            .get(`${import.meta.env.VITE_API_URL}/me/playlists?limit=50`)
    }

    const executePlaylist = async(formData) => {
        return $axios
            .put(`${import.meta.env.VITE_API_URL}/me/player/play`, JSON.stringify(formData))
    }

    const getPlaybackState = async() => {
        return $axios
            .get(`${import.meta.env.VITE_API_URL}/me/player`)
    }

    const getDevices = async() => {
        return $axios
            .get(`${import.meta.env.VITE_API_URL}/me/player/devices`)
    }

    const transferPlayback = async(formData) => {
        return $axios
            .put(`${import.meta.env.VITE_API_URL}/me/player`, JSON.stringify(formData))
    }

    const skipToNext = async() => {
        return $axios
            .post(`${import.meta.env.VITE_API_URL}/me/player/next`, {})
    }

    const skipToPrevious = async() => {
        return $axios
            .post(`${import.meta.env.VITE_API_URL}/me/player/previous`, {})
    }

    const startResumePlayback = async() => {
        return $axios
            .put(`${import.meta.env.VITE_API_URL}/me/player/play`, {})
    }

    const pausePlayback = async() => {
        return $axios
            .put(`${import.meta.env.VITE_API_URL}/me/player/pause`, {})
    }

    const addTrackToQueue = async(track) => {        
        return $axios
            .post(`${import.meta.env.VITE_API_URL}/me/player/queue?uri=${track}`, null)
    }
    
    return { 
        getProfile, 
        getTopItens, 
        getRecommendations,
        getPlaylists,
        executePlaylist,
        getPlaybackState,
        getDevices,
        transferPlayback,
        skipToNext,
        skipToPrevious,
        startResumePlayback,
        addTrackToQueue,
        pausePlayback
    }
}

export function useGeneral() {
    const $axios = inject("useAxios")

    const getPlaylist = async (playlistId) => {
        return $axios
            .get(`${import.meta.env.VITE_API_URL}/playlists/${playlistId}`)
    }
    
    const getTracks = async (playlistId) => {
        return $axios
            .get(`${import.meta.env.VITE_API_URL}/playlists/${playlistId}/tracks`)
    }

    const addTracksToPlaylist = async(playlistId, formData) => {
        return $axios
            .post(`${import.meta.env.VITE_API_URL}/playlists/${playlistId}/tracks`, JSON.stringify(formData))
    }

    const savePlaylist = async(userId, formData) => {
        return $axios
            .post(`${import.meta.env.VITE_API_URL}/users/${userId}/playlists`, JSON.stringify(formData))
    }

    return {
        getPlaylist,
        getTracks,
        addTracksToPlaylist,
        savePlaylist
    }
}
