# ⚙️ Downloader Backend — REST & WebSocket API

Este é o servidor intermediador (**backend**) do ecossistema Downloader. Ele funciona como uma ponte de comunicação de baixa latência e orientada a eventos entre a interface visual (React) e a infraestrutura do **GitHub Actions**.

O servidor gerencia a autenticação com a API do GitHub, dispara os fluxos de download, recebe webhooks de conclusão do GitHub e notifica o frontend em tempo real usando WebSockets.

---

## 🗺️ Fluxo de Integração

O backend gerencia o seguinte fluxo assíncrono:

1. **Trigger**: Recebe requisições HTTP do frontend e dispara workflows via Octokit (GitHub API).
2. **Track**: Monitora e captura o `runId` do fluxo iniciado para retornar ao frontend.
3. **Stream**: Mantém conexões WebSockets ativas com os clientes para notificar sobre mudanças de status da execução.
4. **Webhook**: Recebe a notificação de finalização do GitHub Actions (`workflow_run` completed), valida a assinatura SHA-256 e obtém a URL direta e segura do artefato gerado.
5. **Dispatch**: Transmite a URL de download finalizada e o nome do arquivo via WebSocket para o cliente.

---

## 🛠️ Tecnologias Utilizadas

* **Node.js** & **Express 5** — Servidor web rápido para gerenciar endpoints REST.
* **WebSockets (`ws`)** — Canal bidirecional em tempo real para atualização de status dos downloads.
* **Octokit (`@octokit/rest`)** — Integração oficial com a API REST do GitHub.
* **Helmet** & **Express Rate Limit** — Proteção de cabeçalhos e limites de requisições para mitigar sobrecargas.
* **Crypto** — Validação segura por criptografia das assinaturas de Webhooks do GitHub.
* **TypeScript** — Verificação estática dos tipos e compilação para JavaScript executado pelo Node.js.

---

## 📂 Estrutura de Diretórios

```text
backend/
├── config/               # Configurações globais e carregamento de envs
├── middleware/           # CORS, Webhook Signature Check & Rate Limiters
├── routes/               # Endpoints REST (/trigger, /webhook, /artifact)
├── websocket/            # Gerenciador de conexões WebSocket e streams
├── types/                # Tipos compartilhados e extensões de tipos
├── dist/                 # JavaScript compilado (gerado pela build, não versionado)
├── index.ts              # Ponto de entrada TypeScript do servidor
├── tsconfig.json         # Configuração do compilador TypeScript
├── .env.example          # Modelo de variáveis de ambiente
└── package.json          # Dependências do servidor
```

---

## ⚙️ Configuração do Ambiente

Crie um arquivo `.env` na raiz do diretório `backend/` baseando-se no `.env.example`:

```env
PORT=3000
FRONTEND_URL=https://neotwr.github.io/downloader  # URL do frontend permitido pelo CORS
OWNER=seu_usuario_github
REPO=nome_deste_repositorio
TOKEN=seu_github_personal_access_token
SECRET=sua_chave_secreta_webhook
WORKFLOW_URLDOWNLOAD=url-download.yml
WORKFLOW_PYDOWNLOAD=pip-download.yml
```

> [!IMPORTANT]
> * **TOKEN**: Requer um Personal Access Token (PAT) do GitHub com permissões de `workflows` (Classic) ou leitura/escrita em `Actions` e `Workflows` (Fine-grained).
> * **SECRET**: Chave aleatória e privada definida por você para validar que as chamadas no endpoint `/webhook` realmente partiram do GitHub.

---

## 💻 Como Executar Localmente

### Pré-requisitos
Certifique-se de ter o [Node.js](https://nodejs.org/) 20 ou superior e o npm instalados. O projeto usa ES Modules e gera JavaScript a partir dos fontes TypeScript.

### Passo a Passo
1. Instale as dependências do projeto:
   ```bash
   npm install
   ```
2. Confira os tipos sem gerar arquivos:
   ```bash
   npm run typecheck
   ```
3. Compile o TypeScript para a pasta `dist/`:
   ```bash
   npm run build
   ```
4. Inicie o servidor compilado:
   ```bash
   npm start
   ```

O comando `npm start` executa `dist/index.js`; ele não compila os fontes. Sempre rode `npm run build` depois de alterar o código e antes de iniciar o servidor. A porta e as demais configurações vêm do arquivo `.env`. Com `PORT=3000`, o servidor estará ativo em `http://localhost:3000`, e as conexões WebSocket usarão o mesmo host e porta.

`npm run test` ainda não executa uma suíte de testes automatizada.

---

## 🔗 Configurando o GitHub Webhook

Para que o backend receba os eventos do GitHub Actions e envie as URLs para o frontend:

1. Acesse as configurações de seu repositório no GitHub (**Settings**).
2. Vá em **Webhooks** > **Add webhook**.
3. Configure os seguintes campos:
   * **Payload URL**: `https://seu-dominio-backend.com/webhook` (ou o túnel público do ngrok/localtunnel se estiver testando localmente).
   * **Content type**: `application/json`.
   * **Secret**: Insira o mesmo segredo definido no seu `.env` (`SECRET`).
   * **Eventos**: Selecione **Let me select individual events** e marque apenas **Workflow runs**.
4. Clique em **Add webhook**.

---

## 🚀 Implantação e Deploy em Produção

O backend pode ser hospedado de forma simples em serviços como **Render**, **Railway**, **Koyeb** ou em uma VPS de sua escolha:
* Certifique-se de configurar todas as variáveis de ambiente presentes no `.env` no painel administrativo de sua plataforma de hospedagem.
* Configure a etapa de build para instalar as dependências de desenvolvimento e executar `npm run build`. O compilador TypeScript está em `devDependencies`, então precisa estar disponível nessa etapa.
* Configure o comando de inicialização como `npm start`. A pasta `dist/` é gerada pela build e não é versionada; a implantação deve preservar o resultado da build para a inicialização.
* Verifique se as conexões WebSockets (`ws://` / `wss://`) não estão sendo bloqueadas por proxies ou firewalls da sua hospedagem.
* Defina corretamente o `FRONTEND_URL` para o endereço do seu frontend a fim de permitir as requisições de CORS.

---

## 📄 Segurança & Limites
* **CORS & Rate Limit**: O backend possui restrições de domínios permitidos e limites de requisições por IP para evitar abusos na sua cota da API do GitHub.
* **Validação de Webhook**: Toda requisição recebida no endpoint `/webhook` passa por uma validação criptográfica HMAC SHA-256 baseada no seu `SECRET`, garantindo que requisições falsificadas sejam sumariamente rejeitadas.
