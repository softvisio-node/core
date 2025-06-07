import "#lib/temporal";
import { isIP } from "node:net";
import CronExpression from "#lib/cron/expression";
import DigitalSize from "#lib/digital-size";
import GlobPattern from "#lib/glob/pattern";
import Hostname from "#lib/hostname";
import Interval from "#lib/interval";
import IpRange from "#lib/ip/range";
import Locale from "#lib/locale";
import * as namingConventions from "#lib/naming-conventions";
import SemanticVersion from "#lib/semantic-version";
import { validateTelegramUsername } from "#lib/validate";

const weekdays = new Set( [ "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" ] ),
    months = new Set( [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ] ),
    temporalOverflow = "reject"; // constrain

function validatePort ( port, { allowRandom } = {} ) {
    port = +port;

    return Number.isInteger( port ) && port >= ( allowRandom
        ? 0
        : 1 ) && port <= 65_535;
}

export default {
    "kebab-case": {
        "type": "string",
        "validate": value => namingConventions.isKebabCase( value ),
    },

    "kebab-case-relative-file-path": {
        "type": "string",
        "validate": value =>
            namingConventions.validatePath( value, {
                "root": false,
                "absolute": false,
                "folder": false,
                "format": "kebab-case",
            } ),
    },

    "kebab-case-root-or-absolute-file-path": {
        "type": "string",
        "validate": value =>
            namingConventions.validatePath( value, {
                "root": true,
                "absolute": true,
                "folder": false,
                "format": "kebab-case",
            } ),
    },

    "kebab-case-root-or-absolute-folder-path": {
        "type": "string",
        "validate": value =>
            namingConventions.validatePath( value, {
                "root": true,
                "absolute": true,
                "folder": true,
                "format": "kebab-case",
            } ),
    },

    "kebab-case-absolute-file-path": {
        "type": "string",
        "validate": value =>
            namingConventions.validatePath( value, {
                "root": false,
                "absolute": true,
                "folder": false,
                "format": "kebab-case",
            } ),
    },

    "kebab-case-absolute-folder-path": {
        "type": "string",
        "validate": value =>
            namingConventions.validatePath( value, {
                "root": false,
                "absolute": true,
                "folder": true,
                "format": "kebab-case",
            } ),
    },

    "glob-pattern": {
        "type": "string",
        "validate": value => GlobPattern.isValid( value ),
    },

    "snake-case": {
        "type": "string",
        "validate": value => namingConventions.isSnakeCase( value ),
    },

    "camel-case-strict": {
        "type": "string",
        "validate": value => namingConventions.isCamelCase( value, { "strict": true } ),
    },

    "semantic-version": {
        "type": "string",
        "validate": value => SemanticVersion.isValid( value ),
    },

    "telegram-username": {
        "type": "string",
        "validate": value => validateTelegramUsername( value ).ok,
    },

    "cron": {
        "type": "string",
        "validate": value => CronExpression.isValid( value ),
    },

    "url": {
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

    "random-ip-port": {
        "type": "number",
        "validate": value => validatePort( value, { "allowRandom": true } ),
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

    "int2": {
        "type": "integer",
        "validate": value => value >= -32_768 && value <= 32_767,
    },

    "int4": {
        "type": "integer",
        "validate": value => value >= -2_147_483_648 && value <= 2_147_483_647,
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

    "locale": {
        "type": "string",
        "validate": Locale.isValid,
    },

    "language": {
        "type": "string",
        "validate": Locale.languageisValid,
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

    "timestamp": {
        "type": "integer",
        validate ( value ) {
            return value >= 0;
        },
    },

    "date-time": {
        "type": "string",
        validate ( value ) {
            try {
                Temporal.Instant.from( value );

                return true;
            }
            catch {
                return false;
            }
        },
    },

    "date": {
        "type": "string",
        validate ( value ) {
            try {
                Temporal.PlainDate.from( value, {
                    "overflow": temporalOverflow,
                } );

                return true;
            }
            catch {
                return false;
            }
        },
    },

    "time": {
        "type": "string",
        validate ( value ) {
            try {
                Temporal.PlainTime.from( value, {
                    "overflow": temporalOverflow,
                } );

                return true;
            }
            catch {
                return false;
            }
        },
    },

    "zoned-date-time": {
        "type": "string",
        validate ( value ) {
            try {
                Temporal.ZonedDateTime.from( value, {
                    "overflow": temporalOverflow,
                } );

                return true;
            }
            catch {
                return false;
            }
        },
    },

    "plain-date-time": {
        "type": "string",
        validate ( value ) {
            try {
                Temporal.PlainDateTime.from( value, {
                    "overflow": temporalOverflow,
                } );

                return true;
            }
            catch {
                return false;
            }
        },
    },

    "month-day": {
        "type": "string",
        validate ( value ) {
            try {
                Temporal.PlainMonthDay.from( value, {
                    "overflow": temporalOverflow,
                } );

                return true;
            }
            catch {
                return false;
            }
        },
    },

    "year-month": {
        "type": "string",
        validate ( value ) {
            try {
                Temporal.PlainYearMonth.from( value, {
                    "overflow": temporalOverflow,
                } );

                return true;
            }
            catch {
                return false;
            }
        },
    },

    "month": {
        "type": "string",
        validate ( value ) {
            try {
                return months.has( value );
            }
            catch {
                return false;
            }
        },
    },

    "weekday": {
        "type": "string",
        validate ( value ) {
            try {
                return weekdays.has( value );
            }
            catch {
                return false;
            }
        },
    },

    "timezone": {
        "type": "string",
        validate ( value ) {
            try {
                Temporal.Now.zonedDateTimeISO( value );

                return true;
            }
            catch {
                return false;
            }
        },
    },

    "duration": {
        "type": "string",
        validate ( value ) {
            try {
                Temporal.Duration.from( value );

                return true;
            }
            catch {
                return false;
            }
        },
    },
};
