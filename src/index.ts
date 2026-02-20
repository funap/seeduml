import { SequenceParser } from './diagrams/sequence/SequenceParser';
import { SequenceSVGRenderer } from './diagrams/sequence/SequenceSVGRenderer';
import { ComponentParser } from './diagrams/component/ComponentParser';
import { ComponentSVGRenderer } from './diagrams/component/ComponentSVGRenderer';

export interface InitializeConfig {
    startOnLoad?: boolean;
    selector?: string;
}

export function renderSequenceDiagram(content: string): string {
    const parser = new SequenceParser();
    const renderer = new SequenceSVGRenderer();
    try {
        const diagram = parser.parse(content);
        return renderer.render(diagram);
    } catch (e: any) {
        return renderError(e);
    }
}

export function renderComponentDiagram(content: string): string {
    const parser = new ComponentParser();
    const renderer = new ComponentSVGRenderer();
    try {
        const diagram = parser.parse(content);
        return renderer.render(diagram);
    } catch (e: any) {
        return renderError(e);
    }
}

function renderError(e: any): string {
    const errorMsg = e.message || 'Unknown error occurred during parsing';
    const escapedError = errorMsg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const width = 800; // Arbitrary width for error
    const height = 100;
    return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background: white; font-family: sans-serif;">
            <rect width="100%" height="100%" fill="#ffeeee" stroke="#ff0000" stroke-width="2" />
            <text x="20" y="50" fill="#ff0000" font-size="16" font-weight="bold">${escapedError}</text>
        </svg>
    `.trim();
}

export function render(content: string): string {
    // Basic auto-detection logic
    const isComponent = /\b(component|interface|package|node|cloud|database|frame|folder)\b|\[.*?\]/.test(content);
    const isSequence = /\b(participant|actor|boundary|control|entity|collections|queue|sequence)\b/.test(content);

    // Default to sequence if ambiguous but has -> or -- (could be component too)
    // Preference: Explicit keywords > ambiguous arrows
    if (isComponent && !isSequence) return renderComponentDiagram(content);
    if (!isComponent && isSequence) return renderSequenceDiagram(content);

    // Fallback: Check for component specific syntax like [Bracket] or component elements
    if (/\[.*?\]/.test(content)) return renderComponentDiagram(content);

    // Default
    return renderSequenceDiagram(content);
}

/**
 * Automatically render all seeduml diagram blocks on the page
 * @param selector CSS selector for diagram blocks (default: 'pre.seeduml')
 */
export function renderAll(selector: string = 'pre.seeduml'): void {
    if (typeof document === 'undefined') return;

    const blocks = document.querySelectorAll(selector);
    blocks.forEach((block) => {
        const content = block.textContent || '';
        const svg = render(content);

        // Replace the pre element with an SVG container
        const container = document.createElement('div');
        container.className = 'seeduml-diagram';
        container.innerHTML = svg;
        container.style.display = 'inline-block';

        block.parentNode?.replaceChild(container, block);
    });
}

/**
 * Initialize SeedUML with automatic rendering
 * @param config Configuration options
 */
export function initialize(config: InitializeConfig = {}): void {
    const { startOnLoad = true, selector = 'pre.seeduml' } = config;

    if (!startOnLoad) return;

    if (typeof document === 'undefined') return;

    // If document is already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            renderAll(selector);
        });
    } else {
        renderAll(selector);
    }
}

// Browser global
if (typeof window !== 'undefined') {
    (window as any).seeduml = {
        renderSequenceDiagram,
        renderComponentDiagram,
        render,
        renderAll,
        initialize
    };
}

// Export for ES modules
export default {
    renderSequenceDiagram,
    renderComponentDiagram,
    render,
    renderAll,
    initialize
};
