#!/bin/bash
# ============================================
# Server Setup Script for DigitalOcean
# Prepares environment for Remotion video rendering
# ============================================

set -e  # Exit on error

echo "🚀 Starting server setup for Remotion video rendering..."

# ============================================
# 1. System Update
# ============================================
echo ""
echo "📦 Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# ============================================
# 2. Install Node.js 20.x
# ============================================
echo ""
echo "📦 Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "✅ Node.js version:"
node --version
echo "✅ npm version:"
npm --version

# ============================================
# 3. Install Remotion Dependencies
# ============================================
echo ""
echo "📦 Installing Remotion system dependencies..."

# Chrome/Chromium for headless rendering
echo "Installing Chromium..."
sudo apt-get install -y chromium-browser

# ffmpeg for video processing
echo "Installing ffmpeg..."
sudo apt-get install -y ffmpeg

# Additional libraries required by Remotion
echo "Installing additional libraries..."
sudo apt-get install -y \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libatspi2.0-0 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libx11-6 \
  libxcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  xdg-utils

echo "✅ Remotion dependencies installed"

# ============================================
# 4. Setup Application Directory
# ============================================
echo ""
echo "📁 Setting up application directory..."

APP_DIR="/home/apps/shorts-factory"
sudo mkdir -p /home/apps
sudo chown -R $USER:$USER /home/apps

if [ -d "$APP_DIR" ]; then
  echo "⚠️  Application directory already exists: $APP_DIR"
  read -p "Do you want to remove it and clone fresh? (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$APP_DIR"
  fi
fi

if [ ! -d "$APP_DIR" ]; then
  echo "📥 Clone your repository manually:"
  echo "   cd /home/apps"
  echo "   git clone <your-repo-url> shorts-factory"
  echo ""
  echo "Then run: cd $APP_DIR && npm install"
else
  echo "✅ Application directory exists: $APP_DIR"
fi

# ============================================
# 5. Create .env file template
# ============================================
echo ""
echo "📝 Creating .env template..."

ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" << 'EOF'
# Supabase Configuration
VITE_SUPABASE_URL=https://qgbxduvipeadycxremqa.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# AI Provider Keys (optional, for local testing)
VITE_GEMINI_API_KEY=your-gemini-key-here
VITE_OPENAI_API_KEY=your-openai-key-here

# n8n Webhook URL (set after n8n setup)
VITE_N8N_WEBHOOK_URL=https://n8n.your-domain.com/webhook/render-video
EOF
  echo "✅ .env template created at: $ENV_FILE"
  echo "⚠️  Please edit this file with your actual keys!"
else
  echo "⚠️  .env file already exists, skipping..."
fi

# ============================================
# 6. Create temp directories for rendering
# ============================================
echo ""
echo "📁 Creating temp directories..."
sudo mkdir -p /tmp/remotion-renders
sudo chmod 777 /tmp/remotion-renders
echo "✅ Temp directory created: /tmp/remotion-renders"

# ============================================
# 7. Install PM2 for process management (optional)
# ============================================
echo ""
read -p "Do you want to install PM2 for process management? (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
  echo "📦 Installing PM2..."
  sudo npm install -g pm2
  echo "✅ PM2 installed"
  echo ""
  echo "To start the app with PM2:"
  echo "  pm2 start npm --name 'shorts-factory-server' -- run server"
  echo "  pm2 save"
  echo "  pm2 startup"
fi

# ============================================
# 8. Test Remotion Installation
# ============================================
echo ""
echo "🧪 Testing Remotion installation..."
if command -v chromium-browser &> /dev/null; then
  echo "✅ Chromium installed: $(chromium-browser --version)"
else
  echo "❌ Chromium not found!"
fi

if command -v ffmpeg &> /dev/null; then
  echo "✅ ffmpeg installed: $(ffmpeg -version | head -n 1)"
else
  echo "❌ ffmpeg not found!"
fi

# ============================================
# 9. Firewall Configuration (if needed)
# ============================================
echo ""
read -p "Do you want to configure firewall rules? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🔒 Configuring firewall..."
  sudo ufw allow 22/tcp   # SSH
  sudo ufw allow 80/tcp   # HTTP
  sudo ufw allow 443/tcp  # HTTPS
  sudo ufw --force enable
  echo "✅ Firewall configured"
fi

# ============================================
# Summary
# ============================================
echo ""
echo "=================================="
echo "✅ Server setup complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Clone your repository to: $APP_DIR"
echo "2. Run: cd $APP_DIR && npm install"
echo "3. Edit .env file with your API keys"
echo "4. Setup n8n workflow (see DEPLOY.md)"
echo "5. Test render: npm run server"
echo ""
echo "For n8n setup instructions, see DEPLOY.md"
echo ""
