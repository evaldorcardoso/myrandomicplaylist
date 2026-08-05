import { useGeneral } from '@/support/spotifyApi'
import { usePlaylistStore } from '@/stores/playlist'
import { supabase } from '@/support/supabaseClient'
import { invalidateOccupancy } from '@/support/occupancyCache'
import { useUserStore } from '../stores/user'
import { useSettingsStore } from '@/stores/settings'

export function PlaylistService() {
    const playlistStore = usePlaylistStore()
    const userStore = useUserStore()
    const { getArtists } = useGeneral()
    
    const hasChangedFromDatabase = async (playlist) => {
        const trackedPlaylist = await playlistStore.getPlaylist(playlist.id)

        if (!trackedPlaylist?.tracked) {
            return false
        }
        if (trackedPlaylist.name !== playlist.name) {
            return true
        }
        const imageId = playlist.images[0].url.split('/').pop();
        const databaseImageId = trackedPlaylist.image.split('/').pop();
        if (databaseImageId !== imageId) {
            return true
        }
        return false
    }

    const hasSilentChangesFromDatabase = async (playlist) => {
        const trackedPlaylist = await playlistStore.getPlaylist(playlist.id)

        if (!trackedPlaylist?.tracked) {
            return false
        }
        if ((trackedPlaylist) && (trackedPlaylist.items !== playlist.tracks.total)) {
            return true
        }
        return false
    }

    const updatePlaylistTotalTracks = async(playlistId, totalTracks) => {
        const { data, error } = await supabase
            .from('playlists')
            .update({ items: totalTracks })
            .eq('id', playlistId)
            .select()
        if (error) {
            console.error(error.message)
            return false
        }
        console.log('Updated totalTracks on supabase')
        return true
    }

    const savePlaylist = async(spotifyPlaylist) => {
        var payload = {
            name: spotifyPlaylist.name,
            image: spotifyPlaylist.images[0].url,
            items: spotifyPlaylist.tracks.total ?? spotifyPlaylist.tracks.length,
        }
        const genres = await playlistStore.getTopGenres(spotifyPlaylist.id)
        if (genres) {
            payload.genres = genres
        }
        const topArtists = await playlistStore.getTopArtists(spotifyPlaylist.id)
        if (genres) {
            payload.top_artists = topArtists
        }
        const ps = await playlistStore.getPlaylist(spotifyPlaylist.id) 
        const trackedPlaylist = ps?.tracked ?? false
        if (!trackedPlaylist) {
            payload.id = spotifyPlaylist.id
            const { data, error } = await supabase
                .from('playlists')
                .insert([
                    payload
                ])
                .select()
            if (error) {
                console.error(error.message)
                return false
            }
            console.log('Inserted on supabase:')
            console.log(data)
            try {
                data[0].isOwner = true
                data[0].owner = { display_name: userStore.getUser.display_name }
                data[0].tracked = true
                playlistStore.load(data[0])
                return true
            } catch (error) {
                console.error('Error on save playlist to Store')
                console.error(error)
                return false
            }
        }
        const { data, error } = await supabase
            .from('playlists')
            .update(payload)
            .eq('id', spotifyPlaylist.id)
            .select()
        if (error) {
            console.error(error.message)
            return false
        }
        console.log('Updated on supabase:')
        console.log(data)
        return true
    }

    const loadAllFromDatabase = async() => {
        const { data, error } = await supabase
            .from('playlists')
            .select('*')
            .order('order', { ascending: true, nullsFirst: false })
            .order('name', { ascending: true })
        
        if (error) {
            console.error(error.message)
            return false
        }

        data.forEach((item) => {
            item.isOwner = true
            item.owner = { display_name: userStore.getUser?.display_name }
            item.tracked = true
            item.topArtists = JSON.parse(item.top_artists)
            item.genres = JSON.parse(item.genres)
        })

        return data;
    }

    const removeFromDatabase = async(playlistId) => {
        const relatedTables = [
            'track_requests',
            'track_popularity',
            'playlists_statistics',
            'price_positions'
        ]

        for (const table of relatedTables) {
            const { error } = await supabase
                .from(table)
                .delete()
                .eq('playlist_id', playlistId)
            if (error) {
                console.error(error.message)
                return false
            }
        }

        const { error } = await supabase
            .from('playlists')
            .delete()
            .eq('id', playlistId)
        if (error) {
            console.error(error.message)
            return false
        }

        invalidateOccupancy()
        return true
    }

    const getGenres = async(artists) => {
        const uniqueArtistIds = new Set();
        const settingsStore = useSettingsStore()
        const batchSize = settingsStore.getSessionSetting('artistsBatchSize')
    
        artists.forEach(artist => {
            const artistId = artist.id;
            uniqueArtistIds.add(artistId);
        });
    
        const allArtistIds = Array.from(uniqueArtistIds);
        let allArtistsDetails = [];
        
        for (let i = 0; i < allArtistIds.length; i += batchSize) {
            const idsBatch = allArtistIds.slice(i, i + batchSize).join(',');
            const artistsBatch = await getArtists(idsBatch);
            allArtistsDetails = allArtistsDetails.concat(artistsBatch);
        }
    
        const genreCount = {};    
        allArtistsDetails.forEach(artist => {
            if (artist.genres && Array.isArray(artist.genres)) {
                artist.genres.forEach(genre => {
                    genreCount[genre] = (genreCount[genre] || 0) + 1;
                });
            }
        });
        
        const topGenresCount = settingsStore.getSessionSetting('topGenresCount')
        const topGenres = Object.entries(genreCount)
            .map(([genre, count]) => ({ genre, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, topGenresCount);
    
        return topGenres
    }

    return {
        hasChangedFromDatabase,
        hasSilentChangesFromDatabase,
        savePlaylist,
        updatePlaylistTotalTracks,
        loadAllFromDatabase,
        removeFromDatabase,
        getGenres
    }
}