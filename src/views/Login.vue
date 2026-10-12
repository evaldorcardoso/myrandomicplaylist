<script setup>
  import { onMounted, reactive, ref } from 'vue'
  import { supabase } from '@/support/supabaseClient'

  const msg = ref('Gerador de playlist aleatória do Spotify')

  const state = reactive({
    user: null,
    message: '',
    version: '',
  })

  // Mesmos escopos do OAuth anterior (Authorization Code no frontend).
  const SPOTIFY_SCOPES = [
    'user-read-private',
    'user-read-email',
    'playlist-read-private',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-top-read',
  ].join(' ')

  const authorize = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'spotify',
      options: {
        scopes: SPOTIFY_SCOPES,
        redirectTo: `${window.location.origin}/callback`,
      },
    })
    if (error) {
      state.message = error.message
      console.error('Falha ao iniciar o login com o Spotify:', error)
    }
  }

  const openLink = (url) => {
    window.open(url, '_blank')
  }

  onMounted(async () => {
    state.version = import.meta.env.PACKAGE_VERSION
  })

</script>

<template>
  <h2 class="center" style="margin-top: 50px;color:#fff;text-align:center;">{{ msg }}</h2>
  <p>
    <div class="login">      
      <img alt="Vue logo" src="../assets/Spotify_Logo_RGB_White.png" />
      <p class="span-login">Para começar, você precisa se autenticar com o Spotify</p>
      <a href="#" @click.prevent="authorize()">
        <button class="but-login">Entrar com Spotify</button>        
      </a>      
    </div>
    <div class="footer">
      <img class="center" alt="evaldorc" src="../assets/logo_semfundo.png" @click="openLink('https://evaldorc.super.site/')" style="width: 50px;"/>
      <p class="center span-login">{{ state.version }}</p>
    </div>
  </p>
  <br/>
</template>

<style scoped>
.login{
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: auto;
}
.login img{
  width: 330px;
}
.span-login{
  font-size: 15px;
  margin-top: 40px;
  color: #fff;
}
.center{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: auto;
}
.but-login{
  margin-top: 25px;
  background-image: linear-gradient(60deg, #e0eb98, #62faf5);
  color: black;  
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
}
.footer{
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: auto;
  bottom: 65px;
  position: absolute;
  width: 100%;
}
</style>
