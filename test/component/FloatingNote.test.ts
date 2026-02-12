
import { describe, it, expect } from 'vitest';
import { ComponentParser } from '../../src/diagrams/component/ComponentParser';

describe('Floating Note', () => {
    it('should parse floating note with alias', () => {
        const input = `
[Component] as C

note as N
  A floating note can also
  be on several lines
end note

C .. N
`;
        const parser = new ComponentParser();
        const diagram = parser.parse(input);

        // Check component exists
        expect(diagram.findComponent('C')).toBeDefined();
        expect(diagram.findComponent('C')?.label).toBe('Component');

        // Check note exists and has correct properties
        expect(diagram.notes.length).toBe(1);
        const note = diagram.notes[0];
        expect(note.alias).toBe('N');
        expect(note.text).toBe('A floating note can also\nbe on several lines');
        expect(note.linkedTo).toBeUndefined();
        expect(note.position).toBeUndefined();

        // Check relationship exists between component and note
        expect(diagram.relationships.length).toBe(1);
        const rel = diagram.relationships[0];
        expect(rel.from).toBe('C');
        expect(rel.to).toBe('N');
        expect(rel.type).toBe('dashed'); // .. is dashed
    });

    it('should parse multiple floating notes', () => {
        const input = `
note as N1
  First note
end note

note as N2
  Second note
end note
`;
        const parser = new ComponentParser();
        const diagram = parser.parse(input);

        expect(diagram.notes.length).toBe(2);
        expect(diagram.notes[0].alias).toBe('N1');
        expect(diagram.notes[0].text).toBe('First note');
        expect(diagram.notes[1].alias).toBe('N2');
        expect(diagram.notes[1].text).toBe('Second note');
    });

    it('should differentiate between floating notes and positioned notes', () => {
        const input = `
[Component] as C

note left of C
  Positioned note
end note

note as N
  Floating note
end note
`;
        const parser = new ComponentParser();
        const diagram = parser.parse(input);

        expect(diagram.notes.length).toBe(2);

        // First note is positioned
        expect(diagram.notes[0].position).toBe('left');
        expect(diagram.notes[0].linkedTo).toBe('C');
        expect(diagram.notes[0].alias).toBeUndefined();

        // Second note is floating
        expect(diagram.notes[1].alias).toBe('N');
        expect(diagram.notes[1].position).toBeUndefined();
        expect(diagram.notes[1].linkedTo).toBeUndefined();
    });
});
