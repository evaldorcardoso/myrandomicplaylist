import { ref, reactive, onUnmounted } from 'vue'
import { saveSubscription, deleteSubscription } from '@/services/PushService'

const SW_READY_TIMEOUT_MS = 10000
const SUBSCRIBE_TIMEOUT_MS = 15000
const SAVE_TIMEOUT_MS = 10000
const UNSUBSCRIBE_TIMEOUT_MS = 10000

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms)
    })
  ])
}

export function usePushNotifications() {
  const isSupported = ref(
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  )
  const permission = ref(Notification?.permission ?? 'default')
  const loading = ref(false)
  const errorMessage = ref('')
  const activeSubscription = ref(null)

  const cleanup = []
  onUnmounted(() => {
    for (const fn of cleanup) fn()
  })

  const getRegistration = async () => {
    return withTimeout(
      navigator.serviceWorker.ready,
      SW_READY_TIMEOUT_MS,
      'O service worker não ativou. Recarregue a página e tente novamente.'
    )
  }

  const getCurrentSubscription = async () => {
    const registration = await getRegistration()
    return withTimeout(
      registration.pushManager.getSubscription(),
      SW_READY_TIMEOUT_MS,
      'O navegador demorou para consultar a assinatura push. Tente novamente.'
    )
  }

  const subscribe = async () => {
    if (!isSupported.value) {
      errorMessage.value = 'Este navegador não suporta notificações push.'
      return false
    }

    loading.value = true
    errorMessage.value = ''
    activeSubscription.value = null

    try {
      const permissionResult = await withTimeout(
        Notification.requestPermission(),
        SUBSCRIBE_TIMEOUT_MS,
        'A solicitação de permissão de notificação demorou demais. Conceda pelo site settings do navegador.'
      )
      permission.value = permissionResult
      if (permissionResult === 'denied') {
        errorMessage.value = 'Permissão de notificação negada nas configurações do navegador.'
        return false
      }
      if (permissionResult !== 'granted') {
        errorMessage.value = 'Permissão não concedida. Clique em Ativar e permita quando o navegador perguntar.'
        return false
      }

      const applicationServerKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      if (!applicationServerKey) {
        errorMessage.value = 'Chave pública VAPID não configurada.'
        return false
      }

      const registration = await getRegistration()
      const subscription = await withTimeout(
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(applicationServerKey)
        }),
        SUBSCRIBE_TIMEOUT_MS,
        'O navegador demorou para criar a assinatura push. Tente novamente.'
      )

      await withTimeout(
        saveSubscription(subscription),
        SAVE_TIMEOUT_MS,
        'Não foi possível salvar a assinatura no servidor. Verifique sua conexão.'
      )
      activeSubscription.value = subscription
      return true
    } catch (e) {
      console.error(e)
      errorMessage.value = e.message || 'Não foi possível ativar as notificações.'
      return false
    } finally {
      loading.value = false
    }
  }

  const unsubscribe = async () => {
    if (!isSupported.value) return true
    loading.value = true
    errorMessage.value = ''

    try {
      const subscription = await getCurrentSubscription()
      if (subscription) {
        await withTimeout(
          subscription.unsubscribe(),
          UNSUBSCRIBE_TIMEOUT_MS,
          'O navegador demorou para remover a assinatura push. Tente novamente.'
        )
        await withTimeout(
          deleteSubscription(subscription.endpoint),
          UNSUBSCRIBE_TIMEOUT_MS,
          'Não foi possível remover a assinatura no servidor. Verifique sua conexão.'
        )
      }
      activeSubscription.value = null
      return true
    } catch (e) {
      console.error(e)
      errorMessage.value = e.message || 'Não foi possível desativar as notificações.'
      return false
    } finally {
      loading.value = false
    }
  }

  const getErrorMessage = () => errorMessage.value

  const syncState = async () => {
    if (!isSupported.value) return
    permission.value = Notification.permission
    if (permission.value === 'granted') {
      try {
        activeSubscription.value = await getCurrentSubscription()
      } catch (e) {
        console.error(e)
        activeSubscription.value = null
      }
    } else {
      activeSubscription.value = null
    }
  }

  const init = async () => {
    loading.value = false
    errorMessage.value = ''
    await syncState()
    const resync = () => {
      if (document.visibilityState === 'visible') syncState()
    }
    window.addEventListener('focus', resync)
    document.addEventListener('visibilitychange', resync)
    cleanup.push(() => {
      window.removeEventListener('focus', resync)
      document.removeEventListener('visibilitychange', resync)
    })
  }

  return reactive({
    isSupported,
    permission,
    loading,
    errorMessage,
    activeSubscription,
    subscribe,
    unsubscribe,
    init
  })
}
