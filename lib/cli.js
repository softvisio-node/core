module.exports = class extends require( "./base.js" ) {
    constructor () {
        super();
    }

    parse ( argv, spec ) {
        var shortOptions = {};

        spec.options = spec.options || {};

        // parse short options
        for ( const option in spec.options ) {
            if ( spec.options[option].short !== undefined && spec.options[option].short !== null && spec.options[option].short !== false ) {
                const short = option.charAt( 0 ).toLowerCase();

                if ( shortOptions[short] !== undefined ) {
                    throw `Short options are duplicated`;
                }

                shortOptions[option] = option;
            }
        }

        var lastOption;

        argv.forEach( ( arg ) => {
            // long option
            if ( arg.substring( 0, 2 ) === "--" ) {
                console.log( arg );
            }

            // short option
            else if ( arg.charAt( 0 ) === "-" ) {
            }

            // argument
            else {
            }

            // console.log( arg );
        } );

        return {};
    }
};
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 24:13         | no-unused-vars               | 'lastOption' is defined but never used.                                        |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 33:49         | no-empty                     | Empty block statement.                                                         |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 37:18         | no-empty                     | Empty block statement.                                                         |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
