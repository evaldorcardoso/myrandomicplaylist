# AGENTS.md - My Randomic Playlist

## Project Overview

Vue 3 + Vite application for generating random Spotify playlists with Supabase backend.

## Build Commands

```bash
# Install dependencies
yarn

# Development server (http://localhost:5173)
yarn dev

# Production build
yarn build

# Preview production build locally
yarn preview
```

**Note**: No test framework or linter is currently configured.

## Environment Setup

Copy `.env.example` to `.env` and configure:
- `VITE_SPOTIFY_CLIENT_ID` - Spotify API client ID
- `VITE_SPOTIFY_CLIENT_SECRET` - Spotify API client secret
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_KEY` - Supabase anon key
- `VITE_SUPABASE_PLAYLISTS_TABLE` - Supabase table for playlists
- `VITE_SUPABASE_TRACKS_TABLE` - Supabase table for tracks

## Code Style Guidelines

### General
- Language: JavaScript (no TypeScript)
- Vue Version: 3.x with Composition API
- Prefer `<script setup>` syntax in Vue components

### Imports
- Use `@/` alias for src directory: `import foo from '@/stores/foo'`
- External libraries: double quotes
- Relative imports: single quotes or double quotes
- Order: Vue core, external libraries, internal modules, components

### Naming Conventions
- **Components**: PascalCase (e.g., `Navbar.vue`, `FloatPlayer.vue`)
- **Views**: PascalCase (e.g., `Library.vue`, `Playlist.vue`)
- **Stores**: camelCase with `use` prefix (e.g., `useUserStore`)
- **Services**: PascalCase (e.g., `PlaylistService.js`)
- **Variables/Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE

### Component Structure
```vue
<script setup>
  import { ref, computed, onMounted } from 'vue'
  
  const state = reactive({ ... })
  const props = defineProps({ ... })
  const emit = defineEmits(['event'])
  
  // methods
  const myMethod = () => { ... }
</script>

<template>
  <!-- HTML with kebab-case attributes -->
</template>

<style scoped>
  /* SCSS with nesting support */
</style>
```

### State Management (Pinia)
- Use Options API style with `state`, `getters`, `actions`
- Getters access state directly
- Actions use `this` for state/methods
- Store composition: `const store = useStoreName()`

### Error Handling
- Use try/catch for async operations
- Log errors with `console.error()`
- Return boolean for operation success/failure when appropriate

### Styling
- Use SCSS (with `lang="scss"` in Vue components)
- Use `scoped` attribute for component-specific styles
- Support CSS nesting (BEM-style patterns common)

### API Patterns
- Supabase for database operations
- Axios for HTTP requests
- Environment variables prefixed with `VITE_` for client-side config
- Use `import.meta.env.VITE_*` for accessing env vars

## File Organization

```
src/
├── App.vue
├── main.js              # App initialization, plugin registration
├── router/
│   └── index.js         # Route definitions, guards
├── stores/              # Pinia stores
│   ├── user.js
│   └── playlist.js
├── services/            # Business logic
│   └── PlaylistService.js
├── support/             # Utilities
│   ├── helpers.js
│   ├── spotifyApi.js
│   └── supabaseClient.js
├── views/               # Page components
│   ├── Inicio.vue
│   ├── Library.vue
│   └── ...
├── components/          # Reusable components
│   ├── Navbar.vue
│   └── ...
├── composables/         # Vue composables
└── axios-plugin.js
```

## Path Aliases

Configured in `vite.config.js`:
- `@/` → `./src/`

## Common Operations

```javascript
// LocalStorage helpers
import helpers, { LOCALSTORAGE_KEYS } from '@/support/helpers'
helpers.getLocalStorage()
helpers.setLocalStorage(key, value)
helpers.logout()

// Supabase queries
import { supabase } from '@/support/supabaseClient'
const { data, error } = await supabase.from('table').select('*')

// Notifications
import { notify } from '@kyvg/vue3-notification'
notify({ type: 'success', title: 'Message' })
```

## Development Notes

- App uses PWA with Workbox for offline caching
- Spotify images cached for 30 days
- Production build uses `/myrandomicplaylist/` base path
- Development uses `/` as base path
- No linting or tests configured - ensure code quality manually before commits
