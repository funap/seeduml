import { Diagram } from './Diagram';

export interface Parser {
    parse(content: string): Diagram;
}
