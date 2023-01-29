import { useRouter } from "vue-router"
import helpers from '../support/helpers'
import { LOCALSTORAGE_KEYS } from '../support/helpers'

export function useRequestToken() {
    const router = useRouter();
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET;
    const redirectUri = window.location.origin + '/callback'

    const requestToken = async () => {
        const authorizationCode = router.currentRoute.value.query.code;
        if (!authorizationCode) return;
        const data = {
            grant_type: "authorization_code",
            code: authorizationCode,
            redirect_uri: redirectUri,
        };

        const options = {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${window.btoa(
                    `${clientId}:${clientSecret}`
                )}`,
            },
            body: new URLSearchParams(data),
        };

        const response = await fetch(
            "https://accounts.spotify.com/api/token",
            options
        );
        const { access_token, expires_in, refresh_token } = await response.json();
        helpers.setLocalStorage(LOCALSTORAGE_KEYS.accessToken, access_token)
        helpers.setLocalStorage(LOCALSTORAGE_KEYS.refreshToken, refresh_token)
        const tokenExpiresIn = Date.now() + (expires_in - 400) * 3600;       
        helpers.setLocalStorage(LOCALSTORAGE_KEYS.expireTime, tokenExpiresIn)
        router.push('/')
        setTimeout(() => {
            window.location.reload()
        }, 100)
    };

    const refreshToken = async () => {
        console.log('refreshtoken')
        const { refreshToken } = helpers.getLocalStorage()
        const data = {
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        };

        const options = {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${window.btoa(
                    `${clientId}:${clientSecret}`
                )}`,
            },
            body: new URLSearchParams(data),
        };

        const response = await fetch(
            "https://accounts.spotify.com/api/token",
            options
        );
        const { access_token, expires_in } = await response.json();
        const tokenExpiresIn = Date.now() + (expires_in - 400) * 3600;
        helpers.setLocalStorage(LOCALSTORAGE_KEYS.accessToken, access_token)
        helpers.setLocalStorage(LOCALSTORAGE_KEYS.expireTime, tokenExpiresIn)
        setTimeout(() => {
            window.location.reload()
        }, 100)
    };

    return { requestToken, refreshToken };
}
