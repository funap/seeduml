import { describe, it, expect } from 'vitest';
import { SequenceParser } from '../src/diagrams/sequence/SequenceParser';
import { LayoutEngine } from '../src/diagrams/sequence/SequenceLayout';
import { defaultTheme } from '../src/diagrams/sequence/SequenceTheme';

describe('Sequence Diagram Activation Length', () => {
    it('should have sufficient height for self-activation ended by deactivate', () => {
        const content = `
participant a
a->a++
deactivate a
        `;
        const parser = new SequenceParser();
        const diagram = parser.parse(content);
        const engine = new LayoutEngine(defaultTheme);
        const layout = engine.calculateLayout(diagram);

        const aAct = layout.activations.find(a => a.activation.participantName === 'a')!;

        // Logging for analysis in case it fails
        console.log('Activation startStep:', aAct.activation.startStep);
        console.log('Activation endStep:', aAct.activation.endStep);
        console.log('Activation Y:', aAct.y);
        console.log('Activation Height:', aAct.height);

        // A self-activation should at least cover its own return loop (25px) 
        // plus some padding or the next step's height.
        // If it starts at y+25 and ends at stepY[step+1], and step gap is 45, height is 20.
        expect(aAct.height).toBeGreaterThanOrEqual(20);
    });

    it('should have full step height for self-activation ended by shorthand --', () => {
        const content = `
participant a
a->a++
a->a--
        `;
        const parser = new SequenceParser();
        const diagram = parser.parse(content);
        const engine = new LayoutEngine(defaultTheme);
        const layout = engine.calculateLayout(diagram);

        const aAct = layout.activations.find(a => a.activation.participantName === 'a')!;

        // y = stepY[1] + 25
        // yEnd = stepY[2] + 25
        // height = stepY[2] - stepY[1]
        // stepHeights[1] is 45 (25+10 loop + 10 padding)
        expect(aAct.height).toBeGreaterThanOrEqual(40);
    });
    it('should have sufficient height for cross-participant activation ended by deactivate', () => {
        const content = `
participant a
participant b
a->b++
deactivate b
        `;
        const parser = new SequenceParser();
        const diagram = parser.parse(content);
        const engine = new LayoutEngine(defaultTheme);
        const layout = engine.calculateLayout(diagram);

        const bAct = layout.activations.find(a => a.activation.participantName === 'b')!;

        // For cross-message, y = stepY[0], yEnd = stepY[1]
        // Default gap is 60.
        expect(bAct.height).toBeGreaterThanOrEqual(50);
    });
    it('should align destroy mark with the preceding message arrow', () => {
        const content = `
A -> B : DoWork
activate B
B --> A: WorkDone
destroy B
        `;
        const parser = new SequenceParser();
        const diagram = parser.parse(content);
        const engine = new LayoutEngine(defaultTheme);
        const layout = engine.calculateLayout(diagram);

        const bAct = layout.activations.find(a => a.activation.participantName === 'B')!;
        const workDoneMsg = layout.messages.find(m => m.message.text === 'WorkDone')!;

        // The destroy mark (end of activation) should be at the same height as the message
        // For messages, y is the vertical position of the arrow.
        // For activations, height is (endStepY - startStepY).

        console.log('WorkDone Msg Y:', workDoneMsg.y);
        console.log('B Activation Y:', bAct.y);
        console.log('B Activation Height:', bAct.height);
        console.log('B Activation End Y:', bAct.y + bAct.height);

        // We expect the end of the activation (where the X is) to be at the same Y as the message
        expect(bAct.y + bAct.height).toBeCloseTo(workDoneMsg.y, 0);
    });

    it('should align deactivate with the preceding message arrow', () => {
        const content = `
A -> B: << createRequest >>
activate B
B --> A: RequestCreated
deactivate B
        `;
        const parser = new SequenceParser();
        const diagram = parser.parse(content);
        const engine = new LayoutEngine(defaultTheme);
        const layout = engine.calculateLayout(diagram);

        const bAct = layout.activations.find(a => a.activation.participantName === 'B')!;
        const requestCreatedMsg = layout.messages.find(m => m.message.text === 'RequestCreated')!;

        console.log('RequestCreated Msg Y:', requestCreatedMsg.y);
        console.log('B Activation End Y:', bAct.y + bAct.height);

        // We expect the end of the activation (deactivate) to be at the same Y as the message
        expect(bAct.y + bAct.height).toBeCloseTo(requestCreatedMsg.y, 0);
    });

    it('should NOT align deactivate with the preceding return message if receiver', () => {
        const content = `
activate A
A -> B: << createRequest >>
activate B

B --> A: RequestCreated
deactivate B
deactivate A
        `;
        const parser = new SequenceParser();
        const diagram = parser.parse(content);
        const engine = new LayoutEngine(defaultTheme);
        const layout = engine.calculateLayout(diagram);

        const aAct = layout.activations.find(a => a.activation.participantName === 'A')!;
        const requestCreatedMsg = layout.messages.find(m => m.message.text === 'RequestCreated')!;

        console.log('RequestCreated Msg Y:', requestCreatedMsg.y);
        console.log('A Activation End Y:', aAct.y + aAct.height);

        // We expect the end of the activation for A to be BELOW the message
        expect(aAct.y + aAct.height).toBeGreaterThan(requestCreatedMsg.y);
    });

    it('should have different heights for consecutive deactivations of the same participant', () => {
        const content = `
participant User

User -> A: DoWork
activate A #FFBBBB

A -> A: Internal call
activate A #DarkSalmon

A -> B: << createRequest >>
activate B

B --> A: RequestCreated
deactivate B
deactivate A

A -> User: Done
deactivate A
        `;
        const parser = new SequenceParser();
        const diagram = parser.parse(content);
        const engine = new LayoutEngine(defaultTheme);
        const layout = engine.calculateLayout(diagram);

        const aActivations = layout.activations.filter(a => a.activation.participantName === 'A').sort((a, b) => a.activation.level - b.activation.level);
        const aLevel0 = aActivations[0];
        const aLevel1 = aActivations[1];

        const doneMsg = layout.messages.find(m => m.message.text === 'Done')!;

        console.log('A Level 1 End Y (first deactivate A):', aLevel1.y + aLevel1.height);
        console.log('Done Msg Y:', doneMsg.y);
        console.log('A Level 0 End Y (last deactivate A):', aLevel0.y + aLevel0.height);

        // First deactivate A (level 1) should be at its own step (not aligned)
        // Last deactivate A (level 0) should be aligned with "Done" message

        expect(aLevel0.y + aLevel0.height).toBeCloseTo(doneMsg.y, 0);
        expect(aLevel1.y + aLevel1.height).toBeLessThan(aLevel0.y + aLevel0.height);
    });

    it('should NOT align deactivate with a preceding return message from outside', () => {
        const content = `
[-> A: DoWork
activate A #FFBBBB

A -> A: Internal call
activate A #DarkSalmon

A ->] : << createRequest >>

A <--] : RequestCreated
deactivate A

[<- A: Done
deactivate A
        `;
        const parser = new SequenceParser();
        const diagram = parser.parse(content);
        const engine = new LayoutEngine(defaultTheme);
        const layout = engine.calculateLayout(diagram);

        const aActivations = layout.activations.filter(a => a.activation.participantName === 'A').sort((a, b) => a.activation.level - b.activation.level);
        const aLevel0 = aActivations[0];
        const aLevel1 = aActivations[1];

        const requestCreatedMsg = layout.messages.find(m => m.message.text === 'RequestCreated')!;
        const doneMsg = layout.messages.find(m => m.message.text === 'Done')!;

        console.log('RequestCreated Msg Y:', requestCreatedMsg.y);
        console.log('A Level 1 End Y (deactivate A after RequestCreated):', aLevel1.y + aLevel1.height);
        console.log('Done Msg Y:', doneMsg.y);
        console.log('A Level 0 End Y (deactivate A after Done):', aLevel0.y + aLevel0.height);

        // deactivate A after A <--] should be BELOW the message (not aligned)
        expect(aLevel1.y + aLevel1.height).toBeGreaterThan(requestCreatedMsg.y);

        // deactivate A after [<- A should be ALIGNED with the message
        expect(aLevel0.y + aLevel0.height).toBeCloseTo(doneMsg.y, 0);
    });
});
