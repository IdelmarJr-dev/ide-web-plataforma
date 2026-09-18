import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { requireAuth } from '../middlewares/requireAuth';
import { PrismaSessaoAuthRepository } from '../repositories/SessaoAuthRepository';
import { PrismaUsuarioRepository } from '../repositories/UsuarioRepository';
import { AuthService } from '../services/AuthService';
import { asyncHandler } from '../utils/asyncHandler';

const usuarioRepository = new PrismaUsuarioRepository();
const sessaoRepository = new PrismaSessaoAuthRepository();
const authService = new AuthService(usuarioRepository, sessaoRepository);
const authController = new AuthController(authService);

export const authRoutes = Router();

authRoutes.post('/auth/registrar', asyncHandler((req, res) => authController.registrar(req, res)));
authRoutes.post('/auth/login', asyncHandler((req, res) => authController.login(req, res)));
authRoutes.post('/auth/refresh', asyncHandler((req, res) => authController.refresh(req, res)));
authRoutes.post('/auth/logout', requireAuth, asyncHandler((req, res) => authController.logout(req, res)));
authRoutes.get('/auth/me', requireAuth, asyncHandler((req, res) => authController.me(req, res)));
