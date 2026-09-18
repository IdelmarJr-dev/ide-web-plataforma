import type { Request, Response } from 'express';
import { toHealthResponseDto } from '../dtos/health.dto';
import type { HealthService } from '../services/HealthService';
import { BaseController } from './BaseController';

export class HealthController extends BaseController {
  constructor(private readonly healthService: HealthService) {
    super();
  }

  check = async (_req: Request, res: Response): Promise<void> => {
    const healthStatus = await this.healthService.check();
    this.handleSuccess(res, toHealthResponseDto(healthStatus));
  };
}
