export interface SequenceTheme {
    padding: number;
    participantWidth: number;
    participantHeight: number;
    participantGap: number;
    defaultMessageGap: number;
    fontSize: number;
    activationWidth: number;
    colors: {
        defaultStroke: string;
        defaultFill: string;
        actorFill: string;
        noteFill: string;
        line: string;
        text: string;
    };
    fontFamily: string;
}

export const defaultTheme: SequenceTheme = {
    padding: 40,
    participantWidth: 120,
    participantHeight: 40,
    participantGap: 180,
    defaultMessageGap: 50,
    fontSize: 14,
    activationWidth: 12,
    colors: {
        defaultStroke: '#333333',
        defaultFill: '#eeeeee',
        actorFill: '#f8f9fa',
        noteFill: '#ffffcc',
        line: '#666666',
        text: '#000000',
    },
    fontFamily: 'sans-serif',
};
