export const DEFINE_PLUGIN_NAME = 'defineGoosePlugin';

// Wraps plugin code in its own function scope so one plugin's top-level
// `const`/`let` declarations can't collide with another's: classic <script>
// elements otherwise share a single global scope.
export function wrapPluginCode(code: string): string {
  return `(function (${DEFINE_PLUGIN_NAME}) {\n${code}\n})(window.${DEFINE_PLUGIN_NAME});`;
}
