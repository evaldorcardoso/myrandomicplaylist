<script setup>
  import { onMounted, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import helpers from '../support/helpers'
  import { LOCALSTORAGE_KEYS } from '../support/helpers'
  import spotifyApi from '../support/spotifyApi'

  const msg = ref('Gerador de playlist aleatória do')

  const state = reactive({    
    user: null,
    message: '',
    version: '',
  })

  const router = useRouter()
  
  const hasTokenExpired = () => {
    const { accessToken, timestamp, expireTime } = helpers.getLocalStorage()
    if(!accessToken || !timestamp || !expireTime){
      return true      
    }    
    const millisecondsElapsed = Date.now() - Number(timestamp)
    if ((millisecondsElapsed / 1000) > Number(expireTime)) {
      authorize();
      return true;
    }
    
    return false;
  }

  const buildAuthorizeRequest = () => {
    let code = helpers.getLocalStorage().code
    //the parameters encoded in application/x-www-form-urlencoded:
    const formData = new URLSearchParams()
    formData.append('grant_type', 'authorization_code')
    formData.append('code', code)
    formData.append('redirect_uri', window.location.origin)
    
    return formData
  }

  const authorize = () => {
    window.location.href = spotifyApi.getAuthorizeUrl() //url + query    
  }

  const openLink = (url) => {
    window.open(url, '_blank')
  }

  onMounted(async () => {
    state.version = import.meta.env.PACKAGE_VERSION
    
    var params = window.location.search.substr(1)
    if(params){
      params = params.split('&')
      params = params.map(param => {
        param = param.split('=')      
        return {
          key: param[0],
          value: param[1]
        }
      })

      params = params.reduce((acc, param) => {
        acc[param.key] = param.value
        return acc
      }, {}) 
      if(params.code){
        helpers.setLocalStorage(LOCALSTORAGE_KEYS.code, params.code)
        const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID
        const clientSecret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET
        try {
          const data = await spotifyApi.authorize(clientId, clientSecret, buildAuthorizeRequest())          
          helpers.setLocalStorage(LOCALSTORAGE_KEYS.accessToken, data.access_token)
          helpers.setLocalStorage(LOCALSTORAGE_KEYS.refreshToken, data.refresh_token)        
          helpers.setLocalStorage(LOCALSTORAGE_KEYS.expireTime, data.expires_in)
          helpers.setLocalStorage(LOCALSTORAGE_KEYS.timestamp, Date.now())            
        } catch(error) {
          console.log(error)
        }
      }      
    }

    if(!hasTokenExpired()){
        router.push('/home')
    }
  })

</script>

<template>
  <h2 class="center" style="margin-top: 50px;color:#fff">{{ msg }}</h2>
  <p>
    <div class="login">      
      <img alt="Vue logo" src="../assets/Spotify_Logo_RGB_White.png" />
      <p class="span-login">Para começar, você precisa se autenticar com o Spotify</p>
      <a href="#" @click.prevent="authorize()">
        <button class="but-login">Entrar com Spotify</button>        
      </a>      
    </div>
    <div class="footer">
      <p class="center span-login">{{ state.version }}</p>
      <img class="center" alt="evaldorc" src="https://www.evaldorc.com.br/assets/images/marca_w.png" @click="openLink('https://evaldorc.com.br')"/>
    </div>
  </p>
  <br/>
</template>

<style scoped>
.page{
  height: 50%;
}
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
