import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tsParser from '@typescript-eslint/parser'

// Flat config (ESLint v9). Base mínima: `@eslint/js` recommended +
// `plugin:vue/vue3-essential`, com blocos separados por ambiente de execução.
export default [
  {
    ignores: [
      'dist/**',
      'dev-dist/**',
      'node_modules/**',
      'public/**',
      'coverage/**',
      '.kilo/**',
      '.agents/**'
    ]
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    // TypeScript: o parser próprio lê a sintaxe dos arquivos `.ts`
    // (`src/sw.ts` e as Edge Functions). Como não há lint com informação de
    // tipos (`recommended-type-checked`), `no-undef`/`no-unused-vars` do JS não
    // se aplicam bem aqui e ficam desligados para esses arquivos.
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off'
    }
  },
  {
    rules: {
      // Só `console.error` é permitido no código; o restante vira aviso.
      'no-console': ['warn', { allow: ['error'] }],
      // As views/componentes seguem nomes curtos em pt-BR (Dashboard, Login,
      // Sidebar, Financeiro...), single-word por convenção do app.
      'vue/multi-word-component-names': 'off'
    }
  },
  {
    // Aplicação (browser).
    files: ['src/**/*.{js,vue,ts}'],
    languageOptions: {
      globals: { ...globals.browser }
    }
  },
  {
    // Service worker do PWA (worker + service worker globals).
    files: ['src/sw.ts'],
    languageOptions: {
      globals: { ...globals.serviceworker, ...globals.worker }
    }
  },
  {
    // Scripts utilitários e configurações (Node).
    files: ['scripts/**/*.js', '*.config.{js,mjs}'],
    languageOptions: {
      globals: { ...globals.node }
    }
  },
  {
    // Testes rodam no Node (Vitest), mas alguns stubam APIs de browser
    // (ex.: `localStorage`).
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser }
    }
  },
  {
    // Edge Functions (Deno, rodam no runtime do Supabase).
    files: ['supabase/functions/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        Deno: 'readonly'
      }
    }
  }
]
