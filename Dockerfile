FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy application code
COPY . .

# Build the application
RUN npm run build
RUN npm run bot:build

# Set environment variables
ENV NODE_ENV=production

# Run the bot
CMD ["npm", "run", "bot:prod"]