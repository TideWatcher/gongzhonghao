declare module "node-cron" {
  export interface ScheduleOptions {
    timezone?: string;
    scheduled?: boolean;
  }

  export interface ScheduledTask {
    start(): void;
    stop(): void;
  }

  export function schedule(
    expression: string,
    func: () => void | Promise<void>,
    options?: ScheduleOptions,
  ): ScheduledTask;

  export function validate(expression: string): boolean;
}
