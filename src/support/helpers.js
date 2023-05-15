// Map for localStorage keys
export const LOCALSTORAGE_KEYS = {
    code: 'spotify_code',
    accessToken: 'spotify_access_token',
    refreshToken: 'spotify_refresh_token',
    expireTime: 'spotify_token_expire_time',
    //timestamp: 'spotify_token_timestamp',
    filterLibrary: 'spotify_filter_library',
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
          filterLibrary: window.localStorage.getItem(LOCALSTORAGE_KEYS.filterLibrary)
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