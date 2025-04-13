import { useGeneral } from '@/support/spotifyApi'
import { usePlaylistStore } from '@/stores/playlist'
import { supabase } from '@/support/supabaseClient'
import { useUserStore } from '../stores/user'

export function PlaylistService() {
    const playlistStore = usePlaylistStore()
    const userStore = useUserStore()
    const { getArtists } = useGeneral()
    
    const hasChangedFromDatabase = async (playlist) => {
        // console.error(playlist)
        const trackedPlaylist = await playlistStore.getPlaylist(playlist.id)
        // console.log(trackedPlaylist)
        if (! trackedPlaylist) {
            return true
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
        // console.error(playlist)
        const trackedPlaylist = await playlistStore.getPlaylist(playlist.id)
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
            items: spotifyPlaylist.tracks.total,
        }
        const genres = await playlistStore.getTopGenres(spotifyPlaylist.id)
        if (genres) {
            payload.genres = genres
        }
        const topArtists = await playlistStore.getTopArtists(spotifyPlaylist.id)
        if (genres) {
            payload.top_artists = topArtists
        }
        console.log(payload)
        const trackedPlaylist = await playlistStore.getPlaylist(spotifyPlaylist.id)
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
            .order('name', { ascending: true })
        
        if (error) {
            console.error(error.message)
            return false
        }

        data.forEach((item) => {
            item.isOwner = true
            item.owner = { display_name: userStore.getUser.display_name }
            item.tracked = true
            item.topArtists = JSON.parse(item.top_artists)
            item.genres = JSON.parse(item.genres)
        })

        return data;
    }

    const getGenres = async(artists) => {
        const uniqueArtistIds = new Set();
    
        // Contagem de artistas e coleta de IDs únicos
        artists.forEach(artist => {
            const artistId = artist.id;
            // Adiciona o ID ao conjunto de IDs únicos
            uniqueArtistIds.add(artistId);
        });
    
        const allArtistIds = Array.from(uniqueArtistIds);
        let allArtistsDetails = [];
        
        // Processa artistas em lotes de 50 (limite da API do Spotify)
        for (let i = 0; i < allArtistIds.length; i += 50) {
            const idsBatch = allArtistIds.slice(i, i + 50).join(',');
            const artistsBatch = await getArtists(idsBatch);
            allArtistsDetails = allArtistsDetails.concat(artistsBatch);
        }
    
        const genreCount = {};    
        // Conta a ocorrência de cada gênero
        allArtistsDetails.forEach(artist => {
            if (artist.genres && Array.isArray(artist.genres)) {
                artist.genres.forEach(genre => {
                    genreCount[genre] = (genreCount[genre] || 0) + 1;
                });
            }
        });
        
        // Transforma o objeto de contagem em array, ordena e pega os principais
        const topGenres = Object.entries(genreCount)
            .map(([genre, count]) => ({ genre, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    
        return topGenres
    }

    return {
        hasChangedFromDatabase,
        hasSilentChangesFromDatabase,
        savePlaylist,
        updatePlaylistTotalTracks,
        loadAllFromDatabase,
        getGenres
    }
}