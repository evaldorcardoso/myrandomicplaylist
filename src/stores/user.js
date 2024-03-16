import { defineStore } from "pinia"
import helpers, { LOCALSTORAGE_KEYS } from "../support/helpers"

export const useUserStore = defineStore({
    id: 'user',
    state: () => ({
        user: null,
        tracks: []
    }),
    getters: {
        isLogged: (state) => state.user !== null,
        isTracksLoaded: (state) => state.tracks.length > 0,
        getUser: (state) => {
            const storedState = localStorage.getItem(LOCALSTORAGE_KEYS.user)
            if (storedState) {
                state.user = JSON.parse(storedState)
            }
            return state.user
        }
    },
    actions: {
        setUser(user) {
            this.user = user
            helpers.setLocalStorage(LOCALSTORAGE_KEYS.user, JSON.stringify(user))
        },
        clearUser() {
            this.user = null
            helpers.setLocalStorage(LOCALSTORAGE_KEYS.user, null)
        },
        loadAllTracks(tracks) {
            this.tracks = tracks
        },
        loadTrack(track) {
            if (!track) return

            try {
                const index = this.tracks.findIndex(element => element.id === track?.id)
                if (index >= 0) {
                    this.playlist[index]
                    return
                }
                this.tracks.push(track)
            } catch (e) {
                console.log(e)
            }

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