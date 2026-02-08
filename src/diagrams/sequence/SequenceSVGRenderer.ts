import { Renderer } from '../../core/Renderer';
import { SequenceDiagram, ArrowHead } from './SequenceDiagram';
import { SequenceTheme, defaultTheme } from './SequenceTheme';
import { LayoutEngine, LayoutResult } from './SequenceLayout';

export class SequenceSVGRenderer implements Renderer<SequenceDiagram> {
    private theme: SequenceTheme = defaultTheme;
    private layoutEngine: LayoutEngine;

    constructor() {
        this.layoutEngine = new LayoutEngine(this.theme);
    }

    render(diagram: SequenceDiagram): string {
        // 1. Ensure participants
        this.ensureParticipants(diagram);

        // 2. Calculate Layout
        const layout = this.layoutEngine.calculateLayout(diagram);

        // 3. Render SVG
        return this.generateSvg(diagram, layout);
    }

    private ensureParticipants(diagram: SequenceDiagram) {
        diagram.notes.forEach(note => {
            if (note.participants) {
                note.participants.forEach(p => diagram.addParticipant(p));
            }
        });
    }

    private generateSvg(diagram: SequenceDiagram, layout: LayoutResult): string {
        let svg = `<svg width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" xmlns="http://www.w3.org/2000/svg" style="background: white; font-family: ${this.theme.fontFamily};">`;

        svg += this.renderDefs(diagram);
        svg += this.renderLifelines(diagram, layout);
        svg += this.renderActivations(diagram, layout); // Activations need layout linkage, currently relying on stepY match. Ideally LayoutEngine returns ActivationLayouts.
        svg += this.renderGroups(layout);
        svg += this.renderParticipants(diagram, layout);
        svg += this.renderReferences(diagram, layout);
        svg += this.renderNotes(layout);
        svg += this.renderMessages(diagram, layout);
        svg += this.renderDividers(diagram, layout);
        svg += this.renderDelays(diagram, layout);
        svg += this.renderTimeConstraints(layout);
        svg += this.renderDestructionMarks(layout);

        // Title/Header/Footer
        if (diagram.title) {
            svg += `<text x="${layout.width / 2}" y="${25}" text-anchor="middle" font-size="${this.theme.fontSize + 4}" font-weight="bold">${diagram.title}</text>`;
        }
        if (diagram.header) {
            svg += `<text x="${layout.width - this.theme.padding}" y="${15}" text-anchor="end" font-size="${this.theme.fontSize - 4}">${diagram.header}</text>`;
        }
        if (diagram.footer) {
            svg += `<text x="${layout.width / 2}" y="${layout.height - 10}" text-anchor="middle" font-size="${this.theme.fontSize - 4}">${diagram.footer}</text>`;
        }

        svg += '</svg>';
        return svg;
    }

    private renderDefs(diagram: SequenceDiagram): string {
        const usedColors = new Set<string>();
        usedColors.add(this.theme.colors.defaultStroke);
        diagram.messages.forEach(m => {
            usedColors.add(this.normalizeColor(m.color, this.theme.colors.defaultStroke));
        });

        let defs = '<defs>';
        usedColors.forEach(color => {
            const safeColor = color.replace('#', '');
            defs += `
      <marker id="arrowhead-${safeColor}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="${color}" />
      </marker>
      <marker id="arrowhead-reverse-${safeColor}" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
        <polygon points="10 0, 0 3.5, 10 7" fill="${color}" />
      </marker>
      <marker id="arrowhead-open-${safeColor}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
        <path d="M 0 0 L 10 3.5 L 0 7" fill="none" stroke="${color}" stroke-width="1" />
      </marker>
      <marker id="arrowhead-open-reverse-${safeColor}" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
        <path d="M 10 0 L 0 3.5 L 10 7" fill="none" stroke="${color}" stroke-width="1" />
      </marker>
      <marker id="halfhead-${safeColor}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 3.5" fill="${color}" />
      </marker>
      <marker id="halfhead-reverse-${safeColor}" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
        <polygon points="10 0, 0 3.5, 10 3.5" fill="${color}" />
      </marker>
      <marker id="circlehead-${safeColor}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
        <circle cx="4" cy="4" r="3" fill="white" stroke="${color}" stroke-width="1.5" />
      </marker>
      <marker id="arrowhead-circle-${safeColor}" markerWidth="18" markerHeight="7.5" refX="14" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="${color}" />
        <circle cx="14" cy="3.5" r="3" fill="${color}" stroke="${color}" stroke-width="1" />
      </marker>
      <marker id="arrowhead-circle-reverse-${safeColor}" markerWidth="18" markerHeight="7.5" refX="4" refY="3.5" orient="auto">
        <polygon points="17 0, 7 3.5, 17 7" fill="${color}" />
        <circle cx="4" cy="3.5" r="3" fill="${color}" stroke="${color}" stroke-width="1" />
      </marker>
      <marker id="losthead-${safeColor}" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
        <line x1="0" y1="0" x2="10" y2="10" stroke="${color}" stroke-width="2" />
        <line x1="10" y1="0" x2="0" y2="10" stroke="${color}" stroke-width="2" />
      </marker>`;
        });
        defs += '</defs>';
        return defs;
    }

    private renderLifelines(diagram: SequenceDiagram, layout: LayoutResult): string {
        let svg = '';
        layout.participants.forEach(pl => {
            // Skip external participants ([ and ])
            if (pl.participant.name === '[' || pl.participant.name === ']') {
                return;
            }

            const x = pl.centerX;
            // Use destroyedY or default to bottom
            const yEnd = pl.destroyedY !== undefined ?
                pl.destroyedY :
                (diagram.hideFootbox ? (layout.height - this.theme.padding) : (layout.height - this.theme.padding - this.theme.participantHeight));

            svg += `<line x1="${x}" y1="${pl.y + pl.height}" x2="${x}" y2="${yEnd}" stroke="${this.theme.colors.line}" stroke-dasharray="4" />`;
        });
        return svg;
    }

    private renderDestructionMarks(layout: LayoutResult): string {
        let svg = '';
        layout.participants.forEach(pl => {
            if (pl.destroyedY !== undefined) {
                const x = pl.centerX;
                const y = pl.destroyedY;
                const dSize = 12;
                // Draw red X mark centered at y
                svg += `<line x1="${x - dSize}" y1="${y - dSize}" x2="${x + dSize}" y2="${y + dSize}" stroke="#FF0000" stroke-width="3" />`;
                svg += `<line x1="${x + dSize}" y1="${y - dSize}" x2="${x - dSize}" y2="${y + dSize}" stroke="#FF0000" stroke-width="3" />`;
            }
        });
        return svg;
    }

    private renderParticipants(diagram: SequenceDiagram, layout: LayoutResult): string {
        let svg = '';
        const draw = (pl: any, top: boolean) => {
            const fill = this.normalizeColor(pl.participant.color, this.theme.colors.actorFill);
            const x = pl.x;
            const y = top ? pl.y : layout.height - this.theme.padding - this.theme.participantHeight - 20;
            const cx = pl.centerX;
            const cy = y + this.theme.participantHeight / 2;
            const label = (pl.participant.label || pl.participant.name).replace(/\\n/g, '\n');
            const lines = label.split('\n');

            switch (pl.participant.type) {
                case 'actor':
                    svg += `<circle cx="${cx}" cy="${y + 10}" r="8" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
                    svg += `<line x1="${cx}" y1="${y + 18}" x2="${cx}" y2="${y + 30}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
                    svg += `<line x1="${cx - 10}" y1="${y + 22}" x2="${cx + 10}" y2="${y + 22}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
                    svg += `<line x1="${cx}" y1="${y + 30}" x2="${cx - 8}" y2="${y + 40}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
                    svg += `<line x1="${cx}" y1="${y + 30}" x2="${cx + 8}" y2="${y + 40}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
                    lines.forEach((line: string, j: number) => {
                        svg += `<text x="${cx}" y="${y + 55 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
                    });
                    break;
                case 'boundary':
                    svg += `<line x1="${cx - 20}" y1="${cy}" x2="${cx - 10}" y2="${cy}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
                    svg += `<line x1="${cx - 20}" y1="${cy - 10}" x2="${cx - 20}" y2="${cy + 10}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
                    svg += `<circle cx="${cx}" cy="${cy}" r="14" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
                    lines.forEach((line: string, j: number) => {
                        svg += `<text x="${cx}" y="${y + this.theme.participantHeight + 20 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
                    });
                    break;
                case 'control':
                    svg += `<circle cx="${cx}" cy="${cy}" r="14" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
                    svg += `<path d="M ${cx + 4} ${cy - 18} L ${cx - 4} ${cy - 14} L ${cx + 4} ${cy - 10}" fill="none" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
                    lines.forEach((line: string, j: number) => {
                        svg += `<text x="${cx}" y="${y + this.theme.participantHeight + 20 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
                    });
                    break;
                case 'entity':
                    svg += `<circle cx="${cx}" cy="${cy}" r="14" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
                    svg += `<line x1="${cx - 14}" y1="${cy + 14}" x2="${cx + 14}" y2="${cy + 14}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
                    lines.forEach((line: string, j: number) => {
                        svg += `<text x="${cx}" y="${y + this.theme.participantHeight + 20 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
                    });
                    break;
                case 'database':
                    const dbW = 34;
                    const dbH = 40;
                    const dbY = y;
                    const dbX = cx - dbW / 2;
                    svg += `<path d="M ${dbX} ${dbY + 10} L ${dbX} ${dbY + dbH - 10} A 17 8 0 0 0 ${dbX + dbW} ${dbY + dbH - 10} L ${dbX + dbW} ${dbY + 10} A 17 8 0 0 0 ${dbX} ${dbY + 10} M ${dbX} ${dbY + 10} A 17 8 0 0 1 ${dbX + dbW} ${dbY + 10}" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
                    svg += `<path d="M ${dbX} ${dbY + 10} A 17 8 0 0 0 ${dbX + dbW} ${dbY + 10}" fill="none" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
                    lines.forEach((line: string, j: number) => {
                        svg += `<text x="${cx}" y="${y + this.theme.participantHeight + 20 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
                    });
                    break;
                case 'collections':
                    const colW = 34;
                    const colH = 34;
                    const colY = y + 3;
                    const colX = cx - colW / 2;
                    svg += `<rect x="${colX + 4}" y="${colY - 4}" width="${colW}" height="${colH}" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
                    svg += `<rect x="${colX}" y="${colY}" width="${colW}" height="${colH}" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
                    lines.forEach((line: string, j: number) => {
                        svg += `<text x="${cx}" y="${y + this.theme.participantHeight + 20 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
                    });
                    break;
                case 'queue':
                    const qW = 40;
                    const qH = 40;
                    const qY = y + 3;
                    const qX = cx - qW / 2;
                    const qRx = 5;
                    const qRy = qH / 2;

                    // Body Fill (Left Arc, Top, Right Back Arc, Bottom)
                    svg += `<path d="M ${qX + qW} ${qY} L ${qX} ${qY} A ${qRx} ${qRy} 0 0 0 ${qX} ${qY + qH} L ${qX + qW} ${qY + qH} A ${qRx} ${qRy} 0 0 0 ${qX + qW} ${qY}" fill="${fill}" stroke="none" />`;

                    // Right Face Fill (Full Ellipse)
                    svg += `<ellipse cx="${qX + qW}" cy="${qY + qRy}" rx="${qRx}" ry="${qRy}" fill="${fill}" stroke="none" />`;

                    // Strokes
                    // Body Outline (Top, Left Arc, Bottom) - Open
                    svg += `<path d="M ${qX + qW} ${qY} L ${qX} ${qY} A ${qRx} ${qRy} 0 0 0 ${qX} ${qY + qH} L ${qX + qW} ${qY + qH}" fill="none" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;

                    // Right Face Outline (Full Ellipse)
                    svg += `<ellipse cx="${qX + qW}" cy="${qY + qRy}" rx="${qRx}" ry="${qRy}" fill="none" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;

                    lines.forEach((line: string, j: number) => {
                        svg += `<text x="${cx}" y="${y + this.theme.participantHeight + 20 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
                    });
                    break;
                default:
                    svg += `<rect x="${x}" y="${y}" width="${pl.width}" height="${this.theme.participantHeight}" rx="5" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
                    lines.forEach((line: string, j: number) => {
                        const lineY = lines.length > 1 ? (cy - (lines.length - 1) * 7.5 + j * 15) : cy;
                        svg += `<text x="${cx}" y="${lineY}" text-anchor="middle" dominant-baseline="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
                    });
            }
        };

        layout.participants.forEach(pl => {
            // Skip external participants ([ and ])
            if (pl.participant.name === '[' || pl.participant.name === ']') {
                return;
            }
            draw(pl, true);
            if (!diagram.hideFootbox) {
                draw(pl, false);
            }
        });
        return svg;
    }

    private renderGroups(layout: LayoutResult): string {
        let svg = '';
        layout.groups.forEach(g => {
            svg += `<rect x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" fill="none" stroke="#222" stroke-width="2" rx="5" />`;
            svg += `<path d="M ${g.x} ${g.y} L ${g.x + 70} ${g.y} L ${g.x + 70} ${g.y + 10} L ${g.x + 60} ${g.y + 20} L ${g.x} ${g.y + 20} Z" fill="#eee" stroke="#222" stroke-width="2" />`;
            svg += `<text x="${g.x + 5}" y="${g.y + 15}" font-size="${this.theme.fontSize - 2}" font-weight="bold">${g.type}</text>`;
            if (g.label) svg += `<text x="${g.x + 75}" y="${g.y + 15}" font-size="${this.theme.fontSize - 2}" font-weight="bold">[${g.label}]</text>`;


            // Render group sections (e.g., "else error" in alt blocks)
            g.sections.forEach(section => {
                const sectionY = section.y;
                svg += `<line x1="${g.x}" y1="${sectionY}" x2="${g.x + g.width}" y2="${sectionY}" stroke="#222" stroke-width="1" stroke-dasharray="5,5" />`;
                svg += `<text x="${g.x + 5}" y="${sectionY + 15}" font-size="${this.theme.fontSize - 2}" font-weight="bold">[${section.label}]</text>`;
            });
        });
        return svg;
    }

    private renderNotes(layout: LayoutResult): string {
        let svg = '';
        layout.notes.forEach(nl => {
            this.drawNoteShape(svg, nl.x, nl.y, nl.width, nl.height, nl.note.shape, nl.note.color, nl.note.text);
            svg = this.lastSvg; // Using temp hack until helper refactored to return string
        });
        return svg;
    }

    // ... Stubbing other methods to complete structure ...
    private renderActivations(d: SequenceDiagram, l: LayoutResult): string {
        let svg = '';
        // Sort by level (lowest first) so higher levels render on top
        const sortedActivations = [...l.activations].sort((a, b) => a.activation.level - b.activation.level);
        sortedActivations.forEach(a => {
            const fill = a.activation.color || this.theme.colors.actorFill;
            svg += `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="1" />`;
        });
        return svg;
    }

    private renderReferences(d: SequenceDiagram, l: LayoutResult): string {
        let svg = '';
        l.references.forEach(r => {
            svg += `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${this.theme.colors.defaultFill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
            svg += `<path d="M ${r.x} ${r.y} L ${r.x + 70} ${r.y} L ${r.x + 70} ${r.y + 10} L ${r.x + 60} ${r.y + 20} L ${r.x} ${r.y + 20} Z" fill="#eee" stroke="#222" stroke-width="2" />`;
            svg += `<text x="${r.x + 5}" y="${r.y + 12}" font-size="${this.theme.fontSize - 2}" font-weight="bold">ref</text>`;

            const lines = r.reference.label.split('\n');
            const lineHeight = this.theme.fontSize + 2;
            const totalTextHeight = lines.length * lineHeight;

            // Header height is approx 20px (path goes to y+20). Add padding.
            const headerHeight = 25;

            // Center vertically, but ensure we don't overlap the header
            let startY = r.y + r.height / 2 - totalTextHeight / 2 + lineHeight / 2;
            if (startY < r.y + headerHeight + lineHeight / 2) {
                startY = r.y + headerHeight + lineHeight / 2;
            }

            lines.forEach((line, i) => {
                svg += `<text x="${r.x + r.width / 2}" y="${startY + i * lineHeight}" text-anchor="middle" dominant-baseline="middle" font-size="${this.theme.fontSize}">${line}</text>`;
            });
        });
        return svg;
    }

    private renderMessages(d: SequenceDiagram, l: LayoutResult): string {
        let svg = '';
        l.messages.forEach(ml => {
            const m = ml.message;
            const strokeColor = this.normalizeColor(m.color, this.theme.colors.defaultStroke);
            const strokeDash = ml.lineStyle === 'dashed' ? '4' : '0';
            const safeColor = strokeColor.replace('#', '');

            // Markers
            const getMarker = (type: ArrowHead, isStart: boolean) => {
                if (type === 'none') return 'none';
                let id = '';
                if (type === 'default') id = isStart ? `arrowhead-reverse-${safeColor}` : `arrowhead-${safeColor}`;
                else if (type === 'open') id = isStart ? `arrowhead-open-reverse-${safeColor}` : `arrowhead-open-${safeColor}`;
                else if (type === 'half') id = isStart ? `halfhead-reverse-${safeColor}` : `halfhead-${safeColor}`;
                else if (type === 'circle') id = `circlehead-${safeColor}`;
                else if (type === 'arrow-circle') id = isStart ? `arrowhead-circle-reverse-${safeColor}` : `arrowhead-circle-${safeColor}`;
                else if (type === 'lost') id = `losthead-${safeColor}`;
                else if (type === 'found') id = `circlehead-${safeColor}`;
                return id ? `url(#${id})` : 'none';
            };

            const markerEnd = getMarker(m.arrowHead || 'default', false);
            const markerStart = getMarker(m.startHead || (m.bidirectional ? 'default' : 'none'), true);

            // Draw line
            if (ml.points.length > 2) {
                // Polyline for self-message
                const dPath = `M ${ml.points.map(p => `${p.x} ${p.y}`).join(' L ')}`;
                svg += `<path d="${dPath}" fill="none" stroke="${strokeColor}" stroke-width="1.5" stroke-dasharray="${strokeDash}" marker-end="${markerEnd}" marker-start="${markerStart}" />`;
            } else {
                const [p1, p2] = ml.points;
                svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${strokeColor}" stroke-width="1.5" stroke-dasharray="${strokeDash}" marker-end="${markerEnd}" marker-start="${markerStart}" />`;
            }

            // Draw text
            const text = m.number ? `[${m.number}] ${m.text}` : m.text;
            const lines = text.split('\n');
            const anchor = ml.points.length > 2 ? 'start' : 'middle';

            lines.forEach((line, i) => {
                const lineY = ml.labelPosition.y - (lines.length - 1 - i) * 15 - 5;
                // Adjust Y for self-message? Self message label position in LayoutEngine was: y + 10...
                // Wait, LayoutEngine `labelPosition` for self message was `y + 10`.
                // Standard message was `y`.
                // Here we are subtracting.
                // Let's trust LayoutEngine provided the "Center" or "Start" of the text block.

                let y = lineY;
                if (ml.points.length > 2) {
                    // Self message text logic in original renderer:
                    // y + 10 + i * 20
                    y = ml.labelPosition.y + i * 20;
                }

                svg += `<text x="${ml.labelPosition.x}" y="${y}" text-anchor="${anchor}" font-size="${this.theme.fontSize - 2}" fill="${strokeColor}">${line}</text>`;
            });
        });
        return svg;
    }

    private renderDividers(d: SequenceDiagram, l: LayoutResult): string {
        let svg = '';
        l.dividers.forEach(div => {
            const y = div.y;
            svg += `<line x1="${this.theme.padding}" y1="${y}" x2="${l.width - this.theme.padding}" y2="${y}" stroke="${this.theme.colors.defaultStroke}" stroke-width="1" />`;
            svg += `<line x1="${this.theme.padding}" y1="${y + 4}" x2="${l.width - this.theme.padding}" y2="${y + 4}" stroke="${this.theme.colors.defaultStroke}" stroke-width="1" />`;
            if (div.label) {
                const labelW = div.label.length * 9 + 20;
                svg += `<rect x="${l.width / 2 - labelW / 2}" y="${y - 10}" width="${labelW}" height="20" fill="white" stroke="${this.theme.colors.defaultStroke}" stroke-width="1" />`;
                svg += `<text x="${l.width / 2}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="${this.theme.fontSize - 2}" font-weight="bold">${div.label}</text>`;
            }
        });
        return svg;
    }

    private renderDelays(d: SequenceDiagram, l: LayoutResult): string {
        let svg = '';
        l.delays.forEach(delay => {
            const y = delay.y;
            const midX = l.width / 2;
            const dotGap = 10;
            const dotCount = 5;

            // Render text if present
            if (delay.text) {
                const textW = delay.text.length * 8 + 20;
                svg += `<text x="${midX}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="${this.theme.fontSize}" fill="${this.theme.colors.text}">${delay.text}</text>`;

                // Dots on the left
                for (let i = 0; i < dotCount; i++) {
                    const dx = midX - (textW / 2) - 10 - i * dotGap;
                    svg += `<circle cx="${dx}" cy="${y}" r="1.5" fill="${this.theme.colors.text}" />`;
                }
                // Dots on the right
                for (let i = 0; i < dotCount; i++) {
                    const dx = midX + (textW / 2) + 10 + i * dotGap;
                    svg += `<circle cx="${dx}" cy="${y}" r="1.5" fill="${this.theme.colors.text}" />`;
                }
            } else {
                // Just dots across
                for (let i = -10; i <= 10; i++) {
                    if (i === 0) continue;
                    svg += `<circle cx="${midX + i * dotGap}" cy="${y}" r="1.5" fill="${this.theme.colors.text}" />`;
                }
            }
        });
        return svg;
    }

    private renderTimeConstraints(l: LayoutResult): string {
        let svg = '';
        l.timeConstraints.forEach(tc => {
            const x = tc.x;
            const y1 = tc.startY;
            const y2 = tc.endY;
            const color = this.theme.colors.defaultStroke;

            // Draw vertical line
            svg += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${color}" stroke-width="1.5" />`;

            // Draw arrowheads on both ends
            // Top arrowhead (pointing up)
            svg += `<polygon points="${x} ${y1}, ${x - 4} ${y1 + 8}, ${x + 4} ${y1 + 8}" fill="${color}" />`;
            // Bottom arrowhead (pointing down)
            svg += `<polygon points="${x} ${y2}, ${x - 4} ${y2 - 8}, ${x + 4} ${y2 - 8}" fill="${color}" />`;

            // Draw label
            if (tc.label) {
                const midY = (y1 + y2) / 2;
                svg += `<text x="${x + 10}" y="${midY}" text-anchor="start" dominant-baseline="middle" font-size="${this.theme.fontSize - 2}" fill="${color}">${tc.label}</text>`;
            }
        });
        return svg;
    }

    // Helpers
    private normalizeColor(color: string | undefined, defaultColor: string): string {
        if (!color) return defaultColor;
        if (color.startsWith('#')) {
            // Check if it is a valid hex color (3 to 8 hex digits)
            if (/^#[0-9a-fA-F]{3,8}$/.test(color)) {
                return color;
            }
            // Otherwise assume it is a named color with # prefix (common in PlantUML)
            return color.substring(1);
        }
        return color;
    }

    private formatRichText(text: string): string {
        let escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

        escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<tspan font-weight="bold">$1</tspan>');
        escaped = escaped.replace(/\/\/(.*?)\/\//g, '<tspan font-style="italic">$1</tspan>');
        escaped = escaped.replace(/""(.*?)""/g, '<tspan font-family="monospace">$1</tspan>');
        escaped = escaped.replace(/--(.*?)--/g, '<tspan text-decoration="line-through">$1</tspan>');
        escaped = escaped.replace(/__(.*?)__/g, '<tspan text-decoration="underline">$1</tspan>');
        escaped = escaped.replace(/~~(.*?)~~/g, '<tspan style="text-decoration: underline; text-decoration-style: wavy">$1</tspan>');

        return escaped;
    }

    private lastSvg: string = '';
    private drawNoteShape(svg: string, x: number, y: number, w: number, h: number, shape: any, color: string | undefined, text: string) {
        let noteSvg = '';
        const fill = this.normalizeColor(color, this.theme.colors.noteFill);
        const borderColor = this.theme.colors.defaultStroke;

        const effectiveShape = shape || 'folder';

        if (effectiveShape === 'hexagon') {
            const pointDepth = 10;
            const points = [
                `${x + pointDepth},${y}`,
                `${x + w - pointDepth},${y}`,
                `${x + w},${y + h / 2}`,
                `${x + w - pointDepth},${y + h}`,
                `${x + pointDepth},${y + h}`,
                `${x},${y + h / 2}`
            ].join(' ');
            noteSvg += `<polygon points="${points}" fill="${fill}" stroke="${borderColor}" stroke-width="1.5" />`;
        } else if (effectiveShape === 'bubble') {
            const r = h / 2;
            noteSvg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}" stroke="${borderColor}" stroke-width="1.5" />`;
        } else if (effectiveShape === 'rectangle') {
            noteSvg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${borderColor}" stroke-width="1.5" />`;
        } else {
            // Default to 'folder' (dog-ear)
            const foldSize = 10;
            const notePath = `
                M ${x} ${y}
                L ${x + w - foldSize} ${y}
                L ${x + w} ${y + foldSize}
                L ${x + w} ${y + h}
                L ${x} ${y + h}
                Z
            `;
            noteSvg += `<path d="${notePath}" fill="${fill}" stroke="${borderColor}" stroke-width="1.5" />`;

            const foldPath = `
                M ${x + w - foldSize} ${y}
                L ${x + w - foldSize} ${y + foldSize}
                L ${x + w} ${y + foldSize}
            `;
            noteSvg += `<path d="${foldPath}" fill="none" stroke="${borderColor}" stroke-width="1.5" />`;
        }

        const lines = text.split('\n');
        lines.forEach((line, i) => {
            noteSvg += `<text x="${x + w / 2}" y="${y + 20 + i * 20}" text-anchor="middle" font-size="${this.theme.fontSize}" fill="${this.theme.colors.text}">${this.formatRichText(line)}</text>`;
        });

        this.lastSvg = svg + noteSvg;
    }
}
