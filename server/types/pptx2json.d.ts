declare module 'pptx2json' {
    interface Slide {
        text: string;
    }
    
    interface PPTXData {
        slides: Slide[];
    }
    
    function parse(filePath: string): Promise<PPTXData>;
    export default { parse };
} 