<script setup>
  import { getCurrentInstance, onMounted, computed, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'

  const msg = ref('Gerador de playlist aleatória do')

  // Map for localStorage keys
  const LOCALSTORAGE_KEYS = {
    accessToken: 'spotify_access_token',
    refreshToken: 'spotify_refresh_token',
    expireTime: 'spotify_token_expire_time',
    timestamp: 'spotify_token_timestamp',
  }

  const getLocalStorage = () =>{
    // Map to retrieve localStorage values
    const LOCALSTORAGE_VALUES = {    
      accessToken: window.localStorage.getItem(LOCALSTORAGE_KEYS.accessToken),
      expireTime: window.localStorage.getItem(LOCALSTORAGE_KEYS.expireTime),
      timestamp: window.localStorage.getItem(LOCALSTORAGE_KEYS.timestamp),
    };
    return LOCALSTORAGE_VALUES
  }

  const state = reactive({    
    user: null,
    message: '',
  })

  const internalInstance = getCurrentInstance()
  const axios = internalInstance.appContext.config.globalProperties.axios
  const router = useRouter()
  
  const hasTokenExpired = () => {
    const { accessToken, timestamp, expireTime } = getLocalStorage()
    if(!accessToken || !timestamp || !expireTime){ 
      return true      
    }    
    const millisecondsElapsed = Date.now() - Number(timestamp)
    return (millisecondsElapsed / 1000) > Number(expireTime)
  }

  const authorize = () => {
    const url = 'https://accounts.spotify.com/authorize?'
    const client_id = import.meta.env.VITE_SPOTIFY_CLIENT_ID
    const response_type = 'token'
    const redirect_uri = window.location.origin
    const scope = 'user-read-private user-read-email playlist-read-private playlist-modify-public playlist-modify-private user-read-playback-state user-modify-playback-state'
    const state = '34fFs29kd09'
    const show_dialog = 'false'
    const query = `client_id=${client_id}&response_type=${response_type}&redirect_uri=${redirect_uri}&scope=${scope}&state=${state}&show_dialog=${show_dialog}`
    window.location.href = url + query    
  }



  onMounted(async () => {
    // var params = window.location.search.substr(1)
    var params = window.location.hash
    console.log(params)
    if(params){
      params = params.split('#')[1]
      params = params.split('&')
      params = params.map(param => {
        param = param.split('=')
        console.log(param);        
        return {
          key: param[0],
          value: param[1]
        }
      })

      params = params.reduce((acc, param) => {
        acc[param.key] = param.value
        return acc
      }, {}) 
      if(params.access_token){
        localStorage.setItem(LOCALSTORAGE_KEYS.accessToken, params.access_token)        
        localStorage.setItem(LOCALSTORAGE_KEYS.expireTime, params.expires_in)
        localStorage.setItem(LOCALSTORAGE_KEYS.timestamp, Date.now())        
        router.push('/');
      }
    }

    if(!hasTokenExpired()){        
       router.push('/') 
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
  background-color: #1DB954;
  color: #fff;  
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
}

</style>
