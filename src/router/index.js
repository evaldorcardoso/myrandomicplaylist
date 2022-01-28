import { createWebHistory, createRouter } from "vue-router";
import Inicio from "@/views/Inicio.vue";
import Player from "@/views/Player.vue";
import Login from "@/views/Login.vue";
import Biblioteca from "@/views/Biblioteca.vue";
import Randomic from "@/views/Randomic.vue";

const routes = [
  {
    path: "/",
    name: "Login",
    component: Login,
  },
  {
    path: "/player",
    name: "Player",
    component: Player,
  },
  {
    path: "/home",
    name: "Home",
    component: Inicio,
  },
  {
    path: "/biblioteca",
    name: "Biblioteca",
    component: Biblioteca,
  },
  {
    path: "/randomic",
    name: "Randomic",
    component: Randomic,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;