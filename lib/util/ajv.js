const Ajv = require( "ajv" ).default;
const ajvErrors = require( "ajv-errors" );
const ajvFormats = require( "ajv-formats" );
const ajvFormatsDraft2019 = require( "ajv-formats-draft2019" );
const ajvKeywords = require( "ajv-keywords" );

// const ajvMergePatch = require( "ajv-merge-patch" );

module.exports.ajv = function ( options = {} ) {
    options = {
        "strict": false,
        "coerceTypes": true,
        "allErrors": true,
        ...options,
    };

    const ajv = new Ajv( options );

    // plugins
    ajvErrors( ajv, { "keepErrors": false, "singleError": false } );
    ajvFormats( ajv );
    ajvFormatsDraft2019( ajv );
    ajvKeywords( ajv );

    // ajvMergePatch( ajv );

    return ajv;
};
