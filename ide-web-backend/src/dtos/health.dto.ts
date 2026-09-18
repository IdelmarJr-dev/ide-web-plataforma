import { z } from 'zod';
import type { HealthStatus } from '../models/HealthStatus';

export const healthResponseSchema = z.object({
  status: z.enum(['up', 'degraded', 'down']),
  uptimeSeconds: z.number().nonnegative(),
  checkedAt: z.string().datetime(),
});

export type HealthResponseDto = z.infer<typeof healthResponseSchema>;

export function toHealthResponseDto(healthStatus: HealthStatus): HealthResponseDto {
  return {
    status: healthStatus.status,
    uptimeSeconds: healthStatus.uptimeSeconds,
    checkedAt: healthStatus.checkedAt.toISOString(),
  };
}
