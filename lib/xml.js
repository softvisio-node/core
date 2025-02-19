import { XMLBuilder, XMLParser } from "fast-xml-parser";

export function parseXml ( xml ) {
    const parser = new XMLParser();

    return parser.parse( xml );
}

export function stringifyXml ( data ) {
    const builder = new XMLBuilder();

    return builder.build( data );
}
