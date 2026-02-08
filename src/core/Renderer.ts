import { Diagram } from './Diagram';

export interface Renderer<T extends Diagram = Diagram> {
    render(diagram: T): string;
}
