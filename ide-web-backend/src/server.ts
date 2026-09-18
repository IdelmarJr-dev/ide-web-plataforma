import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';

const app = createApp();

app.listen(config.server.port, () => {
  logger.info(`Server listening on port ${String(config.server.port)}`, { env: config.env });
});
