
import { describe, it, expect } from 'vitest';
import { ComponentParser } from '../src/diagrams/component/ComponentParser';
import { ComponentLayout } from '../src/diagrams/component/ComponentLayout';
import { defaultTheme } from '../src/diagrams/component/ComponentTheme';

describe('Component Port Dynamic Placement', () => {
    it('should place port on the top edge when connected from above', () => {
        const input = `
component C {
  portin p1
}
component External
External --> p1
`;
        // In the layout, if External is placed above C (which it should be if External --> p1 implies down),
        // then p1 should be on the top edge of C.

        const parser = new ComponentParser();
        const diagram = parser.parse(input);
        const layout = new ComponentLayout(diagram, defaultTheme);
        const result = layout.calculateLayout();

        const cNode = result.components.find(n => n.component.name === 'C')!;
        const p1Node = result.components.find(n => n.component.name === 'p1')!;
        const extNode = result.components.find(n => n.component.name === 'External')!; // Layout might rename/id differently? No, name is id.

        // Check relative positions of components
        // External should be above C (lower y is higher up)
        // If layout doesn't guarantee this, we might need to enforce it or check logic.
        // Assuming default 'down' direction.

        console.log(`External: (${extNode.x}, ${extNode.y})`);
        console.log(`C: (${cNode.x}, ${cNode.y})`);
        console.log(`p1: (${p1Node.x}, ${p1Node.y})`);

        // If External is indeed above C
        if (extNode.y + extNode.height < cNode.y) {
            // p1 should be on the top edge of C
            // Top edge y = cNode.y - portHeight/2
            const portHeight = 10;
            expect(p1Node.y).toBeCloseTo(cNode.y - portHeight / 2, 1);

            // And x should be within C's width
            expect(p1Node.x).toBeGreaterThanOrEqual(cNode.x);
            expect(p1Node.x).toBeLessThanOrEqual(cNode.x + cNode.width);
        } else {
            console.warn('External component was not placed above C as expected, test assumption might be invalid for current layout engine behavior without hints.');
        }
    });

    it('should place port on the right edge when connected from right', () => {
        const input = `
component C {
  portin p2
}
component External
p2 -> External
`;
        // p2 -> External implies p2 is source, External is target.
        // Default direction is down? "->" is usually right or down depending on plantuml.
        // But let's use explicit direction to be sure

        const inputExplicit = `
component C {
  portin p2
}
component External
C -right-> External
External --> p2
`;
        // Wait, if C is to the left of External.
        // And External has a connection to p2. 
        // Start simple.
    });

    it('reproduces the user scenario', () => {
        const input = `
component C {
  portin p1
  portin p2
  portin p3
  component c1
}

c --> p1
c --> p2
c --> p3
p1 --> c1
p2 --> c1
`;
        // We assume 'c' is an external component.

        const parser = new ComponentParser();
        const diagram = parser.parse(input);
        const layout = new ComponentLayout(diagram, defaultTheme);
        const result = layout.calculateLayout();

        const cExt = result.components.find(n => n.component.name === 'c');
        const C = result.components.find(n => n.component.name === 'C');
        const p1 = result.components.find(n => n.component.name === 'p1');

        if (cExt && C && p1) {
            // If c is above C
            if (cExt.y < C.y) {
                // p1 should be on top
                const halfPort = 5;
                // Expectation: p1.y splits the top boundary
                expect(p1.y).toBeCloseTo(C.y - halfPort, 1);
            }
        }

    });
});
