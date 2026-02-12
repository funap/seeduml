
import { describe, it, expect } from 'vitest';
import { ComponentParser } from '../../src/diagrams/component/ComponentParser';
import { ComponentLayout } from '../../src/diagrams/component/ComponentLayout';
import { defaultTheme } from '../../src/diagrams/component/ComponentTheme';
import { ComponentSVGRenderer } from '../../src/diagrams/component/ComponentSVGRenderer';

describe('User Reported Issues', () => {
    it('should generate SVG where component label is not obscured by children', () => {
        const input = `
component C {
  component c1
}
`;
        const parser = new ComponentParser();
        const diagram = parser.parse(input);
        const renderer = new ComponentSVGRenderer();
        const svg = renderer.render(diagram);

        // We can't easily check visual overlap in unit test, but we can check if label is rendered 
        // AFTER the children or has a reserved space.
        // In the current implementation, 'text' for label is drawn last in 'renderComponent'.
        // However, 'c1' (child) is drawn in 'sortedComponents.forEach' loop in render method.
        // The parent C is drawn, then children are drawn ON TOP of it if they come later in sorted list?
        // Or if C is a container, it draws a rect.
        // If the label is drawn as part of C's renderComponent, and children are drawn later, 
        // children will overlap the label if the label is inside the content area.

        // Use ComponentLayout to check if adequate space is reserved for label at the TOP.
        const layout = new ComponentLayout(diagram, defaultTheme);
        const result = layout.calculateLayout();
        const cNode = result.components.find(n => n.component.name === 'C')!;
        const c1Node = result.components.find(n => n.component.name === 'c1')!;

        // c1 should be shifted down to make room for C's label
        // C's label is usually at the top.
        // Check if c1.y is significantly greater than C.y
        expect(c1Node.y).toBeGreaterThan(cNode.y + 20); // arbitrary threshold for label height
    });

    it('should render port labels', () => {
        const input = `
component C {
  portin p1
}
`;
        const parser = new ComponentParser();
        const diagram = parser.parse(input);
        const renderer = new ComponentSVGRenderer();
        const svg = renderer.render(diagram);

        // Check if "p1" text exists in SVG
        expect(svg).toContain('>p1<');
    });
});
