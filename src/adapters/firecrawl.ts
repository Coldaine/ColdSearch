import type { SearchAdapter, ExtractResult, CrawlResult } from "../types.js";

/**
 * Firecrawl adapter.
 * Provides extract (scrape) and crawl capabilities.
 * @see https://docs.firecrawl.dev
 */
export class FirecrawlAdapter implements SearchAdapter {
  name = "firecrawl";
  capabilities = ["extract", "crawl"];
  private baseUrl = "https://api.firecrawl.dev/v2";

  async search(): Promise<never[]> {
    throw new Error("Firecrawl does not support search");
  }

  async extract(url: string, apiKey: string): Promise<ExtractResult> {
    // Validate URL
    if (!url || !url.trim()) {
      throw new Error("URL is required");
    }

    const normalizedUrl = url.trim();

    const response = await fetch(`${this.baseUrl}/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: normalizedUrl,
        formats: ["markdown"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Firecrawl API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as {
      success?: boolean;
      data?: {
        markdown?: string;
        metadata?: {
          title?: string;
          sourceURL?: string;
        };
      };
      error?: string;
    };

    if (!data.success || data.error) {
      throw new Error(`Firecrawl error: ${data.error || "Unknown error"}`);
    }

    return {
      content: data.data?.markdown || "",
      url: data.data?.metadata?.sourceURL || url,
      title: data.data?.metadata?.title || "",
      source: this.name,
    };
  }

  async crawl(url: string, apiKey: string, options?: { limit?: number }): Promise<CrawlResult[]> {
    // Validate URL
    if (!url || !url.trim()) {
      throw new Error("URL is required");
    }

    const normalizedUrl = url.trim();
    const limit = options?.limit ?? 10;

    // Start crawl job
    const startResponse = await fetch(`${this.baseUrl}/crawl`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: normalizedUrl,
        limit,
        scrapeOptions: {
          formats: ["markdown"],
        },
      }),
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      throw new Error(
        `Firecrawl crawl error: ${startResponse.status} - ${errorText}`
      );
    }

    const startData = (await startResponse.json()) as {
      success?: boolean;
      id?: string;
      error?: string;
    };

    if (!startData.success || !startData.id) {
      throw new Error(`Firecrawl crawl failed: ${startData.error || "No job ID"}`);
    }

    // Poll for completion
    const jobId = startData.id;
    const maxAttempts = 30;
    const pollInterval = 2000; // 2 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const statusResponse = await fetch(
        `${this.baseUrl}/crawl/${jobId}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );

      if (!statusResponse.ok) {
        continue; // Retry on poll failure
      }

      const statusData = (await statusResponse.json()) as {
        success?: boolean;
        status?: "scraping" | "completed" | "failed";
        data?: Array<{
          markdown?: string;
          metadata?: {
            title?: string;
            sourceURL?: string;
          };
        }>;
        error?: string;
      };

      if (statusData.status === "completed" && statusData.data) {
        return statusData.data.map((item) => ({
          url: item.metadata?.sourceURL || "",
          title: item.metadata?.title || "",
          content: item.markdown || "",
        }));
      }

      if (statusData.status === "failed") {
        throw new Error(`Firecrawl crawl failed: ${statusData.error || "Unknown error"}`);
      }
      // If still scraping, continue polling
    }

    throw new Error("Firecrawl crawl timed out");
  }
}
