# AGENTS.md - MR Playlist

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
- **IMPORTANT**: Never use `max-w-sm/md/lg/xl` (or `max-w-{spacing-token}`). The `@theme` in `src/assets/main.css` defines custom `--spacing-*` tokens (`--spacing-md: 1.5rem`, etc.), and in Tailwind v4 these classes resolve to `var(--spacing-*)` instead of the container scale — e.g. `max-w-md` becomes `max-width: 1.5rem` (24px), collapsing the element into a thin bar. Use arbitrary values (`max-w-[420px]`) or container-scale sizes (`max-w-2xl`/`max-w-4xl`).

### API Patterns
- Supabase for database operations
- Axios for HTTP requests
- Environment variables prefixed with `VITE_` for client-side config
- Use `import.meta.env.VITE_*` for accessing env vars

### Database Changes
- **NEVER create migration files** (do not add files under `supabase/migrations/`)
- Execute database commands directly on Supabase via the MCP (e.g. `apply_migration` / `execute_sql`)

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

## Performance Rules

These rules exist because the app froze for ~30s on playlist entry. Cause: writing properties into deeply-reactive objects stored in Pinia (e.g. Spotify track objects) is extremely slow (up to ~180ms per write in some browsers). Always follow the pattern below.

### Never do this
- Mutate properties on track objects coming from the store while they are deep-reactive. This applies to any loop that writes into reactive objects: `track.id = index`, `track._slot = ...`, `track.track.popularity_old = ...`, `track.track.tracked = ...`. These caused 8-16s stalls per loop.
- Add temporary debug instrumentation to the committed code: `setInterval` heartbeats, `performance.now()` step logging, or CONTROL experiments (e.g. comparing against `JSON.parse(JSON.stringify(...))` copies).
- Rely on reactivity of mutated non-reactive data for UI updates.

### Always do this
- Store Spotify track objects as raw (non-reactive) data in the store: `this.playlists[index].tracks = tracks.map(track => markRaw(track))` (import `markRaw` from `'vue'`). All subsequent writes to those objects become cheap and direct.
- When you mutate that raw data (e.g. `_slot`, `popularity_old`) and need the UI to refresh, bump an explicit render trigger: a `ref(0)` version counter read by computeds and incremented after each mutation (`const bumpSlots = () => slotsVersion.value++`).
- Keep loops over track arrays focused on reads only, or on raw writes. If you need to store computed per-track data, attach it to the raw track or keep it in a separate reactive structure.

## Font Awesome Icons

To use an icon in a component, you need to add it in two places in `main.js`:

1. Import the icon from `@fortawesome/free-solid-svg-icons` or `@fortawesome/free-regular-svg-icons`:
```javascript
import { 
    faSomeIcon,
    faAnotherIcon
} from '@fortawesome/free-solid-svg-icons'
```

2. Add to the library:
```javascript
library.add(
    faSomeIcon,
    faAnotherIcon
)
```

Then use in template with `<font-awesome-icon icon="some-icon" />`. Use `solid` prefix for regular icons: `<font-awesome-icon :icon="['fas', 'some-icon']" />`
