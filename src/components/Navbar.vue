<script setup>
  import { computed, onMounted, reactive } from 'vue'
  import { useRouter } from 'vue-router'
  import helpers from '../support/helpers';
import { useUserStore } from '../stores/user';

  const router = useRouter()
  const userStore = useUserStore()

  const state = reactive({
    menuOpen : false,
    version: '',
  })

  const props = defineProps({
    stepData: {
      type: Number,
      default: 1
    }
  });

  const currentUser = computed(() => {
      return userStore.getUser
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
  <nav class="navbar navbar-expand-lg navbar-light bg-light">
    <div class="container-fluid d-flex justify-content-between">
      <div class="left" style="cursor:pointer">
        <div v-if="$router.currentRoute.value.name != 'Home'" @click="goBack()">
          <font-awesome-icon v-if="router.name != 'Home'" icon="chevron-left" style="width:30px;height:30px;color:black;margin:auto"/>
        </div>
        <div v-if="$router.currentRoute.value.name == 'Home'">
          <img :src="currentUser.images[0]?.url" style="width: 44px; height: 44px;border-radius: 50%;" alt="user-picture"/>
        </div>
      </div>
      <div class="center" style="text-align: center;">
        <div>
          <!-- <img :src="currentUser.images[0]?.url" style="width: 44px; height: 44px;border-radius: 50%;" /> -->
          <p style="user-select: none;">@{{ currentUser?.display_name }}</p>
        </div>
      </div>
      
      <!-- Botão toggle à direita -->
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" 
            @click="state.menuOpen = !state.menuOpen" 
            data-bs-target="#navbarNav" aria-controls="navbarNav"
            aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="div-opacity" @click="state.menuOpen = !state.menuOpen" v-if="state.menuOpen">
      </div>
      <!-- Menu que abre à direita -->
      <div class="collapse navbar-collapse justify-content-end" :class="{ show: state.menuOpen }" id="navbarNav">
        <ul class="navbar-nav text-end">
          <li class="nav-item">
            <router-link to="/">
              <div class="navbar-right-inner-item" @click="state.menuOpen = !state.menuOpen">
                <font-awesome-icon icon="home"/>
                <p>Início</p>
              </div>
            </router-link>
          </li>
          <li class="nav-item">
            <router-link to="/player">
              <div class="navbar-right-inner-item" @click="state.menuOpen = !state.menuOpen">
                <font-awesome-icon icon="play-circle"/>
                <p>Player</p>
              </div>
            </router-link>
          </li>
          <li class="nav-item">
            <router-link to="/library">
              <div class="navbar-right-inner-item" @click="state.menuOpen = !state.menuOpen">
                <font-awesome-icon icon="user"/>
                <p>Biblioteca</p>
              </div>
            </router-link>
          </li>
          <li class="nav-item">
              <div class="navbar-right-inner-item" @click="logout()">
                <font-awesome-icon icon="sign-out-alt"/>
                <p>Sair</p>
              </div>
          </li>
          <p class="version">v.{{ state.version }}</p>
        </ul>
      </div>
    </div>
  </nav>
  
</template>
<style scoped>

@media (max-width: 991.98px) {
  .navbar-collapse {
    position: fixed;
    top: 67px; /* Ajuste conforme a altura do seu navbar */
    right: 0;
    width: 50%; /* Largura do menu mobile */
    height: 100vh;
    background-image: linear-gradient(60deg, #e0eb98, #62faf5); /* Cor de fundo do menu */
    padding: 1rem;
    transform: translateX(100%);
    transition: transform 0.3s ease-in-out;
    z-index: 1000;
  }
  
  .navbar-collapse.show {
    transform: translateX(0);
    box-shadow: -5px 0px 15px rgba(0,0,0,0.1);
  }
}


.navbar{
  background-image: linear-gradient(60deg, #e0eb98, #62faf5);
  /*@click="state.menuOpen = !state.menuOpen"*/
}
.navbar-inner{
  position: relative;
  height: 44px;  
}
.div-opacity{
  position: fixed;
  top: 0;
  left: 0;
  right: 0px;
  z-index: 200;
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
  z-index: 999 !important;
}
.navbar-right-inner{
  padding: 10px;
}
.navbar-right-inner-item{
  position: relative;
  height: 50px;
  padding: 0 10px;
  cursor:pointer;
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
  top: 0;
  left: 0;
  bottom: 0;
  width: 44px;
  text-align: center;
}
.center {
  margin-top: 15px;
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
  bottom: 67px;
  position: absolute;
  font-size: 12px;
  color: #686565;
}
</style>