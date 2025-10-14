import { XMLBuilder, XMLParser } from "fast-xml-parser";

export function fromXml ( xml ) {
    const parser = new XMLParser();

    return parser.parse( xml );
}

export function toXml ( data ) {
    const builder = new XMLBuilder();

    return builder.build( data );
}
