// Map for localStorage keys
export const LOCALSTORAGE_KEYS = {
    code: 'spotify_code',
    accessToken: 'spotify_access_token',
    refreshToken: 'spotify_refresh_token',
    expireTime: 'spotify_token_expire_time',
    //timestamp: 'spotify_token_timestamp',
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
          code: window.localStorage.getItem(LOCALSTORAGE_KEYS.code),
          accessToken: window.localStorage.getItem(LOCALSTORAGE_KEYS.accessToken),
          refreshToken: window.localStorage.getItem(LOCALSTORAGE_KEYS.refreshToken),
          expireTime: window.localStorage.getItem(LOCALSTORAGE_KEYS.expireTime),
          //timestamp: window.localStorage.getItem(LOCALSTORAGE_KEYS.timestamp),
          filterLibrary: window.localStorage.getItem(LOCALSTORAGE_KEYS.filterLibrary),
          settings: window.localStorage.getItem(LOCALSTORAGE_KEYS.settings)
        };

        return LOCALSTORAGE_VALUES
    },
    setLocalStorage: (key, value) => {
        window.localStorage.setItem(key, value)
    },
    logout: () => {
        // Clear all localStorage items
        for (const property in LOCALSTORAGE_KEYS) {
            window.localStorage.removeItem(LOCALSTORAGE_KEYS[property]);
        }
    }
}