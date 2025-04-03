import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import axiosPlugin from './axios-plugin';
import { library } from '@fortawesome/fontawesome-svg-core'
import Vue3TouchEvents from 'vue3-touch-events';
import { registerSW } from 'virtual:pwa-register'
import { 
    faArrowDown,
    faArrowUp,
    faArrowRight,
    faBars,
    faBook,
    faChartLine,
    faChevronUp,
    faChevronDown,
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
    faUnlockAlt,
    faTimes,
    faInfo,
    faPlus
} from '@fortawesome/free-solid-svg-icons'
import {
    faXmarkCircle
} from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome"
import { createPinia } from 'pinia';
import Notifications from '@kyvg/vue3-notification'
import Vue3ProgressBar from "@ctechhindi/vue3-progress-bar";
import * as bootstrap from 'bootstrap/dist/js/bootstrap.bundle'

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
    faArrowUp,
    faSave,
    faBook,
    faChartLine,
    faChevronUp,
    faChevronDown,
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
    faUnlockAlt,
    faTimes,
    faInfo,
    faPlus
)

const updateSW = registerSW({
    onNeedRefresh() {},
    onOfflineReady() {},
})
const app  = createApp(App)
const pinia = createPinia()
const progressOptions = {
    "height": "5px",
    "customStyle": {
        width: "100 %",
        height: "100 %",
        position: "absolute",
        background: "linear-gradient(45deg, #da7748, #d11111)",
        left: "0 %",
    },
}

app.use(router)
app.use(updateSW)
app.use(axiosPlugin)
app.use(Vue3TouchEvents)
app.component("font-awesome-icon", FontAwesomeIcon)
app.use(pinia)
app.use(Notifications)
app.use(Vue3ProgressBar, progressOptions)
app.provide('bootstrap', bootstrap)
app.mount('#app')
