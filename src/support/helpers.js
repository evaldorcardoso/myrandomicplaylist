import { supabase } from './supabaseClient'
import { clearSpotifyToken } from './spotifyToken'

// Map for localStorage keys
// As credenciais do Spotify não vivem mais no navegador (Supabase Auth + Edge
// Function): aqui ficam apenas preferências e o cache do perfil do usuário.
export const LOCALSTORAGE_KEYS = {
    filterLibrary: 'spotify_filter_library',
    user: 'user',
    settings: 'spotify_settings'
}

export const NOTIFICATIONS_TYPE = {
    success: 'success',
    danger: 'danger',
    warning: 'warning',
    info: 'info'
};

export function hexToRgba(hex, alpha = 0.7) {
    // Remove # if present
    hex = hex.replace('#', '');
    // Handle invalid hex (ensure 6 chars)
    if (hex.length !== 6) return null;
    // Convert to RGB
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default {
    getLocalStorage: () => {
        // Map to retrieve localStorage values
        const LOCALSTORAGE_VALUES = {
          filterLibrary: window.localStorage.getItem(LOCALSTORAGE_KEYS.filterLibrary),
          settings: window.localStorage.getItem(LOCALSTORAGE_KEYS.settings)
        };

        return LOCALSTORAGE_VALUES
    },
    setLocalStorage: (key, value) => {
        window.localStorage.setItem(key, value)
    },
    logout: async () => {
        // Encerra a sessão Supabase (que guarda o JWT) e limpa o cache local.
        clearSpotifyToken()
        window.localStorage.removeItem(LOCALSTORAGE_KEYS.user)
        await supabase.auth.signOut()
    }
}