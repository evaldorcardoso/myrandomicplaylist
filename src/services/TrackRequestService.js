import { supabase } from '@/support/supabaseClient'

const TRACK_REQUESTS_TABLE = 'track_requests'

export function TrackRequestService() {
    const getTrackRequests = async (playlistId) => {
        const { data, error } = await supabase
            .from(TRACK_REQUESTS_TABLE)
            .select('*')
            .eq('playlist_id', playlistId)

        if (error) {
            console.error(error.message)
            return []
        }
        return data ?? []
    }

    return {
        getTrackRequests
    }
}
