<script setup>
	import { onBeforeMount } from "vue"
	import { useRouter } from "vue-router"
    import { useRequestToken } from "../composables/requestToken"
    import helpers from '../support/helpers'

	const router = useRouter();
    const { requestToken } = useRequestToken();

	onBeforeMount(async () => {
		try {
            await requestToken();
            const { accessToken } = helpers.getLocalStorage()
            if (accessToken) {
                console.log('tudo certo, redirecionando para inicio')
                router.push("/");
            }
		} catch (error) {
            console.log('Error on handle callback: ', error)
        }
	});
</script>

<template></template>
