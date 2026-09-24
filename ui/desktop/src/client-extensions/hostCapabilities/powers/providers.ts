import { acpListProviderDetails, acpReadDefaults, acpSaveDefaults } from '../../../acp/providers';
import type { HostCapabilityDefinition } from '../types';

function requireNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`"${name}" must be a non-empty string`);
  }
  return value;
}

export const providersPower: HostCapabilityDefinition = {
  id: 'providers',
  description: 'Read the provider inventory and the default provider and model.',
  methods: {
    list: {
      permission: 'providers:read',
      handle: async () => {
        const providers = await acpListProviderDetails();
        return providers.map((provider) => ({
          id: provider.name,
          displayName: provider.metadata.display_name,
          configured: provider.is_configured,
          available: provider.is_available,
          defaultModel: provider.metadata.default_model,
        }));
      },
    },
    getDefault: {
      permission: 'providers:read',
      handle: () => acpReadDefaults(),
    },
    setDefault: {
      permission: 'providers:write',
      handle: async (_context, payload) => {
        const request = (payload ?? {}) as { providerId?: unknown; modelId?: unknown };
        const providerId = requireNonEmptyString(request.providerId, 'providerId');
        const modelId =
          request.modelId === undefined || request.modelId === null
            ? null
            : requireNonEmptyString(request.modelId, 'modelId');
        await acpSaveDefaults(providerId, modelId);
        return { providerId, modelId };
      },
    },
  },
};
