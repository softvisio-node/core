import events from "events";

export default events;

// :group:target1,target2/event/name
events.parseGroup = function parseGroup ( name, args ) {
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

// :target1,target2/event/name
events.parseTargets = function parseTargets ( name, args ) {
    if ( typeof name === "object" ) return name;

    var targets;

    if ( name.startsWith( ":" ) ) {
        const idx = name.indexOf( "/" );

        targets = name
            .substring( 1, idx )
            .split( "," )
            .filter( target => target !== "" );

        name = name.substr( idx + 1 );
    }

    return { targets, name, args };
};
