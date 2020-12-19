const { isPlainObject } = require( "../util" );
const fetch = require( "node-fetch" );
const Agent = require( "./agent" );

module.exports = async function ( url, options = {} ) {
    if ( isPlainObject( options.agent ) ) {
        options = { ...options, "agent": new Agent( options.agent ).fetchAgent };
    }

    return new Promise( resolve => {
        fetch( url, options )
            .then( res => {
                res.reason = res.statusText;

                resolve( res );
            } )
            .catch( e => {
                const res = new fetch.Response( null, {
                    "status": 599,
                    "statusText": e.message,
                } );

                res.reason = res.statusText;

                resolve( res );
            } );
    } );
};

module.exports.agent = Agent;
