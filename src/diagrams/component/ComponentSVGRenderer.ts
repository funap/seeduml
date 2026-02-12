
import { Diagram } from '../../core/Diagram';
import { Renderer } from '../../core/Renderer';
import { ComponentDiagram } from './ComponentDiagram';
import { ComponentLayout, ComponentLayoutResult, ComponentLayoutNode, RelationshipLayoutNode, NoteLayoutNode } from './ComponentLayout';
import { ComponentTheme, defaultTheme } from './ComponentTheme';

export class ComponentSVGRenderer implements Renderer {
    private layoutEngine!: ComponentLayout;
    private theme: ComponentTheme = defaultTheme;

    render(diagram: Diagram): string {
        if (diagram.type !== 'component') {
            throw new Error('ComponentSVGRenderer only supports component diagrams');
        }
        const componentDiagram = diagram as ComponentDiagram;
        this.layoutEngine = new ComponentLayout(componentDiagram, this.theme);
        const layoutResult = this.layoutEngine.calculateLayout();

        const width = Math.max(layoutResult.width, 100);
        const height = Math.max(layoutResult.height, 100);

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

        // Defs for markers, filters, gradients
        svg += `<defs>
            <marker id="comp-arrow-end" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
                <polygon points="0,0 10,3.5 0,7" fill="${this.theme.colors.line}" />
            </marker>
            <marker id="comp-arrow-open" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
                <polyline points="0,0 10,3.5 0,7" fill="none" stroke="${this.theme.colors.line}" stroke-width="1.5" />
            </marker>
            <filter id="comp-shadow" x="-4%" y="-4%" width="112%" height="112%">
                <feDropShadow dx="1" dy="1" stdDeviation="2" flood-color="#00000020" />
            </filter>
        </defs>`;

        // Sort components by hierarchy depth (parents drawn first)
        const sortedComponents = [...layoutResult.components].sort((a, b) => {
            const getDepth = (c: ComponentLayoutNode) => {
                let d = 0;
                let parent = c.component.parentId;
                while (parent) {
                    d++;
                    parent = componentDiagram.components.find(x => x.name === parent)?.parentId;
                }
                return d;
            };
            return getDepth(a) - getDepth(b);
        });

        sortedComponents.forEach(node => {
            svg += this.renderComponentNode(node, componentDiagram, layoutResult);
        });

        // Draw Notes (layer below arrows)
        layoutResult.notes.forEach(note => {
            svg += this.renderNote(note);
        });

        // Draw Relationships (topmost layer as requested)
        layoutResult.relationships.forEach(rel => {
            svg += this.renderRelationship(rel, componentDiagram);
        });

        svg += '</svg>';
        return svg;
    }

    private renderComponentNode(node: ComponentLayoutNode, diagram: ComponentDiagram, layoutResult: ComponentLayoutResult): string {
        const { component } = node;

        switch (component.type) {
            case 'interface':
                return this.renderInterface(node);
            case 'package':
                return this.renderPackage(node);
            case 'node':
                return this.renderNode(node);
            case 'folder':
                return this.renderFolder(node);
            case 'frame':
                return this.renderFrame(node);
            case 'cloud':
                return this.renderCloud(node);
            case 'database':
                return this.renderDatabase(node);
            case 'port':
            case 'portin':
            case 'portout':
                return this.renderPort(node, diagram, layoutResult);
            case 'component':
            default:
                return this.renderComponent(node, diagram);
        }
    }

    /** SysML Component: Rectangle with component icon (two small rectangles on the left) */
    private renderComponent(node: ComponentLayoutNode, diagram: ComponentDiagram): string {
        const { x, y, width, height, component } = node;
        const fill = component.color || this.theme.colors.defaultFill;
        const stroke = this.theme.colors.defaultStroke;
        const label = component.label || component.name;
        const lines = label.split(/\\n|\n/);

        // Component icon dimensions
        const iconW = 14;
        const iconH = 18;
        const iconX = 6;
        const iconY = 6;
        const tabW = 8;
        const tabH = 5;

        // Check if component has children (is a container)
        const hasChildren = diagram.components.some(c => c.parentId === component.name);

        let textX = x + width / 2;
        let textY = y + height / 2;
        let anchor = "middle";

        if (hasChildren) {
            // If container, place label at the top
            textY = y + 20; // Padding from top
            // Keep centered horizontally or move to left? 
            // Standard components with content often have label centered at top or in a compartment.
            // Let's keep it centered horizontally but move to top.
        }

        return `
            <g filter="url(#comp-shadow)">
                <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" rx="3" ry="3" />
                <!-- SysML Component Icon: rectangle with two tabs -->
                <rect x="${x + iconX}" y="${y + iconY}" width="${iconW}" height="${iconH}" fill="none" stroke="${this.theme.colors.componentIcon}" stroke-width="1.2" rx="1" />
                <rect x="${x + iconX - tabW / 2}" y="${y + iconY + 3}" width="${tabW}" height="${tabH}" fill="${fill}" stroke="${this.theme.colors.componentIcon}" stroke-width="1" rx="0.5" />
                <rect x="${x + iconX - tabW / 2}" y="${y + iconY + 10}" width="${tabW}" height="${tabH}" fill="${fill}" stroke="${this.theme.colors.componentIcon}" stroke-width="1" rx="0.5" />
                <text x="${textX}" y="${textY}" text-anchor="${anchor}" dominant-baseline="middle" fill="${this.theme.colors.text}" font-family="${this.theme.fontFamily}" font-size="${this.theme.fontSize}">
                    ${lines.map((line, i) => `<tspan x="${textX}" dy="${i === 0 ? (hasChildren ? 0 : -((lines.length - 1) * 0.6) + 'em') : '1.2em'}">${this.escapeXml(line)}</tspan>`).join('')}
                </text>
            </g>
        `;
    }

    /** SysML Interface: Lollipop (provided interface) */
    private renderInterface(node: ComponentLayoutNode): string {
        const { x, y, width, height, component } = node;
        const r = this.theme.interfaceRadius;
        const cx = x + width / 2;
        const cy = y + height / 2;

        return `
            <g>
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="${this.theme.colors.interfaceFill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="1.5"/>
                <text x="${cx}" y="${cy + r + 16}" text-anchor="middle" fill="${this.theme.colors.text}" font-family="${this.theme.fontFamily}" font-size="${this.theme.fontSize}">
                    ${this.escapeXml(component.label || component.name)}
                </text>
            </g>
        `;
    }

    /** SysML Package: Rectangle with small tab (name compartment) on upper-left */
    private renderPackage(node: ComponentLayoutNode): string {
        const { x, y, width, height, component } = node;
        const label = component.label || component.name;
        const tabH = 22;
        const textW = label.length * 8 + 20;
        const tabW = Math.min(Math.max(textW, 60), width * 0.6);

        return `
            <g filter="url(#comp-shadow)">
                <!-- Package tab -->
                <path d="M${x},${y + tabH} L${x},${y + 3} Q${x},${y} ${x + 3},${y} L${x + tabW - 5},${y} L${x + tabW},${y + tabH}" fill="${this.theme.colors.packageFill}" stroke="${this.theme.colors.packageStroke}" stroke-width="1.5" />
                <!-- Package body -->
                <rect x="${x}" y="${y + tabH}" width="${width}" height="${height - tabH}" fill="${this.theme.colors.packageFill}" fill-opacity="0.25" stroke="${this.theme.colors.packageStroke}" stroke-width="1.5" rx="1" />
                <!-- Label in tab -->
                <text x="${x + 10}" y="${y + 15}" text-anchor="start" font-weight="600" fill="${this.theme.colors.text}" font-family="${this.theme.fontFamily}" font-size="${this.theme.fontSize}">
                    ${this.escapeXml(label)}
                </text>
            </g>
        `;
    }

    /** SysML Node: 3D box (cube) – indicates execution environment */
    private renderNode(node: ComponentLayoutNode): string {
        const { x, y, width, height, component } = node;
        const label = component.label || component.name;
        const d = 10; // 3D depth offset

        return `
            <g filter="url(#comp-shadow)">
                <!-- Top face -->
                <polygon points="${x},${y + d} ${x + d},${y} ${x + width + d},${y} ${x + width},${y + d}" fill="${this.theme.colors.nodeFill}" stroke="${this.theme.colors.packageStroke}" stroke-width="1.2" />
                <!-- Right face -->
                <polygon points="${x + width},${y + d} ${x + width + d},${y} ${x + width + d},${y + height} ${x + width},${y + height + d}" fill="${this.theme.colors.nodeFill}" fill-opacity="0.7" stroke="${this.theme.colors.packageStroke}" stroke-width="1.2" />
                <!-- Front face -->
                <rect x="${x}" y="${y + d}" width="${width}" height="${height}" fill="${this.theme.colors.nodeFill}" fill-opacity="0.35" stroke="${this.theme.colors.packageStroke}" stroke-width="1.5" />
                <text x="${x + 10}" y="${y + d + 18}" text-anchor="start" font-weight="600" fill="${this.theme.colors.text}" font-family="${this.theme.fontFamily}" font-size="${this.theme.fontSize}">
                    «node» ${this.escapeXml(label)}
                </text>
            </g>
        `;
    }

    /** Folder: Rectangle with folder tab */
    private renderFolder(node: ComponentLayoutNode): string {
        const { x, y, width, height, component } = node;
        const label = component.label || component.name;
        const tabH = 16;
        const tabW = Math.min(60, width * 0.35);

        return `
            <g filter="url(#comp-shadow)">
                <!-- Folder tab -->
                <path d="M${x},${y + tabH} L${x},${y + 3} Q${x},${y} ${x + 3},${y} L${x + tabW - 8},${y} L${x + tabW},${y + tabH}" fill="${this.theme.colors.folderFill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="1.3" />
                <!-- Folder body -->
                <rect x="${x}" y="${y + tabH}" width="${width}" height="${height - tabH}" fill="${this.theme.colors.folderFill}" fill-opacity="0.3" stroke="${this.theme.colors.defaultStroke}" stroke-width="1.3" rx="1" />
                <text x="${x + 10}" y="${y + tabH + 18}" text-anchor="start" font-weight="600" fill="${this.theme.colors.text}" font-family="${this.theme.fontFamily}" font-size="${this.theme.fontSize}">
                    ${this.escapeXml(label)}
                </text>
            </g>
        `;
    }

    /** Frame: Rectangle with pentagon name tag in upper-left */
    private renderFrame(node: ComponentLayoutNode): string {
        const { x, y, width, height, component } = node;
        const label = component.label || component.name;
        const tagW = Math.min(label.length * 8 + 24, width * 0.6);
        const tagH = 22;

        return `
            <g filter="url(#comp-shadow)">
                <!-- Frame body -->
                <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${this.theme.colors.frameFill}" fill-opacity="0.25" stroke="${this.theme.colors.defaultStroke}" stroke-width="1.5" rx="2" />
                <!-- Pentagon name tag -->
                <polygon points="${x},${y} ${x + tagW},${y} ${x + tagW},${y + tagH - 6} ${x + tagW - 6},${y + tagH} ${x},${y + tagH}" fill="${this.theme.colors.frameFill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="1.3" />
                <text x="${x + 8}" y="${y + 15}" text-anchor="start" font-weight="600" fill="${this.theme.colors.text}" font-family="${this.theme.fontFamily}" font-size="${this.theme.fontSize - 1}">
                    ${this.escapeXml(label)}
                </text>
            </g>
        `;
    }

    /** Cloud: organic cloud shape */
    private renderCloud(node: ComponentLayoutNode): string {
        const { x, y, width, height, component } = node;
        const label = component.label || component.name;
        const cx = width / 2;
        const cy = height / 2;
        // SVG cloud shape using cubic beziers
        const w = width;
        const h = height;

        return `
            <g transform="translate(${x}, ${y})" filter="url(#comp-shadow)">
                <path d="
                    M${w * 0.25},${h * 0.7}
                    C${w * 0.02},${h * 0.7} ${w * 0.0},${h * 0.45} ${w * 0.15},${h * 0.35}
                    C${w * 0.1},${h * 0.15} ${w * 0.3},${h * 0.05} ${w * 0.45},${h * 0.2}
                    C${w * 0.5},${h * 0.05} ${w * 0.75},${h * 0.05} ${w * 0.78},${h * 0.25}
                    C${w * 1.0},${h * 0.2} ${w * 1.02},${h * 0.5} ${w * 0.85},${h * 0.6}
                    C${w * 0.95},${h * 0.75} ${w * 0.85},${h * 0.85} ${w * 0.7},${h * 0.78}
                    C${w * 0.6},${h * 0.9} ${w * 0.4},${h * 0.9} ${w * 0.25},${h * 0.7}
                    Z
                " fill="${this.theme.colors.cloudFill}" fill-opacity="0.5" stroke="${this.theme.colors.packageStroke}" stroke-width="1.5" />
                ${label ? `<text x="${cx}" y="${cy + 5}" text-anchor="middle" dominant-baseline="middle" font-weight="600" fill="${this.theme.colors.text}" font-family="${this.theme.fontFamily}" font-size="${this.theme.fontSize}">
                    ${this.escapeXml(label)}
                </text>` : ''}
            </g>
        `;
    }

    /** Database: Cylinder shape */
    private renderDatabase(node: ComponentLayoutNode): string {
        const { x, y, width, height, component } = node;
        const label = component.label || component.name;
        const ry = 12; // ellipse y-radius for top/bottom caps

        return `
            <g transform="translate(${x}, ${y})" filter="url(#comp-shadow)">
                <!-- Cylinder body -->
                <rect x="0" y="${ry}" width="${width}" height="${height - ry * 2}" fill="${this.theme.colors.databaseFill}" fill-opacity="0.35" stroke="none" />
                <!-- Side lines -->
                <line x1="0" y1="${ry}" x2="0" y2="${height - ry}" stroke="${this.theme.colors.packageStroke}" stroke-width="1.5" />
                <line x1="${width}" y1="${ry}" x2="${width}" y2="${height - ry}" stroke="${this.theme.colors.packageStroke}" stroke-width="1.5" />
                <!-- Bottom ellipse -->
                <ellipse cx="${width / 2}" cy="${height - ry}" rx="${width / 2}" ry="${ry}" fill="${this.theme.colors.databaseFill}" fill-opacity="0.35" stroke="${this.theme.colors.packageStroke}" stroke-width="1.5" />
                <!-- Top ellipse (drawn last to overlay body) -->
                <ellipse cx="${width / 2}" cy="${ry}" rx="${width / 2}" ry="${ry}" fill="${this.theme.colors.databaseFill}" stroke="${this.theme.colors.packageStroke}" stroke-width="1.5" />
                ${label ? `<text x="${width / 2}" y="${ry + 20}" text-anchor="middle" font-weight="600" fill="${this.theme.colors.text}" font-family="${this.theme.fontFamily}" font-size="${this.theme.fontSize}">
                    ${this.escapeXml(label)}
                </text>` : ''}
            </g>
        `;
    }

    private renderRelationship(rel: RelationshipLayoutNode, diagram: ComponentDiagram): string {
        const { path, relationship } = rel;
        if (path.length < 2) return '';

        const start = path[0];
        const end = path[path.length - 1];

        const strokeDash = relationship.type === 'dashed' ? '6,4' : (relationship.type === 'dotted' ? '2,3' : 'none');

        // Only use marker if showArrowHead is true
        let markerEnd = '';
        if (relationship.showArrowHead !== false) {
            markerEnd = relationship.type === 'dashed' ? 'url(#comp-arrow-open)' : 'url(#comp-arrow-end)';
        }

        let labelSvg = '';
        if (rel.labelPosition && relationship.label) {
            labelSvg = `
                <rect x="${rel.labelPosition.x - relationship.label.length * 3.5 - 4}" y="${rel.labelPosition.y - 10}" width="${relationship.label.length * 7 + 8}" height="16" fill="white" fill-opacity="0.85" rx="3" />
                <text x="${rel.labelPosition.x}" y="${rel.labelPosition.y}" text-anchor="middle" dominant-baseline="middle" fill="${this.theme.colors.textLight}" font-family="${this.theme.fontFamily}" font-size="11" font-style="italic">
                    ${this.escapeXml(relationship.label)}
                </text>
            `;
        }

        return `
            <g>
                <line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${this.theme.colors.line}" stroke-width="1.3" stroke-dasharray="${strokeDash}" marker-end="${markerEnd}"/>
                ${labelSvg}
            </g>
        `;
    }

    private renderNote(noteNode: NoteLayoutNode): string {
        const { x, y, width, height, note } = noteNode;
        const fold = 12;
        return `
            <g transform="translate(${x}, ${y})">
                <path d="M0,0 L${width - fold},0 L${width},${fold} L${width},${height} L0,${height} Z" fill="${this.theme.colors.noteFill}" stroke="${this.theme.colors.noteStroke}" stroke-width="1" />
                <path d="M${width - fold},0 L${width - fold},${fold} L${width},${fold}" fill="none" stroke="${this.theme.colors.noteStroke}" stroke-width="1" />
                <text x="10" y="18" fill="${this.theme.colors.text}" font-family="${this.theme.fontFamily}" font-size="${this.theme.fontSize - 1}">
                    ${note.text.split('\n').map((line, i) => `<tspan x="10" dy="${i === 0 ? 0 : '1.3em'}">${this.escapeXml(line)}</tspan>`).join('')}
                </text>
            </g>
        `;
    }

    private escapeXml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    private renderPort(node: ComponentLayoutNode, diagram: ComponentDiagram, layoutResult: ComponentLayoutResult): string {
        const { x, y, width, height, component } = node;
        const fill = this.theme.colors.line; // Use line color for ports or specific port color

        // Find parent to determine label position
        let labelSvg = '';
        if (component.parentId) {
            const parent = layoutResult.components.find(c => c.component.name === component.parentId);
            if (parent) {
                const cx = x + width / 2;
                const cy = y + height / 2;
                const pcx = parent.x + parent.width / 2;
                const pcy = parent.y + parent.height / 2;

                const dx = cx - pcx;
                const dy = cy - pcy;

                let tx = 0, ty = 0;
                let anchor = 'middle';
                let baseline = 'middle';

                // Position label "inside" the component to avoid cluttering external arrows
                const padding = 10;

                if (Math.abs(dx) >= Math.abs(dy)) {
                    // Horizontal
                    if (dx > 0) { // Right side -> Label Left
                        tx = x - padding / 2;
                        ty = cy;
                        anchor = 'end';
                    } else { // Left side -> Label Right
                        tx = x + width + padding / 2;
                        ty = cy;
                        anchor = 'start';
                    }
                } else {
                    // Vertical
                    if (dy > 0) { // Bottom side -> Label Top
                        tx = cx;
                        ty = y - padding / 2;
                        baseline = 'auto'; // default, bottom of text at y
                    } else { // Top side -> Label Bottom
                        tx = cx;
                        ty = y + height + padding; // approx text height
                        baseline = 'hanging';
                    }
                }

                const label = component.label || component.name;
                labelSvg = `<text x="${tx}" y="${ty}" text-anchor="${anchor}" dominant-baseline="${baseline}" fill="${this.theme.colors.text}" font-family="${this.theme.fontFamily}" font-size="${this.theme.fontSize - 2}">${this.escapeXml(label)}</text>`;
            }
        }

        return `
            <g>
                <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="1" />
                ${labelSvg}
            </g>
        `;
    }
}

