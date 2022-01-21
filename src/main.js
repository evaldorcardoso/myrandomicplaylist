import { createApp } from 'vue'
import axios from 'axios'
import App from './App.vue'
import router from './router'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faSignOutAlt, 
        faRandom, 
        faMobileAlt, 
        faPlayCircle, 
        faBars,
        faHome,
        faUser, 
        faStepBackward,
        faStepForward,
        faPlay,
        faPause,
    } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome"

library.add(
    faSignOutAlt, 
    faRandom, 
    faMobileAlt, 
    faPlayCircle, 
    faBars,
    faHome,
    faUser,
    faStepBackward,
    faStepForward,
    faPlay,
    faPause,
)

const app  = createApp(App)
app.config.globalProperties.axios = axios
app.use(router)
app.component("font-awesome-icon", FontAwesomeIcon)
app.mount('#app')
