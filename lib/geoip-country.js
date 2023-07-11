import MMDB from "#lib/mmdb";
import fs from "node:fs";
import CacheLru from "#lib/cache/lru";
import externalResources from "#lib/external-resources";

const cache = new CacheLru( { "maxSize": 1000 } );

var mmdb;

const resource = await externalResources.add( "softvisio-node/core/resources/geolite2-country", import.meta.url );
resource.on( "update", () => ( mmdb = null ) );

class GeoipCountry {
    constructor () {}

    // public
    get ( ipAddress ) {
        mmdb ??= new MMDB( fs.readFileSync( resource.location + "/GeoLite2-Country.mmdb" ), { cache } );

        return mmdb.get( ipAddress );
    }
}

export default new GeoipCountry();
