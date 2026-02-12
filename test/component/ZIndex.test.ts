
import { describe, it, expect } from 'vitest';
import { ComponentParser } from '../../src/diagrams/component/ComponentParser';
import { ComponentSVGRenderer } from '../../src/diagrams/component/ComponentSVGRenderer';

describe('Relationship Z-Index', () => {
    it('should render relationships after components (making them appear on top)', () => {
        const input = `
component C1
component C2
C1 --> C2
`;
        const parser = new ComponentParser();
        const diagram = parser.parse(input);
        const renderer = new ComponentSVGRenderer();
        const svg = renderer.render(diagram);

        // In SVG, elements defined later are drawn on top.
        // We expect <line> or <path> for relationship to appear AFTER <rect> for component.

        const componentIndex = svg.indexOf('<rect');
        const relationshipIndex = svg.indexOf('<line'); // Relationships use lines currently

        // Note: relationshipIndex might be -1 if we change rendering implementation. 
        // Currently ComponentSVGRenderer uses <line> for straight connectors.

        expect(relationshipIndex).toBeGreaterThan(componentIndex);
        expect(componentIndex).not.toBe(-1);
    });
});
