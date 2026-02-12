
import { describe, it, expect } from 'vitest';
import { ComponentParser } from '../../src/diagrams/component/ComponentParser';
import { ComponentLayout } from '../../src/diagrams/component/ComponentLayout';
import { defaultTheme } from '../../src/diagrams/component/ComponentTheme';

describe('Component Port Rendering', () => {
    it('should parse and layout ports on component boundaries', () => {
        const input = `
component C {
  portin p1
  portin p2
  portin p3
  component c1
}
C --> p1
C --> p2
C --> p3
p1 --> c1
p2 --> c1
`;
        const parser = new ComponentParser();
        const diagram = parser.parse(input);

        // Verify structure
        const c = diagram.components.find(comp => comp.name === 'C');
        expect(c).toBeDefined();

        // Check if ports are parsed (either as children or special property)
        // For now, let's assume they might be children with a special type once implemented.
        // Currently, this test will likely fail to even find p1 if it's not parsed.

        // Depending on implementation, p1 might be found via findComponent or in c.ports
        // We'll update this assertion based on the implementation plan.
        // For now, let's just check if p1 exists in the diagram components list (as parsing usually adds everything there)
        const p1 = diagram.components.find(comp => comp.name === 'p1');
        const p2 = diagram.components.find(comp => comp.name === 'p2');
        const p3 = diagram.components.find(comp => comp.name === 'p3');

        expect(p1).toBeDefined();
        expect(p1?.type).toBe('portin');
        expect(p1?.parentId).toBe('C');

        const layout = new ComponentLayout(diagram, defaultTheme);
        const result = layout.calculateLayout();

        const cNode = result.components.find(n => n.component.name === 'C')!;
        const p1Node = result.components.find(n => n.component.name === 'p1')!;

        // Layout verification:
        // p1 is 'portin'. Dynamic placement puts it based on connections.
        // In this test case, p1 connects to c1 (internal child) which pulls it towards the child.
        // c1 is usually placed below the header, so p1 might end up on Bottom or Left.
        // We verify that it is on ONE of the boundaries.
        const halfPort = 5;

        const onLeft = Math.abs(p1Node.x - (cNode.x - halfPort)) < 1;
        const onRight = Math.abs(p1Node.x - (cNode.x + cNode.width - halfPort)) < 1;
        const onTop = Math.abs(p1Node.y - (cNode.y - halfPort)) < 1;
        const onBottom = Math.abs(p1Node.y - (cNode.y + cNode.height - halfPort)) < 1;

        expect(onLeft || onRight || onTop || onBottom).toBe(true);

        // Also verify that it stays attached to C
        // (Implicitly checked by boundary check above relative to C's coordinates)
    });
});
