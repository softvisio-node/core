import { XMLBuilder, XMLParser } from "fast-xml-parser";

export function parse ( xml ) {
    const parser = new XMLParser();

    return parser.parse( xml );
}

export function stringify ( data ) {
    const builder = new XMLBuilder();

    return builder.build( data );
}
