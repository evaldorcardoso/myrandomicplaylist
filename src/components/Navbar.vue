<script setup>
  import { computed, onMounted, reactive } from 'vue'
  import { useRouter } from 'vue-router'
  import helpers from '../support/helpers';

  const router = useRouter()

  const state = reactive({
    menuOpen : false,
    version: '',
  })

  const props = defineProps({
    userData: {
        type: Object,
        default: () => { },
    },
    stepData: {
      type: Number,
      default: 1
    }
  });

  const currentUser = computed(() => {
      return props.userData;
  });

  const currentStep = computed(() => {
    return props.stepData;
  })

  const openLink = (link) => {
    window.open(link, '_blank')
  }

  const goBack = () => {
    if (currentStep.value > 0) {
      decreaseStep()
      return
    }

	  router.go(-1);
  };

  const logout = () => {
    helpers.logout()
    state.menuOpen = false    
    router.push('/')
    setTimeout(() => {
      window.location.reload()
    }, 100)
  }

  const emit = defineEmits(['update-step-data'])

  const increaseStep = () => {
    emit('update-step-data', currentStep.value + 1)
  }

  const decreaseStep = () => {
    if (currentStep.value == 1) {
      emit('update-step-data', 0)
      router.push('/')
      return
    }

    if (currentStep.value == 99) {
      emit('update-step-data', 3)
      return
    }

    emit('update-step-data', currentStep.value - 1)
  }

  onMounted(async () => {
    state.version = import.meta.env.PACKAGE_VERSION
  })

</script>
<template>
    <div class="navbar">
      <div class="navbar-inner" v-if="currentUser">
        <div class="left">
          <div v-if="$router.currentRoute.value.name != 'Home'" @click="goBack()">
            <font-awesome-icon v-if="router.name != 'Home'" icon="chevron-left" style="width:30px;height:30px;color:black;margin:auto"/>
          </div>
          <div v-if="$router.currentRoute.value.name == 'Home'">
            <img :src="currentUser.images[0]?.url" style="width: 44px; height: 44px;border-radius: 50%;" />
          </div>
        </div>
        <div class="center" style="text-align: center;">
          <div v-if="$router.currentRoute.value.name != 'Home'">
            <!-- <img :src="currentUser.images[0]?.url" style="width: 44px; height: 44px;border-radius: 50%;" /> -->
            <p>@{{ currentUser?.display_name }}</p>
          </div>
        </div>
        <div class="right" style="margin: auto" v-if="currentStep == 0">
          <font-awesome-icon icon="bars"
            style="width:30px;height:30px;color:black;margin:auto"
            @click="state.menuOpen = !state.menuOpen"
          />
          </div>
          <div class="right" style="margin: auto" v-if="(currentStep > 0) && (currentStep < 99)" @click="increaseStep()">
            <font-awesome-icon v-if="router.name != 'Home'"
              icon="chevron-right"
              style="width:30px;height:30px;color:black;margin:auto"
            />
          </div>
      </div>
      <div class="div-opacity" @click="state.menuOpen = !state.menuOpen" v-if="state.menuOpen">
      </div>
      <div class="navbar-right" v-if="state.menuOpen">
        <div class="navbar-right-inner">
          <div class="navbar-right-inner-item" @click="state.menuOpen = !state.menuOpen;router.push('/')" v-if="state.menuOpen">
            <font-awesome-icon icon="home"/>
            <p>Início</p>
          </div>
          <router-link to="/player">
            <div class="navbar-right-inner-item" @click="state.menuOpen = !state.menuOpen" v-if="state.menuOpen">
              <font-awesome-icon icon="play-circle"/>
              <p>Player</p>
            </div>
          </router-link>
          <div class="navbar-right-inner-item" @click="state.menuOpen = !state.menuOpen;router.push('/library')" v-if="state.menuOpen">
            <font-awesome-icon icon="user"/>
            <p>Biblioteca</p>
          </div>
          <div class="navbar-right-inner-item" @click="state.menuOpen = !state.menuOpen;openLink('https://developer.spotify.com/dashboard')" v-if="state.menuOpen">
            <font-awesome-icon icon="book"/>
            <p>Api Spotify</p>
          </div>
          <div class="navbar-right-inner-item" @click="logout()">
            <font-awesome-icon icon="sign-out-alt"/>
            <p>Sair</p>
          </div>
          <p class="version">{{ state.version }}</p>
        </div>
      </div>
    </div>
</template>
<style scoped>
.navbar{
  position: relative;
  height: 44px;
  padding: 7px;
  /*background-color: #0c8d39;*/
  background-image: linear-gradient(60deg, #e0eb98, #62faf5);
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
  /*background: #0c8d39;*/
  background-image: linear-gradient(60deg, #e0eb98, #62faf5);
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
  color: black;
  font-size: 14px;
  font-weight: bold;
  display: contents;
  margin-left: 5px;
}
.navbar-right-inner-item svg {
  margin-right: 10px;
  color: black;
}
.left{
  display: flex;
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
.version{
  bottom: 0px;
  position: absolute;
  font-size: 12px;
  color: #686565;
}
</style>