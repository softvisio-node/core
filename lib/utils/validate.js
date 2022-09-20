import "#lib/result";
import { fullFormats } from "ajv-formats/dist/formats.js";

// accepted characters: A-z (case-insensitive), 0-9 and underscores, length: 5-255 characters
export function validateTelegramUsername ( value ) {

    // length must be between 5 and 32 characters
    if ( value.length < 5 || value.length > 255 ) return result( [400, `Telegram username lenght must be between 5 and 255 characters`] );

    // must contain letters, digits and "_" only
    if ( /[^a-z\d_]/i.test( value ) ) return result( [400, `Telegram username must contain letters, digits and "_" character only`] );

    return result( 200 );
}

export function validateEmail ( value ) {
    if ( !fullFormats.email.test( value ) ) return result( [400, `Email address is invalid`] );

    return result( 200 );
}

export function validateHostname ( value ) {
    if ( !fullFormats.hostname.test( value ) ) return result( [400, `Hostname is invalid`] );

    return result( 200 );
}

export function validatePassword ( value, { minLength = 1 } = {} ) {
    minLength ||= 1;

    if ( value.length < minLength ) return result( [400, `Password length must be greater than ${minLength} characters`] );

    return result( 200 );
}
