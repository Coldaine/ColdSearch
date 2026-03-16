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
export declare class ResearchContext {
    goal: string;
    sources: Source[];
    steps: ResearchStep[];
    currentQuery: string;
    findings: string[];
    maxSources: number;
    constructor(goal: string, maxSources?: number);
    /**
     * Add a source if not already tracked.
     */
    addSource(result: NormalizedResult): void;
    /**
     * Record a research step.
     */
    addStep(type: ResearchStep["type"], description: string): void;
    /**
     * Add a finding from research.
     */
    addFinding(finding: string): void;
    /**
     * Get formatted sources for citation.
     */
    getFormattedSources(): string;
    /**
     * Generate final response with citations.
     */
    generateResponse(answer: string): {
        answer: string;
        sources: Source[];
        steps: ResearchStep[];
    };
}
//# sourceMappingURL=context.d.ts.map