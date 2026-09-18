export interface HealthRepository {
  getProcessUptimeSeconds(): Promise<number>;
}

export class ProcessHealthRepository implements HealthRepository {
  getProcessUptimeSeconds(): Promise<number> {
    return Promise.resolve(process.uptime());
  }
}
