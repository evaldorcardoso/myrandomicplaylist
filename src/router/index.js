import { createWebHistory, createRouter } from "vue-router"
import Inicio from "@/views/Inicio.vue"
import Player from "@/views/Player.vue"
import Callback from "@/views/Callback.vue"
import Login from "@/views/Login.vue"
import Library from "@/views/Library.vue"
import Randomic from "@/views/Randomic.vue"
import Playlist from "@/views/Playlist.vue"
import helpers from "@/support/helpers"

const isLogged = (to, from, next) => {
	const { accessToken } = helpers.getLocalStorage()
  if (!accessToken) {
    next('Login')
  }
  
  next()
};

const routes = [
  {
    path: "/",
    component: () => import('../components/Layout.vue'),
    beforeEnter: isLogged,
    name: "Layout",
    props: true,
    children: [
      {
        path: "",
        name: "Home",
        component: Inicio,
      },
      {
        path: "/library",
        name: "Library",
        component: Library,
      },
      {
        path: "/playlist/:id",
        name: "Playlist",
        component: Playlist,
      },
      {
        path: "/randomic",
        name: "Randomic",
        component: Randomic,
      },
      {
        path: "/player",
        name: "Player",
        component: Player,
      }
    ]
  },
  {
    path: "/login",
    name: "Login",
    component: Login,
  },
  {
    path: "/callback",
    name: "Callback",
    component: Callback,
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;