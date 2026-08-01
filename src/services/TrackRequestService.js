import { supabase } from '@/support/supabaseClient'

const TRACK_REQUESTS_TABLE = 'track_requests'
const REQUESTERS_TABLE = 'requesters'

export function TrackRequestService() {
    const getTrackRequests = async (playlistId) => {
        const { data, error } = await supabase
            .from(TRACK_REQUESTS_TABLE)
            .select('*, requesters(name, curator)')
            .eq('playlist_id', playlistId)

        if (error) {
            console.error(error.message)
            return []
        }
        return (data ?? []).map(request => ({
            ...request,
            requester_name: request.requesters?.name ?? null,
            curator: request.requesters?.curator ?? null
        }))
    }

    const createTrackRequest = async (payload) => {
        const { data, error } = await supabase
            .from(TRACK_REQUESTS_TABLE)
            .insert(payload)
            .select()

        if (error) {
            console.error(error.message)
            return { data: null, error }
        }
        return { data, error: null }
    }

    const updateTrackRequest = async (id, payload) => {
        const { data, error } = await supabase
            .from(TRACK_REQUESTS_TABLE)
            .update(payload)
            .eq('id', id)
            .select()

        if (error) {
            console.error(error.message)
            return { data: null, error }
        }
        return { data, error: null }
    }

    const deleteTrackRequest = async (id) => {
        const { data, error } = await supabase
            .from(TRACK_REQUESTS_TABLE)
            .delete()
            .eq('id', id)

        if (error) {
            console.error(error.message)
            return { data: null, error }
        }
        return { data, error: null }
    }

    const getRequesters = async (name) => {
        const { data, error } = await supabase
            .from(REQUESTERS_TABLE)
            .select('*')
            .ilike('name', `%${name}%`)
            .order('name', { ascending: true })
            .limit(10)

        if (error) {
            console.error(error.message)
            return []
        }
        return data ?? []
    }

    const getOrCreateRequester = async ({ name, curator }) => {
        const { data: found, error: foundError } = await supabase
            .from(REQUESTERS_TABLE)
            .select('*')
            .ilike('name', name.trim())
            .limit(1)

        if (foundError) {
            console.error(foundError.message)
            return { data: null, error: foundError }
        }
        if (found?.length) {
            return { data: found[0], error: null }
        }

        const { data: created, error } = await supabase
            .from(REQUESTERS_TABLE)
            .insert({ name: name.trim(), curator: curator?.trim() || null })
            .select()

        if (error) {
            console.error(error.message)
            return { data: null, error }
        }
        return { data: created[0], error: null }
    }

    return {
        getTrackRequests,
        createTrackRequest,
        updateTrackRequest,
        deleteTrackRequest,
        getRequesters,
        getOrCreateRequester
    }
}
