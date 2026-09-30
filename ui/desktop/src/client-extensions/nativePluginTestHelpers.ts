import { DEFINE_PLUGIN_NAME, wrapPluginCode } from './pluginCodeWrapper';
import type { PluginDefinition } from './nativePlugin';

// jsdom (used by the vitest suite) never executes an appended <script>
// element, so tests run the same wrapped code through the Function
// constructor instead of the DOM. loadPluginDefinition itself is exercised
// against a real Chromium/Electron window, not here.
export function evalPluginCode(code: string): PluginDefinition {
  const captured: { definition: PluginDefinition | null } = { definition: null };
  Reflect.set(window, DEFINE_PLUGIN_NAME, (definition: PluginDefinition) => {
    captured.definition = definition;
  });
  try {
    new Function(wrapPluginCode(code))();
  } finally {
    Reflect.deleteProperty(window, DEFINE_PLUGIN_NAME);
  }

  if (typeof captured.definition?.activate !== 'function') {
    throw new Error(`Plugin code must call ${DEFINE_PLUGIN_NAME}({ activate })`);
  }
  return captured.definition;
}
