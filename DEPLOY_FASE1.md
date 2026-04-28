# Deploy — Fase 1 (Edge Functions + admin gate)

Esta fase migra todas as chamadas de IA pra Edge Functions do Supabase.
As chaves passam a ficar **apenas no servidor** (Supabase Secrets) e nunca aparecem no browser do usuário.

## Pré-requisitos

```bash
# Instalar Supabase CLI (uma vez)
npm install -g supabase

# Logar
supabase login

# Linkar este projeto ao seu Supabase
cd "d:/apps/Social UP"
supabase link --project-ref <SEU_PROJECT_REF>
```

Onde `<SEU_PROJECT_REF>` é o ID do projeto (vê em Supabase Dashboard → Project Settings → General → Reference ID).

## 1. Rodar a migração SQL

No Supabase Dashboard → SQL Editor → New query → cole o conteúdo de [supabase_usage_log.sql](supabase_usage_log.sql) → Run.

Isso cria a tabela `usage_log` com RLS e índices.

## 2. Configurar os Secrets das Edge Functions

Supabase Dashboard → **Project Settings → Edge Functions → Manage Secrets** → Add secret:

| Nome | Valor |
|------|-------|
| `MINIMAX_API_KEY` | Sua chave da MiniMax |
| `MINIMAX_GROUP_ID` | Seu Group ID (necessário pro TTS) |
| `GEMINI_API_KEY` | Sua chave do Google AI Studio |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já vêm injetadas automaticamente pelo Supabase, não precisa configurar.

## 3. Deploy das Edge Functions

```bash
cd "d:/apps/Social UP"

supabase functions deploy proxy-minimax
supabase functions deploy proxy-gemini
# (proxy-image já está deployada, não precisa redeployar)
```

## 4. Conferir que `.env` do front tem as URLs do Supabase

Na raiz do projeto, em `.env` (ou `.env.local`):

```
VITE_SUPABASE_URL=https://<projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-anon-key-publica>
```

(Essas duas continuam públicas — só servem pra autenticar o usuário e identificar o projeto.)

## 5. Testar

1. Logue na app com `coutodev7@gmail.com` (admin).
2. Vá em **Configurações** → veja se MiniMax e Gemini aparecem como "Online".
3. Logue com qualquer outro email → a aba **Configurações** deve sumir do menu.
4. Gere um vídeo no Gerador → deve usar MiniMax via proxy.
5. Vá em **Divulgação de Produtos** → escolha **Produto** → upload de uma bolsa → veja se o produto é preservado (Gemini multimodal).
6. Repita escolhendo **Pessoa** → upload de um retrato → veja se a pessoa é preservada (MiniMax subject_reference).
7. Volte em Configurações → confira que o `usage_log` está registrando as chamadas.

## O que mudou pro usuário comum

- **Sumiu**: aba Configurações, inputs de chave de API, seletor de provider em todas as telas.
- **Apareceu**: toggle "Produto / Pessoa" na Divulgação de Produtos (define qual IA preserva a referência).
- **Continua igual**: Gerador de Vídeos, Gerador de Imagens, Carrossel, Minhas Imagens, Meus Vídeos, Integrações.

## Próxima fase (a fazer depois)

- Stripe + planos (Free / Pro / Business) com cota mensal.
- Edge Function valida cota antes de chamar API → bloqueia ou redireciona pra upgrade.
- Tabela `subscriptions` + webhook do Stripe pra atualizar plano em tempo real.
