export type AddonContribution =
  | "chatAction"
  | "rootLink"
  | "sidecar"
  | "contentSuffix"
  | "customRender";

export interface AddonEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  link: string;
  source_path: string;
  is_example: boolean;
  endorsed: boolean;
  contributions: AddonContribution[];
  installation_notes: string;
  engines?: {
    grc?: string;
  };
}
