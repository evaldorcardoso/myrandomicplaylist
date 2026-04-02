import axios from 'axios'
import helpers, { LOCALSTORAGE_KEYS } from './support/helpers'

let isRefreshing = false
let refreshSubscribers = []

function subscribeTokenRefresh(callback) {
    refreshSubscribers.push(callback)
}

function onTokenRefreshed(accessToken) {
    refreshSubscribers.forEach(callback => callback(accessToken))
    refreshSubscribers = []
}

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
    if (response.status == 400 || response.status == 401) {
        helpers.logout()
        window.location.href = '/login'
        setTimeout(() => { window.location.reload() }, 100)
        return false
    }
    const { access_token, expires_in } = await response.json()
    const tokenExpiresIn = Date.now() + (expires_in - 400) * 1000
    helpers.setLocalStorage(LOCALSTORAGE_KEYS.accessToken, access_token)
    helpers.setLocalStorage(LOCALSTORAGE_KEYS.expireTime, tokenExpiresIn)
    return access_token
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
            useAxios.interceptors.request.use(async config => {
                if (Date.now() > expireTime) {
                    if (!isRefreshing) {
                        isRefreshing = true
                        try {
                            const newToken = await refreshAccessToken()
                            if (newToken) {
                                onTokenRefreshed(newToken)
                            }
                        } finally {
                            isRefreshing = false
                        }
                    } else {
                        await new Promise(resolve => {
                            subscribeTokenRefresh(token => {
                                config.headers["Authorization"] = `Bearer ${token}`
                                resolve()
                            })
                        })
                    }
                }
                return config
            })

			useAxios.interceptors.response.use(
                response => response,
                async (error) => {
			        const originalRequest = error.config
                    if (error.response?.status === 401 && !originalRequest._retry) {
                        originalRequest._retry = true
                        if (!isRefreshing) {
                            isRefreshing = true
                            try {
                                const newToken = await refreshAccessToken()
                                if (newToken) {
                                    originalRequest.headers["Authorization"] = `Bearer ${newToken}`
                                    return useAxios(originalRequest)
                                }
                            } finally {
                                isRefreshing = false
                            }
                        } else {
                            return new Promise(resolve => {
                                subscribeTokenRefresh(token => {
                                    originalRequest.headers["Authorization"] = `Bearer ${token}`
                                    resolve(useAxios(originalRequest))
                                })
                            })
                        }
                    }
                    return Promise.reject(error)
                }
            )
		}

		app.provide("useAxios", useAxios)
	},
}