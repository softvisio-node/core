import * as namingConventions from "#lib/utils/naming-conventions";
import * as validate from "#lib/utils/validate";

const formats = {
    "event-name": {
        "type": "string",
        "validate": value => namingConventions.isKebabCase( value, { "sep": "/" } ),
    },
    "telegram-username": {
        "type": "string",
        "validate": value => !validate.isInvalidTelegramUsername( value ),
    },
    "uri-whatwg": {
        "type": "string",
        "validate": value => {
            try {
                new URL( value );

                return true;
            }
            catch ( e ) {
                return false;
            }
        },
    },
};

export default function ( ajv ) {
    for ( const [name, code] of Object.entries( formats ) ) ajv.addFormat( name, code );
}
