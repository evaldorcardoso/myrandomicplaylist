<script setup>
  import { onMounted, computed, reactive, ref } from 'vue'
  import VueBasicAlert from 'vue-basic-alert'
  import { useProfile, useGeneral } from '@/support/spotifyApi'

  const { 
    getTopItens, 
    getProfile, 
    getPlaylists,
    getDevices, 
    getPlaybackState, 
    transferPlayback, 
    addTrackToQueue 
  } = useProfile();

  const { getTracks } = useGeneral();

  const msg = ref('Gerador de playlist aleatória do Spotify')

  const ALERT_OPTIONS = { 
    iconSize: 35, // Size of the icon (px)
    iconType: 'solid', // Icon styles: now only 2 styles 'solid' and 'regular'
    position: 'top right' // Position of the alert 'top right', 'top left', 'bottom left', 'bottom right'
  } 

  const state = reactive({
    isProcessing: false,
    isPlaying: false,
    playlists: [],
    devices: [],
    tracks: [],
    topTracks: [],
    popTracks: [],
    user: null,
    userPopularity: 0,
    message: '',
  })

  const props = defineProps({
    userData: {
        type: Object,
        default: () => { },
    },
  });

  const currentUser = computed(() => {
    return props.userData;
  });

  const alert = ref(null)

  const testPopularityLevel = ()=>{
    let popularity = 0;
    const tracks = state.topTracks;
    tracks.map(async(item) => {
      let track = JSON.parse(JSON.stringify(item));
      popularity+=track.popularity;
    });
    state.userPopularity = popularity / state.topTracks.length;
  }

  const openLink = (url) => {
    window.open(url, '_blank')
  }

  onMounted(async () => {      
    // const { data } = await getProfile()
    // state.user = data
  })

</script>

<template>
  <div class="page">
    <!-- <h2 class="center title">{{ msg }}</h2> -->
    <vue-basic-alert :duration="300" :closeIn="3000" ref="alert" />
    <!--
    <br><br><hr>
    <h3 class="center statistics-title">As top 10 de {{currentUser?.display_name}} </h3>
    <p class="center statistics-subtitle">No último mês</p>
    <button v-if="state.topTracks.length === 0" class="center btn-execute" @click="getUserTopItems()" :disabled="state.isProcessing">
      <p style="margin: 0" v-if="!(state.isProcessing)"> Buscar</p>
      <p style="margin: 0" v-if="(state.isProcessing)"><font-awesome-icon icon="hourglass" /> Buscando, aguarde...</p>
    </button>
    <p v-if="state.topTracks.length > 0" class="center" style="color: white;display: table;font-size: 12px;">
      <font-awesome-icon v-if="(state.userPopularity < 40)" class="icon-popularity-bad" icon="chart-line"/>
      <font-awesome-icon v-else-if="(state.userPopularity >= 40 && state.userPopularity < 70)" class="icon-popularity-medium" icon="chart-line"/>
      <font-awesome-icon v-else-if="(state.userPopularity >= 70)" class="icon-popularity-good" icon="chart-line"/>
      {{state.userPopularity}}
    </p>
    <div class="list-list">
      <ul class="list">
        <li v-for="track in state.topTracks" class="list-item">
          <img :src="track.album.images[0].url" class="music-cover" />
          <div class="list-item-content">                
            <div class="list-item-title">
              {{track.name}}
            </div>
            <div class="list-item-popularity">
              <font-awesome-icon v-if="(track.popularity < 40)" class="icon-popularity-bad" icon="chart-line"/>
              <font-awesome-icon v-else-if="(track.popularity >= 40 && track.popularity < 70)" class="icon-popularity-medium" icon="chart-line"/>
              <font-awesome-icon v-else-if="(track.popularity >= 70)" class="icon-popularity-good" icon="chart-line"/>
              {{track.popularity}}%
            </div>
          </div>
          <div class="list-item-subtitle">{{track.artists[0].name}}</div>
        </li>
      </ul>
    </div>
    <h3 class="center statistics-title">As top 50 mais populares de {{currentUser?.display_name}}: </h3>
    <button v-if="state.popTracks.length === 0" class="center btn-execute" @click="getUserPlaylistTracks()" :disabled="state.isProcessing">
      <p style="margin: 0" v-if="!(state.isProcessing)"> Buscar</p>
      <p style="margin: 0" v-if="(state.isProcessing)"><font-awesome-icon icon="hourglass" /> Buscando, aguarde...</p>
    </button>
    <button v-if="state.popTracks.length > 0" class="center btn-execute" @click="executePlaylist()" :disabled="state.isProcessing">
        <p style="margin: 0" v-if="!(state.isProcessing)"><font-awesome-icon icon="play" /> Adicionar à fila</p>
        <p style="margin: 0" v-if="(state.isProcessing)"><font-awesome-icon icon="hourglass" /> Adicionando, aguarde...</p>
    </button>
    <div class="list-list">
      <ul class="list">
        <li v-for="track in state.popTracks" class="list-item">
          <img :src="track.track.album.images[0].url" class="music-cover" />
          <div class="list-item-content">                
            <div class="list-item-title">
              {{track.track.name}}
            </div>
            <div class="list-item-subtitle">{{track.track.artists[0].name}}</div>
          </div>
          <div class="list-item-popularity">
            <font-awesome-icon v-if="(track.track.popularity < 40)" class="icon-popularity-bad" icon="chart-line"/>
            <font-awesome-icon v-else-if="(track.track.popularity >= 40 && track.track.popularity < 70)" class="icon-popularity-medium" icon="chart-line"/>
            <font-awesome-icon v-else-if="(track.track.popularity >= 70)" class="icon-popularity-good" icon="chart-line"/>
            {{track.track.popularity}}%
          </div>
        </li>
      </ul>
    </div>
    -->
    <link href="https://fonts.googleapis.com/css?family=Lato" rel="stylesheet">

    <div class="content">
      <div class="content__container">
        <p class="content__container__text">
          Play
        </p>
        
        <ul class="content__container__list">
          <li class="content__container__list__item">random items !</li>
          <li class="content__container__list__item">top items !</li>
          <li class="content__container__list__item">library items !</li>
          <li class="content__container__list__item">spotify !</li>
        </ul>
      </div>
      <router-link to="/randomic" style="text-decoration:none;margin-top: 75px;display: block;">
        <button class="btn-generate">
          Start now !
        </button>
      </router-link>
    </div>

    <div class="footer">
      <img class="center" alt="evaldorc" src="https://www.evaldorc.com.br/assets/images/marca_w.png" @click="openLink('https://evaldorc.com.br')"/>
    </div>    
  </div>
</template>

<style lang="scss" scoped>
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: auto;
}
.btn-generate {
  margin: 25px auto auto auto;
  background-image: linear-gradient(60deg, #e0eb98, #62faf5);
  color: black;
  border: none;
  padding: 10px 20px;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  border-radius: 20px;
  border: none;
}
.footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  bottom: 85px;
  position: fixed;
  width: 100%;
  opacity: 0.3;
}
/*NEW CODE */
.content {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  height: 160px;
  overflow:hidden;
  
  font-family: 'Lato', sans-serif;
  font-size: 27px;
  line-height: 40px;
  color: #ecf0f1;
  
  &__container {
    font-weight: 600;
    overflow: hidden;
    height: 40px;
    padding: 0 40px;

    &:before {
      content: '[';
      left: 0;
    }

    &:after {
      content: ']';
      position: absolute;
      right: 0;
    }

    &:after, &:before {
      position: absolute;
      top: 0;
      
      color: rgb(30, 215, 96);
      font-size: 34px;
      line-height: 40px;
      
      -webkit-animation-name: opacity;
      -webkit-animation-duration: 2s;
      -webkit-animation-iteration-count: infinite;
      animation-name: opacity;
      animation-duration: 2s;
      animation-iteration-count: infinite;
    }

    &__text {
      display: inline;
      float: left;
      margin: 0;
    }

    &__list {
      margin-top: 0;
      padding-left: 70px;
      text-align: left;
      list-style: none;
      width: 180px;
      
      -webkit-animation-name: change;
      -webkit-animation-duration: 10s;
      -webkit-animation-iteration-count: infinite;
      animation-name: change;
      animation-duration: 10s;
      animation-iteration-count: infinite;

      &__item {
        line-height:40px;
        margin:0;
      }
    }
  }
}

@-webkit-keyframes opacity {
  0%, 100% {opacity:0;}
  50% {opacity:1;}
}

@-webkit-keyframes change {
  0%, 12.66%, 100% {transform:translate3d(0,0,0);}
  16.66%, 29.32% {transform:translate3d(0,-25%,0);}
  33.32%,45.98% {transform:translate3d(0,-50%,0);}
  49.98%,62.64% {transform:translate3d(0,-75%,0);}
  66.64%,79.3% {transform:translate3d(0,-50%,0);}
  83.3%,95.96% {transform:translate3d(0,-25%,0);}
}

@-o-keyframes opacity {
  0%, 100% {opacity:0;}
  50% {opacity:1;}
}

@-o-keyframes change {
  0%, 12.66%, 100% {transform:translate3d(0,0,0);}
  16.66%, 29.32% {transform:translate3d(0,-25%,0);}
  33.32%,45.98% {transform:translate3d(0,-50%,0);}
  49.98%,62.64% {transform:translate3d(0,-75%,0);}
  66.64%,79.3% {transform:translate3d(0,-50%,0);}
  83.3%,95.96% {transform:translate3d(0,-25%,0);}
}

@-moz-keyframes opacity {
  0%, 100% {opacity:0;}
  50% {opacity:1;}
}

@-moz-keyframes change {
  0%, 12.66%, 100% {transform:translate3d(0,0,0);}
  16.66%, 29.32% {transform:translate3d(0,-25%,0);}
  33.32%,45.98% {transform:translate3d(0,-50%,0);}
  49.98%,62.64% {transform:translate3d(0,-75%,0);}
  66.64%,79.3% {transform:translate3d(0,-50%,0);}
  83.3%,95.96% {transform:translate3d(0,-25%,0);}
}

@keyframes opacity {
  0%, 100% {opacity:0;}
  50% {opacity:1;}
}

@keyframes change {
  0%, 12.66%, 100% {transform:translate3d(0,0,0);}
  16.66%, 29.32% {transform:translate3d(0,-25%,0);}
  33.32%,45.98% {transform:translate3d(0,-50%,0);}
  49.98%,62.64% {transform:translate3d(0,-75%,0);}
  66.64%,79.3% {transform:translate3d(0,-50%,0);}
  83.3%,95.96% {transform:translate3d(0,-25%,0);}
}
</style>
