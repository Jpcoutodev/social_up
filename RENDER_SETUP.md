# 🎬 Guia de Renderização MP4

Este guia explica como usar a nova funcionalidade de download direto de vídeos em MP4.

## 🚀 Como Usar

### 1. Iniciar o Servidor de Renderização

Você tem duas opções:

**Opção A: Iniciar tudo de uma vez (Recomendado)**
```bash
npm run dev:all
```
Este comando inicia tanto o servidor Vite (frontend) quanto o servidor de renderização simultaneamente.

**Opção B: Iniciar separadamente**

Em um terminal:
```bash
npm run dev
```

Em outro terminal:
```bash
npm run server
```

### 2. Gerar e Baixar o Vídeo

1. Acesse a aplicação no navegador (geralmente `http://localhost:5173`)
2. Faça login
3. Na aba "Generator", digite o tópico do seu vídeo
4. Clique em "Generate Script"
5. Aguarde a geração do script e preview do vídeo
6. Clique no botão **"Download MP4"**
7. O vídeo será renderizado e baixado automaticamente!

## 📋 Opções de Export

Depois de gerar um vídeo, você terá as seguintes opções:

### 🎥 Download MP4 (NOVO!)
Renderiza e baixa o vídeo em MP4 diretamente no navegador. Requer que o servidor de renderização esteja rodando.

**Vantagens:**
- Download direto, sem linha de comando
- Rápido e fácil de usar
- Ideal para uso diário

### 💾 Save to Library
Salva o script do vídeo na sua biblioteca para uso posterior.

### 🔧 Opções Avançadas

#### Download Shell Script
Baixa um script bash que você pode executar manualmente para renderizar o vídeo.

#### Copy CLI Command
Copia o comando Remotion CLI para o clipboard, caso você queira executar manualmente.

## 🛠️ Troubleshooting

### Erro: "Failed to render video: Make sure the render server is running"

**Solução:** Certifique-se de que o servidor de renderização está rodando:
```bash
npm run server
```

### O servidor de renderização não inicia

**Possíveis causas:**
1. Porta 3001 já está em uso
2. Dependências não instaladas

**Solução:**
```bash
npm install
npm run server
```

### O download não inicia

Verifique o console do navegador (F12) e o terminal do servidor para mensagens de erro.

## 📁 Onde os Vídeos São Salvos?

Durante o processo de renderização, os vídeos são temporariamente salvos em:
```
d:\apps\Social UP\rendered-videos\
```

Após o download, os arquivos temporários são automaticamente excluídos.

## ⚙️ Configurações Técnicas

- **Porta do servidor:** 3001
- **Codec:** H.264
- **Resolução:** 1080x1920 (9:16 vertical)
- **FPS:** 30

## 💡 Dicas

1. **Primeiro uso:** Sempre execute `npm install` para garantir que todas as dependências estão instaladas
2. **Desenvolvimento:** Use `npm run dev:all` para facilitar o desenvolvimento
3. **Produção:** Para produção, considere usar um servidor dedicado para renderização
4. **Performance:** A renderização pode levar alguns minutos dependendo da duração do vídeo

## 🐛 Problemas Conhecidos

- A primeira renderização pode demorar mais devido ao bundling inicial do Remotion
- Vídeos muito longos (>5 minutos) podem consumir muita memória

## 📞 Suporte

Se encontrar problemas, verifique:
1. Console do navegador (F12 > Console)
2. Terminal do servidor de renderização
3. Terminal do Vite (frontend)
