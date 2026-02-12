
export interface ComponentTheme {
    padding: number;
    componentWidth: number;
    componentHeight: number;
    interfaceRadius: number;
    componentGapX: number;
    componentGapY: number;
    fontSize: number;
    packagePadding: number;
    colors: {
        defaultStroke: string;
        defaultFill: string;
        interfaceFill: string;
        noteFill: string;
        noteStroke: string;
        line: string;
        text: string;
        textLight: string;
        packageFill: string;
        packageStroke: string;
        nodeFill: string;
        folderFill: string;
        frameFill: string;
        cloudFill: string;
        databaseFill: string;
        componentIcon: string;
    };
    fontFamily: string;
}

export const defaultTheme: ComponentTheme = {
    padding: 20,
    componentWidth: 120,
    componentHeight: 50,
    interfaceRadius: 10,
    componentGapX: 80,
    componentGapY: 60,
    fontSize: 13,
    packagePadding: 20,
    colors: {
        defaultStroke: '#5a6270',
        defaultFill: '#e8edf3',
        interfaceFill: '#ffffff',
        noteFill: '#fff9c4',
        noteStroke: '#e0d86e',
        line: '#5a6270',
        text: '#2c3e50',
        textLight: '#7f8c9b',
        packageFill: '#ebf0f7',
        packageStroke: '#7b8fa8',
        nodeFill: '#ebf0f7',
        folderFill: '#ebf0f7',
        frameFill: '#ebf0f7',
        cloudFill: '#ebf0f7',
        databaseFill: '#ebf0f7',
        componentIcon: '#7b8fa8',
    },
    fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
};
