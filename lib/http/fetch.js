const { isPlainObject } = require( "../util" );
const fetch = require( "node-fetch" );
const Agent = require( "./agent" );

// options:
// proxy: null
// rejectUnauthorized: true
module.exports = async function ( url, options = {} ) {
    if ( options.agent ) {
        if ( isPlainObject( options.agent ) ) {
            options = { ...options, "agent": new Agent( options.agent ).fetchAgent };
        }
        else if ( options.agent instanceof Agent ) {
            options = { ...options, "agent": options.agent.fetchAgent };
        }
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

module.exports.Agent = Agent;
