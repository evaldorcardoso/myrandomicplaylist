import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import axiosPlugin from './axios-plugin';
import { library } from '@fortawesome/fontawesome-svg-core'
import Vue3TouchEvents from 'vue3-touch-events';
import { registerSW } from 'virtual:pwa-register'
import { 
    faArrowDown,
    faArrowRight,
    faBars,
    faBook,
    faChartLine,
    faChevronLeft,
    faChevronRight,
    faHome,
    faHourglass,
    faMobileAlt, 
    faPause,
    faPlay,
    faPlayCircle, 
    faRandom, 
    faSave,
    faSignOutAlt, 
    faSpinner,
    faStepBackward,
    faStepForward,
    faUser, 
    faSort,
    faMusic,
    faTrash,
    faHeart,
    faSync,
    faChartBar,
    faChartPie,
    faEllipsisV,
    faCheck,
    faSmile,
    faSadTear,
    faMeh,
    faLock,
    faUnlockAlt
} from '@fortawesome/free-solid-svg-icons'
import {
    faXmarkCircle
} from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome"
import { createPinia } from 'pinia';

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
    faSpinner,
    faHourglass,
    faArrowRight,
    faArrowDown,
    faSave,
    faBook,
    faChartLine,
    faChevronLeft,
    faChevronRight,
    faSort,
    faMusic,
    faTrash,
    faHeart,
    faSync,
    faChartBar,
    faChartPie,
    faEllipsisV,
    faXmarkCircle,
    faCheck,
    faSmile,
    faSadTear,
    faMeh,
    faLock,
    faUnlockAlt
)

const updateSW = registerSW({
    onNeedRefresh() {},
    onOfflineReady() {},
})
const app  = createApp(App)
const pinia = createPinia()
app.use(router)
app.use(updateSW)
app.use(axiosPlugin)
app.use(Vue3TouchEvents)
app.component("font-awesome-icon", FontAwesomeIcon)
app.use(pinia)
app.mount('#app')
