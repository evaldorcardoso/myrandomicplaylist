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
    async openSlotFromId(id) {
      if (!id) return false
      try {
        const { getTrackRequestById } = TrackRequestService()
        const { data: request, error } = await getTrackRequestById(id)
        if (error || !request) {
          console.error('Track request not found:', id)
          notify({ title: 'Ops', text: 'Não foi possível encontrar a música da notificação!', type: 'error' })
          return false
        }

        const playlistStore = usePlaylistStore()
        if (!playlistStore.isLoaded) {
          const playlists = await PlaylistService().loadAllFromDatabase()
          playlistStore.loadAll(playlists)
        }

        const playlistId = request.playlist_id
        const playlist = playlistStore.playlists.find(p => p.id === playlistId)

        const { getTracks } = useGeneral()
        let tracks = await playlistStore.getTracks(playlistId)
        if (!tracks || tracks.length === 0) {
          tracks = await getTracks(playlistId)
          playlistStore.loadTracks(playlistId, tracks)
          tracks = await playlistStore.getTracks(playlistId)
        }

        const trackId = request.track_id
        const trackIndex = tracks.findIndex(t => t.track?.id === trackId || t.id === request.position - 1)
        const trackItem = trackIndex >= 0 ? tracks[trackIndex] : null

        const expiration = {
          id: String(request.id),
          track: trackItem ? { ...trackItem, id: trackIndex } : null,
          request: {
            id: String(request.id),
            status: request.status,
            due_date: request.due_date,
            value: request.value,
            requester_id: request.requester_id,
            requester_name: request.requester_name,
            position: request.position,
            curator: request.curator,
            notified_at: request.notified_at
          },
          playlistId,
          playlist: playlist ? { id: playlist.id, name: playlist.name } : null
        }

        this.openSlot(expiration)
        return true
      } catch (error) {
        console.error('Error opening slot from ID:', error)
        notify({ title: 'Ops', text: 'Não foi possível abrir a música da notificação!', type: 'error' })
        return false
      }
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