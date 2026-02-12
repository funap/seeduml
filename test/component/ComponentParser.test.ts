
import { describe, it, expect } from 'vitest';
import { ComponentParser } from '../../src/diagrams/component/ComponentParser';

// Helper to remove whitespace for easier SVG comparison (if we were comparing SVG, but here we compare model)
// For parser testing, we check the model structure.

describe('ComponentParser', () => {
  it('should parse complex grouping example', () => {
    const input = `
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
`;
    const parser = new ComponentParser();
    const diagram = parser.parse(input);

    // Check components exist
    expect(diagram.findComponent('Some Group')).toBeDefined();
    expect(diagram.findComponent('Some Group')?.type).toBe('package');

    expect(diagram.findComponent('Other Groups')).toBeDefined();
    expect(diagram.findComponent('Other Groups')?.type).toBe('node');

    // Check anonymous cloud
    // The parser generates IDs for anonymous groups as `${type}_${count}` (e.g. cloud_0)
    // Since it's the first cloud, it should be cloud_0
    const cloud = diagram.components.find(c => c.type === 'cloud');
    expect(cloud).toBeDefined();
    // ID should be auto-generated or handled.
    // In my implementation I made it `cloud_${count}`.
    expect(cloud?.name).toMatch(/^cloud_\d+_\d+$/);

    // Check "First Component"
    const c1 = diagram.findComponent('First Component');
    expect(c1).toBeDefined();
    // Check parent of "First Component"
    expect(c1?.parentId).toBe('Some Group');

    // Check "Another Component"
    const c2 = diagram.findComponent('Another Component');
    expect(c2).toBeDefined();
    expect(c2?.parentId).toBe('Some Group');

    // Check "Second Component"
    const c3 = diagram.findComponent('Second Component');
    expect(c3).toBeDefined();
    expect(c3?.parentId).toBe('Other Groups');

    // Check relationships
    // HTTP - [First Component]
    // This syntax "Name - [Bracket]" might strictly be parsed as relation if HTTP is treated as component ID.
    // ComponentParser logic for relations:
    // ^(?:\\[([^\\]]+)\\]|(".*?"|\\w+))\\s+(\\S*[-.]+\\S*)\\s+(?:\\[([^\\]]+)\\]|(".*?"|\\w+))(?:\\s*:\\s*(.*))?$
    // HTTP - [First Component]
    // ID1: HTTP (word)
    // Arrow: -
    // ID2: First Component (bracket)
    // Should match.

    const rel1 = diagram.relationships.find(r =>
      (r.from === 'HTTP' && r.to === 'First Component') ||
      (r.from === 'First Component' && r.to === 'HTTP')
    );
    expect(rel1).toBeDefined();

    // [First Component] --> FTP
    const rel2 = diagram.relationships.find(r => r.from === 'First Component' && r.to === 'FTP');
    expect(rel2).toBeDefined();
    expect(rel2?.type).toBe('solid'); // --> is solid

    // [Another Component] --> [Example 1]
    const rel3 = diagram.relationships.find(r => r.from === 'Another Component' && r.to === 'Example 1');
    expect(rel3).toBeDefined();

    // Check Nested groups
    // database "MySql" -> folder "This is my folder" -> [Folder 3]
    const mysql = diagram.findComponent('MySql');
    expect(mysql).toBeDefined();
    expect(mysql?.type).toBe('database');

    const myFolder = diagram.findComponent('This is my folder');
    expect(myFolder).toBeDefined();
    expect(myFolder?.type).toBe('folder');
    expect(myFolder?.parentId).toBe('MySql');

    const folder3 = diagram.findComponent('Folder 3');
    expect(folder3).toBeDefined();
    expect(folder3?.parentId).toBe('This is my folder');

  });
});
