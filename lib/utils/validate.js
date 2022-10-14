import "#lib/result";
import { fullFormats } from "ajv-formats/dist/formats.js";
import passwords from "#lib/utils/passwords";

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

export function validatePassword ( value, { strength } = {} ) {
    return passwords.checkPasswordStrength( value, { strength } );
}
