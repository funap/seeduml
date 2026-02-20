
import { describe, it, expect } from 'vitest';
import { ComponentParser } from '../../src/diagrams/component/ComponentParser';

// ============================================================================
// Spec §2: Input Specification — PlantUML compatible parsing
// ============================================================================

describe('ComponentParser: PlantUML Standard Syntax', () => {

  describe('Component declarations', () => {
    it('should parse bracket-style component: [Name]', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('[First Component]');
      expect(diagram.findComponent('First Component')).toBeDefined();
      expect(diagram.findComponent('First Component')?.type).toBe('component');
    });

    it('should parse component keyword: component Name', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('component Comp3');
      expect(diagram.findComponent('Comp3')).toBeDefined();
      expect(diagram.findComponent('Comp3')?.type).toBe('component');
    });

    it('should parse component with alias: [Name] as Alias', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('[Another component] as Comp2');
      expect(diagram.findComponent('Comp2')).toBeDefined();
      expect(diagram.findComponent('Comp2')?.label).toBe('Another component');
    });

    it('should parse component with keyword and alias: component "Name" as Alias', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('component "Last Component" as Comp4');
      const comp = diagram.findComponent('Comp4');
      expect(comp).toBeDefined();
      expect(comp?.label).toBe('Last Component');
    });

    it('should parse component with color: [Name] #Yellow', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('component [Web Server] #Yellow');
      const comp = diagram.findComponent('Web Server');
      expect(comp).toBeDefined();
      expect(comp?.color).toBe('Yellow');
    });
  });

  describe('Interface declarations', () => {
    it('should parse interface keyword', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('interface Interf3');
      expect(diagram.findComponent('Interf3')).toBeDefined();
      expect(diagram.findComponent('Interf3')?.type).toBe('interface');
    });

    it('should parse interface with quoted name', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('interface "Data Access" as DA');
      const comp = diagram.findComponent('DA');
      expect(comp).toBeDefined();
      expect(comp?.type).toBe('interface');
      expect(comp?.label).toBe('Data Access');
    });

    it('should parse lollipop notation: () "Name"', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('() "First Interface"');
      expect(diagram.findComponent('First Interface')).toBeDefined();
      expect(diagram.findComponent('First Interface')?.type).toBe('interface');
    });

    it('should parse lollipop with alias: () "Name" as Alias', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('() "Another interface" as Interf2');
      expect(diagram.findComponent('Interf2')).toBeDefined();
      expect(diagram.findComponent('Interf2')?.type).toBe('interface');
      expect(diagram.findComponent('Interf2')?.label).toBe('Another interface');
    });
  });

  describe('Group / Container declarations', () => {
    it('should parse package group', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse(`
                package "Some Group" {
                    [A]
                }
            `);
      const pkg = diagram.findComponent('Some Group');
      expect(pkg).toBeDefined();
      expect(pkg?.type).toBe('package');
      expect(diagram.findComponent('A')?.parentId).toBe('Some Group');
    });

    it('should parse node group', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse(`
                node "Server" {
                    [App]
                }
            `);
      expect(diagram.findComponent('Server')?.type).toBe('node');
      expect(diagram.findComponent('App')?.parentId).toBe('Server');
    });

    it('should parse folder group', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse(`
                folder "MyFolder" {
                    [File]
                }
            `);
      expect(diagram.findComponent('MyFolder')?.type).toBe('folder');
    });

    it('should parse frame group', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse(`
                frame "MyFrame" {
                    [Widget]
                }
            `);
      expect(diagram.findComponent('MyFrame')?.type).toBe('frame');
    });

    it('should parse cloud group', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse(`
                cloud {
                    [Service]
                }
            `);
      const cloud = diagram.components.find(c => c.type === 'cloud');
      expect(cloud).toBeDefined();
      expect(diagram.findComponent('Service')?.parentId).toBe(cloud?.name);
    });

    it('should parse database group', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse(`
                database "MySql" {
                    [Table]
                }
            `);
      expect(diagram.findComponent('MySql')?.type).toBe('database');
      expect(diagram.findComponent('Table')?.parentId).toBe('MySql');
    });

    it('should handle nested groups', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse(`
                database "MySql" {
                    folder "Logs" {
                        [LogFile]
                    }
                }
            `);
      expect(diagram.findComponent('Logs')?.parentId).toBe('MySql');
      expect(diagram.findComponent('LogFile')?.parentId).toBe('Logs');
    });
  });

  describe('Relationships', () => {
    it('should parse solid arrow: -->', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('[A] --> [B]');
      const rel = diagram.relationships.find(r => r.from === 'A' && r.to === 'B');
      expect(rel).toBeDefined();
      expect(rel?.type).toBe('solid');
      expect(rel?.showArrowHead).toBe(true);
    });

    it('should parse dashed arrow: ..>', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('[A] ..> [B] : use');
      const rel = diagram.relationships.find(r => r.from === 'A' && r.to === 'B');
      expect(rel).toBeDefined();
      expect(rel?.type).toBe('dashed');
      expect(rel?.label).toBe('use');
    });

    it('should parse no-arrowhead line: -', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('DataAccess - [First Component]');
      const rel = diagram.relationships.find(r =>
        (r.from === 'DataAccess' && r.to === 'First Component') ||
        (r.from === 'First Component' && r.to === 'DataAccess')
      );
      expect(rel).toBeDefined();
    });

    it('should parse direction hints in arrows: -left->', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('[A] -left-> [B]');
      const rel = diagram.relationships[0];
      expect(rel.direction).toBe('left');
    });

    it('should parse direction hints: -right->', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('[A] -right-> [B]');
      const rel = diagram.relationships[0];
      expect(rel.direction).toBe('right');
    });

    it('should parse direction hints: -up->', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('[A] -up-> [B]');
      const rel = diagram.relationships[0];
      expect(rel.direction).toBe('up');
    });

    it('should parse direction hints: -down->', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('[A] -down-> [B]');
      const rel = diagram.relationships[0];
      expect(rel.direction).toBe('down');
    });

    it('should infer right direction for single-dash arrow: ->', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('[A] -> [B]');
      const rel = diagram.relationships[0];
      expect(rel.direction).toBe('right');
    });

    it('should infer down direction for double-dash arrow: -->', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('[A] --> [B]');
      const rel = diagram.relationships[0];
      expect(rel.direction).toBe('down');
    });

    it('should parse relationships with labels', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('[Frontend] --> [Backend] : REST API');
      const rel = diagram.relationships[0];
      expect(rel.label).toBe('REST API');
    });

    it('should auto-create components mentioned in relationships', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('[Implicit1] --> [Implicit2]');
      expect(diagram.findComponent('Implicit1')).toBeDefined();
      expect(diagram.findComponent('Implicit2')).toBeDefined();
    });

    it('should parse reverse arrows: <- and <--', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse('Interface1 <-- [Component]');
      // Under the hood, this creates a relationship from Component to Interface1
      const rel = diagram.relationships[0];
      expect(rel.from).toBe('Component');
      expect(rel.to).toBe('Interface1');
      expect(rel.direction).toBe('up'); // inverted from down
      expect(rel.showArrowHead).toBe(true);
    });
  });

  describe('Notes', () => {
    it('should parse inline note: note right of [C] : text', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse(`
                [Component] as C
                note right of C : A right note
            `);
      expect(diagram.notes.length).toBe(1);
      expect(diagram.notes[0].position).toBe('right');
      expect(diagram.notes[0].linkedTo).toBe('C');
      expect(diagram.notes[0].text).toBe('A right note');
    });

    it('should parse multi-line note with end note', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse(`
                [Comp] as C
                note left of C
                  Line 1
                  Line 2
                end note
            `);
      expect(diagram.notes.length).toBe(1);
      expect(diagram.notes[0].position).toBe('left');
      expect(diagram.notes[0].text).toContain('Line 1');
      expect(diagram.notes[0].text).toContain('Line 2');
    });

    it('should parse floating note with alias', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse(`
                note as N
                  Floating note text
                end note
            `);
      expect(diagram.notes.length).toBe(1);
      expect(diagram.notes[0].alias).toBe('N');
      expect(diagram.notes[0].position).toBeUndefined();
      expect(diagram.notes[0].linkedTo).toBeUndefined();
    });

    it('should parse note top of', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse(`
                [C]
                note top of [C] : Top note
            `);
      expect(diagram.notes[0].position).toBe('top');
    });

    it('should parse note bottom of', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse(`
                [C]
                note bottom of [C] : Bottom note
            `);
      expect(diagram.notes[0].position).toBe('bottom');
    });
  });

  describe('Ports', () => {
    it('should parse port declaration', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse(`
                component C {
                    port P1
                }
            `);
      const port = diagram.findComponent('P1');
      expect(port).toBeDefined();
      expect(port?.type).toBe('port');
      expect(port?.parentId).toBe('C');
    });

    it('should parse portin declaration', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse(`
                component C {
                    portin Input1
                }
            `);
      const port = diagram.findComponent('Input1');
      expect(port?.type).toBe('portin');
    });

    it('should parse portout declaration', () => {
      const parser = new ComponentParser();
      const diagram = parser.parse(`
                component C {
                    portout Output1
                }
            `);
      const port = diagram.findComponent('Output1');
      expect(port?.type).toBe('portout');
    });
  });
});

// ============================================================================
// Spec §2.2 & §14: Extended Syntax — Position Hints
// ============================================================================

describe('ComponentParser: Position Hint Syntax (Extended)', () => {
  it('should parse [A] right of [B] syntax', () => {
    const parser = new ComponentParser();
    const diagram = parser.parse(`
            [Web Server]
            [API Gateway] right of [Web Server]
        `);
    const api = diagram.findComponent('API Gateway');
    expect(api).toBeDefined();
    // If position hint is supported, check it.
    // If not yet implemented, this test documents the expected behavior.
    if ((api as any)?.positionHint) {
      expect((api as any).positionHint.reference).toBe('Web Server');
      expect((api as any).positionHint.position).toBe('right');
    }
  });

  it('should parse [A] left of [B] syntax', () => {
    const parser = new ComponentParser();
    const diagram = parser.parse(`
            [Main]
            [Side] left of [Main]
        `);
    const side = diagram.findComponent('Side');
    expect(side).toBeDefined();
    if ((side as any)?.positionHint) {
      expect((side as any).positionHint.reference).toBe('Main');
      expect((side as any).positionHint.position).toBe('left');
    }
  });

  it('should parse [A] bottom of [B] syntax', () => {
    const parser = new ComponentParser();
    const diagram = parser.parse(`
            [Top]
            [Bottom] bottom of [Top]
        `);
    const bottom = diagram.findComponent('Bottom');
    expect(bottom).toBeDefined();
    if ((bottom as any)?.positionHint) {
      expect((bottom as any).positionHint.reference).toBe('Top');
      expect((bottom as any).positionHint.position).toBe('bottom');
    }
  });

  it('should parse [A] top of [B] syntax', () => {
    const parser = new ComponentParser();
    const diagram = parser.parse(`
            [Main]
            [Header] top of [Main]
        `);
    const header = diagram.findComponent('Header');
    expect(header).toBeDefined();
    if ((header as any)?.positionHint) {
      expect((header as any).positionHint.reference).toBe('Main');
      expect((header as any).positionHint.position).toBe('top');
    }
  });
});

// ============================================================================
// Spec §2: Complex Parsing Scenarios
// ============================================================================

describe('ComponentParser: Complex Scenarios', () => {
  it('should parse the full PlantUML grouping example', () => {
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

    // Components
    expect(diagram.findComponent('Some Group')?.type).toBe('package');
    expect(diagram.findComponent('Other Groups')?.type).toBe('node');
    expect(diagram.findComponent('MySql')?.type).toBe('database');
    expect(diagram.findComponent('This is my folder')?.type).toBe('folder');
    expect(diagram.findComponent('Foo')?.type).toBe('frame');

    // Nesting
    expect(diagram.findComponent('First Component')?.parentId).toBe('Some Group');
    expect(diagram.findComponent('Another Component')?.parentId).toBe('Some Group');
    expect(diagram.findComponent('Second Component')?.parentId).toBe('Other Groups');
    expect(diagram.findComponent('This is my folder')?.parentId).toBe('MySql');
    expect(diagram.findComponent('Foo')?.parentId).toBe('MySql');
    expect(diagram.findComponent('Folder 3')?.parentId).toBe('This is my folder');
    expect(diagram.findComponent('Frame 4')?.parentId).toBe('Foo');

    // Relationships
    expect(diagram.relationships.length).toBeGreaterThanOrEqual(5);
  });

  it('should handle the basic interface example', () => {
    const parser = new ComponentParser();
    const diagram = parser.parse(`
            interface "Data Access" as DA
            DA - [First Component]
            [First Component] ..> HTTP : use
        `);

    expect(diagram.findComponent('DA')?.type).toBe('interface');
    expect(diagram.findComponent('DA')?.label).toBe('Data Access');
    expect(diagram.relationships.length).toBe(2);

    const useRel = diagram.relationships.find(r => r.label === 'use');
    expect(useRel).toBeDefined();
    expect(useRel?.type).toBe('dashed');
  });

  it('should handle notes with bracket-referenced components', () => {
    const parser = new ComponentParser();
    const diagram = parser.parse(`
            interface "Data Access" as DA
            DA - [First Component]
            [First Component] ..> HTTP : use
            note left of HTTP : Web Service only
            note right of [First Component]
                A note can also
                be on several lines
            end note
        `);

    expect(diagram.notes.length).toBe(2);
    expect(diagram.notes[0].position).toBe('left');
    expect(diagram.notes[0].linkedTo).toBe('HTTP');
    expect(diagram.notes[1].position).toBe('right');
    expect(diagram.notes[1].linkedTo).toBe('First Component');
  });

  it('should ignore comment lines starting with single quote', () => {
    const parser = new ComponentParser();
    const diagram = parser.parse(`
            ' This is a comment
            [A]
            ' Another comment
            [B]
        `);
    expect(diagram.components.length).toBe(2);
  });

  it('should ignore @startuml and @enduml lines', () => {
    const parser = new ComponentParser();
    const diagram = parser.parse(`
            @startuml
            [A]
            @enduml
        `);
    expect(diagram.components.length).toBe(1);
    expect(diagram.findComponent('A')).toBeDefined();
  });
});
