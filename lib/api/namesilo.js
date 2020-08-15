const fetch = require( "../http/fetch" );
const Agent = require( "../http/agent" );
const result = require( "../result" );

module.exports = class Namesilo {
    #apiKey;
    #proxy;
    #agent;

    constructor ( apiKey, options = {} ) {
        this.#apiKey = Array.isArray( apiKey ) ? apiKey : [apiKey];

        this.#proxy = options.proxy;
    }

    async checkDomains ( domains ) {
        const apiKey = this.#apiKey.shift();

        this.#apiKey.push( apiKey );

        if ( !Array.isArray( domains ) ) domains = [domains];

        const idx = Object.fromEntries( domains.map( domain => [domain, true] ) );

        const url = `https://www.namesilo.com/api/checkRegisterAvailability?version=1&type=xml&key=${apiKey}&domains=` + Object.keys( idx ).join( "," );

        const res = await fetch( url, { "agent": this._agent.nodeFetchAgent } );

        if ( !res.ok ) return result( [res.status, res.statusText] );

        const data = await res.text();

        console.log( data );

        // my $code = $data->{namesilo}->{reply}->[0]->{code}->[0]->{content};
        // return res 400 if $code != 300;
        // for my $item ( $data->{namesilo}->{reply}->[0]->{available}->[0]->{domain}->@* ) {
        //     $idx->{ $item->{content} } = 1;
        // }
        // return res 200, $idx;

        return result( 200 );
    }

    get _agent () {
        if ( !this.#agent ) {
            this.#agent = new Agent( {
                "proxy": this.#proxy,
            } );
        }

        return this.#agent;
    }
};
