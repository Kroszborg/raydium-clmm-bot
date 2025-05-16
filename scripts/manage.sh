#!/bin/bash

# Raydium CLMM Liquidity Bot Management Script
# This script helps manage the running bot

echo "===== Raydium CLMM Liquidity Bot Management ====="
echo

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root. Please use sudo."
  exit 1
fi

# Function to check if the container exists
container_exists() {
  docker ps -a | grep raydium-bot > /dev/null
  return $?
}

# Function to check if the container is running
container_running() {
  docker ps | grep raydium-bot > /dev/null
  return $?
}

# Show menu
show_menu() {
  echo "Please select an option:"
  echo "1. Start bot"
  echo "2. Stop bot"
  echo "3. Restart bot"
  echo "4. View logs"
  echo "5. Update bot"
  echo "6. Edit configuration"
  echo "7. Show status"
  echo "8. Exit"
  echo
  read -p "Enter your choice (1-8): " choice
  echo

  case $choice in
    1) start_bot ;;
    2) stop_bot ;;
    3) restart_bot ;;
    4) view_logs ;;
    5) update_bot ;;
    6) edit_config ;;
    7) show_status ;;
    8) exit 0 ;;
    *) echo "Invalid choice. Please try again." && show_menu ;;
  esac
}

# Start bot
start_bot() {
  if container_running; then
    echo "Bot is already running."
  elif container_exists; then
    echo "Starting bot..."
    docker start raydium-bot
    echo "Bot started."
  else
    echo "Bot container doesn't exist. Creating new container..."
    cd /opt/raydium-bot
    docker run -d --name raydium-bot --restart unless-stopped --env-file .env raydium-clmm-bot
    echo "Bot started."
  fi
  echo
  show_menu
}

# Stop bot
stop_bot() {
  if container_running; then
    echo "Stopping bot..."
    docker stop raydium-bot
    echo "Bot stopped."
  else
    echo "Bot is not running."
  fi
  echo
  show_menu
}

# Restart bot
restart_bot() {
  if container_exists; then
    echo "Restarting bot..."
    docker restart raydium-bot
    echo "Bot restarted."
  else
    echo "Bot container doesn't exist. Please start the bot first."
  fi
  echo
  show_menu
}

# View logs
view_logs() {
  if container_exists; then
    echo "Showing bot logs (press Ctrl+C to exit):"
    docker logs -f raydium-bot
  else
    echo "Bot container doesn't exist. Please start the bot first."
  fi
  echo
  show_menu
}

# Update bot
update_bot() {
  cd /opt/raydium-bot
  
  # Ask for update method
  echo "Update method:"
  echo "1. Pull from GitHub (if you cloned from GitHub)"
  echo "2. Upload new files manually"
  echo "3. Cancel"
  read -p "Choose update method (1-3): " update_method
  
  case $update_method in
    1)
      # Pull from GitHub
      echo "Pulling latest changes from GitHub..."
      git pull
      ;;
    2)
      # Manual update
      echo "Please manually update the files in /opt/raydium-bot/"
      echo "After updating, press Enter to continue..."
      read
      ;;
    3)
      # Cancel
      echo "Update cancelled."
      echo
      show_menu
      return
      ;;
    *)
      echo "Invalid choice. Update cancelled."
      echo
      show_menu
      return
      ;;
  esac
  
  # Rebuild and restart container
  echo "Rebuilding Docker image..."
  docker build -t raydium-clmm-bot .
  
  if container_exists; then
    echo "Stopping and removing old container..."
    docker stop raydium-bot
    docker rm raydium-bot
  fi
  
  echo "Starting new container..."
  docker run -d --name raydium-bot --restart unless-stopped --env-file .env raydium-clmm-bot
  
  echo "Bot updated and restarted."
  echo
  show_menu
}

# Edit configuration
edit_config() {
  echo "Editing .env configuration file..."
  nano /opt/raydium-bot/.env
  
  # Ask if user wants to restart the bot with new config
  read -p "Do you want to restart the bot to apply the new configuration? [y/N] " restart
  if [[ $restart =~ ^[Yy]$ ]]; then
    restart_bot
  else
    echo "Remember to restart the bot to apply the new configuration."
    echo
    show_menu
  fi
}

# Show status
show_status() {
  echo "Bot status:"
  if container_running; then
    echo "Status: Running"
    docker ps | grep raydium-bot
    
    # Show logs from the last hour
    echo
    echo "Recent logs (last 20 lines):"
    docker logs --tail 20 raydium-bot
  elif container_exists; then
    echo "Status: Stopped"
    docker ps -a | grep raydium-bot
  else
    echo "Status: Not installed"
  fi
  echo
  show_menu
}

# Show the menu
show_menu