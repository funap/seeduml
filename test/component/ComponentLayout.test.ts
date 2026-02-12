
import { describe, it, expect } from 'vitest';
import { ComponentDiagram } from '../../src/diagrams/component/ComponentDiagram';
import { ComponentLayout } from '../../src/diagrams/component/ComponentLayout';
import { defaultTheme } from '../../src/diagrams/component/ComponentTheme';

describe('ComponentLayout', () => {
    it('should center components of different sizes', () => {
        const diagram = new ComponentDiagram();
        diagram.addComponent('C1', 'component', 'Short');
        diagram.addComponent('C2', 'component', 'Very Long Component Label');
        diagram.addComponent('C3', 'component', 'Line 1\\nLine 2');
        diagram.addComponent('C4', 'component', 'Small');

        const layout = new ComponentLayout(diagram, defaultTheme);
        const result = layout.calculateLayout();

        // 4 components = 2x2 grid
        // Row heights and col widths should be based on maximums
        const c1 = result.components.find(c => c.component.name === 'C1')!;
        const c2 = result.components.find(c => c.component.name === 'C2')!;
        const c3 = result.components.find(c => c.component.name === 'C3')!;
        const c4 = result.components.find(c => c.component.name === 'C4')!;

        // Grid looks like:
        // [C1] [C2]
        // [C3] [C4]

        // C1 and C3 should have same X center (within Col 0)
        // C2 and C4 should have same X center (within Col 1)
        expect(c1.x + c1.width / 2).toBeCloseTo(c3.x + c3.width / 2);
        expect(c2.x + c2.width / 2).toBeCloseTo(c4.x + c4.width / 2);

        // C1 and C2 should have same Y center (within Row 0)
        // C3 and C4 should have same Y center (within Row 1)
        expect(c1.y + c1.height / 2).toBeCloseTo(c2.y + c2.height / 2);
        expect(c3.y + c3.height / 2).toBeCloseTo(c4.y + c4.height / 2);
    });
});
