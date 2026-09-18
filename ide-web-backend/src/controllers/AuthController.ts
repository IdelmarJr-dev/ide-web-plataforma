import type { Request, Response } from 'express';
import { loginBodySchema, registrarBodySchema, toUsuarioResponseDto } from '../dtos/auth.dto';
import { UnauthorizedError, ValidationError } from '../errors';
import type { AuthService } from '../services/AuthService';
import { clearAuthCookies, getRefreshTokenCookie, setAccessCookie, setAuthCookies } from '../utils/cookies';
import { BaseController } from './BaseController';

const HTTP_CREATED = 201;

export class AuthController extends BaseController {
  constructor(private readonly authService: AuthService) {
    super();
  }

  registrar = async (req: Request, res: Response): Promise<void> => {
    const parsed = registrarBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Dados de registro inválidos', parsed.error.issues);
    }

    const { usuario, accessToken, refreshToken } = await this.authService.register(parsed.data);
    setAuthCookies(res, accessToken, refreshToken);
    this.handleSuccess(res, toUsuarioResponseDto(usuario), HTTP_CREATED);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const parsed = loginBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Dados de login inválidos', parsed.error.issues);
    }

    const { usuario, accessToken, refreshToken } = await this.authService.login(parsed.data);
    setAuthCookies(res, accessToken, refreshToken);
    this.handleSuccess(res, toUsuarioResponseDto(usuario));
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = getRefreshTokenCookie(req.cookies as Record<string, string | undefined>);
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token ausente');
    }

    const { accessToken } = await this.authService.refresh(refreshToken);
    setAccessCookie(res, accessToken);
    this.handleSuccess(res, { renewed: true });
  };

  /**
   * Revoga a sessão no servidor antes de limpar os cookies: desde a Fase 10 o logout
   * mata o token de verdade, em vez de só esquecê-lo no navegador (D1).
   */
  logout = async (req: Request, res: Response): Promise<void> => {
    if (req.usuario) {
      await this.authService.logout(req.usuario.sessaoId);
    }

    clearAuthCookies(res);
    this.handleSuccess(res, { loggedOut: true });
  };

  me = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const usuario = await this.authService.me(req.usuario.id);
    this.handleSuccess(res, toUsuarioResponseDto(usuario));
  };
}
