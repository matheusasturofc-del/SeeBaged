# SeeBaged ✦

Encontre as **conquistas (badges)** de qualquer jogo do Roblox e marque as que você já tem.

- 🔎 **Busca de jogos** por nome, link (`roblox.com/games/...`) ou ID do place
- 🏅 **Todas as conquistas** do jogo, com ícone, descrição, quantos jogadores ganharam e **dificuldade** (De graça → Impossível) calculada pela taxa de obtenção
- ✅ **Marque o que você tem** com um clique — o progresso fica salvo no navegador
- ⟳ **Sincronização com o Roblox**: digite seu nome de usuário e o site marca sozinho as conquistas que você já ganhou (veja abaixo como criar a chave de API)
- 🎛️ Filtros (Todas / Tenho / Faltam), busca e ordenação (mais raras, mais comuns, mais novas…)
- 🏆 **Minha coleção**: progresso de todos os jogos, estatísticas gerais e backup (exportar/importar JSON)
- 📱 Funciona no celular

## Como rodar

Precisa do [Node.js](https://nodejs.org) 18 ou mais novo. Não há dependências para instalar.

```bash
npm start
# abra http://localhost:3000
```

Para usar outra porta: `PORT=8080 npm start`.

### Por que existe um servidor?

As APIs do Roblox não permitem chamadas diretas do navegador (CORS). O `server.js` serve o site e repassa as chamadas para o Roblox:

```
/rbx/<subdomínio>/<caminho>  →  https://<subdomínio>.roblox.com/<caminho>
```

Só os subdomínios `badges`, `games`, `thumbnails`, `users` e `apis` são liberados, e as respostas ficam em cache por 60 s para evitar limite de requisições.

## Sincronizar com a sua conta (chave de API)

Desde 2026 o Roblox não libera mais as conquistas de um jogador para chamadas anônimas. O site usa a API oficial **Open Cloud**, que precisa de uma chave grátis criada na sua conta:

1. Abra [Chaves de API](https://create.roblox.com/dashboard/credentials?activeTab=ApiKeysTab) no Creator Hub e clique em **Criar chave de API**.
2. Em **Permissões de acesso**, escolha o sistema **inventory-item** com a operação **read**.
3. Deixe **Restringir endereços IP** desligado, salve e copie a chave.
4. No SeeBaged, clique em **⟳ Sincronizar com Roblox** (ou ⚙ Configurações → Chave de API) e cole a chave.

A chave fica só no seu navegador e só é repassada ao `apis.roblox.com` pelo servidor local — nunca a um proxy de terceiros. Se o inventário estiver visível para **Todos**, qualquer chave funciona; se for privado, a chave precisa ser da própria conta com a permissão de leitura de inventário.

## Publicar no GitHub Pages

O site é 100% estático, então roda no GitHub Pages: **https://matheusasturofc-del.github.io/SeeBaged/**

1. Em **Settings → Pages**, escolha **Deploy from a branch**, a branch do site e a pasta **/ (root)**, e clique em **Save**.
2. Como lá não existe o `server.js`, o site precisa de um proxy online para falar com o Roblox. Crie um grátis na Cloudflare:
   1. Entre em [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Start with Hello World** → dê o nome `seebaged-proxy` → **Deploy**.
   2. Clique em **Edit code**, apague tudo, cole o conteúdo de [`proxy/cloudflare-worker.js`](proxy/cloudflare-worker.js) e clique em **Deploy**.
   3. Copie o endereço do Worker (algo como `https://seebaged-proxy.SEU-NOME.workers.dev`).
3. Coloque o endereço em [`assets/config.js`](assets/config.js), terminando com `/{sub}`:
   ```js
   proxy: 'https://seebaged-proxy.SEU-NOME.workers.dev/{sub}',
   ```

Sem o Worker, o site tenta o [RoProxy](https://roproxy.com) (serviço de terceiros, pode não funcionar) e a sincronização com chave fica desligada, porque a chave nunca é enviada a terceiros. O Worker só aceita chamadas do `matheusasturofc-del.github.io` e do `localhost` (lista `ALLOWED_ORIGINS` no arquivo).

## APIs usadas

| Para quê | Endpoint |
| --- | --- |
| Buscar jogos | `apis.roblox.com/search-api/omni-search` |
| Place → universo | `apis.roblox.com/universes/v1/places/{placeId}/universe` |
| Dados do jogo | `games.roblox.com/v1/games?universeIds=` |
| Conquistas do jogo | `badges.roblox.com/v1/universes/{id}/badges` |
| Conquistas do usuário (com chave) | `apis.roblox.com/cloud/v2/users/{id}/inventory-items?filter=badgeIds=…` (Open Cloud) |
| Usuário por nome | `users.roblox.com/v1/usernames/users` |
| Ícones | `thumbnails.roblox.com/v1/...` |

## Estrutura

```
index.html                 página única
assets/app.js              lógica (busca, conquistas, marcações, sincronização)
assets/config.js           endereço do proxy quando hospedado (GitHub Pages)
assets/styles.css          visual
assets/icon.svg            logo
server.js                  servidor local + proxy da API
proxy/cloudflare-worker.js proxy para hospedagem estática
```

---

SeeBaged não é afiliado à Roblox Corporation.
