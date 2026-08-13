<script setup>
  import { onMounted, reactive } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import helpers from '../support/helpers'

  const route = useRoute()
  const router = useRouter()

  const props = defineProps({
    open: {
      type: Boolean,
      default: false
    }
  })

  const emit = defineEmits(['close'])

  const state = reactive({
    version: ''
  })

const navItems = [
    { label: 'Dashboard', icon: 'dashboard', to: '/', exact: true },
    { label: 'Financeiro', icon: 'payments', to: '/financeiro' },
    { label: 'Minhas Playlists', icon: 'queue_music', to: '/library' },
    { label: 'Player', icon: 'play_circle', to: '/player' },
    { label: 'Mixar', icon: 'shuffle', to: '/random' }
  ]

  const isActive = (item) => {
    if (item.exact) {
      return route.path === item.to
    }
    return route.path === item.to || route.path.startsWith(item.to + '/')
  }

  const closeAndGo = (to) => {
    emit('close')
    if (route.path !== to) {
      router.push(to)
    }
  }

  const openLink = (link) => {
    window.open(link, '_blank')
  }

  const logout = () => {
    helpers.logout()
    emit('close')
    router.push('/')
    setTimeout(() => {
      window.location.reload()
    }, 100)
  }

  onMounted(() => {
    state.version = import.meta.env.PACKAGE_VERSION
  })
</script>

<template>
  <div
    v-if="props.open"
    class="fixed inset-0 bg-black/60 z-40 lg:hidden"
    @click="emit('close')"
  ></div>

  <aside
    :class="[
      'fixed left-0 top-0 h-full w-56 bg-surface-container-lowest z-50 flex flex-col border-r border-outline-variant/10',
      'transition-transform duration-300 ease-in-out lg:translate-x-0',
      props.open ? 'translate-x-0' : '-translate-x-full'
    ]"
  >
    <div class="px-8 py-8 flex items-center gap-3">
      <div class="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center flex-shrink-0">
        <span class="material-symbols-outlined text-on-primary-container font-bold">equalizer</span>
      </div>
      <span class="text-headline-sm font-display tracking-tighter text-on-surface">
        MR<span class="text-primary">PLAYLIST</span>
      </span>
    </div>

    <nav class="flex-1 px-4 flex flex-col gap-2 overflow-y-auto">
      <button
        v-for="item in navItems"
        :key="item.label"
        class="flex items-center px-4 py-3.5 rounded-xl transition-all duration-300 group text-left"
        :class="isActive(item)
          ? 'bg-primary-container text-on-primary-container font-bold shadow-[0_0_20px_rgba(29,185,84,0.15)]'
          : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'"
        @click="closeAndGo(item.to)"
      >
        <span
          class="material-symbols-outlined mr-4 transition-colors"
          :class="isActive(item) ? '' : 'group-hover:text-primary'"
        >{{ item.icon }}</span>
        <span class="text-body-md">{{ item.label }}</span>
      </button>

      <div class="my-4 border-t border-outline-variant/10"></div>

      <button
        class="flex items-center px-4 py-3.5 rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all duration-300 group text-left"
        @click="closeAndGo('/configuracoes')"
      >
        <span class="material-symbols-outlined mr-4 group-hover:text-primary transition-colors">settings</span>
        <span class="text-body-md">Configurações</span>
      </button>

      <button
        class="flex items-center px-4 py-3.5 rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all duration-300 group text-left"
        @click="logout()"
      >
        <span class="material-symbols-outlined mr-4 group-hover:text-primary transition-colors">logout</span>
        <span class="text-body-md">Logout</span>
      </button>
    </nav>

    <div class="px-8 py-4 border-t border-outline-variant/10">
      <p class="text-label-sm text-on-surface-variant">v{{ state.version }}</p>
    </div>
  </aside>
</template>
