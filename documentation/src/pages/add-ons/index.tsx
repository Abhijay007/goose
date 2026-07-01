import { AddonCard } from "@site/src/components/addon-card";
import type { AddonEntry } from "@site/src/types/addon";
import { fetchAddons, searchAddons } from "@site/src/utils/addons";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function AddOnsPage() {
  const [addons, setAddons] = useState<AddonEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAddons = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const trimmedQuery = searchQuery.trim();
        const results = trimmedQuery ? await searchAddons(trimmedQuery) : await fetchAddons();
        setAddons(results);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(`Failed to load add-ons: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(loadAddons, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const examples = addons.filter((addon) => addon.is_example);
  const community = addons.filter((addon) => !addon.is_example);

  return (
    <Layout>
      <div className="container mx-auto px-4 p-24">
        <div className="pb-16">
          <h1 className="text-[64px] font-medium text-textProminent">Browse Add-ons</h1>
          <p className="text-textProminent max-w-3xl">
            Discover UI add-ons for goose Desktop — custom pages, chat actions, side panels, and
            message decorations. Add-ons extend the desktop client only; they are separate from MCP
            Extensions.
          </p>
          <p className="text-textSubtle mt-4">
            New to add-ons? Start with the{" "}
            <Link to="/docs/guides/add-ons/">add-ons guide</Link>.
          </p>
        </div>

        <div className="flex justify-between items-center mb-8">
          <div className="search-container flex-1">
            <input
              className="bg-bgApp font-light text-textProminent placeholder-textPlaceholder w-full px-3 py-3 text-[40px] leading-[52px] border-b border-borderSubtle focus:outline-none focus:ring-purple-500 focus:border-borderProminent caret-[#FF4F00] pl-0"
              placeholder="Search for add-ons"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {error && <div className="p-4 bg-red-50 text-red-600 rounded-md">{error}</div>}

        {isLoading ? (
          <div className="py-8 text-xl text-gray-600">Loading add-ons...</div>
        ) : addons.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchQuery ? "No add-ons found matching your search." : "No add-ons available yet."}
          </div>
        ) : (
          <>
            {examples.length > 0 && (
              <section className="mb-12">
                <h2 className="text-2xl font-semibold text-textProminent mb-6">Example add-ons</h2>
                <div className="cards-grid">
                  {examples.map((addon) => (
                    <motion.div
                      key={addon.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.6 }}
                    >
                      <AddonCard addon={addon} />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {community.length > 0 && (
              <section>
                <h2 className="text-2xl font-semibold text-textProminent mb-6">Community add-ons</h2>
                <div className="cards-grid">
                  {community.map((addon) => (
                    <motion.div
                      key={addon.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.6 }}
                    >
                      <AddonCard addon={addon} />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
