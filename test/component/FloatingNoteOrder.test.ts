
import { describe, it, expect } from 'vitest';
import { ComponentParser } from '../../src/diagrams/component/ComponentParser';

describe('Floating Note - Relationship Order', () => {
    it('should handle relationship before note definition', () => {
        // This tests the case where relationship appears before note definition
        const input = `
[Component] as C

C .. N

note as N
  A floating note
end note
`;
        const parser = new ComponentParser();
        const diagram = parser.parse(input);

        // Should have 1 component (C)
        expect(diagram.components.length).toBe(1);
        expect(diagram.findComponent('C')).toBeDefined();

        // Should NOT have N as a component
        expect(diagram.findComponent('N')).toBeUndefined();

        // Should have 1 note (N)
        expect(diagram.notes.length).toBe(1);
        expect(diagram.notes[0].alias).toBe('N');

        // Should have 1 relationship
        expect(diagram.relationships.length).toBe(1);
        expect(diagram.relationships[0].from).toBe('C');
        expect(diagram.relationships[0].to).toBe('N');
    });
});
