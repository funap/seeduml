import { Parser } from '../../core/Parser';
import { SequenceDiagram, ArrowHead } from './SequenceDiagram';

export class SequenceParser implements Parser {
    parse(content: string): SequenceDiagram {
        const diagram = new SequenceDiagram();
        const lines = content.split('\n');

        let pendingRef: { participants: string[], label: string[] } | null = null;
        let pendingNote: { text: string[], position: any, participants: string[], color?: string, shape: any } | null = null;
        let lastMessageStep = -1;
        let lastMessageFrom = '';
        let lastMessageTo = '';
        let lastMessageType: string = '';
        let lastActivationStep = new Map<string, number>();

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            const originalLine = line; // keep original for error context if needed
            line = line.trim();
            // Ignore empty lines, comments (@), and pragma directives
            if (!line || line.startsWith('@') || line.startsWith('!pragma')) continue;



            if (pendingNote) {
                const lowerLine = line.toLowerCase();
                const isEndNote = lowerLine.startsWith('end note');
                const isEndHnote = lowerLine === 'end hnote' || lowerLine === 'endhnote';
                const isEndRnote = lowerLine === 'end rnote' || lowerLine === 'endrnote';
                const isEndBnote = lowerLine === 'end bnote' || lowerLine === 'endbnote';

                if (isEndNote || isEndHnote || isEndRnote || isEndBnote) {
                    const normPos = pendingNote.position.toLowerCase();
                    let associationStep: number | undefined;
                    if (pendingNote.participants.length === 0) {
                        if ((normPos === 'right' || normPos === 'left') && lastMessageFrom && lastMessageTo) {
                            const idxFrom = diagram.participants.findIndex(p => p.name === lastMessageFrom);
                            const idxTo = diagram.participants.findIndex(p => p.name === lastMessageTo);
                            if (idxFrom !== -1 && idxTo !== -1) {
                                const pFrom = diagram.participants[idxFrom];
                                const pTo = diagram.participants[idxTo];
                                let isFromLeftOfTo = idxFrom < idxTo;
                                if (pFrom.order !== undefined && pTo.order !== undefined) {
                                    isFromLeftOfTo = pFrom.order < pTo.order;
                                }
                                if (normPos === 'left') {
                                    pendingNote.participants = [isFromLeftOfTo ? lastMessageFrom : lastMessageTo];
                                } else {
                                    pendingNote.participants = [isFromLeftOfTo ? lastMessageTo : lastMessageFrom];
                                }
                            } else {
                                pendingNote.participants = [lastMessageTo];
                            }
                            if (lastMessageStep !== -1) {
                                associationStep = lastMessageStep;
                            }
                        }
                    }
                    const text = pendingNote.text.join('\n').replace(/\\n/g, '\n');
                    diagram.addNote(text, pendingNote.position, pendingNote.participants, pendingNote.color, pendingNote.shape, associationStep);
                    pendingNote = null;
                } else {
                    pendingNote.text.push(originalLine);
                }
                continue;
            }

            if (pendingRef) {
                if (line.toLowerCase().startsWith('end ref')) {
                    diagram.addReference(pendingRef.participants, pendingRef.label.join('\n'));
                    pendingRef = null;
                } else {
                    pendingRef.label.push(originalLine);
                }
                continue;
            }

            if (line.startsWith("'")) continue;

            // Handle "/" prefix - means "at same step/height as previous"
            let sameStep = false;
            if (line.startsWith('/')) {
                sameStep = true;
                line = line.substring(1).trim();
                // Rewind the step counter by one so this element uses the same step
                diagram.rewindStep();
            }

            // Handle explicit create command
            // create <participant>
            // create <type> <participant>
            const createMatch = line.match(/^create\s+(?:(actor|boundary|control|entity|database|collections)\s+)?(\w+)$/i);
            if (createMatch) {
                const [, type, name] = createMatch;
                // Always add participant, using specified type or default
                diagram.addParticipant(name, type as any);
                // Mark this participant to be created at the next message step
                // We pass the current step, which will be used when a message targets this participant
                diagram.create(name, diagram.getCurrentStep());
                continue;
            }

            // Handle explicit action commands: activate, deactivate, destroy
            // Using a more robust regex for participant names
            const actionMatch = line.match(/^(activate|deactivate|destroy)\s+(".*?"|\w+)(?:\s+(#\w+))?$/i);
            if (actionMatch) {
                let [, action, rawName, color] = actionMatch;
                const name = rawName.replace(/^"(.*)"$/, '$1');

                // Sanitize color
                if (color && color.startsWith('#')) {
                    const hexContent = color.substring(1);
                    const isHex = /^[0-9A-Fa-f]+$/.test(hexContent) && [3, 4, 6, 8].includes(hexContent.length);
                    if (!isHex) color = hexContent;
                }

                const act = action.toLowerCase();
                if (act === 'activate') {
                    if (name === lastMessageTo && lastMessageStep !== -1) {
                        diagram.activate(name, lastMessageStep, lastMessageStep, color);
                        lastActivationStep.set(name, lastMessageStep);
                    } else {
                        const step = diagram.nextStep();
                        diagram.activate(name, step, undefined, color);
                        lastActivationStep.set(name, step);
                    }
                } else if (act === 'deactivate') {
                    // For deactivation on a separate line, we want it to align with the last message if applicable
                    // but ONLY if the last message is strictly after the activation started.
                    // Refined: align with return messages only if sender; align with arrows for both sender/receiver.
                    let shouldAlign = false;
                    if (lastMessageStep !== -1 && lastMessageStep > (lastActivationStep.get(name) ?? -1)) {
                        if (lastMessageType === 'arrow') {
                            shouldAlign = (name === lastMessageTo || name === lastMessageFrom);
                        } else if (lastMessageType === 'dotted') {
                            shouldAlign = (name === lastMessageFrom);
                        }
                    }

                    if (shouldAlign) {
                        diagram.deactivate(name, lastMessageStep);
                    } else {
                        diagram.deactivate(name, diagram.nextStep());
                    }
                } else if (act === 'destroy') {
                    let shouldAlign = false;
                    if (lastMessageStep !== -1 && lastMessageStep > (lastActivationStep.get(name) ?? -1)) {
                        if (lastMessageType === 'arrow') {
                            shouldAlign = (name === lastMessageTo || name === lastMessageFrom);
                        } else if (lastMessageType === 'dotted') {
                            shouldAlign = (name === lastMessageFrom);
                        }
                    }

                    if (shouldAlign) {
                        diagram.destroy(name, lastMessageStep);
                    } else {
                        diagram.destroy(name, diagram.nextStep());
                    }
                }
                continue;
            }

            // Handle time constraints: {tag1} <-> {tag2} : label
            const timeConstraintMatch = line.match(/^\{(\w+)\}\s*<->\s*\{(\w+)\}(?:\s*:\s*(.*))?$/);
            if (timeConstraintMatch) {
                const [, startTag, endTag, label] = timeConstraintMatch;
                diagram.addTimeConstraint(startTag, endTag, label || '');
                continue;
            }

            // Handle delays ... or ...label...
            const delayMatch = line.match(/^\.\.\.(?:\s*(.*?)\s*\.\.\.)?$/);
            if (delayMatch) {
                const [, text] = delayMatch;
                diagram.addDelay(text || undefined);
                continue;
            }

            // Comprehensive Arrow Parsing
            // Groups: tag, from, startHeads, line1, msgColor, line2, endHeads, to, shorthand, autoActivColor, text
            // Support [ and ] for messages from/to outside the diagram
            // Support {tag} prefix
            const arrowMatch = line.match(/^(?:\{(\w+)\}\s+)?(".*?"|\w+|x|\[|\])?\s*([<ox\\/]*)([-.]+)(?:\[(#\w+)\])?([-.]*)([>ox\\/]*)?\s*(".*?"|\w+|x|\[|\])?\s*(--\+\+|\+\+--|--|\+\+|\*\*|!!)?(?:\s+(#\w+))?(?:\s*:\s*(.*))?$/i);
            if (arrowMatch) {
                let [, tag, from, headStartStr, line1, msgColor, line2, headEndStr, to, shorthand, autoActivColor, text] = arrowMatch;
                text = text || '';
                const lineFull = line1 + (line2 || '');

                if (lineFull.length > 0) {
                    // Handle [ and ] as external participants (messages from/to outside)
                    if (from) from = from.replace(/^"(.*)"$/, '$1');
                    if (to) to = to.replace(/^"(.*)"$/, '$1');

                    // If from or to is missing, check for [ or ]
                    if (!from || from === '[') from = '[';
                    if (!to || to === ']') to = ']';

                    const isDotted = lineFull.includes('..') || lineFull.includes('--');
                    let isBidirectional = headStartStr.includes('<') && (headEndStr || '').includes('>');

                    const mapHead = (s: string, isStart: boolean): ArrowHead => {
                        if (!s) return 'none';
                        if (s === '>') return 'default';
                        if (s === '<') return 'default';
                        if (s === '>>') return 'open';
                        if (s === '<<') return 'open';
                        if (s === '\\' || s === '/') return 'half';
                        if (s === '\\\\' || s === '//') return 'open';
                        if (s.includes('x')) return 'lost';
                        if (s.includes('o')) {
                            // In PlantUML ->o is specialized.
                            return 'arrow-circle';
                        }
                        return 'default';
                    };

                    let arrowHead = mapHead(headEndStr || '', false);
                    let startHead = mapHead(headStartStr || '', true);

                    // Special cases
                    if (headEndStr === 'x') arrowHead = 'lost';
                    if (from === 'x') startHead = 'found';

                    const normalizedText = text.replace(/\\n/g, '\n');
                    const step = diagram.addMessage(from, to, normalizedText, isDotted ? 'dotted' : 'arrow', arrowHead, msgColor, isBidirectional, startHead);

                    // Register tagged step if {tag} was present
                    if (tag) {
                        diagram.addTaggedStep(tag, step);
                    }

                    // Identify semantic sender and receiver for alignment logic
                    // If target head is default/open/half/arrow-circle and start head is none, standard: from -> to
                    // If start head is default/open/half/arrow-circle and target head is none, reversed: to -> from
                    let semanticFrom = from;
                    let semanticTo = to;

                    const isHead = (h: ArrowHead) => ['default', 'open', 'half', 'arrow-circle'].includes(h);

                    if (isHead(startHead) && !isHead(arrowHead)) {
                        semanticFrom = to;
                        semanticTo = from;
                    } else if (isHead(arrowHead) && !isHead(startHead)) {
                        semanticFrom = from;
                        semanticTo = to;
                    }

                    lastMessageStep = step;
                    lastMessageFrom = semanticFrom;
                    lastMessageTo = semanticTo;
                    lastMessageType = isDotted ? 'dotted' : 'arrow';

                    // Handle combined and single shorthands
                    if (shorthand === '++') {
                        // Sanitize activation color
                        if (autoActivColor && autoActivColor.startsWith('#')) {
                            const hexContent = autoActivColor.substring(1);
                            const isHex = /^[0-9A-Fa-f]+$/.test(hexContent) && [3, 4, 6, 8].includes(hexContent.length);
                            if (!isHex) {
                                autoActivColor = hexContent;
                            }
                        }
                        diagram.activate(to, step, step, autoActivColor);
                        lastActivationStep.set(to, step);
                    } else if (shorthand === '--') {
                        diagram.deactivate(from, step, step);
                    } else if (shorthand === '--++') {
                        // Deactivate sender, activate receiver
                        diagram.deactivate(from, step, step);
                        // Sanitize activation color
                        if (autoActivColor && autoActivColor.startsWith('#')) {
                            const hexContent = autoActivColor.substring(1);
                            const isHex = /^[0-9A-Fa-f]+$/.test(hexContent) && [3, 4, 6, 8].includes(hexContent.length);
                            if (!isHex) {
                                autoActivColor = hexContent;
                            }
                        }
                        diagram.activate(to, step, step, autoActivColor);
                        lastActivationStep.set(to, step);
                    } else if (shorthand === '++--') {
                        // Activate sender, deactivate receiver (less common)
                        // Sanitize activation color
                        if (autoActivColor && autoActivColor.startsWith('#')) {
                            const hexContent = autoActivColor.substring(1);
                            const isHex = /^[0-9A-Fa-f]+$/.test(hexContent) && [3, 4, 6, 8].includes(hexContent.length);
                            if (!isHex) {
                                autoActivColor = hexContent;
                            }
                        }
                        diagram.activate(from, step, step, autoActivColor);
                        lastActivationStep.set(from, step);
                        diagram.deactivate(to, step, step);
                    } else if (shorthand === '**') {
                        diagram.create(to, step);
                    } else if (shorthand === '!!') {
                        diagram.destroy(to, step);
                    }
                    continue;
                }
            }

            // Handle notes
            // note (left|right|over|across) [of Participant] [#color] [: text]
            // hnote, rnote, bnote
            const noteMatch = line.match(/^(h|r|b)?note\s+(left|right|over|across)(?:\s+(?:of\s+)?([^#:]+))?\s*(#\w+)?\s*(?::\s*(.*))?$/i);
            if (noteMatch) {
                let [, shapeType, position, participantsStr, color, text] = noteMatch;
                let participants: string[] = [];
                if (participantsStr && participantsStr.trim()) {
                    participants = participantsStr.split(',').map(p => p.trim().replace(/^"(.*)"$/, '$1'));
                }

                let shape: 'rectangle' | 'hexagon' | 'bubble' | 'folder' = 'folder';
                if (shapeType === 'h') shape = 'hexagon';
                else if (shapeType === 'r') shape = 'rectangle';
                else if (shapeType === 'b') shape = 'bubble';

                if (text !== undefined) {
                    // Single line note
                    const normPos = position.toLowerCase();
                    let associationStep: number | undefined;
                    if (participants.length === 0) {
                        if ((normPos === 'right' || normPos === 'left') && lastMessageFrom && lastMessageTo) {
                            const idxFrom = diagram.participants.findIndex(p => p.name === lastMessageFrom);
                            const idxTo = diagram.participants.findIndex(p => p.name === lastMessageTo);
                            if (idxFrom !== -1 && idxTo !== -1) {
                                const pFrom = diagram.participants[idxFrom];
                                const pTo = diagram.participants[idxTo];
                                let isFromLeftOfTo = idxFrom < idxTo;
                                if (pFrom.order !== undefined && pTo.order !== undefined) {
                                    isFromLeftOfTo = pFrom.order < pTo.order;
                                }
                                if (normPos === 'left') {
                                    participants = [isFromLeftOfTo ? lastMessageFrom : lastMessageTo];
                                } else {
                                    participants = [isFromLeftOfTo ? lastMessageTo : lastMessageFrom];
                                }
                            } else {
                                participants = [lastMessageTo];
                            }
                            if (lastMessageStep !== -1) {
                                associationStep = lastMessageStep;
                            }
                        }
                    }
                    const normalizedText = text.replace(/\\n/g, '\n');
                    diagram.addNote(normalizedText, position.toLowerCase() as any, participants, color, shape, associationStep);
                } else {
                    // Multi-line note start
                    pendingNote = { text: [], position: position.toLowerCase() as any, participants, color, shape };
                }
                continue;
            }

            // Handle alt, opt, group, loop
            const groupStartMatch = line.match(/^(alt|opt|loop|par|break|critical|group)(?:\s+(.*))?$/i);
            if (groupStartMatch) {
                let [, type, label] = groupStartMatch;
                diagram.startGroup(type.toLowerCase(), label || '');
                continue;
            }

            // Handle else
            const elseMatch = line.match(/^else(?:\s+(.*))?$/i);
            if (elseMatch) {
                let [, label] = elseMatch;
                diagram.addGroupSection(label || '');
                continue;
            }

            // Handle end
            if (line.toLowerCase().startsWith('end')) {
                // If we were in a group, end it
                diagram.endGroup();
                continue;
            }

            // Handle ref over P1, P2: label
            const refMatch = line.match(/^ref\s+over\s+(.*?)(?:\s*:\s*(.*))?$/i);
            if (refMatch) {
                let [, participantsStr, label] = refMatch;
                const participants = participantsStr.split(',').map(p => p.trim().replace(/^"(.*)"$/, '$1'));

                if (label) {
                    // Single line ref
                    diagram.addReference(participants, label);
                } else {
                    // Start multi-line ref
                    pendingRef = { participants, label: [] };
                }
                continue;
            }

            // Handle return [text]
            const returnMatch = line.match(/^return(?:\s+(.*))?$/i);
            if (returnMatch) {
                let [, text] = returnMatch;
                const normalizedText = (text || '').replace(/\\n/g, '\n');
                diagram.returnMessage(normalizedText);
                continue;
            }

            // Handle autonumber [start] [increment] [format]
            const autonumberMatch = line.match(/^autonumber(?:\s+(\d+))?(?:\s+(\d+))?(?:\s+"(.*?)"|)$/i);
            if (autonumberMatch) {
                let [, start, increment, format] = autonumberMatch;
                diagram.setAutonumber(
                    start ? parseInt(start, 10) : 1,
                    increment ? parseInt(increment, 10) : 1,
                    format
                );
                continue;
            }

            // Handle autoactivate
            const autoactivateMatch = line.match(/^autoactivate\s+(on|off)$/i);
            if (autoactivateMatch) {
                diagram.setAutoactivate(autoactivateMatch[1].toLowerCase() === 'on');
                continue;
            }

            // Handle dividers == label ==
            const dividerMatch = line.match(/^==\s*(.*?)\s*==$/);
            if (dividerMatch) {
                diagram.addDivider(dividerMatch[1]);
                continue;
            }



            // Handle spacing ||| or ||45||
            if (line === '|||') {
                diagram.addSpacing();
                continue;
            }
            const spacingMatch = line.match(/^\|\|(\d+)\|\|$/);
            if (spacingMatch) {
                diagram.addSpacing(parseInt(spacingMatch[1], 10));
                continue;
            }

            // Handle title, header, footer
            const metaMatch = line.match(/^(title|header|footer)\s+(.*)$/i);
            if (metaMatch) {
                const [, type, text] = metaMatch;
                if (type.toLowerCase() === 'title') diagram.setTitle(text);
                else if (type.toLowerCase() === 'header') diagram.setHeader(text);
                else if (type.toLowerCase() === 'footer') diagram.setFooter(text);
                continue;
            }

            if (line.toLowerCase() === 'hide footbox') {
                diagram.setHideFootbox(true);
                continue;
            }

            // Handle participant type Name [<<Stereotype>>] [as Label] [<<Stereotype>>] [order N] [#color]
            const participantTypes = '(participant|actor|boundary|control|entity|database|collections|queue)';
            const participantRegex = new RegExp(`^${participantTypes}\\s+(".*?"|\\w+)\\s*(?:<<\\s*(.*?)\\s*>>)?(?:\\s+as\\s+(".*?"|\\w+))?\\s*(?:<<\\s*(.*?)\\s*>>)?(?:\\s+order\\s+(\\d+))?(?:\\s+(#\\w+))?$`, 'i');
            const pMatch = line.match(participantRegex);
            if (pMatch) {
                let [, type, name, stereotype1, label, stereotype2, orderStr, color] = pMatch;
                if (!type || !name) continue;

                const stereotype = stereotype1 || stereotype2;

                let participantName: string;
                let participantLabel: string | undefined;

                if (label) {
                    if (label.startsWith('"')) {
                        // participant ID as "Label"
                        participantName = name.replace(/^"(.*)"$/, '$1');
                        participantLabel = label.replace(/^"(.*)"$/, '$1');
                    } else {
                        // participant "Label" as ID
                        participantName = label.replace(/^"(.*)"$/, '$1');
                        participantLabel = name.replace(/^"(.*)"$/, '$1');
                    }
                } else {
                    participantName = name.replace(/^"(.*)"$/, '$1');
                    participantLabel = undefined;
                }

                const order = orderStr ? parseInt(orderStr, 10) : undefined;
                diagram.addParticipant(participantName, participantLabel, type.toLowerCase() as any, order, color, stereotype);
                continue;
            }

            if (originalLine.trim() !== '' && !originalLine.trim().startsWith("'")) {
                throw new Error(`Syntax error at line ${i + 1}: ${line}`);
            }
        }

        return diagram;
    }
}
