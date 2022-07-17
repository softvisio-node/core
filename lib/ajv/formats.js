import * as namingConventions from "#lib/utils/naming-conventions";
import * as validate from "#lib/utils/validate";
import { isIP } from "net";

const formats = {
    "kebab-case": {
        "type": "string",
        "validate": value => namingConventions.isKebabCase( value ),
    },
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
    "ip-address": {
        "type": "string",
        "validate": value => !!isIP( value ),
    },
};

export default function ( ajv ) {
    for ( const [name, code] of Object.entries( formats ) ) ajv.addFormat( name, code );
}
