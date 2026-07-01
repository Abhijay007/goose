import Layout from "@theme/Layout";
import { Button } from "@site/src/components/ui/button";
import { Badge } from "@site/src/components/ui/badge";
import { fetchAddons } from "@site/src/utils/addons";
import type { AddonEntry } from "@site/src/types/addon";
import Link from "@docusaurus/Link";
import { useLocation } from "@docusaurus/router";
import { ArrowLeft, BookOpen, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

const contributionLabels: Record<string, string> = {
  chatAction: "Chat action",
  rootLink: "Page",
  sidecar: "Side panel",
  contentSuffix: "Message decoration",
  customRender: "Custom render",
};

function AddOnDetail({ addon }: { addon: AddonEntry }) {
  return (
    <Layout>
      <div className="min-h-screen flex items-start justify-center py-16">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="flex gap-8">
            <div>
              <Link to="/add-ons" className="no-underline">
                <Button className="flex items-center gap-2 hover:cursor-pointer">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              </Link>
            </div>

            <div className="server-card flex-1">
              <div className="card p-8 relative">
                <Link
                  to="/docs/guides/add-ons/manifest-reference"
                  className="absolute top-4 right-4 flex items-center gap-2 text-textSubtle hover:text-textProminent transition-colors no-underline"
                  title="View manifest reference"
                >
                  <BookOpen className="h-5 w-5" />
                </Link>

                <div className="card-header mb-6">
                  <div className="flex items-center gap-4 flex-wrap">
                    <h1 className="font-medium text-5xl text-textProminent m-0">{addon.name}</h1>
                    {addon.is_example && (
                      <Badge variant="secondary" className="text-sm">
                        Example
                      </Badge>
                    )}
                    {addon.endorsed && (
                      <Badge variant="secondary" className="text-sm">
                        Endorsed
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="card-content space-y-6">
                  <p className="text-xl text-textSubtle m-0">{addon.description}</p>

                  <div className="flex flex-wrap gap-2">
                    {addon.contributions.map((contribution) => (
                      <Badge key={contribution} variant="secondary">
                        {contributionLabels[contribution] ?? contribution}
                      </Badge>
                    ))}
                  </div>

                  <div className="space-y-2 text-textSubtle">
                    <p>
                      <strong>Version:</strong> {addon.version}
                    </p>
                    {addon.engines?.grc && (
                      <p>
                        <strong>Requires goose Desktop:</strong> {addon.engines.grc}
                      </p>
                    )}
                    <p>
                      <strong>Source path:</strong> <code>{addon.source_path}</code>
                    </p>
                  </div>

                  {addon.installation_notes && (
                    <div>
                      <h2 className="text-lg font-medium text-textProminent">Install</h2>
                      <p className="text-md text-textSubtle m-0">{addon.installation_notes}</p>
                      <ol className="text-textSubtle mt-4 space-y-2">
                        <li>Open goose Desktop → Add-ons in the sidebar.</li>
                        <li>Click <strong>Install add-on</strong> and select the folder containing <code>client-extension.json</code>.</li>
                        <li>Enable the add-on with the toggle, then use Reload if needed.</li>
                      </ol>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <a
                      href={addon.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 no-underline"
                    >
                      <Button variant="default" className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4" />
                        View source
                      </Button>
                    </a>
                    <Link to="/docs/guides/add-ons/build-an-add-on" className="no-underline">
                      <Button variant="ghost">Build your own</Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default function AddOnDetailPage() {
  const location = useLocation();
  const [addon, setAddon] = useState<AddonEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    if (!id) {
      setError("Missing add-on id.");
      return;
    }

    fetchAddons()
      .then((entries) => {
        const match = entries.find((entry) => entry.id === id);
        if (!match) {
          setError(`Add-on "${id}" not found.`);
          return;
        }
        setAddon(match);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load add-on.");
      });
  }, [location.search]);

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-24">
          <p className="text-red-600">{error}</p>
          <Link to="/add-ons">Back to add-ons</Link>
        </div>
      </Layout>
    );
  }

  if (!addon) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-24">Loading add-on...</div>
      </Layout>
    );
  }

  return <AddOnDetail addon={addon} />;
}
