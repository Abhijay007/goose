import { commandsPower } from './commands';
import { platformPower } from './platform';
import { providersPower } from './providers';
import { recipesPower } from './recipes';
import { sessionsPower } from './sessions';
import { storagePower } from './storage';

export const COMMON_HOST_POWERS = [
  platformPower,
  providersPower,
  sessionsPower,
  recipesPower,
  commandsPower,
  storagePower,
] as const;
