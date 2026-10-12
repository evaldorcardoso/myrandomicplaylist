# MR Playlist

Painel web (PWA) para **curadoria profissional de playlists do Spotify**. Nasceu como gerador de playlists aleatórias, mas evoluiu para uma ferramenta de gestão completa: venda e administração de posições ("slots") dentro das playlists, controle financeiro, alertas de expiração/renovação e sincronização direta com o Spotify.

> Ferramenta de **uso pessoal do curador proprietário** (não é multi-tenant). O escopo completo, requisitos e roadmap estão em [`docs/PRD.md`](docs/PRD.md).

## O que o app faz

- **Dashboard** — receita do mês, ocupação/posições ativas, faixas expiradas e seguidores; alertas de expiração com ações de renovação, push e cópia de mensagem para WhatsApp.
- **Biblioteca** — lista todas as playlists do Spotify (paginado), filtra por minhas/públicas/privadas/curadoria e marca quais são gerenciadas.
- **Detalhe da playlist** — ocupação por posição (livre/pendente/pago), valor, contagem regressiva de expiração, abas (todas / expira em breve / expiradas / disponíveis / pendentes), busca, paginação e detecção de divergência de ordem vs. Spotify.
- **Venda e gestão de slots** — vender posição (requester, curador, valor, vencimento, marcar pago), renovar, liberar, remover/trocar/mover faixa, tratar pedidos órfãos e ordenar/sincronizar a ordem das faixas no Spotify.
- **Adicionar faixa** — sugere playlists compatíveis por gênero, insere em posição ou no fim e pode encadear com a venda de um slot.
- **Mixar (padrão aleatório)** — gera playlists aleatórias por popularidade/top do usuário a partir de fontes selecionadas e salva no Spotify.
- **Player** — controles de reprodução, seleção de dispositivo e ações sobre a faixa atual (adicionar à playlist, vender slot, copiar). Inclui mini-player global.
- **Estatísticas** — crescimento de likes (15/30/90D), tendência de seguidores, top artistas e mix de gêneros.
- **Financeiro** — ledger de ganhos (novos e renovações) com filtros por período e totais.
- **Configurações** — preços por faixa de posição, notificações push e ajustes de paginação/lote.

## App Demo

O aplicativo conta com uma versão rodando no endereço abaixo:
- [MR Playlist on Vercel](https://myrandomicplaylist.vercel.app/)
- Porém devido a limitações da API do Spotify, para conseguir logar com sua conta é necessário que tenha uma conta de desenvolvedor na api do Spotify e adicionar o email a ser usado no login como um email permitido para realizar login.

## Tecnologias utilizadas

- <img src="https://developer.spotify.com/images/spotify-for-developers-logo.svg#s4d-logo" alt="drawing" style="width:15px;"/> [Spotify Web API - Spotify for Developers](https://developer.spotify.com/)
- <img src="https://github.com/evaldorcardoso/myrandomicplaylist/assets/2326579/11d6c2cc-f1a6-482c-9fe2-b75fe72d8454" alt="drawing" style="width:15px;"/> [VueJS3 - The Progressive JavaScript Framework](https://v3.vuejs.org/)
- <img src="https://vitejs.dev/logo.svg" alt="drawing" style="width:15px;"/> [Vite - Next Generation Frontend Tooling](https://vitejs.dev/)
- <img src="https://github.com/evaldorcardoso/myrandomicplaylist/assets/2326579/be802944-6a1e-410f-9f1a-36884b76275b" alt="drawing" style="width:15px;"/> [Pinia - The Intuitive Store](https://pinia.vuejs.org/)
- <img src="https://github.com/evaldorcardoso/myrandomicplaylist/assets/2326579/16a7b373-3797-49c5-87ec-78e749dbcac9" alt="drawing" style="width:15px;"/> [Supabase - The Open Source Firebase alternative](https://supabase.com/)

## 🛠️ 1- Como fazer funcionar localmente:
* Navegar até a pasta do projeto
* Instalar as dependências no terminal: **yarn**
* Ter uma conta de desenvolvedor no [Spotify](https://developer.spotify.com/) e no [Supabase](https://supabase.com/).
* Configurar as chaves e configs copiando e seguindo o exemplo do arquivo .env.example
* Ainda no terminal rodar o projeto com: **yarn dev**
* Será exibido no terminal o endereço para acessar o aplicativo no navegador

### Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `VITE_APP_URL` | URL da aplicação |
| `VITE_API_URL` | Base da Spotify Web API |
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_KEY` | Chave anon do Supabase |
| `VITE_SUPABASE_PLAYLISTS_TABLE` | Tabela de **estatísticas** de playlists (histórico de likes) |
| `VITE_SUPABASE_TRACKS_TABLE` | Tabela de popularidade por faixa |
| `VITE_VAPID_PUBLIC_KEY` | Chave pública VAPID (Web Push) |

> O `client_id`/`client_secret` do Spotify e a chave privada VAPID ficam apenas no servidor (Supabase Auth + Edge Functions); não são mais empacotados no frontend.

## 📚 Documentação

- [`docs/PRD.md`](docs/PRD.md) — Product Requirements Document (produto atual + roadmap).
- [`AGENTS.md`](AGENTS.md) — convenções de código e regras de performance para agentes.

## 📱 Seguem algumas telas do aplicativo funcionando:
![image](https://github.com/evaldorcardoso/myrandomicplaylist/assets/2326579/54dbe8e7-f525-47be-85ff-d60bb2a9f372)
![image](https://github.com/evaldorcardoso/myrandomicplaylist/assets/2326579/4fc2a39c-be1a-4b16-ac65-2cf27f1bf968)
![image](https://github.com/evaldorcardoso/myrandomicplaylist/assets/2326579/f2d63789-700a-491b-b2d0-ca01ae852224)
![image](https://github.com/evaldorcardoso/myrandomicplaylist/assets/2326579/480986f9-b1ef-4424-a2da-cbc0979bc97b)
![image](https://github.com/evaldorcardoso/myrandomicplaylist/assets/2326579/bb4f616c-0f40-40ee-86f1-5bf2a1a420ac)
![image](https://github.com/evaldorcardoso/myrandomicplaylist/assets/2326579/f5e97f1a-1ff5-4b0e-b3e6-b6c9b1f73c52)
![image](https://github.com/evaldorcardoso/myrandomicplaylist/assets/2326579/61de96d5-ee0a-49f0-9743-c697a6e348c3)
![image](https://github.com/evaldorcardoso/myrandomicplaylist/assets/2326579/1481bd29-435a-4327-ae02-e1d5a4c0b02b)
