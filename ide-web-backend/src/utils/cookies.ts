import type { Response } from 'express';
import { config } from '../config';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_SECOND = 1000;
const ACCESS_COOKIE_MAX_AGE_MINUTES = 15;
const REFRESH_COOKIE_MAX_AGE_DAYS = 7;

const MINUTE_MS = SECONDS_PER_MINUTE * MS_PER_SECOND;
const DAY_MS = HOURS_PER_DAY * MINUTES_PER_HOUR * MINUTE_MS;
const ACCESS_COOKIE_MAX_AGE_MS = ACCESS_COOKIE_MAX_AGE_MINUTES * MINUTE_MS;
const REFRESH_COOKIE_MAX_AGE_MS = REFRESH_COOKIE_MAX_AGE_DAYS * DAY_MS;

function baseCookieOptions(maxAgeMs: number): {
  httpOnly: true;
  sameSite: 'lax' | 'none';
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    // Front (Vercel) e back (Render) são domínios diferentes — cookie cross-site só é
    // enviado em fetch/XHR com SameSite=None (e isso exige Secure=true, daí o par estar
    // amarrado ao mesmo isProduction). Em dev, front e back são portas do mesmo host
    // ("localhost"), então continuam same-site e Lax funciona normalmente.
    sameSite: config.isProduction ? 'none' : 'lax',
    secure: config.isProduction,
    path: '/',
    maxAge: maxAgeMs,
  };
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, baseCookieOptions(ACCESS_COOKIE_MAX_AGE_MS));
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, baseCookieOptions(REFRESH_COOKIE_MAX_AGE_MS));
}

export function setAccessCookie(res: Response, accessToken: string): void {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, baseCookieOptions(ACCESS_COOKIE_MAX_AGE_MS));
}

export function clearAuthCookies(res: Response): void {
  // Precisa repetir sameSite/secure daqui de cima: o navegador só sobrescreve um cookie
  // existente se esses atributos baterem com os que ele foi gravado.
  const options = { path: '/', sameSite: config.isProduction ? ('none' as const) : ('lax' as const), secure: config.isProduction };
  res.clearCookie(ACCESS_TOKEN_COOKIE, options);
  res.clearCookie(REFRESH_TOKEN_COOKIE, options);
}

export function getAccessTokenCookie(cookies: Record<string, string | undefined>): string | undefined {
  return cookies[ACCESS_TOKEN_COOKIE];
}

export function getRefreshTokenCookie(cookies: Record<string, string | undefined>): string | undefined {
  return cookies[REFRESH_TOKEN_COOKIE];
}
