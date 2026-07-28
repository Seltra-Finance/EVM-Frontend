/**
 * Canonical docs information architecture. This is the single source of truth
 * for routes, sidebar order, section grouping, and prev/next pagination —
 * scripts/check-docs.mjs enforces 1:1 parity with content/docs/**.
 */
export interface DocPage {
  title: string;
  /** Route under /docs; "" is the docs homepage. */
  slug: string;
  /** MDX path under content/docs, without extension. */
  file: string;
  section: string;
}

export interface DocSection {
  title: string;
  /** Section landing page slug. */
  slug: string;
  pages: DocPage[];
}

const page = (title: string, slug: string, file: string, section: string): DocPage => ({
  title,
  slug,
  file,
  section,
});

export const docsSections: DocSection[] = [
  {
    title: "Concepts",
    slug: "concepts",
    pages: [
      page("Concepts", "concepts", "concepts/index", "Concepts"),
      page("How Seltra Works", "concepts/how-seltra-works", "concepts/how-seltra-works", "Concepts"),
      page("Order Model", "concepts/order-model", "concepts/order-model", "Concepts"),
      page("Permit2 Signatures", "concepts/permit2-signatures", "concepts/permit2-signatures", "Concepts"),
      page("DEX Settlement", "concepts/dex-settlement", "concepts/dex-settlement", "Concepts"),
      page("P2P Settlement", "concepts/p2p-settlement", "concepts/p2p-settlement", "Concepts"),
      page(
        "Surplus, Fees & Incentives",
        "concepts/surplus-fees-and-incentives",
        "concepts/surplus-fees-and-incentives",
        "Concepts",
      ),
      page(
        "Cancellation, Expiry & Pause",
        "concepts/cancellation-expiry-and-pause",
        "concepts/cancellation-expiry-and-pause",
        "Concepts",
      ),
      page(
        "App Trading Guide",
        "concepts/app-trading-guide",
        "concepts/app-trading-guide",
        "Concepts",
      ),
    ],
  },
  {
    title: "Build with Seltra",
    slug: "build-with-seltra",
    pages: [
      page("Build with Seltra", "build-with-seltra", "build-with-seltra/index", "Build with Seltra"),
      page("Fuji Quickstart", "build-with-seltra/fuji-quickstart", "build-with-seltra/fuji-quickstart", "Build with Seltra"),
      page("Sign an Order", "build-with-seltra/sign-an-order", "build-with-seltra/sign-an-order", "Build with Seltra"),
      page("Orderbook API", "build-with-seltra/orderbook-api", "build-with-seltra/orderbook-api", "Build with Seltra"),
      page(
        "Keeper Integration",
        "build-with-seltra/keeper-integration",
        "build-with-seltra/keeper-integration",
        "Build with Seltra",
      ),
      page(
        "Indexing & Events",
        "build-with-seltra/indexing-and-events",
        "build-with-seltra/indexing-and-events",
        "Build with Seltra",
      ),
      page(
        "Configuration Reference",
        "build-with-seltra/configuration-reference",
        "build-with-seltra/configuration-reference",
        "Build with Seltra",
      ),
    ],
  },
  {
    title: "Contract Reference",
    slug: "contract-reference",
    pages: [
      page("Contract Reference", "contract-reference", "contract-reference/index", "Contract Reference"),
      page("Architecture", "contract-reference/architecture", "contract-reference/architecture", "Contract Reference"),
      page("SeltraSettlement", "contract-reference/seltrasettlement", "contract-reference/seltrasettlement", "Contract Reference"),
      page(
        "Aggregation Router",
        "contract-reference/aggregation-router",
        "contract-reference/aggregation-router",
        "Contract Reference",
      ),
      page("DEX Adapters", "contract-reference/dex-adapters", "contract-reference/dex-adapters", "Contract Reference"),
      page(
        "Events & Errors",
        "contract-reference/events-and-errors",
        "contract-reference/events-and-errors",
        "Contract Reference",
      ),
      page(
        "Governance & Access Control",
        "contract-reference/governance-and-access-control",
        "contract-reference/governance-and-access-control",
        "Contract Reference",
      ),
    ],
  },
  {
    title: "Networks & Deployments",
    slug: "networks-and-deployments",
    pages: [
      page(
        "Networks & Deployments",
        "networks-and-deployments",
        "networks-and-deployments/index",
        "Networks & Deployments",
      ),
      page(
        "Fuji Deployment",
        "networks-and-deployments/fuji-deployment",
        "networks-and-deployments/fuji-deployment",
        "Networks & Deployments",
      ),
      page(
        "Contract Addresses",
        "networks-and-deployments/contract-addresses",
        "networks-and-deployments/contract-addresses",
        "Networks & Deployments",
      ),
      page(
        "Mainnet Status",
        "networks-and-deployments/mainnet-status",
        "networks-and-deployments/mainnet-status",
        "Networks & Deployments",
      ),
    ],
  },
  {
    title: "Security",
    slug: "security",
    pages: [
      page("Security", "security", "security/index", "Security"),
      page("Security Model", "security/security-model", "security/security-model", "Security"),
      page("Testing & Verification", "security/testing-and-verification", "security/testing-and-verification", "Security"),
    ],
  },
];

export const docsHome: DocPage = page("Welcome to Seltra", "", "index", "Docs");

/** Every page in canonical reading order — drives prev/next pagination. */
export const allDocPages: DocPage[] = [docsHome, ...docsSections.flatMap((section) => section.pages)];

export function pageForSlug(slug: string): DocPage | undefined {
  return allDocPages.find((p) => p.slug === slug);
}

export function routeForSlug(slug: string): string {
  return slug === "" ? "/docs" : `/docs/${slug}`;
}
