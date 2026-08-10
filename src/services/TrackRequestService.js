import { supabase } from '@/support/supabaseClient'
import { setRequester, getCachedRequester } from '@/support/requesterCuratorCache'
import { invalidateOccupancy } from '@/support/occupancyCache'

const TRACK_REQUESTS_TABLE = 'track_requests'
const REQUESTERS_TABLE = 'requesters'
const PRICE_POSITIONS_TABLE = 'price_positions'
const EARNINGS_LEDGER_TABLE = 'earnings_ledger'

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
        const requests = (data ?? []).map(request => ({
            ...request,
            requester_name: request.requesters?.name ?? null,
            curator: request.requesters?.curator ?? null
        }))
        for (const request of requests) {
            if (request.requester_name) {
                setRequester(request.requester_name, request.requester_id, request.curator)
            }
        }
        return requests
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
        invalidateOccupancy()
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
        invalidateOccupancy()
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
        invalidateOccupancy()
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
        for (const requester of data ?? []) {
            setRequester(requester.name, requester.id, requester.curator)
        }
        return data ?? []
    }

    const getRequesterByName = async (name) => {
        const cached = getCachedRequester(name)
        if (cached.cached && cached.id) {
            return { data: { id: cached.id, name: String(name ?? '').trim(), curator: cached.curator }, error: null }
        }
        if (cached.cached) {
            return { data: { name: String(name ?? '').trim(), curator: cached.curator }, error: null }
        }

        const { data, error } = await supabase
            .from(REQUESTERS_TABLE)
            .select('*')
            .ilike('name', name.trim())
            .maybeSingle()

        if (error) {
            console.error(error.message)
            return { data: null, error }
        }
        if (data) {
            setRequester(data.name, data.id, data.curator)
        }
        return { data, error: null }
    }

    const getCurators = async () => {
        const { data, error } = await supabase
            .from(REQUESTERS_TABLE)
            .select('curator')
            .not('curator', 'is', null)

        if (error) {
            console.error(error.message)
            return { data: [], error }
        }

        const counts = {}
        for (const row of data) {
            const name = (row.curator ?? '').trim()
            if (!name) continue
            counts[name] = (counts[name] ?? 0) + 1
        }

        const curators = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name]) => name)

        return { data: curators, error: null }
    }

    const getPricePositions = async (playlistId) => {
        const { data, error } = await supabase
            .from(PRICE_POSITIONS_TABLE)
            .select('id, min_position, max_position, value, color')
            .eq('playlist_id', playlistId)
            .order('min_position', { ascending: true })

        if (error) {
            console.error(error.message)
            return { data: null, error }
        }
        return { data, error: null }
    }

    const getPricePositionsWithMetadata = async (playlistId) => {
        const { data, error } = await supabase
            .from(PRICE_POSITIONS_TABLE)
            .select('*, playlists(name, image)')
            .eq('playlist_id', playlistId)

        if (error) {
            console.error(error.message)
            return { data: null, error }
        }
        const items = (data ?? []).map(item => ({
            ...item,
            playlist_name: item.playlists?.name ?? null,
            playlist_image: item.playlists?.image ?? null
        }))
        return { data: items, error: null }
    }

    const getPricePositionByRange = async (playlistId, position) => {
        const { data, error } = await supabase
            .from(PRICE_POSITIONS_TABLE)
            .select('id, min_position, max_position, value, color')
            .eq('playlist_id', playlistId)
            .lte('min_position', position)
            .gte('max_position', position)
            .maybeSingle()

        if (error) {
            console.error(error.message)
            return { data: null, error }
        }
        return { data, error: null }
    }

    const getAllPricePositions = async () => {
        const { data, error } = await supabase
            .from(PRICE_POSITIONS_TABLE)
            .select('*, playlists(name, image)')
            .order('playlist_id', { ascending: true })
            .order('min_position', { ascending: true })

        if (error) {
            console.error(error.message)
            return { data: null, error }
        }
        const items = (data ?? []).map(item => ({
            ...item,
            playlist_name: item.playlists?.name ?? null,
            playlist_image: item.playlists?.image ?? null
        }))
        return { data: items, error: null }
    }

    const updatePricePosition = async (id, payload) => {
        const { data, error } = await supabase
            .from(PRICE_POSITIONS_TABLE)
            .update(payload)
            .eq('id', id)
            .select()

        if (error) {
            console.error(error.message)
            return { data: null, error }
        }
        return { data, error: null }
    }

    const deletePricePosition = async (id) => {
        const { data, error } = await supabase
            .from(PRICE_POSITIONS_TABLE)
            .delete()
            .eq('id', id)

        if (error) {
            console.error(error.message)
            return { data: null, error }
        }
        return { data, error: null }
    }

    const getPricePosition = async (playlistId, position) => {
        return getPricePositionByRange(playlistId, position)
    }

    const createPricePosition = async ({ playlist_id, min_position, max_position, value, color }) => {
        const { data, error } = await supabase
            .from(PRICE_POSITIONS_TABLE)
            .insert({ playlist_id, min_position, max_position, value, color: color ?? null })
            .select()

        if (error) {
            console.error(error.message)
            return { data: null, error }
        }
        return { data, error: null }
    }

    const createPriceGroup = createPricePosition

    const getOrCreateRequester = async ({ name, curator }) => {
        const trimmedName = String(name ?? '').trim()
        if (!trimmedName) return { data: null, error: null }

        const cached = getCachedRequester(trimmedName)
        if (cached.cached && cached.id) {
            return { data: { id: cached.id, name: trimmedName, curator: cached.curator }, error: null }
        }

        const { data: found, error: foundError } = await supabase
            .from(REQUESTERS_TABLE)
            .select('*')
            .ilike('name', trimmedName)
            .limit(1)

        if (foundError) {
            console.error(foundError.message)
            return { data: null, error: foundError }
        }
        if (found?.length) {
            setRequester(found[0].name, found[0].id, found[0].curator)
            return { data: found[0], error: null }
        }

        const { data: created, error } = await supabase
            .from(REQUESTERS_TABLE)
            .insert({ name: trimmedName, curator: curator?.trim() || null })
            .select()

        if (error) {
            console.error(error.message)
            return { data: null, error }
        }
        setRequester(created[0].name, created[0].id, created[0].curator)
        return { data: created[0], error: null }
    }

    const recordEarning = async ({ track_request_id, playlist_id, playlist_name, track_id, track_name, requester_name, curator, amount, type }) => {
        const { data, error } = await supabase
            .from(EARNINGS_LEDGER_TABLE)
            .insert({ track_request_id, playlist_id, playlist_name, track_id, track_name, requester_name, curator, amount, type })
            .select()

        if (error) {
            console.error(error.message)
            return { data: null, error }
        }
        return { data, error: null }
    }

    const hasEarnings = async (track_request_id) => {
        const { data, error } = await supabase
            .from(EARNINGS_LEDGER_TABLE)
            .select('id')
            .eq('track_request_id', track_request_id)
            .maybeSingle()

        if (error) {
            console.error(error.message)
            return false
        }
        return !!data
    }

    return {
        getTrackRequests,
        createTrackRequest,
        updateTrackRequest,
        deleteTrackRequest,
        getRequesters,
        getRequesterByName,
        getOrCreateRequester,
        getCurators,
        getPricePositions,
        getPricePositionsWithMetadata,
        getPricePositionByRange,
        getPricePosition,
        createPricePosition,
        createPriceGroup,
        getAllPricePositions,
        updatePricePosition,
        deletePricePosition,
        recordEarning,
        hasEarnings
    }
}
