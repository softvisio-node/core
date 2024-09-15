import * as namingConventions from "#lib/naming-conventions";
import { validateTelegramUsername } from "#lib/validate";
import { isIP } from "node:net";
import CronExpression from "#lib/cron/expression";
import Locale from "#lib/locale";
import Hostname from "#lib/hostname";
import Interval from "#lib/interval";
import DigitalSize from "#lib/digital-size";
import IpRange from "#lib/ip/range";

function validatePort ( port ) {
    port = +port;

    return Number.isInteger( port ) && port >= 0 && port <= 65_535;
}

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
        "validate": value => CronExpression.isValid( value ),
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
        "validate": validatePort,
    },

    "ip-address+port": {
        "type": "string",
        "validate": value => {
            try {
                const [ hostname, port ] = value.split( ":" );

                if ( !isIP( hostname ) ) return false;

                return validatePort( port );
            }
            catch {
                return false;
            }
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

                return value >= -9_223_372_036_854_775_808n && value <= 9_223_372_036_854_775_807n;
            }
            catch {
                return false;
            }
        },
    },

    "int4": {
        "type": "integer",
        "validate": value => value >= -2_147_483_648 && value <= 2_147_483_647,
    },

    "int2": {
        "type": "integer",
        "validate": value => value >= -32_768 && value <= 32_767,
    },

    "locale": {
        "type": "string",
        "validate": Locale.isValid,
    },

    "l10nt": {
        "type": "object",
        "validate": value => value instanceof Locale.L10nt,
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
            catch {
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
            catch {
                return false;
            }
        },
    },

    "host": {
        "type": "string",
        "validate": value => {
            try {
                const hostname = new Hostname( value );

                return hostname.isValid;
            }
            catch {
                return false;
            }
        },
    },

    "host+port": {
        "type": "string",
        "validate": value => {
            try {
                var [ hostname, port ] = value.split( ":" );

                hostname = new Hostname( hostname );

                if ( !hostname.isValid ) return false;

                return validatePort( port );
            }
            catch {
                return false;
            }
        },
    },

    "domain": {
        "type": "string",
        "validate": value => {
            try {
                const hostname = new Hostname( value );

                return hostname.isDomain && hostname.isValid;
            }
            catch {
                return false;
            }
        },
    },

    "domain+port": {
        "type": "string",
        "validate": value => {
            try {
                var [ hostname, port ] = value.split( ":" );

                hostname = new Hostname( hostname );

                if ( !hostname.isDomain || !hostname.isValid ) return false;

                return validatePort( port );
            }
            catch {
                return false;
            }
        },
    },

    "nginx-server-name": {
        "type": "string",
        validate ( value ) {
            try {
                if ( value.startsWith( "*." ) ) value = value.substing( 2 );

                const hostname = new Hostname( value );

                return hostname.isDomain && hostname.isValid;
            }
            catch {
                return false;
            }
        },
    },
};
