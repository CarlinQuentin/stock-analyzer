export const PRODUCTION_DOMAIN = "https://stock-analyzer-five-rouge.vercel.app";
export const DEFAULT_TITLE = "Investor's Edge | Fundamental Stock Analysis";
export const DEFAULT_DESCRIPTION =
  "Analyze stocks with fundamental metrics, ROIC, free cash flow, valuation data, growth trends, and quality scoring with Investor's Edge.";

export interface PageMetadata {
  title: string;
  description: string;
  canonicalUrl: string;
  robots?: string;
}

/**
 * Generates stock-specific SEO title, meta description, and canonical URL.
 */
export function generateStockMetadata(
  symbol: string,
  companyName?: string | null
): PageMetadata {
  const cleanSymbol = (symbol || "").trim().toUpperCase();
  const cleanName = (companyName || "").trim() || cleanSymbol;

  const title = `${cleanSymbol} Stock Analysis & Quality Score (${cleanName}) | Investor's Edge`;
  const description = `Fundamental analysis for ${cleanName} (${cleanSymbol}), including ROIC, free cash flow, growth trends, valuation metrics, and investment quality scoring.`;
  const canonicalUrl = `${PRODUCTION_DOMAIN}/stock/${encodeURIComponent(cleanSymbol)}`;

  return {
    title,
    description,
    canonicalUrl,
    robots: "index, follow",
  };
}

/**
 * Generates default homepage SEO metadata.
 */
export function generateDefaultMetadata(): PageMetadata {
  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    canonicalUrl: `${PRODUCTION_DOMAIN}/`,
    robots: "index, follow",
  };
}

/**
 * Generates Schema.org BreadcrumbList structured data for a stock page.
 */
export function generateStockBreadcrumbsJsonLd(
  symbol: string,
  _companyName?: string | null
): object {
  const cleanSymbol = (symbol || "").trim().toUpperCase();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${PRODUCTION_DOMAIN}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Stocks",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: cleanSymbol,
        item: `${PRODUCTION_DOMAIN}/stock/${encodeURIComponent(cleanSymbol)}`,
      },
    ],
  };
}

/**
 * Generates Schema.org WebSite structured data with SearchAction.
 */
export function generateWebSiteJsonLd(): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Investor's Edge",
    url: `${PRODUCTION_DOMAIN}/`,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${PRODUCTION_DOMAIN}/stock/{search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Updates DOM head tags dynamically for client-side routing.
 */
export function updateDocumentMetadata(options: {
  title: string;
  description: string;
  canonicalUrl?: string;
  robots?: string;
  jsonLd?: object | null;
}) {
  if (typeof document === "undefined") return;

  // 1. Update Document Title
  document.title = options.title;

  // Helper to set or create meta tag
  const setMetaTag = (attrName: "name" | "property", attrValue: string, content: string) => {
    let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attrName, attrValue);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  };

  // 2. Update Primary Description
  setMetaTag("name", "description", options.description);

  // 3. Update Robots
  setMetaTag("name", "robots", options.robots || "index, follow");

  // 4. Update Open Graph & Twitter Tags
  setMetaTag("property", "og:title", options.title);
  setMetaTag("property", "og:description", options.description);
  setMetaTag("name", "twitter:title", options.title);
  setMetaTag("name", "twitter:description", options.description);

  if (options.canonicalUrl) {
    setMetaTag("property", "og:url", options.canonicalUrl);

    let linkCanonical = document.querySelector('link[rel="canonical"]');
    if (!linkCanonical) {
      linkCanonical = document.createElement("link");
      linkCanonical.setAttribute("rel", "canonical");
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute("href", options.canonicalUrl);
  }

  // 5. Update or remove BreadcrumbList JSON-LD Script Tag
  const BREADCRUMB_SCRIPT_ID = "schema-breadcrumb-jsonld";
  const existingScript = document.getElementById(BREADCRUMB_SCRIPT_ID);

  if (options.jsonLd) {
    if (existingScript) {
      existingScript.textContent = JSON.stringify(options.jsonLd);
    } else {
      const script = document.createElement("script");
      script.id = BREADCRUMB_SCRIPT_ID;
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(options.jsonLd);
      document.head.appendChild(script);
    }
  } else if (existingScript) {
    existingScript.remove();
  }
}
