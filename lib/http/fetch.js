const fetch = require( "node-fetch" );

module.exports = async function ( url, options ) {
    return new Promise( resolve => {
        fetch( url, options )
            .then( res => resolve( res ) )
            .catch( e =>
                resolve( new fetch.Response( null, {
                    "status": 599,
                    "statusText": e.message,
                } ) ) );
    } );
};
