# SeeBaged ✦

Encontre as **conquistas (badges)** de qualquer jogo do Roblox e marque as que você já tem.

- 🔎 **Busca de jogos** por nome, link (`roblox.com/games/...`) ou ID do place
- 🏅 **Todas as conquistas** do jogo, com ícone, descrição, quantos jogadores ganharam e **dificuldade** (De graça → Impossível) calculada pela taxa de obtenção
- ✅ **Marque o que você tem** com um clique — o progresso fica salvo no navegador
- ⟳ **Sincronização com o Roblox**: digite seu nome de usuário e o site marca sozinho as conquistas que você já ganhou (só dados públicos, sem senha — o inventário precisa estar visível para **Todos** nas configurações de privacidade do Roblox)
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

Só os subdomínios `badges`, `games`, `thumbnails`, `users`, `apis` e `inventory` são liberados, e as respostas ficam em cache por 60 s para evitar limite de requisições.

## Hospedar como site estático (GitHub Pages, Netlify…)

Sem o servidor local, o site tenta usar o [RoProxy](https://roproxy.com) automaticamente. Se ele não funcionar, publique seu próprio proxy gratuito:

1. Crie um Worker na [Cloudflare](https://workers.cloudflare.com) com o conteúdo de [`proxy/cloudflare-worker.js`](proxy/cloudflare-worker.js).
2. No site, abra **⚙ Configurações** e preencha o proxy com `https://SEU-WORKER.workers.dev/{sub}`.

## APIs usadas

| Para quê | Endpoint |
| --- | --- |
| Buscar jogos | `apis.roblox.com/search-api/omni-search` |
| Place → universo | `apis.roblox.com/universes/v1/places/{placeId}/universe` |
| Dados do jogo | `games.roblox.com/v1/games?universeIds=` |
| Conquistas do jogo | `badges.roblox.com/v1/universes/{id}/badges` |
| Conquistas do usuário | `badges.roblox.com/v1/users/{id}/badges/awarded-dates` |
| Usuário por nome | `users.roblox.com/v1/usernames/users` |
| Inventário é público? | `inventory.roblox.com/v1/users/{id}/can-view-inventory` |
| Ícones | `thumbnails.roblox.com/v1/...` |

## Estrutura

```
index.html                 página única
assets/app.js              lógica (busca, conquistas, marcações, sincronização)
assets/styles.css          visual
assets/icon.svg            logo
server.js                  servidor local + proxy da API
proxy/cloudflare-worker.js proxy para hospedagem estática
```

---

SeeBaged não é afiliado à Roblox Corporation.
