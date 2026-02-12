
import { describe, it, expect } from 'vitest';
import { ComponentParser } from '../../src/diagrams/component/ComponentParser';

describe('Multi-line Component Description', () => {
    it('should parse component with multi-line description in brackets', () => {
        const input = `
component comp1 [
This component
has a long comment
on several lines
]
`;
        const parser = new ComponentParser();
        const diagram = parser.parse(input);

        const comp = diagram.components.find(c => c.name === 'comp1');
        expect(comp).toBeDefined();
        // The label should accumulate the lines
        // Note: Formatting might include newlines or be joined. PlantUML usually keeps newlines.
        expect(comp?.label).toContain('This component');
        expect(comp?.label).toContain('has a long comment');
        expect(comp?.label).toContain('on several lines');
    });

    it('should parse bracket component with multi-line', () => {
        const input = `
[comp2] as c2 [
  Line 1
  Line 2
]
`;
        const parser = new ComponentParser();
        const diagram = parser.parse(input);

        const comp = diagram.components.find(c => c.name === 'c2');
        expect(comp).toBeDefined();
        expect(comp?.label).toContain('Line 1');
        expect(comp?.label).toContain('Line 2');
    });
});
