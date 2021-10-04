export default function isValidCamelCase ( name ) {

    // not a camelCase string
    if ( !/^[a-z][a-zA-z0-9]*$/.test( name ) ) return;

    // has consecutive latters in upper case
    if ( /[A-Z]{2,}/.test( name ) ) return;

    return true;
}
