// scripts/run-bot.ts
import { liquidityBot } from '../src/bot';
import logger from '../src/services/logger';

async function main() {
  try {
    logger.info('Starting Raydium CLMM Liquidity Bot');
    await liquidityBot.start();
    logger.info('Bot is running. Press Ctrl+C to stop.');
  } catch (error) {
    logger.error('Failed to start bot', { error });
    process.exit(1);
  }
}

main();