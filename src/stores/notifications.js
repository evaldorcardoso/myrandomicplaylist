import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import { usePlaylistStore } from '@/stores/playlist'
import { PlaylistService } from '@/services/PlaylistService'
import { DashboardService } from '@/services/DashboardService'
import { TrackRequestService } from '@/services/TrackRequestService'
import { useGeneral } from '@/support/spotifyApi'
import { notify } from "@kyvg/vue3-notification";

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    expiredTracks: [],
    loading: false,
    slotOpened: false,
    slotTrack: null,
    slotRequest: null,
    slotPlaylistId: '',
    slotPlaylist: null,
    slotRevision: 0
  }),
  getters: {
    hasExpiredTracks: (state) => state.expiredTracks.length > 0
  },
  actions: {
    async loadExpiredTracks() {
      if (this.loading) return
      this.loading = true
      try {
        const playlistStore = usePlaylistStore()
        if (!playlistStore.isLoaded) {
          const playlists = await PlaylistService().loadAllFromDatabase()
          playlistStore.loadAll(playlists)
        }
        const { expirations } = await DashboardService().loadExpirations()
        this.expiredTracks = (expirations ?? [])
          .filter(expiration => expiration.secondsLeft === 0)
          .map(expiration => markRaw(expiration))
      } catch (error) {
        console.error(error)
        this.expiredTracks = []
      } finally {
        this.loading = false
      }
    },
    openSlot(expiration) {
      this.slotTrack = expiration?.track ?? null
      this.slotRequest = expiration?.request ?? null
      this.slotPlaylistId = expiration?.playlistId ?? ''
      this.slotPlaylist = expiration?.playlist ?? null
      this.slotOpened = true
    },
    closeSlot() {
      this.slotOpened = false
      this.slotTrack = null
      this.slotRequest = null
      this.slotPlaylistId = ''
      this.slotPlaylist = null
    },
    async runSlotUpdated() {
      this.closeSlot()
      this.slotRevision++
      await this.loadExpiredTracks()
    },
    async runSlotRemoveTrack({ request, track }) {
      const playlistId = this.slotPlaylistId
      this.closeSlot()
      const { deleteTrackRequest } = TrackRequestService()
      const { removeTracksOfPlaylist } = useGeneral()
      const playlistStore = usePlaylistStore()
      try {
        if (request?.id) {
          const { error } = await deleteTrackRequest(request.id)
          if (error) throw error
        }
        if (track?.track?.uri) {
          await removeTracksOfPlaylist(playlistId, {
            tracks: [{ uri: track.track.uri }]
          })
          playlistStore.removeTrack(playlistId, track.track.uri)
        }
        this.slotRevision++
        await this.loadExpiredTracks()
      } catch (error) {
        console.error(error)
      }
    },
    async runSlotReplaceTrack({ request, track, replacement }) {
      const playlistId = this.slotPlaylistId
      this.closeSlot()
      const { deleteTrackRequest } = TrackRequestService()
      const { removeTracksOfPlaylist, getTracks, updateTracksOfPlaylist } = useGeneral()
      const playlistStore = usePlaylistStore()
      try {
        if (request?.id) {
          const { error } = await deleteTrackRequest(request.id)
          if (error) throw error
        }

        const targetUri = track?.track?.uri ?? track?.uri
        const replacementUri = replacement?.track?.uri ?? replacement?.uri

        let tracks = await playlistStore.getTracks(playlistId) ?? []
        if (tracks.length === 0) {
          playlistStore.loadTracks(playlistId, await getTracks(playlistId))
          tracks = await playlistStore.getTracks(playlistId)
        }

        const replacementTrack = tracks.find(t => (t.track?.uri ?? t.uri) === replacementUri)
        const removalTrack = tracks.find(t => (t.track?.uri ?? t.uri) === targetUri)

        if (!replacementTrack || !removalTrack) {
          notify({ title: 'Ops', text: 'Música não encontrada!', type: 'error' })
          return
        }

        const moveFormData = {
          'range_start': replacementTrack.id,
          'insert_before': removalTrack.id
        }
        await updateTracksOfPlaylist(playlistId, moveFormData)

        const updatedTracks = await getTracks(playlistId)
        const newRemovalTrack = updatedTracks.find(t => (t.track?.uri ?? t.uri) === targetUri)

        if (newRemovalTrack) {
          await removeTracksOfPlaylist(playlistId, {
            'tracks': [{ 'uri': targetUri }]
          })
        }

        playlistStore.loadTracks(playlistId, await getTracks(playlistId))

        notify({
          title: 'Alright',
          text: 'Música substituída!',
          type: 'success'
        })
        this.slotRevision++
        await this.loadExpiredTracks()
      } catch (error) {
        console.error(error)
        notify({
          title: 'Ops',
          text: 'Erro ao substituir a música!',
          type: 'error'
        })
      }
    }
  }
})