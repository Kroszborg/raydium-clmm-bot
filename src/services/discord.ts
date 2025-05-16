import { WebhookClient } from 'discord.js';
import { Config } from '../config';
import logger from './logger';

class DiscordService {
  private webhook: WebhookClient | null = null;

  constructor() {
    if (Config.discord.webhookUrl) {
      try {
        this.webhook = new WebhookClient({ url: Config.discord.webhookUrl });
        logger.info('Discord webhook initialized');
      } catch (error) {
        logger.error('Failed to initialize Discord webhook', { error });
      }
    } else {
      logger.warn('Discord webhook URL not provided, notifications are disabled');
    }
  }

  async sendNotification(title: string, message: string, color = 0x00ff00, fields: any[] = []) {
    if (!this.webhook) {
      logger.debug('Discord notification not sent: webhook not configured', { title, message });
      return;
    }

    try {
      await this.webhook.send({
        embeds: [{
          title,
          description: message,
          color,
          fields,
          timestamp: new Date().toISOString(),
        }],
      });
      logger.debug('Discord notification sent', { title });
    } catch (error) {
      logger.error('Failed to send Discord notification', { error, title, message });
    }
  }

  async sendPositionUpdate(action: 'Created' | 'Withdrawn' | 'Rebalanced', details: any) {
    const colors = {
      Created: 0x00ff00, // Green
      Withdrawn: 0xffaa00, // Orange
      Rebalanced: 0x0099ff, // Blue
    };

    await this.sendNotification(
      `Position ${action}`,
      `Liquidity position has been ${action.toLowerCase()}.`,
      colors[action],
      Object.entries(details).map(([key, value]) => ({ 
        name: key, 
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        inline: true 
      }))
    );
  }

  async sendErrorNotification(error: Error, context: any = {}) {
    await this.sendNotification(
      'Bot Error',
      `An error occurred: ${error.message}`,
      0xff0000, // Red
      Object.entries(context).map(([key, value]) => ({ 
        name: key, 
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        inline: true 
      }))
    );
  }
}

export const discordService = new DiscordService();