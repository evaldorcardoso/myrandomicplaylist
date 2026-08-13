# Plano de Execução — Repaginacão do Fluxo "Mixar" (Random)

## Contexto

Repaginar visualmente **E** repensar o fluxo do menu "Mixar" (Random), migrando do layout antigo (scoped SCSS, Font Awesome, hardcoded colors) para o design system novo (Tailwind v4 + tokens Material 3 + Material Symbols). Lógica de geração (`generatePlaylist`, `getTracks`, pick/order modes) **não** é tocada — puramente front-end.

## Decisões (24)

1. Repaginar visual **E** repensar fluxo
2. Eliminar `Inicio.vue`; Sidebar "Random" → direto no wizard
3. Reduzir de 4 passos para **2 passos** (Configura → Resultado)
4. Passo 1 origens: grid de cards com "origens rápidas" (Liked + Top) em destaque acima, grid de playlists do usuário abaixo (like `Library.vue`)
5. Quantidade: slider + presets (chips 10/20/30/50/100)
6. Manter modo de geração + modo de ordenação como blocos separados (pickMode 3 opções; orderMode 2 opções, condicional)
7. Passo 1: pilha vertical completa + bottom bar com summary + "Generate"
8. Passo 2: lista em table estilo `Playlist.vue` (tabs/paginação), toggle por track + select-all
9. Passo 2: botão primário "Save" + `play_circle` como ícone no header (Execute como affordance secundária)
10. Nome da playlist editável no Passo 1 (input text, default "Random Playlist")
11. Loading Passo 1→2: skeleton rows + header indicator `progress_activity`
12. Botões: bottom bar contextual (Generate no Passo 1, Save no Passo 2); TopBar sem chevrons
13. TopBar durante wizard: chip "1/2" + título do passo no centro
14. Migrar Randomic + Estatisticas pra `notify()`; deletar `Notification.vue`
15. Eliminar `/random`; renomear `/randomic` → `/random`
16. Sidebar: mantém `shuffle`, label **"Mixar"**
17. FloatPlayer permanece visível durante todo o fluxo
18. Empty state: origens rápidas sempre disponíveis + fallback "Reconnect Spotify" se token expirou
19. Botão "Generate" disabled até condições mínimas (≥1 origem, quantidade ≥1) com mensagem contextual
20. Toggle por track + select-all; sem preview/substituir
21. Bottom bar acima do FloatPlayer (`bottom-20 lg:bottom-16`)
22. Pós-save: `router.push('/playlist/:id')` (mantido)
23. Puramente front-end; não toque na lógica de geração
24. Header do Passo 2: `[restart_alt]` + contador central + `play_circle`

## Arquivos afetados

### Modificados
- `src/router/index.js` — remover `/random` (Inicio), renomear `/randomic` → `/random`
- `src/components/Sidebar.vue` — `label: 'Mixar'`, `to: '/random'`
- `src/components/TopBar.vue` — remover chevrons + step props; adicionar chip "1/2" + título condicional
- `src/views/Estatisticas.vue` — migrar de `Notification.vue` para `notify()`
- `src/views/Randomic.vue` — refatoração major do template (Passo 1 + Passo 2)

### Deletados
- `src/views/Inicio.vue`
- `src/components/Notification.vue`

---

## Tarefas

### Tarefa 0 — Investigação de colaterais
**Arquivos:** `src/` (grep)
**Passos:**
- `grep -r "Notification" src/` — confirmar que só Randomic e Estatisticas usam `Notification.vue`
- `grep -r "step-data\|stepData\|update-step-data" src/` — ver se outras rotas além de Randomic usam step nav do TopBar/Layout
- `grep -r "'Randomic'\|\"Randomic\"" src/` — ver se há `router.push({ name: 'Randomic' })` programático
- `grep -r "Inicio" src/` — confirmar que nada mais referencia Inicio
- `grep -r "chart-line" src/` — ver se Font Awesome `chart-line` é usado em outro lugar além de Randomic
- `grep -r "fantChart\|faChartLine" src/main.js` — confirmar registros no main.js
**Saída:** relatório curto do que cada grep retornou, antes de cortar qualquer coisa.

---

### Tarefa 1 — Migrar `Estatisticas.vue` de `Notification.vue` para `notify()`
**Arquivo:** `src/views/Estatisticas.vue`
**Passos:**
- Substituir `<Notification>` (linha ~142) por chamadas `notify({ type, title, text })` da lib `@kyvg/vue3-notification`
- Remover import de `Notification` no script
- Confirmar que `@kyvg/vue3-notification` está importado (igual a `Playlist.vue`)
**Validação:** `yarn build` sem erro.

---

### Tarefa 2 — Migrar `Randomic.vue` `showNotification()` infra para `notify()`
**Arquivo:** `src/views/Randomic.vue`
**Passos:**
- Importar `notify` de `@kyvg/vue3-notification`
- Substituir todas chamadas `showNotification(type, title, message, ...)` por `notify({ type, title, text: message })`
- Remover refs `isNotificationOpened`, `notificationDataReactive`, computeds `notificationOpened`/`notificationData`
- Remover `<Notification>` do template (linha ~483)
- Remover import de `Notification` no script
**Observação:** template antigo ainda existirá (será refatorado na Tarefa 8); só troca o mecanismo de toast aqui.
**Validação:** `yarn build` sem erro.

---

### Tarefa 3 — Deletar `Notification.vue` + limpar registros
**Arquivos:** `src/components/Notification.vue`, `src/main.js`
**Passos:**
- Confirmar via grep que nada mais importa `Notification.vue` (após Tarefas 1 e 2)
- Deletar `src/components/Notification.vue`
- Verificar `src/main.js` — se há registro/import de `Notification`, remover
**Validação:** `yarn build` sem erro.

---

### Tarefa 4 — Atualizar `router/index.js`
**Arquivo:** `src/router/index.js`
**Passos:**
- Remover import de `Inicio` (linha 8)
- Remover route `/random` → `Inicio` (linhas 42-45)
- Renomear `/randomic` → `/random` (linha 57)
- Renomear route `name: 'Randomic'` → `name: 'Random'` (linha 58)
- Manter import e component de `Randomic.vue` (linhas 8, 60)
- Manter `beforeEnter: isLogged` (linha 59)
**Validação:** `yarn build` sem erro.

---

### Tarefa 5 — Deletar `Inicio.vue`
**Arquivo:** `src/views/Inicio.vue`
**Passos:**
- Confirmar via grep que nada importa `Inicio.vue` (após Tarefa 4)
- Deletar `src/views/Inicio.vue`
**Validação:** `yarn build` sem erro.

---

### Tarefa 6 — Atualizar `Sidebar.vue`
**Arquivo:** `src/components/Sidebar.vue`
**Passos:**
- Linha 27: `{ label: 'Random', icon: 'shuffle', to: '/random' }` → `{ label: 'Mixar', icon: 'shuffle', to: '/random' }`

---

### Tarefa 7 — Refatorar `TopBar.vue`
**Arquivo:** `src/components/TopBar.vue`
**Passos:**
- Remover botões `chevron_left`/`chevron_right` do template (linhas 100-114) — **apenas se Tarefa 0 confirmar que só Randomic usa step nav**
- Remover handlers `increaseStep`/`decreaseStep` (linhas 68-85)
- Remover props `currentStep`/`step-data` se não usados por outras rotas
- Adicionar no centro do header, condicional via `route.name === 'Random'`:
  - Chip "1/2" (ou `{currentStep}/2`): `<span class="bg-primary/15 text-primary text-label-sm rounded-full px-sm py-1">1/2</span>`
  - Título: `<span class="text-body-md text-on-surface">Mixar · Configuration</span>` ou `Mixar · Result` baseado em `currentStep`
- Manter hamburger à esquerda, notifications bell + avatar à direita
**Validação:** `yarn build` sem erro; visualmente o header mostra chip+título somenão em `/random`.

---

### Tarefa 8 — Refatorar `Randomic.vue` template (Passo 1 + Passo 2)
**Arquivo:** `src/views/Randomic.vue`
**Passos:**

#### 8a — Ajustes no script setup
- Substituir `currentStep` model: de 1/2/3/99 → **1 (Configura) / 2 (Resultado)**
- Manter estado: `state.playlists`, `state.tracks`, `state.numberTracks`, `state.pickMode`, `state.orderMode`, `state.playlistName`, `state.isProcessing`
- Adicionar computed `selectedCount` (origens selecionadas)
- Adicionar computed `includedCount` (`state.tracks.filter(t => t.checked).length`)
- Adicionar `pagedTracks` computed + `currentPage`, `pageSize = 20` refs (paginação estilo Playlist.vue)
- Adicionar `totalPages` computed
- Garantir que `state.tracks` permanece `markRaw` (via store ou local) — não quebrar Performance Rules

#### 8b — Template Passo 1 (Configura)
Estrutura (pilha vertical, `max-w-[680px] mx-auto px-md py-lg`):

1. **Header sticky** — `text-headline-sm "Mixar Playlist"` + `text-body-sm text-on-surface-variant "Configure a origem, quantidade e modo de geração"`
2. **Section "Origens rápidas"** — grid `grid-cols-2 gap-3`:
   - Card `Liked Songs` (ícone `favorite`, cover gradient overlay, seta `state.filters = ['liked']`)
   - Card `Top Items` (ícone `trending_up`, seta `state.pickMode = 'usertopitems'`)
   - Visual: `rounded-xl bg-surface-container-low overflow-hidden border border-outline-variant/10 hover:border-primary/40 transition p-md flex flex-col gap-sm`
3. **Section "Suas playlists"**:
   - Label `text-label-lg "Suas playlists"`
   - Chips filtros: `All / My / Liked / Select all` (reaproveita `filterPLaylists()`) — `rounded-full bg-surface-container-high px-md py-1 text-label-md hover:bg-primary/15`
   - Grid `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3` de `<article>` com:
     - Cover `<img>` `aspect-square w-full bg-surface-container-high object-cover`
     - `ring-2 ring-primary` + `bg-primary/10` overlay quando `playlist.checked`
     - Clique: `playlist.checked = !playlist.checked`
   - Card: `rounded-xl bg-surface-container-low overflow-hidden border border-outline-variant/10 hover:border-primary/40 transition cursor-pointer relative`
4. **Section "Quantidade"**:
   - Label `text-label-lg`
   - Slider `<input type="range" v-model="state.numberTracks">` + número grande `text-display-sm` lado a lado (`flex items-center gap-md`)
   - Presets: grid `grid-cols-5 gap-2`, cada chip `10 / 20 / 30 / 50 / 100` → `rounded-full bg-surface-container-high px-md py-1 text-label-md`
   - Chip ativo (`numberTracks == preset`): `bg-primary text-on-primary`
5. **Section "Modo de geração"**:
   - Label `text-label-lg "Como as músicas serão escolhidas?"`
   - Grid `grid-cols-1 sm:grid-cols-3 gap-3` de radio cards:
     - **Random** (chama `generatePlaylist()` sem `setPickMode`)
     - **By popularity** (`setPickMode('popularity')`)
     - **User top items** (`setPickMode('usertopitems')`)
   - Card: `rounded-xl p-md border border-outline-variant/10 flex flex-col gap-sm` + ativo `border-primary bg-primary/5` + `<span class="material-symbols-outlined">` por card (`shuffle` / `trending_up` / `mood`) + label `text-body-md`
6. **Section "Modo de ordenação"** (condicional `v-if="state.pickMode == 'popularity' || state.pickMode == 'usertopitems'"`):
   - Label `text-label-lg "Como as músicas serão ordenadas?"`
   - 2 radio cards: Top first (`setOrderMode('top')`), Top last (`setOrderMode('bottom')`) — mesmo padrão visual
   - Ícones: `vertical_align_top` / `vertical_align_bottom`
7. **Section "Nome da playlist"**:
   - Label `text-label-lg`
   - `<input type="text" v-model="state.playlistName">` classe `w-full rounded-xl bg-surface-container-low px-md py-2 text-body-md text-on-surface border border-outline-variant/10 focus:border-primary focus:outline-none`
8. **Bottom bar** (Passo 1):
   - Container: `fixed bottom-20 lg:bottom-16 left-0 right-0 mx-xl rounded-2xl bg-surface-container-low/95 backdrop-blur-md border border-outline-variant/10 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.4)] p-md flex items-center justify-between`
   - Esquerda: summary `text-label-md text-on-surface-variant "{selectedCount} origens · {numberTracks} músicas · {pickModeLabel}"`
   - Direita: botão `Generate` (`:disabled="selectedCount < 1 || numberTracks < 1"`)
     - disabled: `bg-surface-container-high text-on-surface-variant/40 cursor-not-allowed`
     - habilitado: `bg-primary text-on-primary hover:bg-primary/90` + ícone `auto_awesome` left
   - Mensagem contextual abaixo (`v-if="generateBlocked"`): `text-label-sm text-on-surface-variant px-md "Selecione ao menos uma origem"` ou `"Defina a quantidade"`
   - `@click="goToStep(2)"` se habilitado — chama `generatePlaylist()` (lógica existente) e muda `currentStep = 2`

#### 8c — Template Passo 2 (Resultado)
Estrutura:

1. **Header** — `h-14 rounded-2xl bg-surface-container-low border border-outline-variant/10 flex items-center justify-between px-md`:
   - Esquerda: `<button @click="generatePlaylist()">` (regenerar com mesmas configs) + tooltip "Regenerar" → `<span class="material-symbols-outlined text-on-surface-variant hover:text-primary">restart_alt</span>`
   - Centro: `text-body-md "{includedCount} de {state.tracks.length} tracks"`
   - Direita: `<button @click="executePlaylist()">` → `<span class="material-symbols-outlined text-primary hover:text-primary/80">play_circle</span>`
2. **Loading skeleton** (`v-if="state.isProcessing"`):
   - 10 linhas `animate-pulse bg-surface-container-high h-14 rounded-lg` — mesmo padrão de `Playlist.vue` linhas 1515-1553
3. **Tabela de tracks** (`v-else`) — estilo `Playlist.vue` linhas 1396-1561:
   - `<table class="w-full">` + `<thead>` com colunas `[Select all toggle] [#] [Título/Artista] [Popularidade]`
   - Select all no header: `<input type="checkbox">` ou `<span class="material-symbols-outlined">select_all</span>` que toggles todos `track.checked`
   - `<tbody>` com `<tr v-for="(track, index) in pagedTracks">`:
     - Coluna 1: toggle `v-model="track.checked"` — switch Material estilizado
     - Coluna 2: índice paginado (`(currentPage - 1) * pageSize + index + 1`)
     - Coluna 3: capa `<img src="track.album.images[0].url" class="w-10 h-10 rounded-md">` + título `text-body-md text-on-surface` + artista `text-body-sm text-on-surface-variant`
     - Coluna 4: badge popularidade:
       - `<span class="material-symbols-outlined" :class="popularityClass(track.popularity)">trending_up</span>`
       - classes: `text-error` (<40), `text-tertiary` (40-70), `text-primary` (≥70)
       - Número "%" `text-label-sm text-on-surface-variant ml-1`
4. **Paginação** — reusar padrão `Playlist.vue` linhas 1573-1589:
   - `<button @click="currentPage--" :disabled="currentPage <= 1">` + `<span class="material-symbols-outlined">chevron_left</span>`
   - `text-label-md "Página {currentPage} de {totalPages}"`
   - `<button @click="currentPage++" :disabled="currentPage >= totalPages">` + `<span class="material-symbols-outlined">chevron_right</span>`
5. **Empty state** (`v-if="!state.isProcessing && state.tracks.length === 0"`):
   - Card central com `<span class="material-symbols-outlined text-on-surface-variant/40 text-6xl">queue_music</span>` + `text-headline-sm "Nenhuma origem disponível"` + `text-body-sm text-on-surface-variant "Não conseguimos carregar playlists, Liked Songs ou Top Items."`
   - Botão `Refresh` chamando `getUserPlaylists()`
   - Se erro de auth (401): trocar mensagem pra "Sua sessão expirou" + botão `Reconectar Spotify` → `helpers.logout()` ou `router.push('/login')`
6. **Bottom bar** (Passo 2):
   - Mesmo container `fixed bottom-20 lg:bottom-16 ...`
   - Esquerda: `text-label-md text-on-surface-variant "{includedCount} tracks incluídas"`
   - Direita: botão `Save` (`bg-primary text-on-primary hover:bg-primary/90`) → chama `savePlaylist()` (lógica existente) e `router.push('/playlist/' + playlistId)`

#### 8d — Limpar `<style scoped>`
- Remover todo o `<style scoped>` antigo (linhas 624-811) — todos os seletores legados não têm correspondente no novo template
- Remover import de Font Awesome `chart-line` se ainda existir
- Confirmar que nenhum class name antigo (`button-spotify`, `list-item`, `footer-fixed`, `icon-popularity-*`, etc.) ficou órfão no novo template

---

### Tarefa 9 — Validações finais de build e regras do AGENTS.md
**Passos:**
- `yarn build` sem errors de import/unused
- `yarn dev` — caminhar o fluxo manualmente:
  - Abrir Sidebar → "Mixar"
  - Passo 1 carrega origens rápidas + grid de playlists
  - Selecionar 2 origens
  - Slider 20 + preset chip 20
  - "Random" pick mode (bloco de ordenação NÃO aparece)
  - Digitar nome "Teste"
  - "Generate" habilita → click → skeleton → Passo 2 tabela carrega
  - Toggle 1 track off
  - "Save" → redirect `Playlist.vue` com playlist criada
- Back do browser: volta pra última rota antes do wizard, não fica preso no Passo 2
- Empty state simulado: comentar temporariamente `getPlaylists` return → cards de liked + top aparecem; simular 401 → fallback "Reconectar Spotify"
- FloatPlayer visível e funcional durante todo o wizard
- TopBar durante wizard: "1/2 Mixar · Configuration" / "2/2 Mixar · Result"
- Nenhuma referência a `Notification` ou `Inicio` em nenhum arquivo (`grep -r "Notification\|Inicio" src/`)
- Verificar que **NÃO** foi usado `max-w-md`/`max-w-lg` (proibido pelo AGENTS.md) — só `max-w-[420px]`, `max-w-[680px]` ou container scale (`max-w-2xl`, `max-w-4xl`)
- Verificar Performance Rules: nenhum loop escrevendo em tracks reactive; `state.tracks` continua `markRaw`

---

## Riscos detectados

- **TopBar chevrons**: se outras rotas além de Randomic usam `step-data` no Layout → precisamos decidir mantê-los como genérico do TopBar ou limpar. Tarefa 0 resolve essa dúvida.
- **Route name colision**: se há `router.push({ name: 'Randomic' })` programático em algum lugar, renomear para `Random` quebra. Tarefa 0 resolve.
- **`markRaw` em tracks toggle**: toggle `track.checked` no Passo 2 precisa confirmar que `state.tracks` continua wrapped em `markRaw` (via store) pra evitar re-grind de performance. Se `state.tracks` estiver sendo populado diretamente em Randomic (não via store), marcar `markRaw` no push.

---

## Ordem recomendada de execução

1. **Tarefa 0** (investigação)
2. **Tarefa 1** (Estatisticas → notify)
3. **Tarefa 2** (Randomic → notify, mantém template antigo)
4. **Tarefa 3** (deletar Notification.vue)
5. **Tarefa 4** (router)
6. **Tarefa 5** (deletar Inicio.vue)
7. **Tarefa 6** (Sidebar Mixar)
8. **Tarefa 7** (TopBar chip + título)
9. **Tarefa 8** (Randomic refatoração — major)
10. **Tarefa 9** (validações)
