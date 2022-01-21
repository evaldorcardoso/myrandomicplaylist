import { createWebHistory, createRouter } from "vue-router";
import Inicio from "@/views/Inicio.vue";
import Player from "@/views/Player.vue";
import Login from "@/views/Login.vue";
import Biblioteca from "@/views/Biblioteca.vue";

const routes = [
  {
    path: "/",
    name: "Inicio",
    component: Inicio,
  },
  {
    path: "/player",
    name: "Player",
    component: Player,
  },
  {
    path: "/login",
    name: "Login",
    component: Login,
  },
  {
    path: "/biblioteca",
    name: "Biblioteca",
    component: Biblioteca,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;