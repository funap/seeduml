
import { describe, it, expect } from 'vitest';
import { ComponentParser } from '../../src/diagrams/component/ComponentParser';

describe('Cloud Parsing Debug', () => {
    it('should parse cloud as top-level, not nested inside node', () => {
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

        // Log all components for debugging
        diagram.components.forEach(c => {
            console.log(`${c.name} | type: ${c.type} | parent: ${c.parentId || '(none)'}`);
        });

        // Cloud should be top-level (no parent)
        const cloud = diagram.components.find(c => c.type === 'cloud');
        expect(cloud).toBeDefined();
        expect(cloud!.parentId).toBeUndefined();

        // Example 1 should be inside cloud, not inside "Other Groups"
        const ex1 = diagram.components.find(c => c.name === 'Example 1');
        expect(ex1).toBeDefined();
        expect(ex1!.parentId).toBe(cloud!.name);
    });
});
