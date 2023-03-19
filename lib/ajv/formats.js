import * as namingConventions from "#lib/utils/naming-conventions";
import * as validate from "#lib/utils/validate";
import { isIP } from "node:net";

const formats = {
    "kebab-case": {
        "type": "string",
        "validate": value => namingConventions.isKebabCase( value ),
    },
    "kebab-case-relative-file-path": {
        "type": "string",
        "validate": value =>
            namingConventions.isKebabCasePath( value, {
                "allowRoot": false,
                "absolute": false,
                "folder": false,
            } ),
    },
    "kebab-case-root-or-absolute-file-path": {
        "type": "string",
        "validate": value =>
            namingConventions.isKebabCasePath( value, {
                "allowRoot": true,
                "absolute": true,
                "folder": false,
            } ),
    },
    "snake-case": {
        "type": "string",
        "validate": value => namingConventions.isSnakeCase( value ),
    },
    "telegram-username": {
        "type": "string",
        "validate": value => validate.validateTelegramUsername( value ).ok,
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
    "ip-port": {
        "type": "number",
        "validate": value => Number.isInteger( value ) && value >= 0 && value <= 65535,
    },
};

export default function ( ajv ) {
    for ( const [name, code] of Object.entries( formats ) ) ajv.addFormat( name, code );
}
