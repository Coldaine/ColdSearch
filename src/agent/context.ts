import type { NormalizedResult } from "../types.js";

/**
 * Source tracked during research.
 */
export interface Source {
  url: string;
  title: string;
  snippet: string;
  accessedAt: Date;
}

/**
 * Research step/operation record.
 */
export interface ResearchStep {
  type: "search" | "fetch" | "refine" | "synthesize";
  description: string;
  timestamp: Date;
}

/**
 * Research context maintained across agent steps.
 */
export class ResearchContext {
  goal: string;
  sources: Source[] = [];
  steps: ResearchStep[] = [];
  /** Tracked so tools can reference the active query */
  currentQuery: string = "";
  maxSources: number;

  constructor(goal: string, maxSources: number = 5) {
    this.goal = goal;
    this.maxSources = maxSources;
  }

  /**
   * Add a source if not already tracked.
   */
  addSource(result: NormalizedResult): void {
    const exists = this.sources.some(
      (s) => s.url.toLowerCase() === result.url.toLowerCase()
    );
    
    if (!exists && this.sources.length < this.maxSources) {
      this.sources.push({
        url: result.url,
        title: result.title,
        snippet: result.snippet,
        accessedAt: new Date(),
      });
    }
  }

  /**
   * Record a research step.
   */
  addStep(type: ResearchStep["type"], description: string): void {
    this.steps.push({
      type,
      description,
      timestamp: new Date(),
    });
  }

  /**
   * Get formatted sources for citation.
   */
  getFormattedSources(): string {
    return this.sources
      .map((s, i) => `[${i + 1}] ${s.title} - ${s.url}`)
      .join("\n");
  }

  /**
   * Generate final response with source citations appended.
   */
  generateResponse(answer: string): {
    answer: string;
    sources: Source[];
    steps: ResearchStep[];
  } {
    const citationBlock = this.sources.length > 0
      ? "\n\nSources:\n" + this.getFormattedSources()
      : "";

    return {
      answer: answer + citationBlock,
      sources: this.sources,
      steps: this.steps,
    };
  }
}
