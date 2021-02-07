const fetch = require( "../../http/fetch" );
const IPAddr = require( "../../ip/addr" );

module.exports = Super =>
    class extends ( Super || Object ) {

        // XXX stack calls
        async getRemoteAddr () {
            if ( this.remoteAdr ) return this.remoteAdr;

            const res = await fetch( "https://httpbin.org/ip", { "agent": { "proxy": this } } );

            if ( !res.ok ) return;

            try {
                const json = await res.json();

                const addr = new IPAddr( json.origin );

                this.remoteAdr = addr;

                return addr;
            }
            catch ( e ) {
                return;
            }
        }
    };
