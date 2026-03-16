/**
 * Research context maintained across agent steps.
 */
export class ResearchContext {
    goal;
    sources = [];
    steps = [];
    currentQuery = "";
    findings = [];
    maxSources;
    constructor(goal, maxSources = 5) {
        this.goal = goal;
        this.maxSources = maxSources;
    }
    /**
     * Add a source if not already tracked.
     */
    addSource(result) {
        const exists = this.sources.some((s) => s.url.toLowerCase() === result.url.toLowerCase());
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
    addStep(type, description) {
        this.steps.push({
            type,
            description,
            timestamp: new Date(),
        });
    }
    /**
     * Add a finding from research.
     */
    addFinding(finding) {
        this.findings.push(finding);
    }
    /**
     * Get formatted sources for citation.
     */
    getFormattedSources() {
        return this.sources
            .map((s, i) => `[${i + 1}] ${s.title} - ${s.url}`)
            .join("\n");
    }
    /**
     * Generate final response with citations.
     */
    generateResponse(answer) {
        // Add citations to answer
        let citedAnswer = answer;
        this.sources.forEach((source, index) => {
            // Simple citation replacement - could be smarter
            const citation = `[${index + 1}]`;
            // This is a placeholder - actual citation logic would be more sophisticated
        });
        return {
            answer: citedAnswer,
            sources: this.sources,
            steps: this.steps,
        };
    }
}
//# sourceMappingURL=context.js.map