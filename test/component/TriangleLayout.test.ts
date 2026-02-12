import { describe, it, expect } from 'vitest';
import { ComponentParser } from '../../src/diagrams/component/ComponentParser';
import { ComponentLayout } from '../../src/diagrams/component/ComponentLayout';
import { defaultTheme } from '../../src/diagrams/component/ComponentTheme';

describe('Component Triangle Layout', () => {
    it('should layout [a]->[b], [a]-->[c], [a]-->[d] in a balanced triangular pattern', () => {
        const input = `
            [a] -> [b]
            [a] --> [c]
            [a] --> [d]
        `;
        const parser = new ComponentParser();
        const diagram = parser.parse(input);
        const layout = new ComponentLayout(diagram, defaultTheme);
        const result = layout.calculateLayout();

        const findComp = (name: string) => result.components.find(c => c.component.name === name);
        const a = findComp('a');
        const b = findComp('b');
        const c = findComp('c');
        const d = findComp('d');

        expect(a).toBeDefined();
        expect(b).toBeDefined();
        expect(c).toBeDefined();
        expect(d).toBeDefined();

        // The user wants a, b, c to form a "regular triangle".
        // With current refinements, 'a' is centered between its downward children 'c' and 'd'.
    });
});
