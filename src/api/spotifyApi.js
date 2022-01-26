import axios from "axios";

export default {    
    getPlaylists: async (accessToken) => (
        (await axios
            .get('https://api.spotify.com/v1/me/playlists?limit=50', {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            })).data
    )
}
