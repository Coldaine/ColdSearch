import type { SearchAdapter, ExtractResult } from "../types.js";

/**
 * Jina AI Reader adapter.
 * Provides simple URL-to-markdown extraction.
 * No API key required for basic usage.
 * @see https://jina.ai/reader
 */
export class JinaAdapter implements SearchAdapter {
  name = "jina";
  capabilities = ["extract"];

  async search(): Promise<never[]> {
    throw new Error("Jina does not support search");
  }

  async extract(url: string, _apiKey: string): Promise<ExtractResult> {
    // Validate URL
    if (!url || !url.trim()) {
      throw new Error("URL is required");
    }

    // Normalize URL - ensure it has a protocol
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    // Jina AI Reader endpoint - supports both http and https
    const jinaUrl = `https://r.jina.ai/http://${normalizedUrl.replace(/^https?:\/\//, "")}`;

    const response = await fetch(jinaUrl, {
      headers: {
        Accept: "text/plain",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jina API error: ${response.status} - ${errorText}`);
    }

    const content = await response.text();

    if (!content || content.trim().length === 0) {
      throw new Error(`No content extracted from ${url}`);
    }

    // Extract title from first line if it looks like a title
    const lines = content.split("\n");
    let title = "";
    let bodyContent = content;

    // Jina often returns "Title: actual title" format
    if (lines[0]?.startsWith("Title:")) {
      title = lines[0].replace("Title:", "").trim();
      bodyContent = lines.slice(1).join("\n").trim();
    }

    return {
      content: bodyContent,
      url: normalizedUrl,
      title: title,
      source: this.name,
    };
  }
}
