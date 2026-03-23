import axios from 'axios'
import helpers, { LOCALSTORAGE_KEYS } from './support/helpers'

async function refreshAccessToken() {
    const { refreshToken: storedRefreshToken } = helpers.getLocalStorage()
    const data = {
        grant_type: "refresh_token",
        refresh_token: storedRefreshToken,
    }
    const options = {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${window.btoa(`${import.meta.env.VITE_SPOTIFY_CLIENT_ID}:${import.meta.env.VITE_SPOTIFY_CLIENT_SECRET}`)}`,
        },
        body: new URLSearchParams(data),
    }
    const response = await fetch("https://accounts.spotify.com/api/token", options)
    if (response.status == 400) {
        helpers.logout()
        window.location.href = '/login'
        setTimeout(() => { window.location.reload() }, 100)
        return
    }
    const { access_token, expires_in } = await response.json()
    const tokenExpiresIn = Date.now() + (expires_in - 400) * 3600
    helpers.setLocalStorage(LOCALSTORAGE_KEYS.accessToken, access_token)
    helpers.setLocalStorage(LOCALSTORAGE_KEYS.expireTime, tokenExpiresIn)
}

export default {
	install(app) {
        const { accessToken, expireTime } = helpers.getLocalStorage()
		const useAxios = axios.create({
			baseURL: import.meta.env.VITE_API_URL,
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
		});

		if (accessToken !== null && accessToken !== undefined) {
			useAxios.interceptors.response.use(async config => {
				if (Date.now() > expireTime) {
					await refreshAccessToken();
					const { accessToken } = helpers.getLocalStorage()
					config.headers["Authorization"] = `Bearer ${accessToken}`;
				}
				return config;
			},
			async (error) => {
				if (error.response.status === 401) {
					await refreshAccessToken();
					const config = error.config;
					config.headers["Authorization"] = `Bearer ${accessToken}`;
					return useAxios(config);
				}
				return Promise.reject(error);
			});
		}

		app.provide("useAxios", useAxios);
	},
};