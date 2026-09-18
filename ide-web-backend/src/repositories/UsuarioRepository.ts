import type { Usuario } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

export interface CreateUsuarioInput {
  nome: string;
  email: string;
  senha_hash: string;
  papel: Usuario['papel'];
}

export interface UsuarioRepository {
  findByEmail(email: string): Promise<Usuario | null>;
  findById(id: string): Promise<Usuario | null>;
  create(input: CreateUsuarioInput): Promise<Usuario>;
}

export class PrismaUsuarioRepository implements UsuarioRepository {
  findByEmail(email: string): Promise<Usuario | null> {
    return prisma.usuario.findUnique({ where: { email } });
  }

  findById(id: string): Promise<Usuario | null> {
    return prisma.usuario.findUnique({ where: { id } });
  }

  create(input: CreateUsuarioInput): Promise<Usuario> {
    return prisma.usuario.create({ data: { ...input, papel: input.papel } });
  }
}
