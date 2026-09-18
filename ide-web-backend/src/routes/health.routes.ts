import { Router } from 'express';
import { HealthController } from '../controllers/HealthController';
import { ProcessHealthRepository } from '../repositories/HealthRepository';
import { HealthService } from '../services/HealthService';
import { asyncHandler } from '../utils/asyncHandler';

const healthRepository = new ProcessHealthRepository();
const healthService = new HealthService(healthRepository);
const healthController = new HealthController(healthService);

export const healthRoutes = Router();

healthRoutes.get(
  '/health',
  asyncHandler((req, res) => healthController.check(req, res)),
);
