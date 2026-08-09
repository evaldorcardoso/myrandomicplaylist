import { ref } from 'vue'
import { saveSubscription, deleteSubscription } from '@/services/PushService'

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

export function usePushNotifications() {
  const isSupported = ref(
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  )
  const permission = ref(Notification?.permission ?? 'default')
  const loading = ref(false)
  const errorMessage = ref('')
  const activeSubscription = ref(null)

  const getRegistration = async () => {
    if (!navigator.serviceWorker.controller) {
      await navigator.serviceWorker.ready
    }
    return navigator.serviceWorker.ready
  }

  const getCurrentSubscription = async () => {
    const registration = await getRegistration()
    return registration.pushManager.getSubscription()
  }

  const subscribe = async () => {
    if (!isSupported.value) {
      errorMessage.value = 'Este navegador não suporta notificações push.'
      return false
    }

    loading.value = true
    errorMessage.value = ''

    try {
      const permissionResult = await Notification.requestPermission()
      permission.value = permissionResult
      if (permissionResult !== 'granted') {
        errorMessage.value = 'Permissão de notificação negada.'
        return false
      }

      const applicationServerKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      if (!applicationServerKey) {
        errorMessage.value = 'Chave pública VAPID não configurada.'
        return false
      }

      const registration = await getRegistration()
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(applicationServerKey)
      })

      await saveSubscription(subscription)
      activeSubscription.value = subscription
      return true
    } catch (e) {
      console.error(e)
      errorMessage.value = 'Não foi possível ativar as notificações.'
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
        await subscription.unsubscribe()
        await deleteSubscription(subscription.endpoint)
      }
      activeSubscription.value = null
      return true
    } catch (e) {
      console.error(e)
      errorMessage.value = 'Não foi possível desativar as notificações.'
      return false
    } finally {
      loading.value = false
    }
  }

  const getErrorMessage = () => errorMessage.value

  const init = async () => {
    if (!isSupported.value) return
    permission.value = Notification.permission
    if (permission.value === 'granted') {
      activeSubscription.value = await getCurrentSubscription()
    }
  }

  return {
    isSupported,
    permission,
    loading,
    errorMessage,
    activeSubscription,
    subscribe,
    unsubscribe,
    init
  }
}
