import * as namingConventions from "#lib/utils/naming-conventions";

const formats = {
    "event-name": {
        "type": "string",
        "validate": value => namingConventions.isKebabCase( value, { "sep": "/" } ),
    },
};

export default function ( ajv ) {
    for ( const [name, code] of Object.entries( formats ) ) ajv.addFormat( name, code );
}
