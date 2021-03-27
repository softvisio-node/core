module.exports = require( "events" );

module.exports.parseEvent = function ( name, args ) {
    if ( typeof name === "object" ) return name;

    var group, targets;

    if ( name.startsWith( ":" ) ) {
        let idx = name.indexOf( "/" );
        group = name.substring( 1, idx );
        name = name.substr( idx + 1 );

        idx = group.indexOf( ":" );
        if ( idx > 0 ) {
            targets = group
                .substr( idx + 1 )
                .split( "," )
                .filter( target => target !== "" );
            group = group.substring( 0, idx );
        }
    }

    return { group, targets, name, args };
};
