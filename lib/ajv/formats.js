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
    "camel-case-strict": {
        "type": "string",
        "validate": value => namingConventions.isCamelCase( value, { "strict": true } ),
    },
    "telegram-username": {
        "type": "string",
        "validate": value => validate.validateTelegramUsername( value ).ok,
    },
    "uri-whatwg": {
        "type": "string",
        "validate": value => URL.canParse( value ),
    },
    "ip-address": {
        "type": "string",
        "validate": value => !!isIP( value ),
    },
    "ip-port": {
        "type": "number",
        "validate": value => Number.isInteger( value ) && value >= 0 && value <= 65535,
    },
    "int64": {
        "type": "string",
        "validate": value => {
            try {
                value = BigInt( value );

                return value >= -9223372036854775808n && value <= 9223372036854775807n;
            }
            catch ( e ) {
                return false;
            }
        },
    },
    "int53": {
        "type": "string",
        "validate": value => {
            try {
                value = BigInt( value );

                return value >= -9007199254740991n && value <= 9007199254740991n;
            }
            catch ( e ) {
                return false;
            }
        },
    },
    "int32": {
        "type": "number",
        "validate": value => Number.isInteger( value ) && value >= -2147483648 && value <= 2147483647,
    },
    "int16": {
        "type": "number",
        "validate": value => Number.isInteger( value ) && value >= -32768 && value <= 32767,
    },
};

export default function ( ajv ) {
    for ( const [name, code] of Object.entries( formats ) ) ajv.addFormat( name, code );
}
