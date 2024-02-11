import { defineStore } from "pinia"

export const useUserStore = defineStore({
    id: 'user',
    state: () => ({
        user: null,
        tracks: []
    }),
    getters: {
        isLogged: (state) => state.user !== null,
        isTracksLoaded: (state) => state.tracks.length > 0
    },
    actions: {
        setUser(user) {
            this.user = user
        },
        clearUser() {
            this.user = null
        },
        loadAllTracks(tracks) {
            this.tracks = tracks
        },
        loadTrack(track) {
            const index = this.tracks.findIndex(element => element.id === track.id)

            (index >= 0) ? this.playlist[index] = track : this.tracks.push(track)            
        },
        removeTrack(track) {
            const index = this.tracks.findIndex(element => element.id === track.id)

            (index >= 0) ? this.tracks.splice(index, 1) : null
        },
        getTrack(trackId) {
            return this.tracks.find(element => element.track_id === trackId)
        },
        getTracks() {
            return this.tracks
        }
    }
})