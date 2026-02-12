
import { ComponentDiagram, Component, Relationship, Note } from './ComponentDiagram';
import { ComponentTheme } from './ComponentTheme';

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ComponentLayoutNode extends Rect {
    component: Component;
}

export interface RelationshipLayoutNode {
    relationship: Relationship;
    path: { x: number, y: number }[];
    labelPosition?: { x: number, y: number };
}

export interface NoteLayoutNode extends Rect {
    note: Note;
}

export interface ComponentLayoutResult {
    components: ComponentLayoutNode[];
    relationships: RelationshipLayoutNode[];
    notes: NoteLayoutNode[];
    width: number;
    height: number;
}

export class ComponentLayout {
    private layoutMap = new Map<string, Rect>();
    private gridCells = new Map<string, { x: number, w: number }>();
    private noteLayoutMap = new Map<string, Rect>(); // Map note alias/id to position

    constructor(private diagram: ComponentDiagram, private theme: ComponentTheme) { }

    calculateLayout(): ComponentLayoutResult {
        this.layoutMap.clear();

        // 1. Identify roots (components without parent)
        const roots = this.diagram.components.filter(c => !c.parentId);

        // 2. Perform initial layout of components
        this.layoutGroup(roots, 0, 0);

        const componentNodes: ComponentLayoutNode[] = [];
        this.layoutMap.forEach((rect, id) => {
            const comp = this.diagram.components.find(c => c.name === id);
            if (comp) {
                componentNodes.push({ ...rect, component: comp });
            }
        });

        // 3. Straighten vertical lines by shifting top-level containers
        this.straightenVerticalLines(componentNodes);

        // Re-sync positions from layoutMap after all alignment passes
        componentNodes.forEach(node => {
            const rect = this.layoutMap.get(node.component.name);
            if (rect) {
                node.x = rect.x;
                node.y = rect.y;
            }
        });

        // 4. Global bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        componentNodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + node.width);
            maxY = Math.max(maxY, node.y + node.height);
        });

        const notes = this.layoutNotes(componentNodes);
        notes.forEach(n => {
            minX = Math.min(minX, n.x);
            minY = Math.min(minY, n.y);
            maxX = Math.max(maxX, n.x + n.width);
            maxY = Math.max(maxY, n.y + n.height);
        });

        // 5. Shift everything if minX or minY is out of desired padding
        const offsetX = this.theme.padding - minX;
        const offsetY = this.theme.padding - minY;

        if (offsetX !== 0 || offsetY !== 0) {
            componentNodes.forEach(node => {
                node.x += offsetX;
                node.y += offsetY;
                const rect = this.layoutMap.get(node.component.name)!;
                rect.x = node.x;
                rect.y = node.y;
            });
            notes.forEach(note => {
                note.x += offsetX;
                note.y += offsetY;
            });
            maxX += offsetX;
            maxY += offsetY;
        }

        // 6. Layout Relationships based on final positions
        const relationships: RelationshipLayoutNode[] = this.diagram.relationships.map(r => this.routeRelationship(r));

        return {
            components: componentNodes,
            relationships,
            notes,
            width: maxX + this.theme.padding,
            height: maxY + this.theme.padding
        };
    }

    private straightenVerticalLines(nodes: ComponentLayoutNode[]) {
        const vRels = this.diagram.relationships.filter(r => !r.direction || r.direction === 'down' || r.direction === 'up');
        if (vRels.length === 0) return;

        for (let iter = 0; iter < 50; iter++) {
            const shifts = new Map<string, { totalShift: number, count: number }>();

            vRels.forEach(rel => {
                const fromRect = this.layoutMap.get(rel.from);
                const toRect = this.layoutMap.get(rel.to);
                if (!fromRect || !toRect) return;

                const fromX = fromRect.x + fromRect.width / 2;
                const toX = toRect.x + toRect.width / 2;
                const error = toX - fromX;
                if (Math.abs(error) < 0.1) return;

                // Fan-out check: Is this the only vertical relationship from 'from'?
                const outgoingVRels = vRels.filter(r => r.from === rel.from);
                if (outgoingVRels.length > 1) return;

                // Fan-in check: Is this the only vertical relationship to 'to'?
                const incomingVRels = vRels.filter(r => r.to === rel.to);
                if (incomingVRels.length > 1) return;

                const lcp = this.findLowestCommonParent(rel.from, rel.to);

                const nodeFrom = this.getAncestorUnder(rel.from, lcp);
                const nodeTo = this.getAncestorUnder(rel.to, lcp);

                if (nodeFrom && nodeTo && nodeFrom !== nodeTo) {
                    if (!shifts.has(nodeFrom)) shifts.set(nodeFrom, { totalShift: 0, count: 0 });
                    if (!shifts.has(nodeTo)) shifts.set(nodeTo, { totalShift: 0, count: 0 });

                    const sFrom = shifts.get(nodeFrom)!;
                    const sTo = shifts.get(nodeTo)!;

                    sFrom.totalShift += error / 2;
                    sFrom.count++;
                    sTo.totalShift -= error / 2;
                    sTo.count++;
                }
            });

            if (shifts.size === 0) break;

            let moved = false;
            shifts.forEach((val, name) => {
                const avgShift = val.totalShift / val.count;
                if (Math.abs(avgShift) < 0.1) return;

                const rect = this.layoutMap.get(name);
                if (rect) {
                    rect.x += avgShift;
                    moved = true;

                    const cell = this.gridCells.get(name);
                    if (cell) {
                        cell.x += avgShift;
                        this.gridCells.set(name, cell);
                    }

                    // Move descendants recursively
                    const children = this.diagram.components.filter(c => c.parentId === name);
                    if (children.length > 0) {
                        this.shiftChildren(children, avgShift, 0);
                    }
                }
            });

            if (!moved) break;
        }
    }

    private findLowestCommonParent(name1: string, name2: string): string | undefined {
        const path1 = this.getAncestorPath(name1);
        const path2 = this.getAncestorPath(name2);

        let lcp: string | undefined = undefined;
        for (let i = 0; i < Math.min(path1.length, path2.length); i++) {
            if (path1[i] === path2[i]) {
                lcp = path1[i];
            } else {
                break;
            }
        }
        return lcp;
    }

    private getAncestorPath(name: string): string[] {
        const comp = this.diagram.components.find(c => c.name === name);
        if (comp && comp.parentId) {
            return [...this.getAncestorPath(comp.parentId), comp.parentId];
        }
        return [];
    }

    private getAncestorUnder(name: string, parentName: string | undefined): string {
        const comp = this.diagram.components.find(c => c.name === name);
        if (comp && comp.parentId !== parentName) {
            return this.getAncestorUnder(comp.parentId!, parentName);
        }
        return name;
    }

    private getTopLevelAncestor(name: string): string {
        const comp = this.diagram.components.find(c => c.name === name);
        if (comp && comp.parentId) {
            return this.getTopLevelAncestor(comp.parentId);
        }
        return name;
    }

    private layoutGroup(components: Component[], startX: number, startY: number): Rect {
        if (components.length === 0) {
            return { x: startX, y: startY, width: 0, height: 0 };
        }

        // Phase 1: Measure all component sizes
        const sizeMap = new Map<string, { width: number, height: number }>();
        components.forEach(comp => {
            let width = this.theme.componentWidth;
            let height = this.theme.componentHeight;

            if (comp.type === 'interface') {
                width = this.theme.interfaceRadius * 2;
                height = this.theme.interfaceRadius * 2;
                // Interfaces usually have labels outside, but we still need to account for them in the layout cell
                const label = comp.label || comp.name;
                const textWidth = label.length * 8;
                width = Math.max(width, textWidth);
                height += 20; // Space for label below
            } else {
                const allChildren = this.diagram.components.filter(c => c.parentId === comp.name);
                const ports = allChildren.filter(c => c.type === 'port' || c.type === 'portin' || c.type === 'portout');
                const contentChildren = allChildren.filter(c => c.type !== 'port' && c.type !== 'portin' && c.type !== 'portout');

                if (contentChildren.length > 0) {
                    const childrenBounds = this.layoutGroup(contentChildren, 0, 0);
                    width = childrenBounds.width + this.theme.packagePadding * 2;
                    height = childrenBounds.height + this.theme.packagePadding * 2 + 30;
                } else {
                    const label = comp.label || comp.name;
                    const lines = label.split(/\\n|\n/);
                    const maxLineLen = Math.max(...lines.map(l => l.length));
                    width = Math.max(width, maxLineLen * 9 + 20);
                    height = Math.max(height, lines.length * 20 + 20);
                }
            }
            sizeMap.set(comp.name, { width, height });
        });

        // Phase 2: Assign grid positions using relationship direction hints
        const compNames = new Set(components.map(c => c.name));
        const gridPos = new Map<string, { row: number, col: number }>();

        // Build a map of descendant->ancestor for each component in this group
        const descendantToAncestor = new Map<string, string>();
        components.forEach(comp => {
            descendantToAncestor.set(comp.name, comp.name);
            const descendants = this.getAllDescendants(comp.name);
            descendants.forEach(d => descendantToAncestor.set(d, comp.name));
        });

        // Get relationships relevant to this group's components
        // Include relationships between descendants, mapped to ancestor containers
        interface MappedRel { from: string; to: string; direction: string }
        const relevantRels: MappedRel[] = [];
        const seen = new Set<string>();

        this.diagram.relationships.forEach(r => {
            const ancestorFrom = descendantToAncestor.get(r.from);
            const ancestorTo = descendantToAncestor.get(r.to);

            if (ancestorFrom && ancestorTo && ancestorFrom !== ancestorTo) {
                const key = `${ancestorFrom}->${ancestorTo}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    relevantRels.push({
                        from: ancestorFrom,
                        to: ancestorTo,
                        direction: r.direction || 'down'
                    });
                }
            }
        });

        // BFS to assign positions based on directions
        if (relevantRels.length > 0) {
            const adj = new Map<string, { target: string, direction: string }[]>();
            relevantRels.forEach(r => {
                const dir = r.direction || 'down';
                if (!adj.has(r.from)) adj.set(r.from, []);
                adj.get(r.from)!.push({ target: r.to, direction: dir });

                // Reverse adj for BFS traversal back-hints, but marked as reverse
                if (!adj.has(r.to)) adj.set(r.to, []);
                const revDir = dir === 'down' ? 'up' : dir === 'up' ? 'down' : dir === 'right' ? 'left' : 'right';
                adj.get(r.to)!.push({ target: r.from, direction: revDir });
            });

            const queue: string[] = [];
            // Pick a root (preferably one with in-degree 0)
            const roots = components.filter(c => !relevantRels.some(r => r.to === c.name));
            const startNode = roots.length > 0 ? roots[0].name : relevantRels[0].from;

            gridPos.set(startNode, { row: 0, col: 0 });
            queue.push(startNode);

            const visited = new Set<string>();
            while (queue.length > 0) {
                const current = queue.shift()!;
                if (visited.has(current)) continue;
                visited.add(current);

                const currentPos = gridPos.get(current)!;
                const neighbors = adj.get(current) || [];

                // Group unvisited neighbors by direction
                const byDir = new Map<string, string[]>();
                neighbors.forEach(n => {
                    if (!gridPos.has(n.target)) {
                        if (!byDir.has(n.direction)) byDir.set(n.direction, []);
                        byDir.get(n.direction)!.push(n.target);
                    }
                });

                // Symmetrical Distribution
                byDir.forEach((targets, dir) => {
                    targets.forEach((target, i) => {
                        let row = currentPos.row;
                        let col = currentPos.col;

                        // Calculate offset from center
                        const offset = targets.length === 1 ? 0 : (i - (targets.length - 1) / 2);

                        switch (dir) {
                            case 'down':
                                row++;
                                col += Math.round(offset * 1.5); // Spread more if multiple
                                break;
                            case 'up':
                                row--;
                                col += Math.round(offset * 1.5);
                                break;
                            case 'right':
                                col++;
                                row += Math.round(offset * 1.5);
                                break;
                            case 'left':
                                col--;
                                row += Math.round(offset * 1.5);
                                break;
                        }

                        // Basic collision resolve (temporary, will refine in Phase 3)
                        const isTaken = (r: number, c: number) => {
                            for (const p of gridPos.values()) if (p.row === r && p.col === c) return true;
                            return false;
                        };
                        while (isTaken(row, col)) {
                            if (dir === 'down' || dir === 'up') col++; else row++;
                        }

                        gridPos.set(target, { row, col });
                        queue.push(target);
                    });
                });
            }
        }

        // Assign remaining unconnected components (fallback grid)
        const unpositioned = components.filter(c => !gridPos.has(c.name));
        if (unpositioned.length > 0) {
            let maxRow = -1;
            gridPos.forEach(pos => maxRow = Math.max(maxRow, pos.row));
            const startRow = maxRow + 1;
            const cols = Math.ceil(Math.sqrt(unpositioned.length));
            unpositioned.forEach((comp, i) => {
                gridPos.set(comp.name, {
                    row: startRow + Math.floor(i / cols),
                    col: i % cols
                });
            });
        }

        // Phase 3: Global Alignment Polish
        components.forEach(comp => {
            const rels = relevantRels.filter(r => r.from === comp.name && r.direction === 'down');
            if (rels.length > 0) { // Even single child should try to align
                const pos = gridPos.get(comp.name);
                if (pos) {
                    const childrenCols = rels.map(r => gridPos.get(r.to)?.col).filter(c => c !== undefined) as number[];
                    if (childrenCols.length > 0) {
                        const avgCol = childrenCols.reduce((a, b) => a + b, 0) / childrenCols.length;
                        pos.col = Math.round(avgCol);
                    }
                }
            }
        });

        // Normalize and detect final collisions
        const normalizeAndResolve = () => {
            let minR = Infinity, minC = Infinity;
            gridPos.forEach(p => { minR = Math.min(minR, p.row); minC = Math.min(minC, p.col); });
            gridPos.forEach(p => { p.row -= minR; p.col -= minC; });

            // Resolve any overlaps created by polish (brute force)
            const sorted = Array.from(gridPos.keys()).sort((a, b) => {
                const pa = gridPos.get(a)!, pb = gridPos.get(b)!;
                return pa.row - pb.row || pa.col - pb.col;
            });
            const occupied = new Set<string>();
            sorted.forEach(name => {
                const pos = gridPos.get(name)!;
                let key = `${pos.row},${pos.col}`;
                while (occupied.has(key)) {
                    pos.col++;
                    key = `${pos.row},${pos.col}`;
                }
                occupied.add(key);
            });
        };
        normalizeAndResolve();

        // Phase 4: Build row/col structure...
        let maxRow = 0, maxCol = 0;
        gridPos.forEach(pos => {
            maxRow = Math.max(maxRow, pos.row);
            maxCol = Math.max(maxCol, pos.col);
        });

        const colWidths = new Array(maxCol + 1).fill(0);
        const rowHeights = new Array(maxRow + 1).fill(0);

        gridPos.forEach((pos, name) => {
            const size = sizeMap.get(name)!;
            colWidths[pos.col] = Math.max(colWidths[pos.col], size.width);
            rowHeights[pos.row] = Math.max(rowHeights[pos.row], size.height);
        });

        // Phase 5: Position components centered within their cells
        // Calculate cell start positions
        const colStarts: number[] = [startX];
        for (let c = 1; c <= maxCol; c++) {
            colStarts[c] = colStarts[c - 1] + colWidths[c - 1] + this.theme.componentGapX;
        }
        const rowStarts: number[] = [startY];
        for (let r = 1; r <= maxRow; r++) {
            rowStarts[r] = rowStarts[r - 1] + rowHeights[r - 1] + this.theme.componentGapY;
        }

        console.log('--- Grid Layout Details ---');
        console.log('Col Widths:', colWidths);
        console.log('Col Starts:', colStarts);
        console.log('Row Heights:', rowHeights);
        console.log('Row Starts:', rowStarts);

        // First pass: Position all components to establish their centers
        components.forEach(comp => {
            const pos = gridPos.get(comp.name)!;
            const size = sizeMap.get(comp.name)!;

            const cellX = colStarts[pos.col];
            const cellY = rowStarts[pos.row];
            const cellW = colWidths[pos.col];
            const cellH = rowHeights[pos.row];
            const posX = cellX + (cellW - size.width) / 2;
            const posY = cellY + (cellH - size.height) / 2;

            this.layoutMap.set(comp.name, {
                x: posX,
                y: posY,
                width: size.width,
                height: size.height
            });
            this.gridCells.set(comp.name, { x: cellX, w: cellW });
        });

        // Second pass: Shift children and layout ports now that we know where everyone is
        components.forEach(comp => {
            const size = sizeMap.get(comp.name)!;
            // Retrieve the positioned rect
            const rect = this.layoutMap.get(comp.name)!;
            const posX = rect.x;
            const posY = rect.y;

            // If container, shift children (content only) to final position
            const allChildren = this.diagram.components.filter(c => c.parentId === comp.name);
            const contentChildren = allChildren.filter(c => c.type !== 'port' && c.type !== 'portin' && c.type !== 'portout');

            if (contentChildren.length > 0) {
                this.shiftChildren(contentChildren, posX + this.theme.packagePadding, posY + 30 + this.theme.packagePadding);
            }

            // Position ports relative to the FINAL component position
            const ports = allChildren.filter(c => c.type === 'port' || c.type === 'portin' || c.type === 'portout');
            if (ports.length > 0) {
                this.layoutPorts(comp, ports, posX, posY, size.width, size.height);
            }
        });

        const totalWidth = colStarts[maxCol] + colWidths[maxCol] - startX;
        const totalHeight = rowStarts[maxRow] + rowHeights[maxRow] - startY;

        return {
            x: startX,
            y: startY,
            width: totalWidth,
            height: totalHeight
        };
    }

    private shiftChildren(children: Component[], dx: number, dy: number) {
        children.forEach(child => {
            const rect = this.layoutMap.get(child.name);
            if (rect) {
                rect.x += dx;
                rect.y += dy;
                this.layoutMap.set(child.name, rect);

                const cell = this.gridCells.get(child.name);
                if (cell) {
                    cell.x += dx;
                    this.gridCells.set(child.name, cell);
                }

                // Recurse
                const grandChildren = this.diagram.components.filter(c => c.parentId === child.name);
                if (grandChildren.length > 0) {
                    this.shiftChildren(grandChildren, dx, dy);
                }
            }
        });
    }

    /** Recursively get all descendant component names */
    private getAllDescendants(parentName: string): string[] {
        const result: string[] = [];
        const children = this.diagram.components.filter(c => c.parentId === parentName);
        children.forEach(child => {
            result.push(child.name);
            result.push(...this.getAllDescendants(child.name));
        });
        return result;
    }

    private routeRelationship(rel: Relationship): RelationshipLayoutNode {
        // Try to find from component or note
        let fromRect = this.layoutMap.get(rel.from);
        if (!fromRect) {
            fromRect = this.noteLayoutMap.get(rel.from);
        }

        // Try to find to component or note
        let toRect = this.layoutMap.get(rel.to);
        if (!toRect) {
            toRect = this.noteLayoutMap.get(rel.to);
        }

        if (!fromRect || !toRect) {
            return { relationship: rel, path: [] };
        }

        const fromComp = this.diagram.components.find(c => c.name === rel.from);
        const toComp = this.diagram.components.find(c => c.name === rel.to);

        const startCenter = {
            x: fromRect.x + fromRect.width / 2,
            y: fromRect.y + fromRect.height / 2
        };
        const endCenter = {
            x: toRect.x + toRect.width / 2,
            y: toRect.y + toRect.height / 2
        };

        // Clip the line to the rectangles boundaries
        const startPad = fromComp?.type === 'interface' ? this.theme.interfaceRadius + 2 : 5;
        const endPad = toComp?.type === 'interface' ? this.theme.interfaceRadius + 2 : 10; // larger for arrow target

        const start = this.getIntersection(startCenter, endCenter, fromRect, startPad, fromComp?.type === 'interface');
        const end = this.getIntersection(endCenter, startCenter, toRect, endPad, toComp?.type === 'interface');

        return {
            relationship: rel,
            path: [start, end],
            labelPosition: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 10 }
        };
    }

    private getIntersection(center: { x: number, y: number }, target: { x: number, y: number }, rect: Rect, padding: number = 0, isCircle: boolean = false): { x: number, y: number } {
        const dx = target.x - center.x;
        const dy = target.y - center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist === 0) return center;

        if (isCircle) {
            // Circle intersection is simpler: just radius + padding
            const scale = padding / dist;
            return {
                x: center.x + dx * scale,
                y: center.y + dy * scale
            };
        }

        const w = (rect.width / 2) + padding;
        const h = (rect.height / 2) + padding;

        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        let scale = 1;
        if (absDx * h > absDy * w) {
            scale = w / absDx;
        } else {
            scale = h / absDy;
        }

        return {
            x: center.x + dx * scale,
            y: center.y + dy * scale
        };
    }

    private layoutNotes(components: ComponentLayoutNode[]): NoteLayoutNode[] {
        const layouts: NoteLayoutNode[] = [];
        let defaultY = 0;
        // Find max Y
        components.forEach(c => defaultY = Math.max(defaultY, c.y + c.height));
        defaultY += 50;

        this.diagram.notes.forEach((note, i) => {
            // 1. Measure note dimensions first
            const lines = note.text.split('\n');
            const width = Math.max(100, Math.max(...lines.map(l => l.length * 8)) + 20);
            const height = lines.length * 20 + 20;

            let x = 0;
            let y = defaultY + i * 60;

            if (note.linkedTo) {
                const target = components.find(c => c.component.name === note.linkedTo);
                if (target) {
                    const margin = 30; // Spacing between note and component
                    // Position based on preference, centering relative to target side
                    if (note.position === 'right') {
                        x = target.x + target.width + margin;
                        y = target.y + (target.height - height) / 2;
                    } else if (note.position === 'left') {
                        x = target.x - width - margin;
                        y = target.y + (target.height - height) / 2;
                    } else if (note.position === 'top') {
                        x = target.x + (target.width - width) / 2;
                        y = target.y - height - margin;
                    } else if (note.position === 'bottom') {
                        x = target.x + (target.width - width) / 2;
                        y = target.y + target.height + margin;
                    } else {
                        // Default near
                        x = target.x + target.width + margin;
                        y = target.y + (target.height - height) / 2;
                    }
                }
            }

            const layout = {
                note,
                x, y, width, height
            };
            layouts.push(layout);

            // Store note position in map for relationship routing
            // Use alias if available, otherwise use id
            const key = note.alias || note.id;
            this.noteLayoutMap.set(key, { x, y, width, height });
        });

        return layouts;
    }


    private layoutPorts(parent: Component, ports: Component[], parentX: number, parentY: number, parentW: number, parentH: number) {
        const portSegments: { [key: string]: Component[] } = {
            top: [],
            bottom: [],
            left: [],
            right: []
        };

        ports.forEach(port => {
            // Find all connections to this port
            const connections = this.diagram.relationships.filter(r => r.from === port.name || r.to === port.name);

            if (connections.length === 0) {
                // Default fallback if no connections
                if (port.type === 'portin') portSegments.left.push(port);
                else if (port.type === 'portout') portSegments.right.push(port);
                else portSegments.left.push(port);
                return;
            }

            // Calculate centroid of connected nodes
            let totalX = 0, totalY = 0, count = 0;

            connections.forEach(rel => {
                const otherName = rel.from === port.name ? rel.to : rel.from;
                let otherRect = this.layoutMap.get(otherName);

                // Check if it's a note
                if (!otherRect) {
                    // Start by checking notes since we might not have note layout yet if called early?
                    // Actually, notes are laid out AFTER components in calculateLayout main flow?
                    // Wait, notes are laid out in step 4/5. 
                    // This `layoutPorts` is called inside `layoutGroup`.
                    // BUT `layoutGroup` is called "recursively" or in steps? 
                    // `calculateLayout` calls `layoutGroup(roots)`.
                    // So notes are NOT laid out yet when we are here.
                    // This is a chicken-and-egg problem for notes.
                    // However, for other components, if they are in the same group or already laid out, we might have them.
                    // If they are not yet laid out (e.g. forward reference), we might not have their position.
                    // If we don't have position, we can't decide.

                    // Actually, `layoutGroup` is doing a BFS/Grid assignment.
                    // The components in the current group have just been assigned a `layoutMap` entry in "Pass 1" above.
                    // So siblings are known. 
                    // Parents are known (since we are traversing down).
                    // Children are NOT known (we generate them recursively).
                    // External components (in other groups/roots) might be known if they were processed before us?
                    // If strict hierarchy, roots are processed.

                    // IF we can't find the other component, we fallback to default.
                }

                if (otherRect) {
                    totalX += otherRect.x + otherRect.width / 2;
                    totalY += otherRect.y + otherRect.height / 2;
                    count++;
                }
            });

            if (count === 0) {
                // Determine based on port type default
                if (port.type === 'portin') portSegments.left.push(port);
                else if (port.type === 'portout') portSegments.right.push(port);
                else portSegments.left.push(port);
                return;
            }

            const centerX = totalX / count;
            const centerY = totalY / count;

            const parentCenterX = parentX + parentW / 2;
            const parentCenterY = parentY + parentH / 2;

            const dx = centerX - parentCenterX;
            const dy = centerY - parentCenterY;

            // Determine best side based on vector (dx, dy)
            // Divide into 4 quadrants
            // If |dx| > |dy|, then it's left or right
            // If |dy| > |dx|, then it's top or bottom

            // Bias horizontal for side ports? 
            // Let's stick to simple geometric quadrants.

            if (Math.abs(dx) >= Math.abs(dy)) {
                // Horizontal
                if (dx > 0) portSegments.right.push(port);
                else portSegments.left.push(port);
            } else {
                // Vertical
                if (dy > 0) portSegments.bottom.push(port);
                else portSegments.top.push(port);
            }
        });

        const portSize = 10;
        const halfPort = portSize / 2;

        // Helper to distribute specific ports on an edge
        const distribute = (list: Component[], edge: 'left' | 'right' | 'top' | 'bottom') => {
            if (list.length === 0) return;
            const count = list.length;

            const isVertical = edge === 'left' || edge === 'right';
            const availableSpace = isVertical ? parentH : parentW;
            // Use full width/height for distribution?
            // Or leave some padding? 
            // plantuml usually centers them or spreads them.
            // Let's spread evenly.
            const step = availableSpace / (count + 1);

            list.forEach((p, i) => {
                let x = 0, y = 0;
                if (edge === 'left') {
                    x = parentX - halfPort;
                    y = parentY + step * (i + 1) - halfPort;
                } else if (edge === 'right') {
                    x = parentX + parentW - halfPort;
                    y = parentY + step * (i + 1) - halfPort;
                } else if (edge === 'top') {
                    x = parentX + step * (i + 1) - halfPort;
                    y = parentY - halfPort;
                } else if (edge === 'bottom') {
                    x = parentX + step * (i + 1) - halfPort;
                    y = parentY + parentH - halfPort;
                }

                this.layoutMap.set(p.name, {
                    x, y, width: portSize, height: portSize
                });
            });
        };

        distribute(portSegments.left, 'left');
        distribute(portSegments.right, 'right');
        distribute(portSegments.top, 'top');
        distribute(portSegments.bottom, 'bottom');
    }
}
