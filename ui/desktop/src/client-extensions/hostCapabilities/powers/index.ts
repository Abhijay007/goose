import { commandsPower } from './commands';
import { platformPower } from './platform';
import { providersPower } from './providers';
import { recipesPower } from './recipes';
import { schedulesPower } from './schedules';
import { sessionsPower } from './sessions';
import { storagePower } from './storage';
import { toolsPower } from './tools';

export const COMMON_HOST_POWERS = [
  platformPower,
  providersPower,
  sessionsPower,
  recipesPower,
  commandsPower,
  storagePower,
  schedulesPower,
  toolsPower,
] as const;
