// src/config/index.ts
import dotenv from 'dotenv';
dotenv.config();

export const Config = {
  solana: {
    privateKey: process.env.SOLANA_PRIVATE_KEY || '',
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    minSolBalance: parseFloat(process.env.MIN_SOL_BALANCE || '0.05'),
  },
  raydium: {
    poolId: process.env.POOL_ID || '',
    priceRangePercent: parseFloat(process.env.PRICE_RANGE_PERCENT || '5'),
    rebalanceThresholdPercent: parseFloat(process.env.REBALANCE_THRESHOLD_PERCENT || '1'),
  },
  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
  },
  bot: {
    checkIntervalMinutes: parseInt(process.env.CHECK_INTERVAL_MINUTES || '5', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  // Validate configuration
  validate: () => {
    const required = [
      { key: 'SOLANA_PRIVATE_KEY', value: Config.solana.privateKey },
      { key: 'POOL_ID', value: Config.raydium.poolId },
    ];

    const missing = required.filter(item => !item.value);
    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.map(item => item.key).join(', ')}`);
    }
    
    return true;
  }
};

// Validate configuration on import
Config.validate();