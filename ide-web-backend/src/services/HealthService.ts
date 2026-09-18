import type { HealthStatus, ServiceStatus } from '../models/HealthStatus';
import type { HealthRepository } from '../repositories/HealthRepository';

const MINIMUM_STABLE_UPTIME_SECONDS = 5;

export class HealthService {
  constructor(private readonly healthRepository: HealthRepository) {}

  async check(): Promise<HealthStatus> {
    const uptimeSeconds = await this.healthRepository.getProcessUptimeSeconds();

    return {
      status: this.resolveStatus(uptimeSeconds),
      uptimeSeconds,
      checkedAt: new Date(),
    };
  }

  private resolveStatus(uptimeSeconds: number): ServiceStatus {
    if (uptimeSeconds < MINIMUM_STABLE_UPTIME_SECONDS) {
      return 'degraded';
    }

    return 'up';
  }
}
