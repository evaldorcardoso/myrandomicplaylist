import { defineStore } from "pinia"
import helpers, { LOCALSTORAGE_KEYS } from "../support/helpers"

const DEFAULT_SETTINGS = {
  playlistPageSize: 50,
  tracksPageSize: 100,
  artistsBatchSize: 50,
  topGenresCount: 10,
  dashboardExpirationsDisplay: 5
}

export const useSettingsStore = defineStore('settings', {
  state: () => {
    let stored = {}
    try {
      const raw = helpers.getLocalStorage()[LOCALSTORAGE_KEYS.settings]
      if (raw) stored = JSON.parse(raw)
    } catch (e) {
      console.warn('Failed to parse stored settings', e)
    }
    return { settings: { ...DEFAULT_SETTINGS, ...stored } }
  },
  getters: {
    getSessionSetting: (state) => (key) => state.settings[key] ?? DEFAULT_SETTINGS[key]
  },
  actions: {
    setSettings(patch) {
      this.settings = { ...this.settings, ...patch }
      helpers.setLocalStorage(LOCALSTORAGE_KEYS.settings, JSON.stringify(this.settings))
    },
    resetSettings() {
      this.settings = { ...DEFAULT_SETTINGS }
      helpers.setLocalStorage(LOCALSTORAGE_KEYS.settings, JSON.stringify(this.settings))
    }
  }
})