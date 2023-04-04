import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import axiosPlugin from './axios-plugin';
import { library } from '@fortawesome/fontawesome-svg-core'
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
    faSpinner,
    faHourglass,
    faArrowRight,
    faArrowDown,
    faSave,
    faBook,
    faChartLine,
    faChevronLeft,
    faChevronRight,
)

const app  = createApp(App)
app.use(router)
app.use(axiosPlugin)
app.component("font-awesome-icon", FontAwesomeIcon)
app.mount('#app')
