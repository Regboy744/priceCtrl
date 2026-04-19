import type { AppEnvironment } from './config/env.js';
import type { Logger } from './config/logger.js';
import type { SsrsPersistenceService } from './integrations/supabase/ssrs-persistence.service.js';
import type { JobManager } from './modules/jobs/job-manager.js';
import type { SweepService } from './modules/sweep/sweep.service.js';

export interface AppContext {
  env: AppEnvironment;
  logger: Logger;
  jobManager: JobManager;
  ssrsPersistence: SsrsPersistenceService | null;
  sweepService: SweepService;
}
