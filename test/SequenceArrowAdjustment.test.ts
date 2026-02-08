import { describe, it, expect } from 'vitest';
import { SequenceParser } from '../src/diagrams/sequence/SequenceParser';
import { LayoutEngine } from '../src/diagrams/sequence/SequenceLayout';
import { defaultTheme } from '../src/diagrams/sequence/SequenceTheme';

describe('Sequence Diagram Arrow Adjustment', () => {
    it('should adjust arrow endpoints to activation box edges', () => {
        const content = `
participant A
participant B
A -> B ++ : message 1
        `;
        const parser = new SequenceParser();
        const diagram = parser.parse(content);
        const engine = new LayoutEngine(defaultTheme);
        const layout = engine.calculateLayout(diagram);

        const aLayout = layout.participants.find(p => p.participant.name === 'A')!;
        const msg1 = layout.messages.find(m => m.message.text === 'message 1')!;
        const bActivation0 = layout.activations.find(a => a.activation.participantName === 'B' && a.activation.level === 0)!;

        expect(msg1.points[0].x).toBe(aLayout.centerX);
        expect(msg1.points[1].x).toBe(bActivation0.x);
    });

    it('should correctly handle multi-participant nested activations', () => {
        const content = `
participant P1
participant P2
participant P3
P1 -> P2 ++ : m1
P2 -> P3 ++ : m2
P3 -> P2 ++ : m3
        `;
        const parser = new SequenceParser();
        const diagram = parser.parse(content);
        const engine = new LayoutEngine(defaultTheme);
        const layout = engine.calculateLayout(diagram);

        const msg3 = layout.messages.find(m => m.message.text === 'm3')!;
        const p2Activation1 = layout.activations.find(a => a.activation.participantName === 'P2' && a.activation.level === 1)!;
        const p3Activation0 = layout.activations.find(a => a.activation.participantName === 'P3' && a.activation.level === 0)!;

        // msg3 is P3 (right) to P2 (left) - Right to Left
        // Start from P3's left edge, end at P2's level 1 right edge
        expect(msg3.points[0].x).toBe(p3Activation0.x);
        expect(msg3.points[1].x).toBe(p2Activation1.x + p2Activation1.width);
    });

    it('should handle self-message with level increase (++)', () => {
        const content = `
participant A
participant B
A -> B ++ : msg1
B -> B ++ : msg2
        `;
        const parser = new SequenceParser();
        const diagram = parser.parse(content);
        const engine = new LayoutEngine(defaultTheme);
        const layout = engine.calculateLayout(diagram);

        const msg2 = layout.messages.find(m => m.message.text === 'msg2')!;
        const bActivation0 = layout.activations.find(a => a.activation.participantName === 'B' && a.activation.level === 0)!;
        const bActivation1 = layout.activations.find(a => a.activation.participantName === 'B' && a.activation.level === 1)!;

        expect(msg2.points[0].x).toBe(bActivation0.x + bActivation0.width);
        expect(msg2.points[3].x).toBe(bActivation1.x + bActivation1.width);
    });

    it('should handle self-message with level decrease (--)', () => {
        const content = `
participant A
participant B
A -> B ++ : msg1
B -> B ++ : msg2
B -> B -- : msg3
        `;
        const parser = new SequenceParser();
        const diagram = parser.parse(content);
        const engine = new LayoutEngine(defaultTheme);
        const layout = engine.calculateLayout(diagram);

        const msg3 = layout.messages.find(m => m.message.text === 'msg3')!;
        const bActivation0 = layout.activations.find(a => a.activation.participantName === 'B' && a.activation.level === 0)!;
        const bActivation1 = layout.activations.find(a => a.activation.participantName === 'B' && a.activation.level === 1)!;

        expect(msg3.points[0].x).toBe(bActivation1.x + bActivation1.width);
        expect(msg3.points[3].x).toBe(bActivation0.x + bActivation0.width);
    });

    it('should start first self-activation message from participant center', () => {
        const content = `
participant A
A -> A ++ : m1
A -> A ++ : m2
        `;
        const parser = new SequenceParser();
        const diagram = parser.parse(content);
        const engine = new LayoutEngine(defaultTheme);
        const layout = engine.calculateLayout(diagram);

        const aLayout = layout.participants.find(p => p.participant.name === 'A')!;
        const m1 = layout.messages.find(m => m.message.text === 'm1')!;
        const aActivation0 = layout.activations.find(a => a.activation.participantName === 'A' && a.activation.level === 0)!;

        // m1 should start from centerX and end at activation0 edge
        expect(m1.points[0].x).toBe(aLayout.centerX);
        expect(m1.points[3].x).toBe(aActivation0.x + aActivation0.width);

        // m1 arrow tip (points[3]) should align with aActivation0 top (y)
        expect(m1.points[3].y).toBe(aActivation0.y);
    });
});
