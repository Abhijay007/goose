import Link from "@docusaurus/Link";
import type { AddonEntry } from "@site/src/types/addon";
import { ChevronRight } from "lucide-react";

const contributionLabels: Record<string, string> = {
  chatAction: "Chat action",
  rootLink: "Page",
  sidecar: "Side panel",
  contentSuffix: "Message decoration",
  customRender: "Custom render",
};

export function AddonCard({ addon }: { addon: AddonEntry }) {
  return (
    <div className="extension-title h-full">
      <div className="server-card interactive w-full h-full">
        <div className="card-glow"></div>
        <div className="card">
          <div className="card-header">
            <div className="card-header-content">
              <Link to={`/add-ons/detail?id=${addon.id}`} className="home-page-server-name">
                {addon.name}
              </Link>
            </div>
          </div>
          <div className="card-content">
            <p className="card-description">{addon.description}</p>
            <div className="flex flex-wrap gap-2 py-4">
              {addon.contributions.map((contribution) => (
                <span
                  key={contribution}
                  className="inline-flex items-center rounded-full bg-bgSubtle px-2 py-1 text-xs text-textSubtle"
                >
                  {contributionLabels[contribution] ?? contribution}
                </span>
              ))}
              {addon.is_example && (
                <span className="inline-flex items-center rounded-full bg-bgSubtle px-2 py-1 text-xs text-textSubtle">
                  Example
                </span>
              )}
            </div>
            <Link
              to={`/add-ons/detail?id=${addon.id}`}
              className="flex items-center gap-1 text-sm text-textSubtle no-underline hover:text-textProminent"
            >
              View details
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
