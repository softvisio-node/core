export function validateNginxSizeValue ( value ) {
    return /^\d+[kKmMgG]?$/.test( value + "" );
}

export function validateNginxDurationValue ( value ) {
    value = value + "";

    if ( !value ) return false;

    if ( /^\d+$/.test( value ) ) return true;

    if ( /^\d+(?:ms|s|m|h|d|w|M|y)$/.test( value ) ) return true;

    if ( /^(?:\d+y\s*)?(?:\d+M\s*)?(?:\d+w\s*)?(?:\d+d\s*)?(?:\d+h\s*)?(?:\d+m\s*)?(?:\d+s\s*)?(?:\d+ms\s*)?$/.test( value ) ) return true;

    return false;
}
