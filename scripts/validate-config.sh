#!/bin/bash

# Raydium CLMM Liquidity Bot Configuration Validator
# This script validates the .env configuration

echo "===== Raydium CLMM Liquidity Bot Configuration Validator ====="
echo

# Check if .env file exists
if [ ! -f .env ]; then
  echo "Error: .env file not found in the current directory."
  echo "Please run this script from the bot directory or create a .env file."
  exit 1
fi

# Load .env file
source .env

# Function to validate a required field
validate_required() {
  local field_name=$1
  local field_value=$2
  
  if [ -z "$field_value" ] || [ "$field_value" == "your_wallet_private_key_here" ] || [ "$field_value" == "your_raydium_pool_id_here" ] || [ "$field_value" == "your_discord_webhook_url_here" ]; then
    echo "❌ $field_name is missing or has default value"
    return 1
  else
    echo "✅ $field_name is set"
    return 0
  fi
}

# Function to validate a numeric field
validate_numeric() {
  local field_name=$1
  local field_value=$2
  
  if [[ ! "$field_value" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
    echo "❌ $field_name must be a number"
    return 1
  else
    echo "✅ $field_name is valid ($field_value)"
    return 0
  fi
}

# Validate required fields
echo "Validating required fields:"
validate_required "SOLANA_PRIVATE_KEY" "$SOLANA_PRIVATE_KEY"
private_key_valid=$?

validate_required "POOL_ID" "$POOL_ID"
pool_id_valid=$?

# Validate optional fields with defaults
echo
echo "Validating numeric fields:"
validate_numeric "PRICE_RANGE_PERCENT" "${PRICE_RANGE_PERCENT:-5}"
price_range_valid=$?

validate_numeric "REBALANCE_THRESHOLD_PERCENT" "${REBALANCE_THRESHOLD_PERCENT:-1}"
rebalance_threshold_valid=$?

validate_numeric "MIN_SOL_BALANCE" "${MIN_SOL_BALANCE:-0.05}"
min_sol_valid=$?

validate_numeric "CHECK_INTERVAL_MINUTES" "${CHECK_INTERVAL_MINUTES:-5}"
check_interval_valid=$?

# Validate Discord webhook if provided
echo
echo "Validating Discord webhook:"
if [ -z "$DISCORD_WEBHOOK_URL" ] || [ "$DISCORD_WEBHOOK_URL" == "your_discord_webhook_url_here" ]; then
  echo "⚠️ DISCORD_WEBHOOK_URL is not set. You won't receive notifications."
  discord_valid=0
elif [[ ! "$DISCORD_WEBHOOK_URL" =~ ^https://discord\.com/api/webhooks/ ]]; then
  echo "❌ DISCORD_WEBHOOK_URL does not appear to be valid"
  discord_valid=1
else
  echo "✅ DISCORD_WEBHOOK_URL is set"
  discord_valid=0
fi

# Validate RPC URL
echo
echo "Validating Solana RPC URL:"
if [ -z "$SOLANA_RPC_URL" ]; then
  echo "⚠️ SOLANA_RPC_URL is not set. Default will be used: https://api.mainnet-beta.solana.com"
  rpc_valid=0
elif [[ ! "$SOLANA_RPC_URL" =~ ^https?:// ]]; then
  echo "❌ SOLANA_RPC_URL does not appear to be valid"
  rpc_valid=1
else
  echo "✅ SOLANA_RPC_URL is set: $SOLANA_RPC_URL"
  rpc_valid=0
fi

# Check if LOG_LEVEL is valid
echo
echo "Validating LOG_LEVEL:"
log_levels=("error" "warn" "info" "http" "verbose" "debug" "silly")
log_level_valid=0

if [ -z "$LOG_LEVEL" ]; then
  echo "⚠️ LOG_LEVEL is not set. Default will be used: info"
else
  valid_level=0
  for level in "${log_levels[@]}"; do
    if [ "$LOG_LEVEL" == "$level" ]; then
      valid_level=1
      break
    fi
  done
  
  if [ $valid_level -eq 1 ]; then
    echo "✅ LOG_LEVEL is valid: $LOG_LEVEL"
  else
    echo "❌ LOG_LEVEL is not valid. Use one of: ${log_levels[*]}"
    log_level_valid=1
  fi
fi

# Summary
echo
echo "===== Configuration Summary ====="
if [ $private_key_valid -eq 0 ] && [ $pool_id_valid -eq 0 ] && [ $price_range_valid -eq 0 ] && [ $rebalance_threshold_valid -eq 0 ] && [ $min_sol_valid -eq 0 ] && [ $check_interval_valid -eq 0 ] && [ $discord_valid -eq 0 ] && [ $rpc_valid -eq 0 ] && [ $log_level_valid -eq 0 ]; then
  echo "✅ All configuration values are valid. Bot should work correctly."
else
  echo "❌ Some configuration values are invalid or missing. Please fix them before running the bot."
fi