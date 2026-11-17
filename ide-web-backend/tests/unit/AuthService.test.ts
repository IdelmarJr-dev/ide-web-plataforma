import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Usuario } from '../../src/generated/prisma/client';
import type { SessaoAuthRepository } from '../../src/repositories/SessaoAuthRepository';
import type { UsuarioRepository } from '../../src/repositories/UsuarioRepository';
import { AuthService } from '../../src/services/AuthService';
import { SALT_ROUNDS } from '../../src/utils/password';

const SENHA = 'Senha@Teste1';

function usuario(senha_hash: string): Usuario {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    nome: 'Aluno Teste',
    email: 'aluno@ide-web.local',
    senha_hash,
    papel: 'aluno',
    criado_em: new Date('2026-11-16T12:00:00.000Z'),
  } as Usuario;
}

describe('AuthService.login', () => {
  const findByEmail = vi.fn<UsuarioRepository['findByEmail']>();
  const atualizarSenhaHash = vi.fn<UsuarioRepository['atualizarSenhaHash']>();
  const usuarioRepository: UsuarioRepository = {
    findByEmail,
    findById: vi.fn(),
    create: vi.fn(),
    atualizarSenhaHash,
  };
  const sessaoRepository = {
    criar: vi.fn().mockResolvedValue({ id: '33333333-3333-3333-3333-333333333333' }),
  } as unknown as SessaoAuthRepository;
  const service = new AuthService(usuarioRepository, sessaoRepository);

  beforeEach(() => {
    vi.clearAllMocks();
    atualizarSenhaHash.mockResolvedValue(undefined);
  });

  // Teste de carga de 16/11/2026: com 0,1 CPU, cada login a custo 12 levava ~2,5 s.
  it('regrava com o custo atual o hash antigo de custo 12, depois de aceitar a senha', async () => {
    findByEmail.mockResolvedValue(usuario(bcrypt.hashSync(SENHA, 12)));

    await service.login({ email: 'aluno@ide-web.local', senha: SENHA });

    expect(atualizarSenhaHash).toHaveBeenCalledTimes(1);
    const [id, novoHash] = atualizarSenhaHash.mock.calls[0] ?? [];
    expect(id).toBe('22222222-2222-2222-2222-222222222222');
    expect(bcrypt.getRounds(novoHash ?? '')).toBe(SALT_ROUNDS);
    expect(bcrypt.compareSync(SENHA, novoHash ?? '')).toBe(true);
  });

  it('não regrava hash que já está no custo atual', async () => {
    findByEmail.mockResolvedValue(usuario(bcrypt.hashSync(SENHA, SALT_ROUNDS)));

    await service.login({ email: 'aluno@ide-web.local', senha: SENHA });

    expect(atualizarSenhaHash).not.toHaveBeenCalled();
  });

  it('com senha errada recusa e não regrava nada', async () => {
    findByEmail.mockResolvedValue(usuario(bcrypt.hashSync(SENHA, 12)));

    await expect(service.login({ email: 'aluno@ide-web.local', senha: 'outra' })).rejects.toThrow(/Credenciais inválidas/);
    expect(atualizarSenhaHash).not.toHaveBeenCalled();
  });

  it('se a regravação falhar, o login segue normalmente', async () => {
    findByEmail.mockResolvedValue(usuario(bcrypt.hashSync(SENHA, 12)));
    atualizarSenhaHash.mockRejectedValue(new Error('banco fora'));

    await expect(service.login({ email: 'aluno@ide-web.local', senha: SENHA })).resolves.toMatchObject({
      usuario: { id: '22222222-2222-2222-2222-222222222222' },
    });
  });
});
