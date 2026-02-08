// src/diagrams/sequence/SequenceDiagram.ts
var SequenceDiagram = class {
  constructor() {
    this.type = "sequence";
    this.participants = [];
    this.messages = [];
    this.activations = [];
    this.groups = [];
    this.references = [];
    this.notes = [];
    this.dividers = [];
    this.delays = [];
    this.spacings = [];
    this.timeConstraints = [];
    this.taggedSteps = /* @__PURE__ */ new Map();
    this.hideFootbox = false;
    this.currentStep = 0;
    this.groupStack = [];
    this.autonumberConfig = null;
    this.currentAutonumber = 0;
    this.autoactivateEnabled = false;
  }
  setHideFootbox(hide) {
    this.hideFootbox = hide;
  }
  addParticipant(name, label, type = "participant", order, color, stereotype) {
    let participant = this.participants.find((p) => p.name === name);
    if (!participant) {
      participant = { name, label, type, order, color, stereotype };
      this.participants.push(participant);
    } else {
      if (label) participant.label = label;
      if (type !== "participant") participant.type = type;
      if (order !== void 0) participant.order = order;
      if (color) participant.color = color;
      if (stereotype) participant.stereotype = stereotype;
    }
    this.groupStack.forEach((g) => {
      if (!g.participants.includes(name)) g.participants.push(name);
    });
  }
  addMessage(from, to, text, type = "arrow", arrowHead = "default", color, bidirectional, startHead = "none") {
    const step = this.currentStep++;
    this.addParticipant(from);
    this.addParticipant(to);
    let msgNumber;
    if (this.autonumberConfig) {
      msgNumber = this.currentAutonumber.toString();
      this.currentAutonumber += this.autonumberConfig.increment;
    }
    this.messages.push({ from, to, text, type, step, arrowHead, startHead, color, bidirectional, number: msgNumber });
    if (this.autoactivateEnabled && from !== to && type === "arrow") {
      this.activate(to, step, step);
    }
    return step;
  }
  setAutonumber(start = 1, increment = 1, format) {
    this.autonumberConfig = { start, increment, format };
    this.currentAutonumber = start;
  }
  setAutoactivate(enabled) {
    this.autoactivateEnabled = enabled;
  }
  destroy(name, step) {
    const participant = this.participants.find((p) => p.name === name);
    if (participant) {
      participant.destroyedStep = step !== void 0 ? step : this.currentStep++;
      this.deactivate(name, participant.destroyedStep);
    }
  }
  create(name, step) {
    let participant = this.participants.find((p) => p.name === name);
    if (participant) {
      participant.createdStep = step;
    }
  }
  addDivider(label) {
    this.dividers.push({ label, step: this.currentStep++ });
  }
  rewindStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }
  nextStep() {
    return this.currentStep++;
  }
  getCurrentStep() {
    return this.currentStep;
  }
  addDelay(text) {
    this.delays.push({ text, step: this.currentStep++ });
  }
  addSpacing(height = 30) {
    this.spacings.push({ height, step: this.currentStep++ });
  }
  setTitle(title) {
    this.title = title;
  }
  setHeader(header) {
    this.header = header;
  }
  setFooter(footer) {
    this.footer = footer;
  }
  returnMessage(text) {
    const lastActive = [...this.activations].reverse().find((a) => a.endStep === void 0);
    if (!lastActive) return;
    const from = lastActive.participantName;
    let to = from;
    if (lastActive.sourceStep !== void 0) {
      const sourceMsg = this.messages.find((m) => m.step === lastActive.sourceStep);
      if (sourceMsg) {
        to = sourceMsg.from;
      }
    }
    const step = this.addMessage(from, to, text, "dotted", "open");
    this.deactivate(from, step);
  }
  addNote(text, position, participants, color, shape = "folder", step) {
    const noteStep = step !== void 0 ? step : this.currentStep++;
    const owner = this.groupStack.length > 0 ? this.groupStack[this.groupStack.length - 1] : void 0;
    this.notes.push({
      text,
      position,
      participants,
      step: noteStep,
      color,
      shape,
      owner
    });
    return noteStep;
  }
  activate(name, step = this.currentStep, sourceStep, color) {
    this.addParticipant(name);
    const activeCount = this.activations.filter((a) => a.participantName === name && a.endStep === void 0).length;
    this.activations.push({
      participantName: name,
      startStep: step,
      level: activeCount,
      sourceStep,
      color
    });
  }
  deactivate(name, step = this.currentStep, sourceStep) {
    this.addParticipant(name);
    const lastActive = [...this.activations].reverse().find((a) => a.participantName === name && a.endStep === void 0);
    if (lastActive) {
      lastActive.endStep = step;
      lastActive.endSourceStep = sourceStep;
    }
  }
  startGroup(type, label) {
    const step = this.nextStep();
    const group = {
      type,
      label,
      startStep: step,
      sections: [],
      level: this.groupStack.length,
      participants: []
    };
    this.groups.push(group);
    this.groupStack.push(group);
    return group;
  }
  addGroupSection(label) {
    const group = this.groupStack[this.groupStack.length - 1];
    if (group) {
      group.sections.push({ label, startStep: this.nextStep() });
    }
  }
  endGroup() {
    const group = this.groupStack.pop();
    if (group) {
      group.endStep = this.nextStep();
    }
  }
  addReference(participants, label) {
    const startStep = this.nextStep();
    const endStep = this.nextStep();
    this.references.push({ participants, label, startStep, endStep });
  }
  addTaggedStep(tag, step) {
    this.taggedSteps.set(tag, step);
  }
  addTimeConstraint(startTag, endTag, label) {
    this.timeConstraints.push({ startTag, endTag, label });
  }
};

// src/diagrams/sequence/SequenceParser.ts
var SequenceParser = class {
  parse(content) {
    const diagram = new SequenceDiagram();
    const lines = content.split("\n");
    let pendingRef = null;
    let pendingNote = null;
    let lastMessageStep = -1;
    let lastMessageFrom = "";
    let lastMessageTo = "";
    let lastMessageType = "";
    let lastActivationStep = /* @__PURE__ */ new Map();
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const originalLine = line;
      line = line.trim();
      if (!line || line.startsWith("@") || line.startsWith("!pragma")) continue;
      if (pendingNote) {
        const lowerLine = line.toLowerCase();
        const isEndNote = lowerLine.startsWith("end note");
        const isEndHnote = lowerLine === "end hnote" || lowerLine === "endhnote";
        const isEndRnote = lowerLine === "end rnote" || lowerLine === "endrnote";
        const isEndBnote = lowerLine === "end bnote" || lowerLine === "endbnote";
        if (isEndNote || isEndHnote || isEndRnote || isEndBnote) {
          const normPos = pendingNote.position.toLowerCase();
          let associationStep;
          if (pendingNote.participants.length === 0) {
            if ((normPos === "right" || normPos === "left") && lastMessageFrom && lastMessageTo) {
              const idxFrom = diagram.participants.findIndex((p) => p.name === lastMessageFrom);
              const idxTo = diagram.participants.findIndex((p) => p.name === lastMessageTo);
              if (idxFrom !== -1 && idxTo !== -1) {
                const pFrom = diagram.participants[idxFrom];
                const pTo = diagram.participants[idxTo];
                let isFromLeftOfTo = idxFrom < idxTo;
                if (pFrom.order !== void 0 && pTo.order !== void 0) {
                  isFromLeftOfTo = pFrom.order < pTo.order;
                }
                if (normPos === "left") {
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
          const text = pendingNote.text.join("\n").replace(/\\n/g, "\n");
          diagram.addNote(text, pendingNote.position, pendingNote.participants, pendingNote.color, pendingNote.shape, associationStep);
          pendingNote = null;
        } else {
          pendingNote.text.push(originalLine);
        }
        continue;
      }
      if (pendingRef) {
        if (line.toLowerCase().startsWith("end ref")) {
          diagram.addReference(pendingRef.participants, pendingRef.label.join("\n"));
          pendingRef = null;
        } else {
          pendingRef.label.push(originalLine);
        }
        continue;
      }
      if (line.startsWith("'")) continue;
      let sameStep = false;
      if (line.startsWith("/")) {
        sameStep = true;
        line = line.substring(1).trim();
        diagram.rewindStep();
      }
      const createMatch = line.match(/^create\s+(?:(actor|boundary|control|entity|database|collections)\s+)?(\w+)$/i);
      if (createMatch) {
        const [, type, name] = createMatch;
        diagram.addParticipant(name, type);
        diagram.create(name, diagram.getCurrentStep());
        continue;
      }
      const actionMatch = line.match(/^(activate|deactivate|destroy)\s+(".*?"|\w+)(?:\s+(#\w+))?$/i);
      if (actionMatch) {
        let [, action, rawName, color] = actionMatch;
        const name = rawName.replace(/^"(.*)"$/, "$1");
        if (color && color.startsWith("#")) {
          const hexContent = color.substring(1);
          const isHex = /^[0-9A-Fa-f]+$/.test(hexContent) && [3, 4, 6, 8].includes(hexContent.length);
          if (!isHex) color = hexContent;
        }
        const act = action.toLowerCase();
        if (act === "activate") {
          if (name === lastMessageTo && lastMessageStep !== -1) {
            diagram.activate(name, lastMessageStep, lastMessageStep, color);
            lastActivationStep.set(name, lastMessageStep);
          } else {
            const step = diagram.nextStep();
            diagram.activate(name, step, void 0, color);
            lastActivationStep.set(name, step);
          }
        } else if (act === "deactivate") {
          let shouldAlign = false;
          if (lastMessageStep !== -1 && lastMessageStep > (lastActivationStep.get(name) ?? -1)) {
            if (lastMessageType === "arrow") {
              shouldAlign = name === lastMessageTo || name === lastMessageFrom;
            } else if (lastMessageType === "dotted") {
              shouldAlign = name === lastMessageFrom;
            }
          }
          if (shouldAlign) {
            diagram.deactivate(name, lastMessageStep);
          } else {
            diagram.deactivate(name, diagram.nextStep());
          }
        } else if (act === "destroy") {
          let shouldAlign = false;
          if (lastMessageStep !== -1 && lastMessageStep > (lastActivationStep.get(name) ?? -1)) {
            if (lastMessageType === "arrow") {
              shouldAlign = name === lastMessageTo || name === lastMessageFrom;
            } else if (lastMessageType === "dotted") {
              shouldAlign = name === lastMessageFrom;
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
      const timeConstraintMatch = line.match(/^\{(\w+)\}\s*<->\s*\{(\w+)\}(?:\s*:\s*(.*))?$/);
      if (timeConstraintMatch) {
        const [, startTag, endTag, label] = timeConstraintMatch;
        diagram.addTimeConstraint(startTag, endTag, label || "");
        continue;
      }
      const delayMatch = line.match(/^\.\.\.(?:\s*(.*?)\s*\.\.\.)?$/);
      if (delayMatch) {
        const [, text] = delayMatch;
        diagram.addDelay(text || void 0);
        continue;
      }
      const arrowMatch = line.match(/^(?:\{(\w+)\}\s+)?(".*?"|\w+|x|\[|\])?\s*([<ox\\/]*)([-.]+)(?:\[(#\w+)\])?([-.]*)([>ox\\/]*)?\s*(".*?"|\w+|x|\[|\])?\s*(--\+\+|\+\+--|--|\+\+|\*\*|!!)?(?:\s+(#\w+))?(?:\s*:\s*(.*))?$/i);
      if (arrowMatch) {
        let [, tag, from, headStartStr, line1, msgColor, line2, headEndStr, to, shorthand, autoActivColor, text] = arrowMatch;
        text = text || "";
        const lineFull = line1 + (line2 || "");
        if (lineFull.length > 0) {
          if (from) from = from.replace(/^"(.*)"$/, "$1");
          if (to) to = to.replace(/^"(.*)"$/, "$1");
          if (!from || from === "[") from = "[";
          if (!to || to === "]") to = "]";
          const isDotted = lineFull.includes("..") || lineFull.includes("--");
          let isBidirectional = headStartStr.includes("<") && (headEndStr || "").includes(">");
          const mapHead = (s, isStart) => {
            if (!s) return "none";
            if (s === ">") return "default";
            if (s === "<") return "default";
            if (s === ">>") return "open";
            if (s === "<<") return "open";
            if (s === "\\" || s === "/") return "half";
            if (s === "\\\\" || s === "//") return "open";
            if (s.includes("x")) return "lost";
            if (s.includes("o")) {
              return "arrow-circle";
            }
            return "default";
          };
          let arrowHead = mapHead(headEndStr || "", false);
          let startHead = mapHead(headStartStr || "", true);
          if (headEndStr === "x") arrowHead = "lost";
          if (from === "x") startHead = "found";
          const normalizedText = text.replace(/\\n/g, "\n");
          const step = diagram.addMessage(from, to, normalizedText, isDotted ? "dotted" : "arrow", arrowHead, msgColor, isBidirectional, startHead);
          if (tag) {
            diagram.addTaggedStep(tag, step);
          }
          let semanticFrom = from;
          let semanticTo = to;
          const isHead = (h) => ["default", "open", "half", "arrow-circle"].includes(h);
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
          lastMessageType = isDotted ? "dotted" : "arrow";
          if (shorthand === "++") {
            if (autoActivColor && autoActivColor.startsWith("#")) {
              const hexContent = autoActivColor.substring(1);
              const isHex = /^[0-9A-Fa-f]+$/.test(hexContent) && [3, 4, 6, 8].includes(hexContent.length);
              if (!isHex) {
                autoActivColor = hexContent;
              }
            }
            diagram.activate(to, step, step, autoActivColor);
            lastActivationStep.set(to, step);
          } else if (shorthand === "--") {
            diagram.deactivate(from, step, step);
          } else if (shorthand === "--++") {
            diagram.deactivate(from, step, step);
            if (autoActivColor && autoActivColor.startsWith("#")) {
              const hexContent = autoActivColor.substring(1);
              const isHex = /^[0-9A-Fa-f]+$/.test(hexContent) && [3, 4, 6, 8].includes(hexContent.length);
              if (!isHex) {
                autoActivColor = hexContent;
              }
            }
            diagram.activate(to, step, step, autoActivColor);
            lastActivationStep.set(to, step);
          } else if (shorthand === "++--") {
            if (autoActivColor && autoActivColor.startsWith("#")) {
              const hexContent = autoActivColor.substring(1);
              const isHex = /^[0-9A-Fa-f]+$/.test(hexContent) && [3, 4, 6, 8].includes(hexContent.length);
              if (!isHex) {
                autoActivColor = hexContent;
              }
            }
            diagram.activate(from, step, step, autoActivColor);
            lastActivationStep.set(from, step);
            diagram.deactivate(to, step, step);
          } else if (shorthand === "**") {
            diagram.create(to, step);
          } else if (shorthand === "!!") {
            diagram.destroy(to, step);
          }
          continue;
        }
      }
      const noteMatch = line.match(/^(h|r|b)?note\s+(left|right|over|across)(?:\s+(?:of\s+)?([^#:]+))?\s*(#\w+)?\s*(?::\s*(.*))?$/i);
      if (noteMatch) {
        let [, shapeType, position, participantsStr, color, text] = noteMatch;
        let participants = [];
        if (participantsStr && participantsStr.trim()) {
          participants = participantsStr.split(",").map((p) => p.trim().replace(/^"(.*)"$/, "$1"));
        }
        let shape = "folder";
        if (shapeType === "h") shape = "hexagon";
        else if (shapeType === "r") shape = "rectangle";
        else if (shapeType === "b") shape = "bubble";
        if (text !== void 0) {
          const normPos = position.toLowerCase();
          let associationStep;
          if (participants.length === 0) {
            if ((normPos === "right" || normPos === "left") && lastMessageFrom && lastMessageTo) {
              const idxFrom = diagram.participants.findIndex((p) => p.name === lastMessageFrom);
              const idxTo = diagram.participants.findIndex((p) => p.name === lastMessageTo);
              if (idxFrom !== -1 && idxTo !== -1) {
                const pFrom = diagram.participants[idxFrom];
                const pTo = diagram.participants[idxTo];
                let isFromLeftOfTo = idxFrom < idxTo;
                if (pFrom.order !== void 0 && pTo.order !== void 0) {
                  isFromLeftOfTo = pFrom.order < pTo.order;
                }
                if (normPos === "left") {
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
          const normalizedText = text.replace(/\\n/g, "\n");
          diagram.addNote(normalizedText, position.toLowerCase(), participants, color, shape, associationStep);
        } else {
          pendingNote = { text: [], position: position.toLowerCase(), participants, color, shape };
        }
        continue;
      }
      const groupStartMatch = line.match(/^(alt|opt|loop|par|break|critical|group)(?:\s+(.*))?$/i);
      if (groupStartMatch) {
        let [, type, label] = groupStartMatch;
        diagram.startGroup(type.toLowerCase(), label || "");
        continue;
      }
      const elseMatch = line.match(/^else(?:\s+(.*))?$/i);
      if (elseMatch) {
        let [, label] = elseMatch;
        diagram.addGroupSection(label || "");
        continue;
      }
      if (line.toLowerCase().startsWith("end")) {
        diagram.endGroup();
        continue;
      }
      const refMatch = line.match(/^ref\s+over\s+(.*?)(?:\s*:\s*(.*))?$/i);
      if (refMatch) {
        let [, participantsStr, label] = refMatch;
        const participants = participantsStr.split(",").map((p) => p.trim().replace(/^"(.*)"$/, "$1"));
        if (label) {
          diagram.addReference(participants, label);
        } else {
          pendingRef = { participants, label: [] };
        }
        continue;
      }
      const returnMatch = line.match(/^return(?:\s+(.*))?$/i);
      if (returnMatch) {
        let [, text] = returnMatch;
        const normalizedText = (text || "").replace(/\\n/g, "\n");
        diagram.returnMessage(normalizedText);
        continue;
      }
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
      const autoactivateMatch = line.match(/^autoactivate\s+(on|off)$/i);
      if (autoactivateMatch) {
        diagram.setAutoactivate(autoactivateMatch[1].toLowerCase() === "on");
        continue;
      }
      const dividerMatch = line.match(/^==\s*(.*?)\s*==$/);
      if (dividerMatch) {
        diagram.addDivider(dividerMatch[1]);
        continue;
      }
      if (line === "|||") {
        diagram.addSpacing();
        continue;
      }
      const spacingMatch = line.match(/^\|\|(\d+)\|\|$/);
      if (spacingMatch) {
        diagram.addSpacing(parseInt(spacingMatch[1], 10));
        continue;
      }
      const metaMatch = line.match(/^(title|header|footer)\s+(.*)$/i);
      if (metaMatch) {
        const [, type, text] = metaMatch;
        if (type.toLowerCase() === "title") diagram.setTitle(text);
        else if (type.toLowerCase() === "header") diagram.setHeader(text);
        else if (type.toLowerCase() === "footer") diagram.setFooter(text);
        continue;
      }
      if (line.toLowerCase() === "hide footbox") {
        diagram.setHideFootbox(true);
        continue;
      }
      const participantTypes = "(participant|actor|boundary|control|entity|database|collections|queue)";
      const participantRegex = new RegExp(`^${participantTypes}\\s+(".*?"|\\w+)\\s*(?:<<\\s*(.*?)\\s*>>)?(?:\\s+as\\s+(".*?"|\\w+))?\\s*(?:<<\\s*(.*?)\\s*>>)?(?:\\s+order\\s+(\\d+))?(?:\\s+(#\\w+))?$`, "i");
      const pMatch = line.match(participantRegex);
      if (pMatch) {
        let [, type, name, stereotype1, label, stereotype2, orderStr, color] = pMatch;
        if (!type || !name) continue;
        const stereotype = stereotype1 || stereotype2;
        let participantName;
        let participantLabel;
        if (label) {
          if (label.startsWith('"')) {
            participantName = name.replace(/^"(.*)"$/, "$1");
            participantLabel = label.replace(/^"(.*)"$/, "$1");
          } else {
            participantName = label.replace(/^"(.*)"$/, "$1");
            participantLabel = name.replace(/^"(.*)"$/, "$1");
          }
        } else {
          participantName = name.replace(/^"(.*)"$/, "$1");
          participantLabel = void 0;
        }
        const order = orderStr ? parseInt(orderStr, 10) : void 0;
        diagram.addParticipant(participantName, participantLabel, type.toLowerCase(), order, color, stereotype);
        continue;
      }
      if (originalLine.trim() !== "" && !originalLine.trim().startsWith("'")) {
        throw new Error(`Syntax error at line ${i + 1}: ${line}`);
      }
    }
    return diagram;
  }
};

// src/diagrams/sequence/SequenceTheme.ts
var defaultTheme = {
  padding: 40,
  participantWidth: 120,
  participantHeight: 40,
  participantGap: 180,
  defaultMessageGap: 50,
  fontSize: 14,
  activationWidth: 12,
  colors: {
    defaultStroke: "#333333",
    defaultFill: "#eeeeee",
    actorFill: "#f8f9fa",
    noteFill: "#ffffcc",
    line: "#666666",
    text: "#000000"
  },
  fontFamily: "sans-serif"
};

// src/diagrams/sequence/SequenceLayout.ts
var LayoutEngine = class {
  constructor(theme) {
    this.theme = theme;
  }
  calculateLayout(diagram) {
    const participants = [...diagram.participants].sort((a, b) => {
      if (a.order !== void 0 && b.order !== void 0) return a.order - b.order;
      if (a.order !== void 0) return -1;
      if (b.order !== void 0) return 1;
      return 0;
    });
    const maxStep = this.calculateMaxStep(diagram);
    this.finalizeEndSteps(diagram, maxStep);
    const stepHeightResult = this.calculateStepHeights(diagram, maxStep);
    const stepY = stepHeightResult.stepY;
    const currentY = stepHeightResult.totalHeight;
    const pWidths = participants.map((p) => this.calculateParticipantWidth(p));
    const gaps = this.calculateGaps(diagram, participants, pWidths);
    const relpCenterX = this.calculateRelativepCenterXs(participants, pWidths, gaps);
    const noteLayoutsMap = this.preCalculateNoteLayouts(diagram, participants, relpCenterX, pWidths, stepY);
    const bounds = this.calculateBounds(participants, relpCenterX, pWidths, noteLayoutsMap, diagram.messages);
    const offsetX = this.theme.padding - bounds.minX;
    const baseWidth = bounds.maxX - bounds.minX + this.theme.padding * 2;
    let totalWidth = baseWidth;
    if (diagram.timeConstraints.length > 0) {
      const maxLabelLength = Math.max(...diagram.timeConstraints.map((tc) => tc.label.length), 0);
      const timeConstraintSpace = 50 + maxLabelLength * 8;
      totalWidth += timeConstraintSpace;
    }
    const footboxHeight = diagram.hideFootbox ? 0 : this.theme.participantHeight + 20;
    const totalHeight = currentY + footboxHeight + this.theme.padding;
    const participantLayouts = participants.map((p, i) => {
      const centerX = relpCenterX[i] + offsetX;
      return {
        participant: p,
        centerX,
        x: centerX - pWidths[i] / 2,
        y: p.createdStep !== void 0 ? stepY[p.createdStep] - this.theme.participantHeight / 2 : this.theme.padding,
        width: pWidths[i],
        height: this.theme.participantHeight,
        destroyedY: p.destroyedStep !== void 0 ? stepY[p.destroyedStep] : void 0
      };
    });
    const finalNoteLayouts = [];
    noteLayoutsMap.forEach((layout, note) => {
      let x = layout.x + offsetX;
      let w = layout.width;
      if (note.position === "across") {
        x = this.theme.padding;
        w = Math.max(baseWidth - this.theme.padding * 2, layout.width);
      }
      finalNoteLayouts.push({
        note,
        x,
        y: layout.y,
        width: w,
        height: layout.height
      });
    });
    const groupLayouts = this.calculateGroupLayouts(diagram, participantLayouts, finalNoteLayouts, stepY, maxStep);
    const activationLayouts = this.calculateActivationLayouts(diagram, participantLayouts, stepY, diagram.messages);
    return {
      width: totalWidth,
      height: totalHeight,
      participants: participantLayouts,
      notes: finalNoteLayouts,
      dividers: this.calculateDividerLayouts(diagram, stepY, totalWidth),
      references: this.calculateReferenceLayouts(diagram, participantLayouts, stepY),
      messages: this.calculateMessageLayouts(diagram, participantLayouts, stepY, activationLayouts),
      groups: groupLayouts,
      activations: activationLayouts,
      delays: this.calculateDelayLayouts(diagram, stepY),
      timeConstraints: this.calculateTimeConstraintLayouts(diagram, participantLayouts, stepY, baseWidth)
    };
  }
  calculateMessageLayouts(diagram, participants, stepY, activations) {
    return diagram.messages.map((m) => {
      const fromIdx = participants.findIndex((p) => p.participant.name === m.from);
      const toIdx = participants.findIndex((p) => p.participant.name === m.to);
      const y = stepY[m.step];
      let x1 = fromIdx !== -1 ? participants[fromIdx].centerX : 0;
      let x2 = toIdx !== -1 ? participants[toIdx].centerX : 0;
      if (fromIdx !== -1 && toIdx !== -1) {
        const fromActivations = activations.filter((a) => a.activation.participantName === m.from && a.activation.startStep <= m.step && (a.activation.endStep ?? Infinity) >= m.step).sort((a, b) => b.activation.level - a.activation.level);
        const toActivations = activations.filter((a) => a.activation.participantName === m.to && a.activation.startStep <= m.step && (a.activation.endStep ?? Infinity) >= m.step).sort((a, b) => b.activation.level - a.activation.level);
        if (fromIdx !== toIdx) {
          if (fromIdx < toIdx) {
            if (fromActivations.length > 0) {
              x1 = fromActivations[0].x + fromActivations[0].width;
            }
            if (toActivations.length > 0) {
              x2 = toActivations[0].x;
            }
          } else {
            if (fromActivations.length > 0) {
              x1 = fromActivations[0].x;
            }
            if (toActivations.length > 0) {
              x2 = toActivations[0].x + toActivations[0].width;
            }
          }
        }
      }
      if (toIdx !== -1 && participants[toIdx].participant.createdStep === m.step) {
        x2 = participants[toIdx].x;
      }
      const points = [{ x: x1, y }, { x: x2, y }];
      let labelPosition = { x: (x1 + x2) / 2, y };
      if (fromIdx === toIdx && fromIdx !== -1) {
        const activeActivations = activations.filter(
          (a) => a.activation.participantName === m.from && a.activation.startStep <= m.step && (a.activation.endStep ?? Infinity) >= m.step
        ).sort((a, b) => b.activation.level - a.activation.level);
        let startLevelIdx = 0;
        let endLevelIdx = 0;
        if (activeActivations.length > 0) {
          const highest = activeActivations[0];
          if (highest.activation.startStep === m.step) {
            if (activeActivations.length > 1) {
              startLevelIdx = 1;
              endLevelIdx = 0;
            } else {
              startLevelIdx = void 0;
              endLevelIdx = 0;
            }
          } else if (highest.activation.endStep === m.step) {
            if (activeActivations.length > 1) {
              startLevelIdx = 0;
              endLevelIdx = 1;
            } else {
              startLevelIdx = 0;
              endLevelIdx = void 0;
            }
          }
          const baseXStart = startLevelIdx !== void 0 && activeActivations.length > startLevelIdx ? activeActivations[startLevelIdx].x + activeActivations[startLevelIdx].width : participants[fromIdx].centerX;
          const baseXEnd = endLevelIdx !== void 0 && activeActivations.length > endLevelIdx ? activeActivations[endLevelIdx].x + activeActivations[endLevelIdx].width : participants[fromIdx].centerX;
          const diff = 40;
          points[0] = { x: baseXStart, y };
          points[1] = { x: Math.max(baseXStart, baseXEnd) + diff, y };
          points.push({ x: Math.max(baseXStart, baseXEnd) + diff, y: y + 25 });
          points.push({ x: baseXEnd, y: y + 25 });
          labelPosition = { x: Math.max(baseXStart, baseXEnd) + diff + 5, y: y + 10 };
        } else {
          const baseX = participants[fromIdx].centerX;
          const diff = 40;
          points[0] = { x: baseX, y };
          points[1] = { x: baseX + diff, y };
          points.push({ x: baseX + diff, y: y + 25 });
          points.push({ x: baseX, y: y + 25 });
          labelPosition = { x: baseX + diff + 5, y: y + 10 };
        }
      }
      return {
        message: m,
        y,
        points,
        labelPosition,
        lineStyle: m.type === "dotted" ? "dashed" : "solid"
      };
    });
  }
  calculateDividerLayouts(diagram, stepY, totalWidth) {
    return diagram.dividers.map((d) => ({
      y: stepY[d.step],
      label: d.label
    }));
  }
  calculateDelayLayouts(diagram, stepY) {
    return diagram.delays.map((d) => ({
      y: stepY[d.step],
      text: d.text
    }));
  }
  calculateTimeConstraintLayouts(diagram, participants, stepY, totalWidth) {
    return diagram.timeConstraints.map((tc) => {
      const startStep = diagram.taggedSteps.get(tc.startTag);
      const endStep = diagram.taggedSteps.get(tc.endTag);
      if (startStep === void 0 || endStep === void 0) {
        return null;
      }
      return {
        x: totalWidth - this.theme.padding + 20,
        // Position to the right of the diagram
        startY: stepY[startStep],
        endY: stepY[endStep],
        label: tc.label
      };
    }).filter((tc) => tc !== null);
  }
  calculateReferenceLayouts(diagram, participants, stepY) {
    return diagram.references.map((r) => {
      const pIdxs = r.participants.map((name) => participants.findIndex((pl) => pl.participant.name === name)).filter((i) => i !== -1);
      if (pIdxs.length === 0) return null;
      const minIdx = Math.min(...pIdxs);
      const maxIdx = Math.max(...pIdxs);
      const x = participants[minIdx].x;
      const w = participants[maxIdx].x + participants[maxIdx].width - x;
      const y = stepY[r.startStep] - 10;
      const h = stepY[r.endStep] - y;
      return {
        reference: r,
        x,
        y,
        width: w,
        height: h
      };
    }).filter((r) => r !== null);
  }
  calculateActivationLayouts(diagram, participants, stepY, messages) {
    return diagram.activations.map((a) => {
      const pIdx = participants.findIndex((p2) => p2.participant.name === a.participantName);
      if (pIdx === -1) return null;
      const p = participants[pIdx];
      const x = p.centerX - this.theme.activationWidth / 2 + a.level * 5;
      let y = stepY[a.startStep];
      if (a.sourceStep !== void 0) {
        const triggerMsg = messages.find((m) => m.step === a.sourceStep);
        if (triggerMsg && triggerMsg.from === a.participantName && triggerMsg.to === a.participantName) {
          y += 25;
        }
      }
      let yEnd = stepY[a.endStep];
      if (a.endSourceStep !== void 0) {
        const closeMsg = messages.find((m) => m.step === a.endSourceStep);
        if (closeMsg && closeMsg.from === a.participantName && closeMsg.to === a.participantName) {
          yEnd += 25;
        }
      }
      const minHeight = 5;
      const height = Math.max(minHeight, yEnd - y);
      return {
        activation: a,
        x,
        y,
        width: this.theme.activationWidth,
        height
      };
    }).filter((a) => a !== null);
  }
  // ... Helper methods (implementation details moved from Renderer) ...
  calculateMaxStep(diagram) {
    let maxStep = 0;
    const allElements = [
      ...diagram.messages,
      ...diagram.activations,
      ...diagram.groups,
      ...diagram.references,
      ...diagram.notes,
      ...diagram.dividers,
      ...diagram.delays,
      ...diagram.spacings
    ];
    allElements.forEach((e) => {
      const s = e.step ?? e.startStep ?? e.endStep ?? 0;
      if (s > maxStep) maxStep = s;
    });
    return maxStep + 1;
  }
  finalizeEndSteps(diagram, maxStep) {
    diagram.activations.forEach((a) => {
      if (a.endStep === void 0) a.endStep = maxStep;
    });
    diagram.groups.forEach((g) => {
      if (g.endStep === void 0) g.endStep = maxStep;
    });
  }
  calculateStepHeights(diagram, maxStep) {
    const stepHeights = new Array(maxStep + 1).fill(this.theme.defaultMessageGap);
    const topExtension = new Array(maxStep + 2).fill(0);
    const bottomExtension = new Array(maxStep + 2).fill(0);
    diagram.notes.forEach((n) => {
      const lines = n.text.split("\n");
      const noteHeight = lines.length * 20 + 10;
      topExtension[n.step] = Math.max(topExtension[n.step], noteHeight / 2);
      bottomExtension[n.step] = Math.max(bottomExtension[n.step], noteHeight / 2);
    });
    diagram.messages.forEach((m) => {
      const lines = m.text.split("\n");
      const textLines = lines.length;
      if (m.from === m.to) {
        const loopHeight = Math.max(25, textLines * 20);
        topExtension[m.step] = Math.max(topExtension[m.step], 0);
        bottomExtension[m.step] = Math.max(bottomExtension[m.step], loopHeight + 10);
      } else {
        const textHeight = textLines * 15 + 5;
        topExtension[m.step] = Math.max(topExtension[m.step], textHeight);
        bottomExtension[m.step] = Math.max(bottomExtension[m.step], 0);
      }
    });
    const baseHeights = new Array(maxStep + 1).fill(this.theme.defaultMessageGap);
    diagram.dividers.forEach((d) => {
      baseHeights[d.step] = 30;
    });
    diagram.delays.forEach((d) => {
      baseHeights[d.step] = 40;
    });
    diagram.spacings.forEach((s) => {
      baseHeights[s.step] = s.height;
    });
    diagram.references.forEach((r) => {
      const lines = r.label.split("\n");
      const textHeight = lines.length * 15 + 40;
      if (r.endStep === r.startStep + 1) {
        baseHeights[r.startStep] = Math.max(baseHeights[r.startStep], textHeight);
      }
    });
    for (let i = 0; i <= maxStep; i++) {
      const requiredGap = bottomExtension[i] + topExtension[i + 1] + 10;
      stepHeights[i] = Math.max(baseHeights[i], requiredGap);
    }
    const stepY = new Array(maxStep + 1).fill(0);
    let currentY = this.theme.padding + 90;
    for (let i = 0; i <= maxStep; i++) {
      stepY[i] = currentY;
      currentY += stepHeights[i];
    }
    return { stepY, totalHeight: currentY };
  }
  calculateParticipantWidth(p) {
    const label = (p.label || p.name).replace(/\\n/g, "\n");
    const lines = label.split("\n");
    const maxLineLength = Math.max(...lines.map((l) => l.length));
    return Math.max(this.theme.participantWidth, maxLineLength * 9 + 30);
  }
  // Simplified gap calculation for brevity in this first pass
  calculateGaps(diagram, participants, pWidths) {
    const numGaps = Math.max(0, participants.length - 1);
    const gaps = new Array(numGaps).fill(60);
    const maxStep = this.calculateMaxStep(diagram);
    for (let s = 0; s <= maxStep; s++) {
      const gapRequirements = new Array(numGaps).fill(0);
      for (let i = 0; i < participants.length; i++) {
        const name = participants[i].name;
        const participant = participants[i];
        if (participant.createdStep === s) {
          const boxWidth = pWidths[i];
          if (i < numGaps) {
            gapRequirements[i] = Math.max(gapRequirements[i], boxWidth / 2 + 20);
          }
        }
        let rightSpace = 15;
        const selfMsg = diagram.messages.find((m) => m.step === s && m.from === name && m.to === name);
        if (selfMsg) {
          const textWidth = Math.max(...selfMsg.text.split("\n").map((l) => l.length * 8)) + 20;
          rightSpace = 40 + textWidth + 10;
        }
        const activeAlt = diagram.activations.filter((a) => a.participantName === name && a.startStep <= s && (a.endStep ?? Infinity) >= s);
        if (activeAlt.length > 0) {
          const maxL = Math.max(...activeAlt.map((a) => a.level));
          rightSpace = Math.max(rightSpace, this.theme.activationWidth / 2 + maxL * 5 + 10);
        }
        const notesR = diagram.notes.filter((n) => n.step === s && n.position === "right" && n.participants?.includes(name));
        notesR.forEach((n) => {
          const w = Math.max(60, Math.max(...n.text.split("\n").map((l) => l.length * 8.5)) + 20);
          rightSpace += w + 10;
        });
        if (i < numGaps) gapRequirements[i] += rightSpace;
        let leftSpace = 15;
        const notesL = diagram.notes.filter((n) => n.step === s && n.position === "left" && n.participants?.includes(name));
        notesL.forEach((n) => {
          const w = Math.max(60, Math.max(...n.text.split("\n").map((l) => l.length * 8.5)) + 20);
          leftSpace += w + 10;
        });
        if (i > 0) gapRequirements[i - 1] += leftSpace;
      }
      for (let g = 0; g < numGaps; g++) {
        gaps[g] = Math.max(gaps[g], gapRequirements[g]);
      }
    }
    diagram.messages.forEach((m) => {
      const fIdx = participants.findIndex((p) => p.name === m.from);
      const tIdx = participants.findIndex((p) => p.name === m.to);
      if (fIdx === -1 || tIdx === -1 || fIdx === tIdx) return;
      const textWidth = Math.max(...m.text.split("\n").map((l) => l.length * 8)) + 20;
      const s = Math.min(fIdx, tIdx);
      const e = Math.max(fIdx, tIdx);
      let currentSpace = 0;
      for (let k = s; k < e; k++) {
        currentSpace += pWidths[k] / 2 + gaps[k] + pWidths[k + 1] / 2;
      }
      if (currentSpace < textWidth) {
        const deficit = textWidth - currentSpace;
        const increment = deficit / (e - s);
        for (let k = s; k < e; k++) gaps[k] += increment;
      }
    });
    diagram.notes.forEach((n) => {
      if (n.position !== "over" && n.position !== "across") return;
      const lines = n.text.split("\n");
      const noteWidth = Math.max(60, Math.max(...lines.map((l) => l.length * 8.5)) + 20);
      if (n.participants && n.participants.length > 0) {
        const sIdx = participants.findIndex((p) => p.name === n.participants[0]);
        const eIdx = n.participants.length > 1 ? participants.findIndex((p) => p.name === n.participants[1]) : sIdx;
        if (sIdx === -1 || eIdx === -1) return;
        const s = Math.min(sIdx, eIdx);
        const e = Math.max(sIdx, eIdx);
        if (s === e) {
          const required = noteWidth / 2 + 10;
          if (s < numGaps) {
            if (gaps[s] < required) gaps[s] = required;
          }
        } else {
          let currentSpace = 0;
          for (let k = s; k < e; k++) {
            currentSpace += pWidths[k] / 2 + gaps[k] + pWidths[k + 1] / 2;
          }
          if (currentSpace < noteWidth) {
            const deficit = noteWidth - currentSpace;
            const increment = deficit / (e - s);
            for (let k = s; k < e; k++) gaps[k] += increment;
          }
        }
      }
    });
    return gaps;
  }
  calculateRelativepCenterXs(participants, pWidths, gaps) {
    const relpCenterX = new Array(participants.length).fill(0);
    participants.forEach((p, i) => {
      if (i === 0) {
        relpCenterX[i] = pWidths[i] / 2;
      } else {
        relpCenterX[i] = relpCenterX[i - 1] + pWidths[i - 1] / 2 + gaps[i - 1] + pWidths[i] / 2;
      }
    });
    return relpCenterX;
  }
  preCalculateNoteLayouts(diagram, participants, relpCenterX, pWidths, stepY) {
    const noteLayouts = /* @__PURE__ */ new Map();
    const stepOccupancy = /* @__PURE__ */ new Map();
    diagram.notes.forEach((note) => {
      const lines = note.text.split("\n");
      const calculatedWidth = Math.max(...lines.map((l) => l.length * 8.5)) + 20;
      const minWidth = 60;
      const noteWidth = Math.max(calculatedWidth, minWidth);
      const noteHeight = lines.length * 20 + 10;
      const y = stepY[note.step] - noteHeight / 2;
      let x = 0;
      if (note.position === "across") {
        x = 0;
        noteLayouts.set(note, { x, y, width: noteWidth, height: noteHeight });
      } else if (note.position === "over") {
        const pIdxs = note.participants.map((name) => participants.findIndex((p) => p.name === name)).filter((i) => i !== -1);
        if (pIdxs.length > 0) {
          const minIdx = Math.min(...pIdxs);
          const maxIdx = Math.max(...pIdxs);
          const baseWidth = relpCenterX[maxIdx] + pWidths[maxIdx] / 2 - (relpCenterX[minIdx] - pWidths[minIdx] / 2);
          const finalWidth = Math.max(baseWidth, noteWidth);
          x = relpCenterX[minIdx] - pWidths[minIdx] / 2 - (finalWidth - baseWidth) / 2;
          noteLayouts.set(note, { x, y, width: finalWidth, height: noteHeight });
        }
      } else {
        const pIdxs = (note.participants || []).map((name) => participants.findIndex((p) => p.name === name)).filter((i) => i !== -1);
        if (pIdxs.length > 0) {
          const pIdx = note.position === "left" ? Math.min(...pIdxs) : Math.max(...pIdxs);
          const cx = relpCenterX[pIdx];
          const key = `${note.step}-${pIdx}-${note.position}`;
          const participant = participants[pIdx];
          const halfWidth = pWidths[pIdx] / 2;
          const isCreatedStep = note.step === participant.createdStep;
          const effectiveBoxOffset = isCreatedStep ? halfWidth : 0;
          if (note.position === "left") {
            const currentRightEdge = stepOccupancy.get(key) ?? cx - effectiveBoxOffset - 5;
            x = currentRightEdge - noteWidth;
            stepOccupancy.set(key, x - 10);
          } else {
            const selfMessage = diagram.messages.find(
              (m) => m.step === note.step && m.from === participant.name && m.to === participant.name
            );
            let selfMsgRightOffset = 0;
            if (selfMessage) {
              const textLines = selfMessage.text.split("\n");
              const textWidth = Math.max(...textLines.map((l) => l.length * 8)) + 20;
              selfMsgRightOffset = 40 + textWidth;
            }
            const activeAlt = diagram.activations.filter(
              (a) => a.participantName === participant.name && a.startStep <= note.step && (a.endStep ?? Infinity) >= note.step
            );
            const maxLevel = activeAlt.length > 0 ? Math.max(...activeAlt.map((a) => a.level)) : 0;
            const activationOffset = this.theme.activationWidth / 2 + maxLevel * 5;
            const baseRight = Math.max(effectiveBoxOffset, activationOffset, selfMsgRightOffset);
            const currentLeftEdge = stepOccupancy.get(key) ?? cx + baseRight + 5;
            x = currentLeftEdge;
            stepOccupancy.set(key, x + noteWidth + 10);
          }
          noteLayouts.set(note, { x, y, width: noteWidth, height: noteHeight });
        }
      }
    });
    return noteLayouts;
  }
  calculateBounds(participants, relpCenterX, pWidths, noteLayouts, messages) {
    let minX = 0;
    let maxX = 0;
    participants.forEach((p, i) => {
      const left = relpCenterX[i] - pWidths[i] / 2;
      const right = relpCenterX[i] + pWidths[i] / 2;
      if (i === 0) {
        minX = left;
        maxX = right;
      } else {
        if (left < minX) minX = left;
        if (right > maxX) maxX = right;
      }
    });
    noteLayouts.forEach((l) => {
      if (l.x < minX) minX = l.x;
      if (l.x + l.width > maxX) maxX = l.x + l.width;
    });
    messages.forEach((m) => {
      const fromIdx = participants.findIndex((p) => p.name === m.from);
      const toIdx = participants.findIndex((p) => p.name === m.to);
      if (fromIdx === -1 || toIdx === -1) return;
      const textLines = m.text.split("\n");
      const textWidth = Math.max(...textLines.map((l) => l.length * 8)) + 20;
      if (fromIdx === toIdx) {
        const cx = relpCenterX[fromIdx];
        const textWidth2 = Math.max(...m.text.split("\n").map((l) => l.length * 8)) + 20;
        const rightBound = cx + 40 + textWidth2 + 10;
        if (rightBound > maxX) maxX = rightBound;
      } else {
        const x1 = relpCenterX[fromIdx];
        const x2 = relpCenterX[toIdx];
        const cx = (x1 + x2) / 2;
        const left = cx - textWidth / 2;
        const right = cx + textWidth / 2;
        if (left < minX) minX = left;
        if (right > maxX) maxX = right;
      }
    });
    return { minX, maxX };
  }
  calculateGroupLayouts(diagram, participants, noteLayouts, stepY, maxStep) {
    const maxGroupLevel = diagram.groups.length > 0 ? Math.max(...diagram.groups.map((g) => g.level)) : 0;
    return diagram.groups.map((g) => {
      const pIdxs = g.participants.map((name) => participants.findIndex((pl) => pl.participant.name === name)).filter((i) => i !== -1);
      if (pIdxs.length === 0) return null;
      const minIdx = Math.min(...pIdxs);
      const maxIdx = Math.max(...pIdxs);
      const levelOffset = maxGroupLevel - g.level;
      const hPadding = 10 + levelOffset * 10;
      const vPaddingTop = 25 + levelOffset * 8;
      const vPaddingBottom = 5 + levelOffset * 8;
      let x = participants[minIdx].x + participants[minIdx].width / 2 - participants[minIdx].width / 2 - hPadding;
      let rectX = participants[minIdx].x - hPadding;
      let rectW = participants[maxIdx].x + participants[maxIdx].width + hPadding - rectX;
      const notesInGroup = noteLayouts.filter((nl) => {
        const n = nl.note;
        if (n.step < g.startStep || n.step > (g.endStep || maxStep)) return false;
        let owner = n.owner;
        if (!owner) return false;
        if (owner === g) return true;
        const ownerEnd = owner.endStep ?? maxStep;
        const groupEnd = g.endStep ?? maxStep;
        return owner.startStep >= g.startStep && ownerEnd <= groupEnd;
      });
      notesInGroup.forEach((nl) => {
        const n = nl.note;
        if (n.position === "right") {
          const nPIdxs = (n.participants || []).map((name) => participants.findIndex((p) => p.participant.name === name)).filter((i) => i !== -1);
          if (nPIdxs.length > 0 && Math.max(...nPIdxs) === maxIdx) {
            const noteRight = nl.x + nl.width;
            const groupRight = rectX + rectW;
            if (noteRight + 10 > groupRight) {
              rectW = noteRight + 10 - rectX;
            }
          }
        } else if (n.position === "left") {
          const nPIdxs = (n.participants || []).map((name) => participants.findIndex((p) => p.participant.name === name)).filter((i) => i !== -1);
          if (nPIdxs.length > 0 && Math.min(...nPIdxs) === minIdx) {
            const noteLeft = nl.x;
            const groupLeft = rectX;
            if (noteLeft - 10 < groupLeft) {
              const diff = groupLeft - (noteLeft - 10);
              rectX -= diff;
              rectW += diff;
            }
          }
        }
      });
      const yStart = stepY[g.startStep] - vPaddingTop;
      const yEnd = stepY[g.endStep] + vPaddingBottom;
      const sections = g.sections.map((s) => ({
        label: s.label,
        y: stepY[s.startStep]
      }));
      return {
        group: g,
        x: rectX,
        y: yStart,
        width: rectW,
        height: yEnd - yStart,
        type: g.type,
        label: g.label,
        sections
      };
    }).filter((g) => g !== null);
  }
};

// src/diagrams/sequence/SequenceSVGRenderer.ts
var SequenceSVGRenderer = class {
  constructor() {
    this.theme = defaultTheme;
    this.lastSvg = "";
    this.layoutEngine = new LayoutEngine(this.theme);
  }
  render(diagram) {
    this.ensureParticipants(diagram);
    const layout = this.layoutEngine.calculateLayout(diagram);
    return this.generateSvg(diagram, layout);
  }
  ensureParticipants(diagram) {
    diagram.notes.forEach((note) => {
      if (note.participants) {
        note.participants.forEach((p) => diagram.addParticipant(p));
      }
    });
  }
  generateSvg(diagram, layout) {
    let svg = `<svg width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" xmlns="http://www.w3.org/2000/svg" style="background: white; font-family: ${this.theme.fontFamily};">`;
    svg += this.renderDefs(diagram);
    svg += this.renderLifelines(diagram, layout);
    svg += this.renderActivations(diagram, layout);
    svg += this.renderGroups(layout);
    svg += this.renderParticipants(diagram, layout);
    svg += this.renderReferences(diagram, layout);
    svg += this.renderNotes(layout);
    svg += this.renderMessages(diagram, layout);
    svg += this.renderDividers(diagram, layout);
    svg += this.renderDelays(diagram, layout);
    svg += this.renderTimeConstraints(layout);
    svg += this.renderDestructionMarks(layout);
    if (diagram.title) {
      svg += `<text x="${layout.width / 2}" y="${25}" text-anchor="middle" font-size="${this.theme.fontSize + 4}" font-weight="bold">${diagram.title}</text>`;
    }
    if (diagram.header) {
      svg += `<text x="${layout.width - this.theme.padding}" y="${15}" text-anchor="end" font-size="${this.theme.fontSize - 4}">${diagram.header}</text>`;
    }
    if (diagram.footer) {
      svg += `<text x="${layout.width / 2}" y="${layout.height - 10}" text-anchor="middle" font-size="${this.theme.fontSize - 4}">${diagram.footer}</text>`;
    }
    svg += "</svg>";
    return svg;
  }
  renderDefs(diagram) {
    const usedColors = /* @__PURE__ */ new Set();
    usedColors.add(this.theme.colors.defaultStroke);
    diagram.messages.forEach((m) => {
      usedColors.add(this.normalizeColor(m.color, this.theme.colors.defaultStroke));
    });
    let defs = "<defs>";
    usedColors.forEach((color) => {
      const safeColor = color.replace("#", "");
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
    defs += "</defs>";
    return defs;
  }
  renderLifelines(diagram, layout) {
    let svg = "";
    layout.participants.forEach((pl) => {
      if (pl.participant.name === "[" || pl.participant.name === "]") {
        return;
      }
      const x = pl.centerX;
      const yEnd = pl.destroyedY !== void 0 ? pl.destroyedY : diagram.hideFootbox ? layout.height - this.theme.padding : layout.height - this.theme.padding - this.theme.participantHeight;
      svg += `<line x1="${x}" y1="${pl.y + pl.height}" x2="${x}" y2="${yEnd}" stroke="${this.theme.colors.line}" stroke-dasharray="4" />`;
    });
    return svg;
  }
  renderDestructionMarks(layout) {
    let svg = "";
    layout.participants.forEach((pl) => {
      if (pl.destroyedY !== void 0) {
        const x = pl.centerX;
        const y = pl.destroyedY;
        const dSize = 12;
        svg += `<line x1="${x - dSize}" y1="${y - dSize}" x2="${x + dSize}" y2="${y + dSize}" stroke="#FF0000" stroke-width="3" />`;
        svg += `<line x1="${x + dSize}" y1="${y - dSize}" x2="${x - dSize}" y2="${y + dSize}" stroke="#FF0000" stroke-width="3" />`;
      }
    });
    return svg;
  }
  renderParticipants(diagram, layout) {
    let svg = "";
    const draw = (pl, top) => {
      const fill = this.normalizeColor(pl.participant.color, this.theme.colors.actorFill);
      const x = pl.x;
      const y = top ? pl.y : layout.height - this.theme.padding - this.theme.participantHeight - 20;
      const cx = pl.centerX;
      const cy = y + this.theme.participantHeight / 2;
      const label = (pl.participant.label || pl.participant.name).replace(/\\n/g, "\n");
      const lines = label.split("\n");
      switch (pl.participant.type) {
        case "actor":
          svg += `<circle cx="${cx}" cy="${y + 10}" r="8" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
          svg += `<line x1="${cx}" y1="${y + 18}" x2="${cx}" y2="${y + 30}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
          svg += `<line x1="${cx - 10}" y1="${y + 22}" x2="${cx + 10}" y2="${y + 22}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
          svg += `<line x1="${cx}" y1="${y + 30}" x2="${cx - 8}" y2="${y + 40}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
          svg += `<line x1="${cx}" y1="${y + 30}" x2="${cx + 8}" y2="${y + 40}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
          lines.forEach((line, j) => {
            svg += `<text x="${cx}" y="${y + 55 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
          });
          break;
        case "boundary":
          svg += `<line x1="${cx - 20}" y1="${cy}" x2="${cx - 10}" y2="${cy}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
          svg += `<line x1="${cx - 20}" y1="${cy - 10}" x2="${cx - 20}" y2="${cy + 10}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
          svg += `<circle cx="${cx}" cy="${cy}" r="14" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
          lines.forEach((line, j) => {
            svg += `<text x="${cx}" y="${y + this.theme.participantHeight + 20 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
          });
          break;
        case "control":
          svg += `<circle cx="${cx}" cy="${cy}" r="14" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
          svg += `<path d="M ${cx + 4} ${cy - 18} L ${cx - 4} ${cy - 14} L ${cx + 4} ${cy - 10}" fill="none" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
          lines.forEach((line, j) => {
            svg += `<text x="${cx}" y="${y + this.theme.participantHeight + 20 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
          });
          break;
        case "entity":
          svg += `<circle cx="${cx}" cy="${cy}" r="14" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
          svg += `<line x1="${cx - 14}" y1="${cy + 14}" x2="${cx + 14}" y2="${cy + 14}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
          lines.forEach((line, j) => {
            svg += `<text x="${cx}" y="${y + this.theme.participantHeight + 20 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
          });
          break;
        case "database":
          const dbW = 34;
          const dbH = 40;
          const dbY = y;
          const dbX = cx - dbW / 2;
          svg += `<path d="M ${dbX} ${dbY + 10} L ${dbX} ${dbY + dbH - 10} A 17 8 0 0 0 ${dbX + dbW} ${dbY + dbH - 10} L ${dbX + dbW} ${dbY + 10} A 17 8 0 0 0 ${dbX} ${dbY + 10} M ${dbX} ${dbY + 10} A 17 8 0 0 1 ${dbX + dbW} ${dbY + 10}" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
          svg += `<path d="M ${dbX} ${dbY + 10} A 17 8 0 0 0 ${dbX + dbW} ${dbY + 10}" fill="none" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
          lines.forEach((line, j) => {
            svg += `<text x="${cx}" y="${y + this.theme.participantHeight + 20 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
          });
          break;
        case "collections":
          const colW = 34;
          const colH = 34;
          const colY = y + 3;
          const colX = cx - colW / 2;
          svg += `<rect x="${colX + 4}" y="${colY - 4}" width="${colW}" height="${colH}" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
          svg += `<rect x="${colX}" y="${colY}" width="${colW}" height="${colH}" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
          lines.forEach((line, j) => {
            svg += `<text x="${cx}" y="${y + this.theme.participantHeight + 20 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
          });
          break;
        case "queue":
          const qW = 40;
          const qH = 40;
          const qY = y + 3;
          const qX = cx - qW / 2;
          const qRx = 5;
          const qRy = qH / 2;
          svg += `<path d="M ${qX + qW} ${qY} L ${qX} ${qY} A ${qRx} ${qRy} 0 0 0 ${qX} ${qY + qH} L ${qX + qW} ${qY + qH} A ${qRx} ${qRy} 0 0 0 ${qX + qW} ${qY}" fill="${fill}" stroke="none" />`;
          svg += `<ellipse cx="${qX + qW}" cy="${qY + qRy}" rx="${qRx}" ry="${qRy}" fill="${fill}" stroke="none" />`;
          svg += `<path d="M ${qX + qW} ${qY} L ${qX} ${qY} A ${qRx} ${qRy} 0 0 0 ${qX} ${qY + qH} L ${qX + qW} ${qY + qH}" fill="none" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
          svg += `<ellipse cx="${qX + qW}" cy="${qY + qRy}" rx="${qRx}" ry="${qRy}" fill="none" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
          lines.forEach((line, j) => {
            svg += `<text x="${cx}" y="${y + this.theme.participantHeight + 20 + j * 15}" text-anchor="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
          });
          break;
        default:
          svg += `<rect x="${x}" y="${y}" width="${pl.width}" height="${this.theme.participantHeight}" rx="5" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
          lines.forEach((line, j) => {
            const lineY = lines.length > 1 ? cy - (lines.length - 1) * 7.5 + j * 15 : cy;
            svg += `<text x="${cx}" y="${lineY}" text-anchor="middle" dominant-baseline="middle" font-size="${this.theme.fontSize}" font-weight="bold">${line}</text>`;
          });
      }
    };
    layout.participants.forEach((pl) => {
      if (pl.participant.name === "[" || pl.participant.name === "]") {
        return;
      }
      draw(pl, true);
      if (!diagram.hideFootbox) {
        draw(pl, false);
      }
    });
    return svg;
  }
  renderGroups(layout) {
    let svg = "";
    layout.groups.forEach((g) => {
      svg += `<rect x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" fill="none" stroke="#222" stroke-width="2" rx="5" />`;
      svg += `<path d="M ${g.x} ${g.y} L ${g.x + 70} ${g.y} L ${g.x + 70} ${g.y + 10} L ${g.x + 60} ${g.y + 20} L ${g.x} ${g.y + 20} Z" fill="#eee" stroke="#222" stroke-width="2" />`;
      svg += `<text x="${g.x + 5}" y="${g.y + 15}" font-size="${this.theme.fontSize - 2}" font-weight="bold">${g.type}</text>`;
      if (g.label) svg += `<text x="${g.x + 75}" y="${g.y + 15}" font-size="${this.theme.fontSize - 2}" font-weight="bold">[${g.label}]</text>`;
      g.sections.forEach((section) => {
        const sectionY = section.y;
        svg += `<line x1="${g.x}" y1="${sectionY}" x2="${g.x + g.width}" y2="${sectionY}" stroke="#222" stroke-width="1" stroke-dasharray="5,5" />`;
        svg += `<text x="${g.x + 5}" y="${sectionY + 15}" font-size="${this.theme.fontSize - 2}" font-weight="bold">[${section.label}]</text>`;
      });
    });
    return svg;
  }
  renderNotes(layout) {
    let svg = "";
    layout.notes.forEach((nl) => {
      this.drawNoteShape(svg, nl.x, nl.y, nl.width, nl.height, nl.note.shape, nl.note.color, nl.note.text);
      svg = this.lastSvg;
    });
    return svg;
  }
  // ... Stubbing other methods to complete structure ...
  renderActivations(d, l) {
    let svg = "";
    const sortedActivations = [...l.activations].sort((a, b) => a.activation.level - b.activation.level);
    sortedActivations.forEach((a) => {
      const fill = a.activation.color || this.theme.colors.actorFill;
      svg += `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" fill="${fill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="1" />`;
    });
    return svg;
  }
  renderReferences(d, l) {
    let svg = "";
    l.references.forEach((r) => {
      svg += `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${this.theme.colors.defaultFill}" stroke="${this.theme.colors.defaultStroke}" stroke-width="2" />`;
      svg += `<path d="M ${r.x} ${r.y} L ${r.x + 70} ${r.y} L ${r.x + 70} ${r.y + 10} L ${r.x + 60} ${r.y + 20} L ${r.x} ${r.y + 20} Z" fill="#eee" stroke="#222" stroke-width="2" />`;
      svg += `<text x="${r.x + 5}" y="${r.y + 12}" font-size="${this.theme.fontSize - 2}" font-weight="bold">ref</text>`;
      const lines = r.reference.label.split("\n");
      const lineHeight = this.theme.fontSize + 2;
      const totalTextHeight = lines.length * lineHeight;
      const headerHeight = 25;
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
  renderMessages(d, l) {
    let svg = "";
    l.messages.forEach((ml) => {
      const m = ml.message;
      const strokeColor = this.normalizeColor(m.color, this.theme.colors.defaultStroke);
      const strokeDash = ml.lineStyle === "dashed" ? "4" : "0";
      const safeColor = strokeColor.replace("#", "");
      const getMarker = (type, isStart) => {
        if (type === "none") return "none";
        let id = "";
        if (type === "default") id = isStart ? `arrowhead-reverse-${safeColor}` : `arrowhead-${safeColor}`;
        else if (type === "open") id = isStart ? `arrowhead-open-reverse-${safeColor}` : `arrowhead-open-${safeColor}`;
        else if (type === "half") id = isStart ? `halfhead-reverse-${safeColor}` : `halfhead-${safeColor}`;
        else if (type === "circle") id = `circlehead-${safeColor}`;
        else if (type === "arrow-circle") id = isStart ? `arrowhead-circle-reverse-${safeColor}` : `arrowhead-circle-${safeColor}`;
        else if (type === "lost") id = `losthead-${safeColor}`;
        else if (type === "found") id = `circlehead-${safeColor}`;
        return id ? `url(#${id})` : "none";
      };
      const markerEnd = getMarker(m.arrowHead || "default", false);
      const markerStart = getMarker(m.startHead || (m.bidirectional ? "default" : "none"), true);
      if (ml.points.length > 2) {
        const dPath = `M ${ml.points.map((p) => `${p.x} ${p.y}`).join(" L ")}`;
        svg += `<path d="${dPath}" fill="none" stroke="${strokeColor}" stroke-width="1.5" stroke-dasharray="${strokeDash}" marker-end="${markerEnd}" marker-start="${markerStart}" />`;
      } else {
        const [p1, p2] = ml.points;
        svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${strokeColor}" stroke-width="1.5" stroke-dasharray="${strokeDash}" marker-end="${markerEnd}" marker-start="${markerStart}" />`;
      }
      const text = m.number ? `[${m.number}] ${m.text}` : m.text;
      const lines = text.split("\n");
      const anchor = ml.points.length > 2 ? "start" : "middle";
      lines.forEach((line, i) => {
        const lineY = ml.labelPosition.y - (lines.length - 1 - i) * 15 - 5;
        let y = lineY;
        if (ml.points.length > 2) {
          y = ml.labelPosition.y + i * 20;
        }
        svg += `<text x="${ml.labelPosition.x}" y="${y}" text-anchor="${anchor}" font-size="${this.theme.fontSize - 2}" fill="${strokeColor}">${line}</text>`;
      });
    });
    return svg;
  }
  renderDividers(d, l) {
    let svg = "";
    l.dividers.forEach((div) => {
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
  renderDelays(d, l) {
    let svg = "";
    l.delays.forEach((delay) => {
      const y = delay.y;
      const midX = l.width / 2;
      const dotGap = 10;
      const dotCount = 5;
      if (delay.text) {
        const textW = delay.text.length * 8 + 20;
        svg += `<text x="${midX}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="${this.theme.fontSize}" fill="${this.theme.colors.text}">${delay.text}</text>`;
        for (let i = 0; i < dotCount; i++) {
          const dx = midX - textW / 2 - 10 - i * dotGap;
          svg += `<circle cx="${dx}" cy="${y}" r="1.5" fill="${this.theme.colors.text}" />`;
        }
        for (let i = 0; i < dotCount; i++) {
          const dx = midX + textW / 2 + 10 + i * dotGap;
          svg += `<circle cx="${dx}" cy="${y}" r="1.5" fill="${this.theme.colors.text}" />`;
        }
      } else {
        for (let i = -10; i <= 10; i++) {
          if (i === 0) continue;
          svg += `<circle cx="${midX + i * dotGap}" cy="${y}" r="1.5" fill="${this.theme.colors.text}" />`;
        }
      }
    });
    return svg;
  }
  renderTimeConstraints(l) {
    let svg = "";
    l.timeConstraints.forEach((tc) => {
      const x = tc.x;
      const y1 = tc.startY;
      const y2 = tc.endY;
      const color = this.theme.colors.defaultStroke;
      svg += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${color}" stroke-width="1.5" />`;
      svg += `<polygon points="${x} ${y1}, ${x - 4} ${y1 + 8}, ${x + 4} ${y1 + 8}" fill="${color}" />`;
      svg += `<polygon points="${x} ${y2}, ${x - 4} ${y2 - 8}, ${x + 4} ${y2 - 8}" fill="${color}" />`;
      if (tc.label) {
        const midY = (y1 + y2) / 2;
        svg += `<text x="${x + 10}" y="${midY}" text-anchor="start" dominant-baseline="middle" font-size="${this.theme.fontSize - 2}" fill="${color}">${tc.label}</text>`;
      }
    });
    return svg;
  }
  // Helpers
  normalizeColor(color, defaultColor) {
    if (!color) return defaultColor;
    if (color.startsWith("#")) {
      if (/^#[0-9a-fA-F]{3,8}$/.test(color)) {
        return color;
      }
      return color.substring(1);
    }
    return color;
  }
  formatRichText(text) {
    let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<tspan font-weight="bold">$1</tspan>');
    escaped = escaped.replace(/\/\/(.*?)\/\//g, '<tspan font-style="italic">$1</tspan>');
    escaped = escaped.replace(/""(.*?)""/g, '<tspan font-family="monospace">$1</tspan>');
    escaped = escaped.replace(/--(.*?)--/g, '<tspan text-decoration="line-through">$1</tspan>');
    escaped = escaped.replace(/__(.*?)__/g, '<tspan text-decoration="underline">$1</tspan>');
    escaped = escaped.replace(/~~(.*?)~~/g, '<tspan style="text-decoration: underline; text-decoration-style: wavy">$1</tspan>');
    return escaped;
  }
  drawNoteShape(svg, x, y, w, h, shape, color, text) {
    let noteSvg = "";
    const fill = this.normalizeColor(color, this.theme.colors.noteFill);
    const borderColor = this.theme.colors.defaultStroke;
    const effectiveShape = shape || "folder";
    if (effectiveShape === "hexagon") {
      const pointDepth = 10;
      const points = [
        `${x + pointDepth},${y}`,
        `${x + w - pointDepth},${y}`,
        `${x + w},${y + h / 2}`,
        `${x + w - pointDepth},${y + h}`,
        `${x + pointDepth},${y + h}`,
        `${x},${y + h / 2}`
      ].join(" ");
      noteSvg += `<polygon points="${points}" fill="${fill}" stroke="${borderColor}" stroke-width="1.5" />`;
    } else if (effectiveShape === "bubble") {
      const r = h / 2;
      noteSvg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}" stroke="${borderColor}" stroke-width="1.5" />`;
    } else if (effectiveShape === "rectangle") {
      noteSvg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${borderColor}" stroke-width="1.5" />`;
    } else {
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
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      noteSvg += `<text x="${x + w / 2}" y="${y + 20 + i * 20}" text-anchor="middle" font-size="${this.theme.fontSize}" fill="${this.theme.colors.text}">${this.formatRichText(line)}</text>`;
    });
    this.lastSvg = svg + noteSvg;
  }
};

// src/index.ts
function renderSequenceDiagram(content) {
  const parser = new SequenceParser();
  const renderer = new SequenceSVGRenderer();
  try {
    const diagram = parser.parse(content);
    return renderer.render(diagram);
  } catch (e) {
    const errorMsg = e.message || "Unknown error occurred during parsing";
    const escapedError = errorMsg.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const width = 800;
    const height = 100;
    return `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background: white; font-family: sans-serif;">
                <rect width="100%" height="100%" fill="#ffeeee" stroke="#ff0000" stroke-width="2" />
                <text x="20" y="50" fill="#ff0000" font-size="16" font-weight="bold">${escapedError}</text>
            </svg>
        `.trim();
  }
}
function renderAll(selector = "pre.seeduml") {
  if (typeof document === "undefined") return;
  const blocks = document.querySelectorAll(selector);
  blocks.forEach((block) => {
    const content = block.textContent || "";
    const svg = renderSequenceDiagram(content);
    const container = document.createElement("div");
    container.className = "seeduml-diagram";
    container.innerHTML = svg;
    container.style.display = "inline-block";
    block.parentNode?.replaceChild(container, block);
  });
}
function initialize(config = {}) {
  const { startOnLoad = true, selector = "pre.seeduml" } = config;
  if (!startOnLoad) return;
  if (typeof document === "undefined") return;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      renderAll(selector);
    });
  } else {
    renderAll(selector);
  }
}
if (typeof window !== "undefined") {
  window.seeduml = {
    renderSequenceDiagram,
    renderAll,
    initialize
  };
}
var index_default = {
  renderSequenceDiagram,
  renderAll,
  initialize
};
export {
  index_default as default,
  initialize,
  renderAll,
  renderSequenceDiagram
};
