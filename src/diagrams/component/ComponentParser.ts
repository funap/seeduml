
import { Parser } from '../../core/Parser';
import { ComponentDiagram, ComponentType, RelationshipType, Direction } from './ComponentDiagram';

export class ComponentParser implements Parser {
    parse(content: string): ComponentDiagram {
        const diagram = new ComponentDiagram();
        const lines = content.split('\n');

        let pendingNote: { text: string[], position?: any, linkedTo?: string, alias?: string, isDescription?: boolean } | null = null;
        let parentStack: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line || line.startsWith("'") || line.startsWith('@')) continue;

            // Handle multi-line notes or descriptions end
            if (pendingNote) {
                if (line.endsWith(']')) {
                    if (pendingNote.isDescription && pendingNote.linkedTo) {
                        const description = pendingNote.text.join('\n');
                        const comp = diagram.findComponent(pendingNote.linkedTo);
                        if (comp) {
                            // Append or replace label? PlantUML usually appends or uses as description.
                            // The user request shows it as "label" effectively.
                            // If user already had a label in [], we probably append to it or new line?
                            // Let's assume we append to existing label with newline.
                            comp.label = comp.label ? `${comp.label}\n${description}` : description;
                        }
                        pendingNote = null;
                    } else if (line.toLowerCase() === 'end note') {
                        diagram.addNote(pendingNote.text.join('\n'), pendingNote.position, pendingNote.linkedTo, pendingNote.alias);
                        pendingNote = null;
                    } else {
                        pendingNote.text.push(line);
                    }
                } else if (line.toLowerCase() === 'end note' && !pendingNote.isDescription) {
                    diagram.addNote(pendingNote.text.join('\n'), pendingNote.position, pendingNote.linkedTo, pendingNote.alias);
                    pendingNote = null;
                } else {
                    // Check if line contains ']' for description end not on its own line?
                    // But PlantUML usually expects ] on its own line or at end of line.
                    // If line is just "]", it ends.
                    // If line is "some text ]", it ends.
                    if (pendingNote.isDescription && line.endsWith(']')) {
                        const content = line.substring(0, line.length - 1).trim();
                        if (content) pendingNote.text.push(content);

                        const description = pendingNote.text.join('\n');
                        const comp = diagram.findComponent(pendingNote.linkedTo!);
                        if (comp) {
                            comp.label = comp.label ? `${comp.label}\n${description}` : description;
                        }
                        pendingNote = null;
                    } else {
                        pendingNote.text.push(line);
                    }
                }
                continue;
            }

            const currentParentId = parentStack.length > 0 ? parentStack[parentStack.length - 1] : undefined;

            // 1. Components and Interfaces definitions
            // component Name [as Alias] [#Color]
            const componentMatch = line.match(/^component\s+(?:\[(.*?)\]|(".*?"|\S+))(?:\s+as\s+(\S+))?(?:\s+(#\w+))?(?:\s*\[)?$/i);
            if (componentMatch) {
                const bracketName = componentMatch[1];
                const simpleName = componentMatch[2];
                const alias = componentMatch[3];
                const color = componentMatch[4];

                const label = bracketName || (simpleName ? simpleName.replace(/^"(.*)"$/, '$1') : '');
                const id = alias || label;

                // Check if color property is present
                diagram.addComponent(id, 'component', label, currentParentId, this.parseColor(color));

                // Check for multi-line description start
                if (line.trim().endsWith('[')) {
                    pendingNote = { text: [], linkedTo: id, alias: undefined, isDescription: true };
                }
                continue;
            }

            // interface "Name" [as Alias] [#Color]
            const interfaceMatch = line.match(/^interface\s+(".*?"|\S+)(?:\s+as\s+(\S+))?(?:\s+(#\w+))?(?:\s*\[)?$/i);
            if (interfaceMatch) {
                const name = interfaceMatch[1].replace(/^"(.*)"$/, '$1');
                const alias = interfaceMatch[2];
                const color = interfaceMatch[3];
                diagram.addComponent(alias || name, 'interface', name, currentParentId, this.parseColor(color));

                // Check for multi-line description start (though less common for interface)
                if (line.trim().endsWith('[')) {
                    pendingNote = { text: [], linkedTo: alias || name, alias: undefined, isDescription: true };
                }
                continue;
            }

            // () "Name" [as Alias] [#Color]
            const circleMatch = line.match(/^\(\)\s+(".*?"|\S+)(?:\s+as\s+(\S+))?(?:\s+(#\w+))?(?:\s*\[)?$/);
            if (circleMatch) {
                const name = circleMatch[1].replace(/^"(.*)"$/, '$1');
                const alias = circleMatch[2];
                const color = circleMatch[3];
                diagram.addComponent(alias || name, 'interface', name, currentParentId, this.parseColor(color));
                continue;
            }

            // [Name] [as Alias] [#Color]
            // Note: This must be checked before relationships because [A] is valid component but also part of [A] --> [B]
            // But usually [A] as B is on its own line.
            // CAUTION: rel lines also start with [. We must ensure this regex doesn't match relationships.
            // Using [^\]]+ ensures we stop at first bracket.
            const bracketMatch = line.match(/^\[([^\]]+)\](?:\s+as\s+(\S+))?(?:\s+(#\w+))?(?:\s*\[)?$/);
            if (bracketMatch) {
                const label = bracketMatch[1];
                const alias = bracketMatch[2];
                const color = bracketMatch[3];
                const id = alias || label;
                diagram.addComponent(id, 'component', label, currentParentId, this.parseColor(color));

                if (line.trim().endsWith('[')) {
                    pendingNote = { text: [], linkedTo: id, alias: undefined, isDescription: true };
                }
                continue;
            }

            // 2. Groups (Package, Node, etc)
            // package "Name" {
            // box "Name" { (not supported in component but similar syntax)

            // Allow name to be optional for anonymous groups, e.g. "cloud {"
            const groupStartMatch = line.match(/^(package|node|folder|frame|cloud|database|component|interface)(?:\s+(".*?"|\S+))?\s*\{$/i);

            if (groupStartMatch) {
                const type = groupStartMatch[1].toLowerCase() as ComponentType;
                const nameRaw = groupStartMatch[2];
                let groupId = nameRaw ? nameRaw.replace(/^"(.*)"$/, '$1') : type;

                if (!nameRaw) {
                    const count = diagram.components.filter(c => c.type === type).length;
                    groupId = `${type}_${count}_${i}`; // Add line index for stability
                    diagram.addComponent(groupId, type, '', currentParentId);
                } else {
                    diagram.addComponent(groupId, type, groupId, currentParentId);
                }

                parentStack.push(groupId);
                continue;
            }

            // } to close group
            if (line === '}') {
                parentStack.pop();
                continue;
            }

            // 2b. Ports inside components
            // port "Name" [as Alias]
            // portin "Name" [as Alias]
            // portout "Name" [as Alias]
            const portMatch = line.match(/^(port|portin|portout)\s+(".*?"|\S+)(?:\s+as\s+(\S+))?$/i);
            if (portMatch) {
                const type = portMatch[1].toLowerCase();
                const name = portMatch[2].replace(/^"(.*)"$/, '$1');
                const alias = portMatch[3];
                // Map to specific port types
                let componentType: ComponentType = 'port';
                if (type === 'portin') componentType = 'portin';
                if (type === 'portout') componentType = 'portout';

                diagram.addComponent(alias || name, componentType, name, currentParentId);
                continue;
            }

            // 3. Relationships
            // [C1] --> [C2] : Label
            // Use precise regex to capture [.*] or ".*" or \w+
            // Group 1: ID1 (bracket)
            // Group 2: ID1 (quote/word)
            // Group 3: Arrow
            // Group 4: ID2 (bracket)
            // Group 5: ID2 (quote/word)
            // Group 6: Label

            const componentRef = `(?:\\[([^\\]]+)\\]|(".*?"|[^\\s-]+))`;
            const arrowRef = `([-.]+[^[\\]\\s]*)`;
            const separator = `(?:\\s+|(?<=[^\\s])(?=[-.])|(?<=[-.])(?=[^\\s]))`;

            const relRegex = new RegExp(`^${componentRef}${separator}${arrowRef}${separator}${componentRef}(?:\\s*:\\s*(.*))?$`);
            const relMatch = line.match(relRegex);

            if (relMatch) {
                const id1Raw = relMatch[1] || relMatch[2];
                const isId1Bracketed = !!relMatch[1];
                const arrow = relMatch[3];
                const id2Raw = relMatch[4] || relMatch[5];
                const isId2Bracketed = !!relMatch[4];
                const label = relMatch[6];

                const id1 = id1Raw.replace(/^"(.*)"$/, '$1');
                const id2 = id2Raw.replace(/^"(.*)"$/, '$1');

                // Ensure components exist (but don't create if it's a note alias)
                const isId1NoteAlias = diagram.notes.some(n => n.alias === id1);
                const isId2NoteAlias = diagram.notes.some(n => n.alias === id2);

                if (!diagram.components.some(c => c.name === id1) && !isId1NoteAlias) {
                    const type = isId1Bracketed ? 'component' : 'interface';
                    diagram.addComponent(id1, type, id1, currentParentId);
                }
                if (!diagram.components.some(c => c.name === id2) && !isId2NoteAlias) {
                    const type = isId2Bracketed ? 'component' : 'interface';
                    diagram.addComponent(id2, type, id2, currentParentId);
                }

                let type: RelationshipType = 'solid';
                if (arrow.includes('..')) type = 'dashed';
                else if (arrow.includes('--')) type = 'solid';

                // 1. Check for explicit direction keywords
                let direction: Direction | undefined = undefined;
                if (arrow.includes('left') || arrow.includes('le')) direction = 'left';
                else if (arrow.includes('right') || arrow.includes('ri')) direction = 'right';
                else if (arrow.includes('up')) direction = 'up';
                else if (arrow.includes('down') || arrow.includes('do')) direction = 'down';

                // 2. Infer default direction from dash/dot count
                // In PlantUML: single dash/dot = horizontal, double = vertical
                if (!direction) {
                    // Count consecutive dashes or dots (ignoring arrow heads like > <)
                    const stripped = arrow.replace(/[<>]/g, '');
                    const dashMatch = stripped.match(/(-+|\.+)/);
                    if (dashMatch) {
                        const len = dashMatch[1].length;
                        direction = len >= 2 ? 'down' : 'right';
                    }
                }

                const hasArrowHead = arrow.includes('>');

                diagram.addRelationship(id1, id2, type, label, direction, hasArrowHead, currentParentId);
                continue;
            }

            // 4. Notes
            // 4a. Floating note: note as <alias>
            const floatingNoteMatch = line.match(/^note\s+as\s+(\S+)$/i);
            if (floatingNoteMatch) {
                const alias = floatingNoteMatch[1];
                pendingNote = { text: [], alias };
                continue;
            }

            // 4b. note (left|right|top|bottom) of [Component] : TEXT
            const noteMatch = line.match(/^note\s+(left|right|top|bottom)\s+of\s+(?:\[(.*?)\]|(".*?"|\S+))(?:\s*:\s*(.*))?$/i);
            if (noteMatch) {
                const pos = noteMatch[1].toLowerCase();
                const targetDisplay = noteMatch[2] || noteMatch[3];
                const targetId = targetDisplay.replace(/^"(.*)"$/, '$1');

                const text = noteMatch[4];
                if (text) {
                    diagram.addNote(text, pos as any, targetId);
                } else {
                    pendingNote = { text: [], position: pos, linkedTo: targetId };
                }
                continue;
            }

            // Unhandled
            // console.log(`Unhandled line: ${line}`);
        }

        return diagram;
    }

    private parseColor(color: string | undefined): string | undefined {
        if (!color) return undefined;
        // If color starts with #, check if it's followed by a valid hex code
        if (color.startsWith('#')) {
            const hexContent = color.substring(1);
            // Hex codes are 3, 4, 6, or 8 chars.
            const isHex = /^([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hexContent);
            if (isHex) {
                return color; // Keep # for hex
            } else {
                return hexContent; // Return as named color (stripped #)
            }
        }
        return color;
    }
}
