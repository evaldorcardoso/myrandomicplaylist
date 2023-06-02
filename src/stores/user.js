import { defineStore } from "pinia"

export const useUserStore = defineStore({
    id: 'user',
    state: () => ({
        user: null
    }),
    getters: {
        isLogged: (state) => state.user !== null
    },
    actions: {
        setUser(user) {
            this.user = user
        },
        clearUser() {
            this.user = null
        }
    }
})