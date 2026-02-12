
import { describe, it, expect } from 'vitest';
import { ComponentParser } from '../../src/diagrams/component/ComponentParser';

describe('Component Color Parsing', () => {
    it('should parse component with color', () => {
        const input = `
component [Web Server] #Yellow
`;
        const parser = new ComponentParser();
        const diagram = parser.parse(input);

        const comp = diagram.components.find(c => c.label === 'Web Server');
        expect(comp).toBeDefined();
        // Check if color property is set (assuming Component interface has color)
        // If not, we might need to add it to Component interface too.
        expect((comp as any).color).toBe('Yellow');
    });

    it('should parse component with alias and color', () => {
        const input = `
component [Database] as DB #Red
`;
        const parser = new ComponentParser();
        const diagram = parser.parse(input);

        const comp = diagram.components.find(c => c.name === 'DB');
        expect(comp).toBeDefined();
        expect(comp?.label).toBe('Database');
        expect((comp as any).color).toBe('Red');
    });
});
