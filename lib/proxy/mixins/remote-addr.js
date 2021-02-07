const fetch = require( "../../http/fetch" );
const IPAddr = require( "../../ip/addr" );

module.exports = Super =>
    class extends ( Super || Object ) {
        #callbacks = [];
        #busy;

        async getRemoteAddr () {
            if ( this.remoteAddr ) return this.remoteAddr;

            if ( this.#busy ) return new Promise( resolve => this.#callbacks.push( resolve ) );

            this.#busy = true;

            var addr;

            try {
                const res = await fetch( "https://httpbin.org/ip", { "agent": { "proxy": this } } );

                if ( !res.ok ) throw Error();

                const json = await res.json();

                addr = new IPAddr( json.origin );

                this.remoteAddr = addr;
            }
            catch ( e ) {}

            this.#busy = false;

            const callbacks = this.#callbacks;
            this.#callbacks = [];

            for ( const cb of callbacks ) {
                cb( addr );
            }

            return addr;
        }
    };
