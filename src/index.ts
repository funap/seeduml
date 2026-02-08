import { SequenceParser } from './diagrams/sequence/SequenceParser';
import { SequenceSVGRenderer } from './diagrams/sequence/SequenceSVGRenderer';

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
        const errorMsg = e.message || 'Unknown error occurred during parsing';
        // Render a simple SVG with the error message
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
        const svg = renderSequenceDiagram(content);
        
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
        renderAll,
        initialize
    };
}

// Export for ES modules
export default {
    renderSequenceDiagram,
    renderAll,
    initialize
};
