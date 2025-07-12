declare module 'docxtemplater' {
  interface DocxtemplaterOptions {
    paragraphLoop?: boolean;
    linebreaks?: boolean;
    delimiters?: {
      start: string;
      end: string;
    };
  }

  class Docxtemplater {
    constructor(zip: any, options?: DocxtemplaterOptions);
    render(data: any): void;
    getZip(): any;
  }

  export = Docxtemplater;
}