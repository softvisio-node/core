const { mixin } = require( "../../mixins" );
const IPAddr = require( "../../ip/addr" );

module.exports = mixin( Super =>
    class extends Super {
        async getRemoteAddr () {
            const fetch = require( "../../http/fetch" );

            const res = await fetch( "https://httpbin.org/ip", { "agent": { "proxy": this } } );

            if ( !res.ok ) return;

            const json = await res.json();

            return new IPAddr( json.origin );
        }
    } );
