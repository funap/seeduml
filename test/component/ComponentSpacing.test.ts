
import { describe, it, expect } from 'vitest';
import { ComponentParser } from '../../src/diagrams/component/ComponentParser';
import { ComponentLayout } from '../../src/diagrams/component/ComponentLayout';
import { defaultTheme } from '../../src/diagrams/component/ComponentTheme';

describe('Component Spacing and Container Layout', () => {
    it('should layout components with sufficient spacing inside containers', () => {
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
        const layout = new ComponentLayout(diagram, defaultTheme);
        const result = layout.calculateLayout();

        // Helper to get component bounds
        const getComp = (name: string) => result.components.find(c => c.component.name === name)!;

        const someGroup = getComp('Some Group');
        const firstComp = getComp('First Component');
        const anotherComp = getComp('Another Component');
        const http = getComp('HTTP');

        // Check if children are inside parent "Some Group" with padding
        expect(firstComp.x).toBeGreaterThanOrEqual(someGroup.x + defaultTheme.packagePadding);
        expect(firstComp.y).toBeGreaterThanOrEqual(someGroup.y + defaultTheme.packagePadding);

        // Check distance between siblings in "Some Group"
        // HTTP - [First Component] (Horizontal)
        // [Another Component] (No relation to above in group, so likely below or same row depending on global layout)

        // The user wants "not too close".
        // Let's assert minimum distance between HTTP and First Component
        const distHttpFirst = Math.abs(firstComp.x - (http.x + http.width));
        if (firstComp.x > http.x) {
            expect(distHttpFirst).toBeGreaterThanOrEqual(defaultTheme.componentGapX);
        }

        // Check vertical spacing in "MySql"
        const mysql = getComp('MySql');
        const folder3 = getComp('This is my folder'); // Folder inside MySql
        const frame4 = getComp('Foo'); // Frame inside MySql

        // Verify containment
        expect(folder3.x).toBeGreaterThanOrEqual(mysql.x + defaultTheme.packagePadding);
        expect(frame4.x).toBeGreaterThanOrEqual(mysql.x + defaultTheme.packagePadding);
    });
});
