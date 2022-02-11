import { fullFormats } from "ajv-formats/dist/formats.js";

// accepted characters: A-z (case-insensitive), 0-9 and underscores, length: 5-255 characters
export function isInvalidTelegramUsername ( value ) {

    // length must be between 5 and 32 characters
    if ( value.length < 5 || value.length > 255 ) return `Telegram username lenght must be between 5 and 255 characters`;

    // must contain letters, digits and "_" only
    if ( /[^a-z\d_]/i.test( value ) ) return `Telegram username must contain letters, digits and "_" character only`;
}

export function isInvalidEmail ( value ) {
    if ( !fullFormats.email.test( value ) ) return `Email address is invalid`;
}

export function isInvalidHostname ( value ) {
    if ( !fullFormats.hostname.test( value ) ) return `Hostname is invalid`;
}

export function isInvalidPassword ( value, { minLength = 1 } = {} ) {
    minLength ||= 1;

    if ( value.length < minLength ) return `Password length must be greater than ${minLength} characters`;
}

// accepted characters: A-z (case-insensitive), 0-9, "_", "-", "@", ".", length: 3-32 characters, not number, not UUID
export function isInvalidUsername ( value ) {

    // check length
    if ( value.length < 3 || value.length > 32 ) return `Username length must be between 3 and 32 characters`;

    // contains forbidden chars
    if ( /[^a-z\d_@.-]/i.test( value ) ) return `Username must contain letters, digits, "_", "@", ".", "-" characters only`;

    // number
    if ( !isNaN( value ) ) return `Username should not be a number`;

    // looks like uuid
    if ( /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test( value ) ) return `Username should not look like UUID`;
}
