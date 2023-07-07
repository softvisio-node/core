import resources from "#lib/resources";
import { Reader as MMDB } from "mmdb-lib";
import fs from "node:fs";
import CacheLru from "#lib/cache/lru";

const cache = new CacheLru( { "maxSize": 1000 } );

var mmdb;

resources.on( "update", resource => {
    if ( resource.id === "country" ) mmdb = null;
} );

class GeoipCountry {
    constructor () {}

    // public
    get ( ipAddress ) {
        mmdb ??= new MMDB( fs.readFileSync( resources.location + "/country" ), { cache } );

        return mmdb.get( ipAddress );
    }
}

export default new GeoipCountry();
