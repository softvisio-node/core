import * as namingConventions from "#lib/utils/naming-conventions";
import * as validate from "#lib/utils/validate";
import { isIP } from "node:net";
import Cron from "#lib/cron";
import Locale from "#lib/locale";

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

    // XXX
    "kebab-case-glob-pattern": {
        "type": "string",
        "validate": value => true,
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
    "cron": {
        "type": "string",
        "validate": value => Cron.isValid( value ),
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
    "locale": {
        "type": "string",
        "validate": Locale.isValid,
    },

    "digital-size-unit": {
        "type": "string",
        "validate": value => /^\d+[kKmMgG]?$/.test( value ),
    },

    "duration-unit": {
        "type": "string",
        "validate": value => {
            if ( !value ) return false;

            if ( /^\d+$/.test( value ) ) return true;

            if ( /^\d+(?:ms|s|m|h|d|w|M|y)$/.test( value ) ) return true;

            if ( /^(?:\d+y\s*)?(?:\d+M\s*)?(?:\d+w\s*)?(?:\d+d\s*)?(?:\d+h\s*)?(?:\d+m\s*)?(?:\d+s\s*)?(?:\d+ms\s*)?$/.test( value ) ) return true;

            return false;
        },
    },
};

export default function ( ajv ) {
    for ( const [name, code] of Object.entries( formats ) ) ajv.addFormat( name, code );
}
