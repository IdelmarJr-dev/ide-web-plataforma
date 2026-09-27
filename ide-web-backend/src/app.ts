import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import { config } from './config';
import { errorHandler } from './middlewares/errorHandler';
import { notFoundHandler } from './middlewares/notFoundHandler';
import { routes } from './routes';

const API_PREFIX = '/api/v1';

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: config.cors.origin, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/.well-known/strix-verify.txt', (_req, res) => {
    res.type('text/plain').send('strix-verify-ef5d865c263a477a6538a23ed2b24bab');
  });

  app.use(API_PREFIX, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
