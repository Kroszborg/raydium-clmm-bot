#!/bin/bash

# Raydium CLMM Liquidity Bot Setup Script
# This script helps set up and run the bot on a fresh Ubuntu server

echo "===== Raydium CLMM Liquidity Bot Setup ====="
echo

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root. Please use sudo."
  exit 1
fi

# Update system
echo "Updating system packages..."
apt update && apt upgrade -y

# Install Docker
echo "Installing Docker..."
apt install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io

# Create bot directory
echo "Creating bot directory..."
mkdir -p /opt/raydium-bot
cd /opt/raydium-bot

# Create .env file
echo "Creating .env file..."
cat > .env << EOF
# Solana Configuration
SOLANA_PRIVATE_KEY=your_wallet_private_key_here
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Raydium Configuration
POOL_ID=your_raydium_pool_id_here
PRICE_RANGE_PERCENT=5
REBALANCE_THRESHOLD_PERCENT=1
MIN_SOL_BALANCE=0.05

# Discord Webhook
DISCORD_WEBHOOK_URL=your_discord_webhook_url_here

# Bot Configuration
CHECK_INTERVAL_MINUTES=5
LOG_LEVEL=info
EOF

echo "Please edit the .env file with your configuration:"
echo "nano /opt/raydium-bot/.env"
echo

# Ask if user wants to edit the .env file now
read -p "Do you want to edit the .env file now? [y/N] " edit_env
if [[ $edit_env =~ ^[Yy]$ ]]; then
  nano /opt/raydium-bot/.env
fi

# Ask for GitHub repository URL
read -p "Enter the GitHub repository URL (or press Enter to skip): " repo_url
if [ -n "$repo_url" ]; then
  echo "Cloning repository..."
  apt install -y git
  git clone "$repo_url" .
else
  echo "Please manually copy the bot files to /opt/raydium-bot/"
  echo "You can use SCP or another file transfer method."
fi

# Build and run Docker container
echo "Building Docker container..."
docker build -t raydium-clmm-bot .

echo "Starting bot container..."
docker run -d --name raydium-bot --restart unless-stopped --env-file .env raydium-clmm-bot

# Show bot status
echo
echo "Bot container status:"
docker ps | grep raydium-bot

echo
echo "===== Setup Complete ====="
echo "You can check the logs with: docker logs -f raydium-bot"
echo "Make sure your .env file is configured correctly."