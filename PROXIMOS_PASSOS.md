# 🚀 Próximos Passos - Configuração Rápida

Seu app já está rodando em: **https://social-up.dualis.love/**

Agora você precisa configurar o sistema de renderização de vídeos. Siga estes passos:

---

## ✅ Passo 1: Configurar Supabase Storage (5 minutos)

### 1.1 Criar Bucket
1. Acesse: https://app.supabase.com
2. Selecione seu projeto
3. **Storage** → **New Bucket**
4. Configure:
   - Name: `rendered-videos`
   - Public: ✅ **SIM**
   - File size limit: `500 MB`

### 1.2 Executar SQL
1. **SQL Editor** → **New query**
2. Cole todo o conteúdo de `supabase_update.sql`
3. **Run**

### 1.3 Pegar Service Role Key
1. **Settings** → **API**
2. Copie **service_role (secret)** - você vai precisar no n8n

---

## ✅ Passo 2: Configurar Servidor no DigitalOcean (15 minutos)

### 2.1 Acessar seu servidor
```bash
ssh root@seu-ip-digitalocean
```

### 2.2 Executar script de setup
```bash
# Baixar o script
wget https://raw.githubusercontent.com/seu-repo/main/scripts/setup-server.sh

# Dar permissão
chmod +x setup-server.sh

# Executar
./setup-server.sh
```

Ou copie manualmente os comandos do arquivo `scripts/setup-server.sh`.

### 2.3 Clonar seu repositório
```bash
cd /home/apps
git clone https://github.com/seu-usuario/seu-repo.git shorts-factory
cd shorts-factory
npm install
```

### 2.4 Criar .env no servidor
```bash
nano /home/apps/shorts-factory/.env
```

Cole e **substitua com seus valores**:
```env
VITE_SUPABASE_URL=https://qgbxduvipeadycxremqa.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...sua-chave-aqui
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...service-role-key-do-passo-1.3
```

Salvar: `Ctrl+X` → `Y` → `Enter`

---

## ✅ Passo 3: Configurar n8n (10 minutos)

### 3.1 Importar Workflow
1. Acesse seu n8n no Easypanel
2. **+ New Workflow**
3. Menu **...** → **Import from File**
4. Selecione: `n8n-workflow-video-render.json`

### 3.2 Configurar Credenciais

#### A. Supabase Service Key (para upload)
1. **Settings** → **Credentials** → **+ Add Credential**
2. Escolha: **HTTP Header Auth**
3. Configure:
   - Name: `Supabase Service Key`
   - Header Name: `Authorization`
   - Header Value: `Bearer SEU_SERVICE_ROLE_KEY_AQUI`
4. Save

#### B. Supabase API (para database)
1. **+ Add Credential** → **Supabase API**
2. Configure:
   - Name: `Supabase Credentials`
   - Host: `qgbxduvipeadycxremqa.supabase.co`
   - Service Role Secret: `sua-service-role-key`
3. Save

### 3.3 Configurar Variáveis de Ambiente
1. No workflow, **Settings** (⚙️)
2. **Environment Variables**
3. Adicione:
```
APP_PATH=/home/apps/shorts-factory
SUPABASE_URL=https://qgbxduvipeadycxremqa.supabase.co
```

### 3.4 Atualizar Nodes
- **Node "Upload to Supabase Storage"**: Selecione credential `Supabase Service Key`
- **Node "Save to Database"**: Selecione credential `Supabase Credentials`

### 3.5 Ativar Workflow
1. Toggle **Active** (topo direito)
2. Copie a **Production URL** do node Webhook
   - Exemplo: `https://n8n.dualis.love/webhook/render-video`

---

## ✅ Passo 4: Atualizar Vercel (2 minutos)

### 4.1 Adicionar Variável de Ambiente
1. Acesse: https://vercel.com/seu-projeto
2. **Settings** → **Environment Variables**
3. Adicione:
   - **Name:** `VITE_N8N_WEBHOOK_URL`
   - **Value:** `https://n8n.dualis.love/webhook/render-video`
   - **Environments:** ✅ Production, Preview, Development
4. **Save**

### 4.2 Redeploy
1. **Deployments** → **...** (no último deploy) → **Redeploy**
2. Aguarde build finalizar

---

## ✅ Passo 5: Testar! (5 minutos)

### Teste Completo
1. Acesse: **https://social-up.dualis.love/**
2. Faça login
3. **Generator** → Digite um tópico
4. **Generate Script**
5. Após gerar, clique em **Download MP4**
6. Aguarde a renderização (pode levar 2-5 minutos)
7. Vídeo será baixado automaticamente! 🎉

### Verificar no Supabase
1. **Storage** → **rendered-videos**
2. Deve aparecer o vídeo renderizado

---

## 📊 Checklist Rápido

- [ ] Bucket `rendered-videos` criado no Supabase
- [ ] SQL executado no Supabase
- [ ] Service Role Key copiada
- [ ] Servidor DigitalOcean configurado (Node, Chromium, ffmpeg)
- [ ] Repositório clonado no servidor
- [ ] .env criado no servidor
- [ ] Workflow importado no n8n
- [ ] Credenciais configuradas no n8n
- [ ] Variáveis de ambiente no n8n
- [ ] Workflow ativado
- [ ] Webhook URL copiada
- [ ] `VITE_N8N_WEBHOOK_URL` adicionada na Vercel
- [ ] Vercel redeployado
- [ ] Teste end-to-end executado

---

## 🆘 Troubleshooting Rápido

### "Failed to render video"
1. Verifique se workflow está **Active** no n8n
2. Veja logs da execução no n8n (**Executions**)
3. Verifique se o servidor tem Chromium e ffmpeg instalados

### "Upload error"
1. Service Role Key está correta?
2. Bucket existe e é público?
3. Veja logs do node "Upload to Supabase" no n8n

### Timeout no n8n
- Aumente timeout nos nodes:
  - Bundle Remotion: 300000ms (5 min)
  - Render Video: 900000ms (15 min)

---

## 🎯 Resumo

**Arquitetura:**
```
Frontend (Vercel) → n8n Webhook → Remotion (DigitalOcean) → Supabase Storage
     ↓                                                              ↓
   Usuário ←──────────────────── URL público do vídeo ←───────────┘
```

**Tempo total:** ~30-40 minutos
**Custo mensal:** ~$12 (DigitalOcean)

---

## 📚 Documentação Completa

Para informações detalhadas, consulte:
- **DEPLOY.md** - Guia completo de deploy
- **RENDER_SETUP.md** - Documentação do servidor local

---

Dúvidas? Verifique logs do n8n ou console do navegador (F12).

**Boa sorte! 🚀**
