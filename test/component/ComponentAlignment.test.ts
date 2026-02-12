
import { describe, it, expect } from 'vitest';
import { ComponentParser } from '../../src/diagrams/component/ComponentParser';
import { ComponentLayout } from '../../src/diagrams/component/ComponentLayout';
import { defaultTheme } from '../../src/diagrams/component/ComponentTheme';

describe('Component Vertical Alignment', () => {
    it('should align vertical relationships strictly on the X axis', () => {
        const parser = new ComponentParser();
        const diagram = parser.parse(`
@startuml

package "Some Group" {
  HTTP - [First Component]
  [Another Component]
}

node "Other Groups" {
  FTP - [Second Component]
  [First Component] --> FTP
}

cloud {
  [Example 1]
}

database "MySql" {
  folder "This is my folder" {
    [Folder 3]
  }
  frame "Foo" {
    [Frame 4]
  }
}

[Another Component] --> [Example 1]
[Example 1] --> [Folder 3]
[Folder 3] --> [Frame 4]

@enduml
        `);

        const layout = new ComponentLayout(diagram, defaultTheme);
        const result = layout.calculateLayout();

        const findRel = (from: string, to: string) => {
            return result.relationships.find(r => r.relationship.from === from && r.relationship.to === to);
        };

        // 1. [First Component] --> FTP
        const rel1 = findRel('First Component', 'FTP');
        expect(rel1).toBeDefined();
        const start1 = rel1!.path[0];
        const end1 = rel1!.path[rel1!.path.length - 1];
        expect(Math.abs(start1.x - end1.x)).toBeLessThanOrEqual(1.5);

        // 2. [Another Component] --> [Example 1]
        const rel2 = findRel('Another Component', 'Example 1');
        expect(rel2).toBeDefined();
        const start2 = rel2!.path[0];
        const end2 = rel2!.path[rel2!.path.length - 1];
        expect(Math.abs(start2.x - end2.x)).toBeLessThanOrEqual(1.5);

        // 3. [Example 1] --> [Folder 3]
        const rel3 = findRel('Example 1', 'Folder 3');
        expect(rel3).toBeDefined();
        expect(Math.abs(rel3!.path[0].x - rel3!.path[rel3!.path.length - 1].x)).toBeLessThanOrEqual(1.5);

        // 4. [Folder 3] --> [Frame 4]
        const rel4 = findRel('Folder 3', 'Frame 4');
        expect(rel4).toBeDefined();
        expect(Math.abs(rel4!.path[0].x - rel4!.path[rel4!.path.length - 1].x)).toBeLessThanOrEqual(1.5);
    });
});
