# 🚀 Guia de Deploy - Sistema de Renderização de Vídeos

Este guia explica como fazer deploy completo da aplicação usando **DigitalOcean + n8n + Supabase Storage** para renderização de vídeos em produção.

## 📋 Pré-requisitos

- ✅ Conta DigitalOcean com créditos
- ✅ Easypanel instalado e configurado
- ✅ n8n rodando no Easypanel
- ✅ Conta Supabase (já configurada)
- ✅ Repositório Git da aplicação
- ✅ Domínio configurado (opcional, mas recomendado)

---

## 🎯 Arquitetura

```
Frontend (Vercel) → n8n Webhook (DigitalOcean) → Remotion Renderer → Supabase Storage
                                                                            ↓
                                                                      Public Video URL
```

---

## Parte 1: Configurar Supabase Storage

### 1.1 Criar Bucket no Supabase

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **Storage** no menu lateral
4. Clique em **New Bucket**
5. Configure:
   - **Name:** `rendered-videos`
   - **Public:** ✅ YES (para URLs públicos)
   - **Allowed MIME types:** `video/mp4`
   - **File size limit:** 500 MB

### 1.2 Executar SQL para Políticas

1. Vá em **SQL Editor** no Supabase Dashboard
2. Clique em **New query**
3. Cole o conteúdo do arquivo `supabase_update.sql`
4. Clique em **Run**

### 1.3 Obter Service Role Key

1. Vá em **Settings** → **API**
2. Copie a **service_role key** (secret)
3. Guarde para usar no n8n

> ⚠️ **IMPORTANTE:** Nunca exponha a Service Role Key no frontend!

---

## Parte 2: Preparar Servidor DigitalOcean

### 2.1 Criar Droplet (se necessário)

Se ainda não tiver um droplet/servidor:

1. Acesse DigitalOcean Dashboard
2. Create → Droplets
3. Selecione:
   - **Imagem:** Ubuntu 22.04 LTS
   - **Tamanho:** Basic ($12/mês - 2 GB RAM mínimo)
   - **Região:** Próximo aos usuários
4. Adicione SSH key
5. Create Droplet

### 2.2 Executar Script de Setup

No servidor, execute:

```bash
# Fazer download do script
wget https://raw.githubusercontent.com/seu-usuario/seu-repo/main/scripts/setup-server.sh

# Dar permissão de execução
chmod +x setup-server.sh

# Executar
./setup-server.sh
```

Ou copie e execute manualmente os comandos do arquivo `scripts/setup-server.sh`.

### 2.3 Clonar Repositório

```bash
cd /home/apps
git clone https://github.com/seu-usuario/seu-repo.git shorts-factory
cd shorts-factory
npm install
```

### 2.4 Configurar .env no Servidor

```bash
nano /home/apps/shorts-factory/.env
```

Adicione:

```env
VITE_SUPABASE_URL=https://qgbxduvipeadycxremqa.supabase.co
VITE_SUPABASE_ANON_KEY=seu-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=seu-service-role-key-aqui
```

---

## Parte 3: Configurar n8n Workflow

### 3.1 Importar Workflow no n8n

1. Acesse seu n8n (ex: `https://n8n.seu-dominio.com`)
2. Clique em **+** (novo workflow)
3. Clique nos **...** (menu) → **Import from File**
4. Selecione o arquivo `n8n-workflow-video-render.json`
5. O workflow será importado com todos os nodes

### 3.2 Configurar Credenciais

#### A. Criar Credencial HTTP Header Auth (Supabase Storage)

1. No n8n, vá em **Settings** → **Credentials**
2. Clique em **+ Add Credential**
3. Escolha **HTTP Header Auth**
4. Configure:
   - **Name:** `Supabase Service Key`
   - **Header Name:** `Authorization`
   - **Header Value:** `Bearer SEU_SERVICE_ROLE_KEY_AQUI`
5. Save

#### B. Criar Credencial Supabase API

1. **+ Add Credential** → **Supabase API**
2. Configure:
   - **Name:** `Supabase Credentials`
   - **Host:** `qgbxduvipeadycxremqa.supabase.co`
   - **Service Role Secret:** `seu-service-role-key-aqui`
3. Save

### 3.3 Configurar Variáveis de Ambiente no n8n

1. No workflow, clique em **Settings** (gear icon)
2. Vá em **Environment Variables**
3. Adicione:

```
APP_PATH=/home/apps/shorts-factory
SUPABASE_URL=https://qgbxduvipeadycxremqa.supabase.co
```

### 3.4 Atualizar Nodes do Workflow

Verifique e atualize os seguintes nodes:

#### Node: "Upload to Supabase Storage"
- **Credentials:** Selecione `Supabase Service Key`
- **URL:** `={{$env.SUPABASE_URL}}/storage/v1/object/rendered-videos/{{$json.filePath}}`

#### Node: "Save to Database"
- **Credentials:** Selecione `Supabase Credentials`

### 3.5 Ativar Workflow

1. Na barra superior, ative o toggle **Active**
2. O workflow estará pronto para receber requisições

### 3.6 Obter URL do Webhook

1. Clique no node **Webhook**
2. Copie a **Production URL**
3. Exemplo: `https://n8n.seu-dominio.com/webhook/render-video`

---

## Parte 4: Atualizar Frontend

### 4.1 Adicionar Variável de Ambiente

No projeto local (ou no Vercel):

**.env.local:**
```env
VITE_N8N_WEBHOOK_URL=https://n8n.seu-dominio.com/webhook/render-video
```

### 4.2 Deploy no Vercel

Se usando Vercel:

1. Vá em **Settings** → **Environment Variables**
2. Adicione:
   - **Key:** `VITE_N8N_WEBHOOK_URL`
   - **Value:** URL do webhook do n8n
3. Redeploy a aplicação

Ou via CLI:

```bash
vercel env add VITE_N8N_WEBHOOK_URL
# Cole a URL do webhook
vercel --prod
```

---

## Parte 5: Testar o Sistema

### 5.1 Teste Manual do n8n

1. No n8n, clique em **Execute Workflow** (node Webhook)
2. Clique em **Listen for Test Event**
3. Em outro terminal, faça uma requisição de teste:

```bash
curl -X POST https://n8n.seu-dominio.com/webhook/render-video \
  -H "Content-Type: application/json" \
  -d '{
    "script": {
      "scenes": [{
        "text": "Teste",
        "durationInSeconds": 3,
        "imagePrompt": "teste",
        "imageUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "audioUrl": ""
      }],
      "backgroundMusicMood": "Happy"
    },
    "title": "Teste Manual",
    "user_id": "test-user-id"
  }'
```

4. Verifique os logs no n8n
5. Confirme que o vídeo foi criado em `/tmp/`
6. Verifique no Supabase Storage se o vídeo foi uploaded

### 5.2 Teste End-to-End

1. Acesse sua aplicação no navegador
2. Faça login
3. Vá para a aba **Generator**
4. Digite um tópico (ex: "3 fatos sobre Python")
5. Clique em **Generate Script**
6. Após gerar, clique em **Download MP4**
7. Aguarde a renderização (pode levar alguns minutos)
8. Verifique se o download iniciou
9. Confirme no Supabase Storage → Bucket `rendered-videos`

---

## Parte 6: Monitoramento e Debug

### 6.1 Logs do n8n

- Acesse o workflow no n8n
- Clique em **Executions** no menu
- Veja o histórico de execuções
- Clique em uma execução para ver detalhes/erros

### 6.2 Logs do Servidor

```bash
# Ver logs em tempo real
tail -f /var/log/syslog

# Ou logs do PM2 (se instalado)
pm2 logs shorts-factory-server
```

### 6.3 Verificar Supabase Storage

```sql
-- No SQL Editor do Supabase
SELECT * FROM storage.objects
WHERE bucket_id = 'rendered-videos'
ORDER BY created_at DESC
LIMIT 10;
```

### 6.4 Testes Comuns

#### Problema: Timeout no n8n

**Solução:** Aumentar timeout nos nodes Execute Command
- Bundle Remotion: 5 minutos (300000ms)
- Render Video: 15 minutos (900000ms)

#### Problema: Chromium não encontrado

**Solução:**
```bash
which chromium-browser
# Adicionar ao PATH se necessário
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

#### Problema: ffmpeg não encontrado

**Solução:**
```bash
sudo apt-get install -y ffmpeg
ffmpeg -version
```

#### Problema: Vídeo não aparece no Storage

**Verificar:**
1. Service Role Key está correta?
2. Bucket `rendered-videos` existe?
3. Políticas estão configuradas?
4. Logs do n8n mostram erro de upload?

---

## Parte 7: Otimizações (Opcional)

### 7.1 Usar PM2 para Gerenciar Processo

```bash
pm2 start npm --name "shorts-factory-server" -- run server
pm2 save
pm2 startup
```

### 7.2 Configurar NGINX como Reverse Proxy

```nginx
server {
    listen 80;
    server_name render.seu-dominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 7.3 Configurar SSL com Let's Encrypt

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d render.seu-dominio.com
```

### 7.4 Limpar Vídeos Antigos Automaticamente

Criar cron job para deletar vídeos com mais de 30 dias:

```bash
crontab -e
```

Adicionar:
```
0 2 * * * find /tmp/remotion-renders -type f -mtime +30 -delete
```

---

## Parte 8: Custos Estimados

### DigitalOcean
- **Droplet Basic (2 GB RAM):** $12/mês
- **Bandwidth:** Incluído (1 TB)
- **Total:** ~$12/mês

### Supabase
- **Free tier:** 1 GB storage + 2 GB bandwidth
- **Pro ($25/mês):** 100 GB storage + 200 GB bandwidth
- **Total:** $0 (free) ou $25/mês

### Vercel
- **Free tier:** Suficiente para frontend
- **Total:** $0

**Total Estimado:** $12-37/mês

---

## 🎉 Conclusão

Parabéns! Você configurou um sistema completo de renderização de vídeos com:

✅ Renderização sem limites de timeout
✅ Storage persistente na nuvem
✅ Workflow visual e debugável
✅ Escalável e profissional

### Próximos Passos

- [ ] Implementar fila de renderização (BullMQ)
- [ ] Adicionar notificações em tempo real (Supabase Realtime)
- [ ] Criar preview de thumbnail
- [ ] Implementar compressão automática
- [ ] Adicionar CDN (Cloudflare)

### Suporte

Se encontrar problemas:
1. Verifique os logs do n8n
2. Verifique os logs do servidor
3. Teste cada componente separadamente
4. Consulte documentação oficial:
   - [n8n Docs](https://docs.n8n.io/)
   - [Remotion Docs](https://www.remotion.dev/docs/)
   - [Supabase Docs](https://supabase.com/docs)

---

**Desenvolvido com ❤️ usando Remotion + n8n + Supabase**
