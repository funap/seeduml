import { describe, it, expect } from 'vitest';
import { ComponentParser } from '../../src/diagrams/component/ComponentParser';
import { ComponentLayout, ComponentLayoutResult } from '../../src/diagrams/component/ComponentLayout';
import { defaultTheme } from '../../src/diagrams/component/ComponentTheme';

function parseAndLayout(input: string): ComponentLayoutResult {
    const parser = new ComponentParser();
    const diagram = parser.parse(input);
    const layout = new ComponentLayout(diagram, defaultTheme);
    return layout.calculateLayout();
}

describe('Component Layout Collision', () => {
    it('should reproduce collision between B->D arrow and ComponentC', () => {
        const input = `
            [ComponentA] -> [ComponentB]
            [ComponentA] -> [ComponentC]
            [ComponentA] -> [ComponentD]
            [ComponentB] --> [ComponentD]
            [ComponentD] --> [ComponentC]
        `;
        const result = parseAndLayout(input);

        const compC = result.components.find(c => c.component.name === 'ComponentC');
        const relBD = result.relationships.find(
            r => r.relationship.from === 'ComponentB' && r.relationship.to === 'ComponentD'
        );

        expect(compC).toBeDefined();
        expect(relBD).toBeDefined();

        if (compC && relBD) {
            // It should be a curved path (3 points: start, control, end)
            expect(relBD.path.length).toBe(4);

            const start = relBD.path[0];
            const control = relBD.path[1];

            // Verify control point clears the obstacle
            // In this vertical layout, B->D passes C. Obstacle C is in the middle.
            // The algorithm detours to the RIGHT.
            const obstacleRight = compC.x + compC.width;
            expect(control.x).toBeGreaterThan(obstacleRight);

            // NEW CHECK: Verify start point is on the RIGHT edge of ComponentB
            // Because the curve goes Right, the arrow should start from the Right edge.
            const compB = result.components.find(c => c.component.name === 'ComponentB')!;
            const rightEdgeX = compB.x + compB.width;

            // Allow small floating point error or padding
            expect(start.x).toBeCloseTo(rightEdgeX, 0);
            // And it should be vertically centered relative to B
            expect(start.y).toBeCloseTo(compB.y + compB.height / 2, 0);
        }
    });

    it('should position c below b based on first vertical relationship (b-->c), not later a-->c', () => {
        const input = `
            [a] -> [b]
            [b] --> [c]
            [a] -> [d]
            [a] --> [c]
        `;
        const result = parseAndLayout(input);

        const compA = result.components.find(c => c.component.name === 'a')!;
        const compB = result.components.find(c => c.component.name === 'b')!;
        const compC = result.components.find(c => c.component.name === 'c')!;
        const compD = result.components.find(c => c.component.name === 'd')!;

        expect(compA).toBeDefined();
        expect(compB).toBeDefined();
        expect(compC).toBeDefined();
        expect(compD).toBeDefined();

        // c should be below b (same column as b), not below a
        const bCenterX = compB.x + compB.width / 2;
        const cCenterX = compC.x + compC.width / 2;
        const aCenterX = compA.x + compA.width / 2;

        // c's center X should be closer to b's center X than to a's center X
        // because b-->c was declared first
        expect(Math.abs(cCenterX - bCenterX)).toBeLessThan(Math.abs(cCenterX - aCenterX));

        // c should be below b (higher y value)
        expect(compC.y).toBeGreaterThan(compB.y);
    });
});
