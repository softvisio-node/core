const fetch = require( "../../http/fetch" );
const IPAddr = require( "../../ip/addr" );

module.exports = Super =>
    class extends Super {
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

        async getRemoteCountry () {
            const addr = await this.getRemoteAddr();

            if ( !addr ) return;

            return addr.country;
        }

        async getRemoteTimezone () {
            const addr = await this.getRemoteAddr();

            if ( !addr ) return;

            return addr.timezone;
        }
    };
