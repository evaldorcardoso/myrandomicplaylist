<script setup>
  import { getCurrentInstance, onMounted, reactive } from 'vue'
  import { useRouter } from 'vue-router'
  import Navbar from '@/components/Navbar.vue'

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

  const internalInstance = getCurrentInstance()
  const axios = internalInstance.appContext.config.globalProperties.axios
  const router = useRouter()

  const state = reactive({
    user: null,
    message: '',    
    menuOpen : false
  })

  const hasTokenExpired = () => {
    const { accessToken, timestamp, expireTime } = getLocalStorage()
    if(!accessToken || !timestamp || !expireTime){ 
      return true      
    }    
    const millisecondsElapsed = Date.now() - Number(timestamp)
    return (millisecondsElapsed / 1000) > Number(expireTime)
  }

  const getProfile = async() => {
    const { accessToken } = getLocalStorage()
    // alert('getprofile navbar, token: '+ accessToken)
    await axios
      .get('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(response => {
        // console.log(response.data)
        state.user = response.data
      })
  }

  const openLink = (link) => {
    window.open(link, '_blank')
  }

  const logout = () => {
    // Clear all localStorage items
    for (const property in LOCALSTORAGE_KEYS) {
      window.localStorage.removeItem(LOCALSTORAGE_KEYS[property]);
    }
    state.user = null
    state.menuOpen = false    
    router.push('/login')
  }

  onMounted(async () => {  
    setTimeout(() => {
      if(hasTokenExpired()){        
        // logout()
        return
      }      
      getProfile()   
    }, 1000)  
  })


</script>
<template>
    <div class="navbar">
      <div class="navbar-inner" v-if="state.user">
        <div class="left">
          <div>
            <img :src="state.user.images[0]?.url" style="width: 44px; height: 44px;border-radius: 50%;" />
          </div>
        </div>
        <div class="left-user">
          <p>{{ state.user ? state.user.display_name : '' }}</p>
        </div>
        <div class="right" style="margin: auto">
          <font-awesome-icon icon="bars" style="width:30px;height:30px;color:#fff;margin:auto" @click="state.menuOpen = !state.menuOpen"/>
        </div>
      </div>
      <div class="div-opacity" @click="state.menuOpen = !state.menuOpen" v-if="state.menuOpen">
      </div>
      <div class="navbar-right" v-if="state.menuOpen">
        <div class="navbar-right-inner">
          <div class="navbar-right-inner-item" @click="state.menuOpen = !state.menuOpen;router.push('/')" v-if="state.menuOpen">
            <font-awesome-icon icon="home" style="margin-right: 10px;color:#fff;"/>
            <p>Início</p>
          </div>
          <router-link to="/player">
            <div class="navbar-right-inner-item" @click="state.menuOpen = !state.menuOpen" v-if="state.menuOpen">
              <font-awesome-icon icon="play-circle" style="margin-right: 10px;color:#fff;"/>
              <p>Player</p>
            </div>
          </router-link>
          <div class="navbar-right-inner-item" @click="state.menuOpen = !state.menuOpen;router.push('/biblioteca')" v-if="state.menuOpen">
            <font-awesome-icon icon="user" style="margin-right: 10px;color:#fff;"/>
            <p>Biblioteca</p>
          </div>
          <div class="navbar-right-inner-item" @click="state.menuOpen = !state.menuOpen;openLink('https://developer.spotify.com/dashboard')" v-if="state.menuOpen">
            <font-awesome-icon icon="book" style="margin-right: 10px;color:#fff;"/>
            <p>Api Spotify</p>
          </div>
          <div class="navbar-right-inner-item" @click="logout()">
            <font-awesome-icon icon="sign-out-alt" style="margin-right: 10px;color:#fff;"/>
            <p>Sair</p>
          </div>
        </div>
      </div>
    </div>
</template>
<style scoped>
.navbar{
  position: relative;
  height: 44px;
  padding: 7px;
  background-color: #0c8d39;
}
.navbar-inner{
  position: relative;
  height: 44px;  
}
.div-opacity{
  position: fixed;
  top: 0;
  left: 0;
  right: 200px;
  z-index: 9;
  background: rgba(0,0,0,0.5);
  height: 100vh;
}
.navbar-right{
  position: fixed;
  top: 0;
  right: 0;
  width: 200px;
  height: 100%;
  background: #0c8d39;
  box-shadow: 0 0 10px rgba(0,0,0,0.2);
  z-index: 1;
}
.navbar-right-inner{
  padding: 10px;
}
.navbar-right-inner-item{
  position: relative;
  height: 50px;
  padding: 0 10px;
}
.navbar-right-inner-item p{
  position: absolute;
  color: #fff;
  font-size: 14px;
  font-weight: bold;
  display: contents;
  margin-left: 5px;
}
.left{
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 44px;
  text-align: center;
}
.right{
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 44px;
  text-align: right;
}
.left-user{
  position: absolute;
  top: 0;
  left: 50px;
  bottom: 0;
  width: 44px;
  text-align: right;
}
.left-user p{
  font-size: 16px;
  font-weight: bold;
  color: #fff;  
}
</style>