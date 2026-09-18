/* eslint-disable no-console */
import { config } from '../config';

const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type Level = (typeof LEVELS)[number];

function shouldLog(level: Level): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(config.logLevel);
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog('debug')) console.debug(JSON.stringify({ level: 'debug', message, ...meta }));
  },
  info(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog('info')) console.info(JSON.stringify({ level: 'info', message, ...meta }));
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog('warn')) console.warn(JSON.stringify({ level: 'warn', message, ...meta }));
  },
  error(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog('error')) console.error(JSON.stringify({ level: 'error', message, ...meta }));
  },
};
