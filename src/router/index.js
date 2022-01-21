import { createWebHistory, createRouter } from "vue-router";
import Inicio from "@/views/Inicio.vue";
import Player from "@/views/Player.vue";
import Login from "@/views/Login.vue";

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
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;