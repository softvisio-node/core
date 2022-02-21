import Resources from "#lib/resources";
import fetch from "#lib/fetch";
import fs from "fs";

const CLOUDFLARE_IPV4_URL = `https://www.cloudflare.com/ips-v4`;
const CLOUDFLARE_IPV6_URL = `https://www.cloudflare.com/ips-v6`;

// TODO
// facebook
// whois -h whois.radb.net -- '-i origin AS32934' | grep ^route
//
// cloudflare
// whois -h whois.radb.net -- '-i origin AS13335' | grep ^route
//
// google
// whois -h whois.radb.net -- '-i origin AS15169' | grep ^route

export default class TLD extends Resources.Resource {
    #url = "https://data.iana.org/TLD/tlds-alpha-by-domain.txt";

    // properties
    get id () {
        return "subnets";
    }

    get files () {
        return ["subnets.json"];
    }

    // public
    async getEtag () {

        // cloudflare v4
        var res = await fetch( CLOUDFLARE_IPV4_URL );
        if ( !res.ok ) return res;

        var data = await res.text();

        // cloudflare v6
        res = await fetch( CLOUDFLARE_IPV6_URL );
        if ( !res.ok ) return res;

        data += "\n" + ( await res.text() );

        return result( 200, this._getHash().update( data ) );
    }

    async build ( location ) {
        const data = {
            "loopback": [

                // https://en.wikipedia.org/wiki/IPv4#Loopback
                "127.0.0.0/8",

                // https://en.wikipedia.org/wiki/Reserved_IP_addresses#IPv6
                "::1/128",
            ],
            "private": [

                // https://en.wikipedia.org/wiki/IPv4#Private_networks
                "10.0.0.0/8",
                "172.16.0.0/12",
                "192.168.0.0/16",

                // https://en.wikipedia.org/wiki/Reserved_IP_addresses#IPv6
                "fc00::/7",
            ],
            "cloudflare": [],
        };

        // cloudflare v4
        var res = await fetch( CLOUDFLARE_IPV4_URL );
        if ( !res.ok ) return res;

        data.cloudflare.push( ...( await res.text() )
            .split( "\n" )
            .map( line => line.trim() )
            .filter( line => line )
            .sort() );

        res = await fetch( CLOUDFLARE_IPV6_URL );
        if ( !res.ok ) return res;

        data.cloudflare.push( ...( await res.text() )
            .split( "\n" )
            .map( line => line.trim() )
            .filter( line => line )
            .sort() );

        fs.writeFileSync( location + "/" + this.files[0], JSON.JSON.stringify( data, null, 4 ) );

        return result( 200 );
    }
}
