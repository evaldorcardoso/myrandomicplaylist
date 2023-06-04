import { defineStore } from "pinia"

export const usePlaylistStore = defineStore({
    id: 'playlist',
    state: () => ({
        playlists: []
    }),
    getters: {
        isLoaded: (state) => state.playlists.length > 0
    },
    actions: {
        loadAll(playlists) {
            this.playlists = playlists
        },
        load(playlist) {
            const index = this.playlists.findIndex(element => element.id === playlist.id)

            if (index === -1) {
                this.playlists.push(playlist)
                return
            }

            this.playlists[index] = playlist
        },
        async loadTracks(playlistId, tracks) {
            const index = this.playlists.findIndex(element => element.id === playlistId)

            if (index === -1) {
                return
            }

            this.playlists[index].tracks = tracks
        },
        removeTrack(playlistId, trackUri) {
            const index = this.playlists.findIndex(element => element.id === playlistId)
            if (index === -1) { return }

            this.playlists[index].tracks
            this.playlists[index].tracks = this.playlists[index].tracks.filter(function(track) {
                return track.track.uri !== trackUri
            })
        },
        async getTracks(playlistId) {
            const playlist = this.playlists.find(element => element.id === playlistId)
            
            if (! playlist) { return null }

            if ((!Array.isArray(playlist.tracks)) || playlist.tracks.length === 0) {
                return []
            }

            return playlist.tracks
        },
        async getPlaylist(playlistId) {
            const playlist = this.playlists.find(element => element.id === playlistId)

            if (! playlist) {
                return null
            }            

            return playlist
        }
    }
})