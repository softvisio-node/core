import ExternalRecourceBuilder from "#lib/external-resources/builder";
import fetch from "#lib/fetch";
import fs from "fs";
import { readConfig } from "#lib/config";

const VERSION = 1;

const CLOUDFLARE_IPV4_URL = `https://www.cloudflare.com/ips-v4`;
const CLOUDFLARE_IPV6_URL = `https://www.cloudflare.com/ips-v6`;
const GOOGLE_URL = `https://www.gstatic.com/ipranges/goog.json`;

// TODO
// facebook
// whois -h whois.radb.net -- '-i origin AS32934' | grep ^route
//
// cloudflare
// whois -h whois.radb.net -- '-i origin AS13335' | grep ^route
//
// google
// whois -h whois.radb.net -- '-i origin AS15169' | grep ^route

export default class TLD extends ExternalRecourceBuilder {
    #url = "https://data.iana.org/TLD/tlds-alpha-by-domain.txt";

    // properties
    get id () {
        return "softvisio-node/core/resources/subnets";
    }

    // protected
    async _getEtag () {
        const res = await this.#build();

        if ( !res.ok ) return res;

        const hash = this._getHash();

        hash.update( res.data );

        return result( 200, VERSION + ":" + hash.digest( "hex" ) );
    }

    async _build ( location ) {
        const res = await this.#build();

        if ( !res.ok ) return res;

        fs.writeFileSync( location + "/subnets.json", res.data );

        return res;
    }

    // private
    async #build () {
        const subnets = readConfig( "#resources/subnets.yaml", { "resolve": import.meta.url } );

        subnets.cloudflare = [];
        subnets.google = [];

        // cloudflare v4
        var res = await fetch( CLOUDFLARE_IPV4_URL );
        if ( !res.ok ) return res;

        subnets.cloudflare.push( ...( await res.text() )
            .split( "\n" )
            .map( line => line.trim() )
            .filter( line => line )
            .sort() );

        // cloudflare v6
        res = await fetch( CLOUDFLARE_IPV6_URL );
        if ( !res.ok ) return res;

        subnets.cloudflare.push( ...( await res.text() )
            .split( "\n" )
            .map( line => line.trim() )
            .filter( line => line )
            .sort() );

        // google
        res = await fetch( GOOGLE_URL );
        if ( !res.ok ) return res;

        subnets.google.push( ...( await res.json() ).prefixes.map( prefix => prefix.ipv4Prefix || prefix.ipv6Prefix ) );

        return result( 200, JSON.stringify( subnets, null, 4 ) );
    }
}
