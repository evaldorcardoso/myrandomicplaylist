import axios from 'axios'
import { getSpotifyToken, reauthenticate, requiresReauth } from './support/spotifyToken'

let axiosInstance = null

export function getAxios() {
    return axiosInstance
}

export default {
	install(app) {
		const useAxios = axios.create({
			baseURL: import.meta.env.VITE_API_URL,
			headers: {
				"Content-Type": "application/json",
			},
		});

		// O access token do Spotify é renovado server-side (Edge Function) e
		// injetado a cada requisição — o navegador não guarda mais o segredo.
		useAxios.interceptors.request.use(async config => {
			try {
				const accessToken = await getSpotifyToken()
				config.headers["Authorization"] = `Bearer ${accessToken}`
			} catch (error) {
				if (requiresReauth(error)) {
					await reauthenticate()
				}
				throw error
			}
			return config
		})

		// 401 do Spotify: o token pode ter expirado entre o cache e o uso.
		// Força uma renovação e repete a requisição uma única vez.
		useAxios.interceptors.response.use(
			response => response,
			async (error) => {
				const originalRequest = error.config
				if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
					originalRequest._retry = true
					try {
						const accessToken = await getSpotifyToken({ force: true })
						originalRequest.headers["Authorization"] = `Bearer ${accessToken}`
						return useAxios(originalRequest)
					} catch (refreshError) {
						if (requiresReauth(refreshError)) {
							await reauthenticate()
						}
						return Promise.reject(error)
					}
				}
				return Promise.reject(error)
			}
		)

		axiosInstance = useAxios
		app.provide("useAxios", useAxios)
	},
}
