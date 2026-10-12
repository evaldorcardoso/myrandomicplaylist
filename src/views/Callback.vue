<script setup>
	import { onMounted } from "vue"
	import { useRouter } from "vue-router"
	import { supabase } from '../support/supabaseClient'
	import { storeProviderRefreshToken } from '../support/spotifyToken'

	const router = useRouter()

	// Esta carga de página veio do callback do OAuth? Lido antes de o supabase-js
	// inicializar a sessão e limpar a URL (o provider_refresh_token só aparece aqui).
	const cameFromOAuthCallback = (() => {
		const url = `${window.location.search}${window.location.hash}`
		return url.includes('access_token=') || url.includes('code=')
	})()

	onMounted(async () => {
		try {
			const { data: { session }, error } = await supabase.auth.getSession()
			if (error || !session) {
				router.replace({ name: 'Login' })
				return
			}

			if (cameFromOAuthCallback && session.provider_refresh_token) {
				// A credencial de longa duração fica só no servidor.
				await storeProviderRefreshToken(session.provider_refresh_token)
			} else if (cameFromOAuthCallback) {
				console.error('O Spotify não retornou provider_refresh_token; será preciso autorizar novamente na primeira renovação.')
			}

			// Navegação única: o redirect anterior acontecia aqui e de novo no
			// composable de token.
			router.replace({ name: 'Home' })
		} catch (error) {
			console.error('Falha ao concluir o login:', error)
			router.replace({ name: 'Login' })
		}
	});
</script>

<template></template>
