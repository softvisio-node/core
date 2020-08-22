const fetch = require( "node-fetch" );
const Agent = require( "./agent" );

module.exports = async function ( url, options ) {
    if ( options.proxy && !options.agent ) options.agent = new Agent( { "proxy": options.proxy } ).nodeFetchAgent;

    return new Promise( resolve => {
        fetch( url, options )
            .then( res => {
                res.reason = res.statusText;

                resolve( res );
            } )
            .catch( e =>
                resolve( new fetch.Response( null, {
                    "status": 599,
                    "statusText": e.message,
                    "reason": e.message,
                } ) ) );
    } );
};
