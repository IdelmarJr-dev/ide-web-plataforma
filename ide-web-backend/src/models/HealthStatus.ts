export type ServiceStatus = 'up' | 'degraded' | 'down';

export interface HealthStatus {
  status: ServiceStatus;
  uptimeSeconds: number;
  checkedAt: Date;
}
