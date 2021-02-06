const fetch = require( "../../http/fetch" );
const IPAddr = require( "../../ip/addr" );

module.exports = Super =>
    class extends ( Super || Object ) {
        async getRemoteAddr () {
            const res = await fetch( "https://httpbin.org/ip", { "agent": { "proxy": this } } );

            if ( !res.ok ) return;

            try {
                const json = await res.json();

                return new IPAddr( json.origin );
            }
            catch ( e ) {
                return;
            }
        }
    };
