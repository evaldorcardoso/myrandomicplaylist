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
        var offset = 0
        var total = 0
        var playlists = []
        while (playlists.length < total || offset == 0) {
            let { data } = await $axios
                .get(`${import.meta.env.VITE_API_URL}/me/playlists?limit=50&offset=${offset}`)
            total = data.total
            playlists = playlists.concat(data.items)
            offset += 50
        }

        return playlists
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
    
    const getTrack = async (trackId) => {
        return await $axios
            .get(`${import.meta.env.VITE_API_URL}/tracks/${trackId}`)            
    }

    const getTracks = async (playlistId) => {
        var offset = 0
        var total = 0
        var tracks = []
        while (tracks.length < total || offset == 0) {
            let { data } = await $axios
                .get(`${import.meta.env.VITE_API_URL}/playlists/${playlistId}/tracks?limit=100&offset=${offset}`)
            total = data.total
            tracks = tracks.concat(data.items)
            offset += 100
        }

        return tracks
    }

    const addTracksToPlaylist = async(playlistId, formData) => {
        return $axios
            .post(`${import.meta.env.VITE_API_URL}/playlists/${playlistId}/tracks`, JSON.stringify(formData))
    }

    const updateTracksOfPlaylist = async(playlistId, formData) => {
        return $axios
            .put(`${import.meta.env.VITE_API_URL}/playlists/${playlistId}/tracks`, JSON.stringify(formData))
    }

    const removeTracksOfPlaylist = async(playlistId, formData) => {
        return $axios
            .delete(`${import.meta.env.VITE_API_URL}/playlists/${playlistId}/tracks`, { data: JSON.stringify(formData)})
    }

    const savePlaylist = async(userId, formData) => {
        return $axios
            .post(`${import.meta.env.VITE_API_URL}/users/${userId}/playlists`, JSON.stringify(formData))
    }

    const getArtists = async(ids) => {
        let { data } = await $axios
            .get(`${import.meta.env.VITE_API_URL}/artists?ids=${ids}`)
        
        return data.artists
    }

    return {
        getPlaylist,
        getTrack,
        getTracks,
        addTracksToPlaylist,
        updateTracksOfPlaylist,
        removeTracksOfPlaylist,
        savePlaylist,
        getArtists
    }
}
