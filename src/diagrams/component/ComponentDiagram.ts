
import { Diagram } from '../../core/Diagram';

export type ComponentType = 'component' | 'interface' | 'package' | 'node' | 'folder' | 'frame' | 'cloud' | 'database' | 'port' | 'portin' | 'portout';
export type RelationshipType = 'solid' | 'dashed' | 'dotted';
export type Direction = 'left' | 'right' | 'up' | 'down';

export interface Component {
    name: string; // Unique ID
    label?: string; // Display name
    type: ComponentType;
    alias?: string;
    stereotype?: string;
    color?: string;
    isVisible: boolean;
    parentId?: string; // ID of the parent container
    longDescription?: string;
}

export interface Relationship {
    from: string; // Component ID
    to: string; // Component ID
    label?: string;
    type: RelationshipType;
    direction?: Direction;
    color?: string;
    showArrowHead?: boolean;
}

export interface Note {
    text: string;
    position?: 'left' | 'right' | 'top' | 'bottom';
    linkedTo?: string; // Component ID
    id: string;
    alias?: string; // Alias for floating notes (e.g., "note as N")
}

export class ComponentDiagram implements Diagram {
    type = 'component';
    components: Component[] = [];
    relationships: Relationship[] = [];
    notes: Note[] = [];
    title?: string;

    addComponent(name: string, type: ComponentType, label?: string, parentId?: string, color?: string): Component {
        let component = this.components.find(c => c.name === name);
        if (!component) {
            component = { name, type, label: label || name, isVisible: true, parentId, color };
            this.components.push(component);
        } else {
            // Update existing component if needed (e.g. adding properties later)
            if (label) component.label = label;
            if (parentId) component.parentId = parentId;
            if (color) component.color = color;
            if (type !== 'component' && component.type === 'component') component.type = type; // Upgrade type
        }
        return component;
    }

    addRelationship(from: string, to: string, type: RelationshipType = 'solid', label?: string, direction?: Direction, showArrowHead: boolean = true, _parentId?: string) {
        this.relationships.push({ from, to, type, label, direction, showArrowHead });
    }

    addNote(text: string, position?: 'left' | 'right' | 'top' | 'bottom', linkedTo?: string, alias?: string) {
        const id = `note_${this.notes.length}`;
        this.notes.push({ text, position, linkedTo, id, alias });
    }

    findComponent(name: string): Component | undefined {
        return this.components.find(c => c.name === name || c.alias === name);
    }
}
