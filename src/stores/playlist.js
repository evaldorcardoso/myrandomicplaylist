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
            this.playlists = [ ...this.playlists, ...playlists ]
            // this.playlists = playlists
        },
        load(playlist) {
            const index = this.playlists.findIndex(element => element.id === playlist.id)

            if (index === -1) {
                this.playlists.push(playlist)
                return
            }

            this.playlists[index] = { ...this.playlists[index], ...playlist }
        },
        async loadTracks(playlistId, tracks) {
            const index = this.playlists.findIndex(element => element.id === playlistId)

            if (index === -1) {
                return
            }

            this.playlists[index].tracks = tracks
            this.playlists[index].tracks.forEach((track, index) => {
                track.id = index
            })
        },
        async loadTopArtists(playlistId, topArtists) {
            const index = this.playlists.findIndex(element => element.id === playlistId)

            if (index === -1) {
                return
            }

            this.playlists[index].topArtists = topArtists
        },
        async getTopArtists(playlistId) {
            const playlist = this.playlists.find(element => element.id === playlistId)

            if (! playlist) { return null }

            if (! playlist.topArtists) { return null }

            if ((!Array.isArray(playlist.topArtists)) || playlist.topArtists?.length === 0) {
                return []
            }

            return playlist.topArtists
        },
        async loadTopGenres(playlistId, topGenres) {
            const index = this.playlists.findIndex(element => element.id === playlistId)

            if (index === -1) {
                return
            }

            this.playlists[index].topGenres = topGenres
        },
        async getTopGenres(playlistId) {
            const playlist = this.playlists.find(element => element.id === playlistId)

            if (! playlist) { return null }

            if (! playlist.topGenres) { return null }

            if ((!Array.isArray(playlist.topGenres)) || playlist.topGenres?.length === 0) {
                return []
            }

            return playlist.topGenres
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