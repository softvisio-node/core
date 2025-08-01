import { pipeline } from "node:stream/promises";
import ExternalRecourceBuilder from "#lib/external-resource-builder";
import fetch from "#lib/fetch";
import tar from "#lib/tar";

const MAXMIND_ID = "GeoLite2-Country",
    MAXMIND_LICENSE_KEY = process.env.MAXMIND_LICENSE_KEY,
    url = `https://download.maxmind.com/app/geoip_download?edition_id=${ MAXMIND_ID }&license_key=${ MAXMIND_LICENSE_KEY }&suffix=tar.gz`;

export default class TLD extends ExternalRecourceBuilder {
    #lastModified;

    // properties
    get id () {
        return "softvisio-node/core/resources/geolite2-country";
    }

    // protected
    async _getEtag () {
        if ( !MAXMIND_LICENSE_KEY ) return result( [ 500, "Maxmind license key not found" ] );

        const res = await this._getLastModified( url );

        if ( res.ok ) this.#lastModified = res.data;

        return res;
    }

    async _build ( location ) {
        if ( !MAXMIND_LICENSE_KEY ) return result( [ 500, "Maxmind license key not found" ] );

        const res = await fetch( url );

        // request error
        if ( !res.ok ) return res;

        // download and unpack
        return pipeline(
            res.body,
            tar.extract( {
                "cwd": location,
                "filter": ( path, entry ) => path.endsWith( ".mmdb" ),
                "strip": 1,
            } )
        )
            .then( () => result( 200 ) )
            .catch( e => result.catch( e ) );
    }

    async _getMeta () {
        return result( 200, {
            "lastModified": this.#lastModified,
        } );
    }
}
