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

  app.use(API_PREFIX, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
