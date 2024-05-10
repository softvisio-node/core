import * as namingConventions from "#lib/naming-conventions";
import { validateTelegramUsername } from "#lib/validate";
import { isIP } from "node:net";
import Cron from "#lib/cron";
import Locale from "#lib/locale";
import Hostname from "#lib/hostname";
import Interval from "#lib/interval";
import DigitalSize from "#lib/digital-size";
import IpRange from "#lib/ip/range";

export default {
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
                "file": true,
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

    "kebab-case-root-or-absolute-folder-path": {
        "type": "string",
        "validate": value =>
            namingConventions.isKebabCasePath( value, {
                "allowRoot": true,
                "absolute": true,
                "folder": true,
            } ),
    },

    "kebab-case-absolute-file-path": {
        "type": "string",
        "validate": value =>
            namingConventions.isKebabCasePath( value, {
                "allowRoot": false,
                "absolute": true,
                "folder": false,
            } ),
    },

    "kebab-case-absolute-folder-path": {
        "type": "string",
        "validate": value =>
            namingConventions.isKebabCasePath( value, {
                "allowRoot": false,
                "absolute": true,
                "folder": true,
            } ),
    },

    "kebab-case-glob-pattern": {
        "type": "string",
        "validate": value => {
            value = value.replaceAll( "*", "a" ).replaceAll( "?", "b" );

            return namingConventions.isKebabCasePath( value, {
                "allowRoot": true,
                "absolute": null,
                "folder": false,
            } );
        },
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
        "validate": value => validateTelegramUsername( value ).ok,
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

    "ip-address-port": {
        "type": "string",
        "validate": value => {
            var [ address, port ] = value.split( ":" );

            if ( !isIP( address ) ) return false;

            port = +port;

            if ( !( Number.isInteger( port ) && port >= 0 && port <= 65535 ) ) return false;

            return true;
        },
    },

    "ip-subnet": {
        "type": "string",
        "validate": value => IpRange.isValid( value ),
    },

    "int8": {
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

    "int4": {
        "type": "integer",
        "validate": value => value >= -2147483648 && value <= 2147483647,
    },

    "int2": {
        "type": "integer",
        "validate": value => value >= -32768 && value <= 32767,
    },

    "locale": {
        "type": "string",
        "validate": Locale.isValid,
    },

    "translation": {
        "type": "object",
        "validate": value => value instanceof Locale.Template,
    },

    "digital-size": {
        "type": "string",
        validate ( value ) {
            if ( !value ) return false;

            try {
                const size = DigitalSize.new( value );

                if ( !size.hasValue ) return false;

                return true;
            }
            catch ( e ) {
                return false;
            }
        },
    },

    "interval": {
        "type": "string",
        "validate": value => {
            if ( !value ) return false;

            try {
                const interval = new Interval( value );

                if ( !interval.hasValue ) return false;

                return true;
            }
            catch ( e ) {
                return false;
            }
        },
    },

    "timeout-interval": {
        "type": "string",
        "validate": value => {
            if ( !value ) return false;

            try {
                const interval = new Interval( value );

                if ( !interval.hasValue ) return false;

                if ( interval.isNegative || interval.toMilliseconds() > 2147483647 ) return false;

                return true;
            }
            catch ( e ) {
                return false;
            }
        },
    },

    "domain": {
        "type": "string",
        "validate": value => {
            const hostname = new Hostname( value );

            return hostname.isDomain && hostname.isValid;
        },
    },

    "nginx-server-name": {
        "type": "string",
        validate ( value ) {
            if ( value.startsWith( "*." ) ) value = value.substing( 2 );

            const hostname = new Hostname( value );

            return hostname.isDomain && hostname.isValid;
        },
    },
};
