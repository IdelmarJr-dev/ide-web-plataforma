import type { Usuario } from '../generated/prisma/client';
import { ConflictError, NotFoundError, UnauthorizedError } from '../errors';
import type { SessaoAuthRepository } from '../repositories/SessaoAuthRepository';
import type { UsuarioRepository } from '../repositories/UsuarioRepository';
import { comparePassword, hashPassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyToken } from '../utils/jwt';
import type { LoginBodyDto, RegistrarBodyDto } from '../dtos/auth.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  constructor(
    private readonly usuarioRepository: UsuarioRepository,
    private readonly sessaoRepository: SessaoAuthRepository,
  ) {}

  async register(input: RegistrarBodyDto): Promise<{ usuario: Usuario } & AuthTokens> {
    const existing = await this.usuarioRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('Já existe uma conta com este e-mail');
    }

    const senha_hash = await hashPassword(input.senha);
    const usuario = await this.usuarioRepository.create({
      nome: input.nome,
      email: input.email,
      senha_hash,
      papel: input.papel,
    });

    return { usuario, ...(await this.issueTokens(usuario)) };
  }

  async login(input: LoginBodyDto): Promise<{ usuario: Usuario } & AuthTokens> {
    const usuario = await this.usuarioRepository.findByEmail(input.email);
    if (!usuario?.senha_hash) {
      // Sem senha_hash é linha inconsistente — trata igual a "não encontrado" pra não
      // vazar qual dos dois casos é.
      throw new UnauthorizedError('Credenciais inválidas');
    }

    const senhaValida = await comparePassword(input.senha, usuario.senha_hash);
    if (!senhaValida) {
      throw new UnauthorizedError('Credenciais inválidas');
    }

    return { usuario, ...(await this.issueTokens(usuario)) };
  }

  /**
   * Renova o access token dentro da MESMA sessão. Se a sessão já morreu (revogada, 6h
   * ou 1h parada), renovar não pode ressuscitá-la — senão o logout não valeria nada.
   */
  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    let payload;
    try {
      payload = verifyToken(refreshToken, 'refresh');
    } catch {
      throw new UnauthorizedError('Refresh token inválido ou expirado');
    }

    const [usuario, sessao] = await Promise.all([
      this.usuarioRepository.findById(payload.sub),
      this.sessaoRepository.findById(payload.sid),
    ]);

    if (!usuario || sessao?.revogada_em !== null) {
      throw new UnauthorizedError('Refresh token inválido ou expirado');
    }

    return { accessToken: signAccessToken(usuario.id, usuario.papel, sessao.id) };
  }

  logout(sessaoId: string): Promise<void> {
    return this.sessaoRepository.revogar(sessaoId);
  }

  async me(usuarioId: string): Promise<Usuario> {
    const usuario = await this.usuarioRepository.findById(usuarioId);
    if (!usuario) {
      throw new NotFoundError('Usuário');
    }

    return usuario;
  }

  private async issueTokens(usuario: Usuario): Promise<AuthTokens> {
    const sessao = await this.sessaoRepository.criar(usuario.id);

    return {
      accessToken: signAccessToken(usuario.id, usuario.papel, sessao.id),
      refreshToken: signRefreshToken(usuario.id, usuario.papel, sessao.id),
    };
  }
}
