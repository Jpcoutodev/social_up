<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 🎬 Shorts Factory AI

Plataforma completa para geração automatizada de vídeos verticais (Shorts/Reels) usando IA.

**Live Demo:** [https://social-up.dualis.love/](https://social-up.dualis.love/)

## ✨ Funcionalidades

- 🤖 **Geração de Scripts com IA** - Gemini 2.5 Flash ou GPT-4o
- 🎨 **Imagens Geradas por IA** - DALL-E 3 ou Gemini Imagen
- 🎙️ **Voiceover Automático** - TTS com Google Gemini ou OpenAI
- 📱 **Preview em Tempo Real** - Player Remotion interativo
- 💾 **Biblioteca de Vídeos** - Salvos no Supabase
- 🎥 **Renderização MP4** - Download direto via n8n + Supabase Storage
- 🌐 **Suporte Multi-idioma** - PT-BR, EN-US, ES-ES
- 🎵 **Música de Fundo** - Seleção automática por mood

## 🏗️ Arquitetura

```
┌─────────────────┐
│   Frontend      │  React + Vite + Tailwind CSS
│   (Vercel)      │  @remotion/player para preview
└────────┬────────┘
         │
         ├─────► Gemini/OpenAI API (geração de conteúdo)
         │
         ├─────► Supabase (auth + database)
         │
         └─────► n8n Webhook (renderização)
                     │
                     ├─► @remotion/renderer
                     │
                     └─► Supabase Storage (MP4 final)
```

## 🚀 Quick Start - Desenvolvimento Local

### Pré-requisitos
- Node.js 18+
- Conta Supabase
- API Key do Gemini ou OpenAI

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar .env.local
```env
# Supabase
VITE_SUPABASE_URL=sua-url-supabase
VITE_SUPABASE_ANON_KEY=sua-anon-key

# IA (pelo menos uma)
VITE_GEMINI_API_KEY=sua-gemini-key
VITE_OPENAI_API_KEY=sua-openai-key

# n8n (opcional para produção)
# VITE_N8N_WEBHOOK_URL=https://n8n.seu-dominio.com/webhook/render-video
```

### 3. Iniciar desenvolvimento
```bash
# Apenas frontend
npm run dev

# Frontend + servidor de renderização local
npm run dev:all
```

Acesse: [http://localhost:5173](http://localhost:5173)

## 📦 Deploy em Produção

### Opção 1: Vercel (Frontend) + DigitalOcean + n8n (Recomendado)

✅ **Vantagens:**
- Sem limites de timeout para renderização
- Armazenamento persistente no Supabase Storage
- Escalável e profissional
- Workflow visual no n8n

📖 **Guia Completo:** [PROXIMOS_PASSOS.md](PROXIMOS_PASSOS.md)

### Opção 2: Servidor Local (Desenvolvimento)

```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Servidor de renderização
npm run server
```

## 📁 Estrutura do Projeto

```
shorts-factory/
├── components/          # Componentes React
│   ├── Dashboard.tsx   # Geração de vídeos
│   ├── MyVideos.tsx    # Biblioteca
│   └── VideoComposition.tsx  # Composição Remotion
├── services/           # Integrações API
│   ├── geminiService.ts
│   └── openaiService.ts
├── src/
│   ├── lib/
│   │   └── supabase.ts  # Cliente + helpers de storage
│   └── remotion/        # Entry point Remotion
├── scripts/
│   └── setup-server.sh  # Setup DigitalOcean
├── server.js           # Servidor local de renderização
├── n8n-workflow-video-render.json  # Template workflow
├── DEPLOY.md           # Guia completo de deploy
└── PROXIMOS_PASSOS.md  # Quick start deploy
```

## 🛠️ Tecnologias

### Frontend
- **React 19** + **Vite**
- **Tailwind CSS v4**
- **Remotion** (renderização de vídeos)
- **Lucide Icons**

### Backend / IA
- **Google Gemini 2.5 Flash** (script + imagens + TTS)
- **OpenAI GPT-4o** + **DALL-E 3** (alternativa)
- **Supabase** (auth + database + storage)
- **n8n** (automação de renderização)

### Renderização
- **@remotion/renderer** (headless)
- **ffmpeg** (processamento de vídeo)
- **Chromium** (renderização browser)

## 🎯 Como Funciona

1. **Usuário** digita um tópico (ex: "5 fatos sobre Marte")
2. **IA** gera:
   - Script dividido em cenas
   - Imagens para cada cena
   - Voiceover em áudio
   - Seleção de música de fundo
3. **Preview** em tempo real no player Remotion
4. **Download MP4**:
   - Opção A: n8n renderiza e salva no Supabase Storage
   - Opção B: Servidor local renderiza e baixa direto
5. **Biblioteca**: Vídeos salvos ficam acessíveis em "My Videos"

## 🔧 Scripts Disponíveis

```bash
npm run dev          # Inicia frontend (Vite)
npm run build        # Build para produção
npm run server       # Inicia servidor de renderização local
npm run dev:all      # Frontend + servidor simultaneamente
npm run build:remotion  # Bundle Remotion (produção)
```

## 📊 Custos Estimados (Produção)

| Serviço | Plano | Custo/mês |
|---------|-------|-----------|
| Vercel | Free | $0 |
| Supabase | Free/Pro | $0 - $25 |
| DigitalOcean | 2GB Droplet | $12 |
| **Total** | | **$12 - $37** |

## 🐛 Troubleshooting

### Erro: "Failed to render video"
- ✅ Servidor de renderização está rodando? (`npm run server`)
- ✅ n8n workflow está ativo?
- ✅ Chromium e ffmpeg instalados no servidor?

### Erro: "Supabase Storage upload failed"
- ✅ Bucket `rendered-videos` existe?
- ✅ Bucket está público?
- ✅ Políticas SQL foram executadas?
- ✅ Service Role Key está correta?

### Preview não carrega
- ✅ Imagens foram geradas corretamente?
- ✅ Console do navegador (F12) mostra erros?

## 📚 Documentação

- [PROXIMOS_PASSOS.md](PROXIMOS_PASSOS.md) - Quick start para deploy
- [DEPLOY.md](DEPLOY.md) - Guia completo de deploy
- [RENDER_SETUP.md](RENDER_SETUP.md) - Setup servidor local

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou pull requests.

## 📄 Licença

MIT

## 🙏 Créditos

- **Remotion** - Framework de vídeos programáticos
- **Google Gemini** - IA generativa
- **Supabase** - Backend as a Service
- **n8n** - Automação de workflows

---

**Desenvolvido com ❤️ usando Remotion + Gemini + Supabase**

View original in AI Studio: https://ai.studio/apps/drive/1PRtFX9xVWiOK6dwpjxa2PH1-yEwjkYGE
