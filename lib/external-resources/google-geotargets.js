import ExternalResourceBuilder from "#lib/external-resource-builder";
import url from "node:url";
import sql from "#lib/sql";
import fetch from "#lib/fetch";
import csv from "#lib/csv";
import * as uule from "#lib/api/google/uule";
import { DOMParser } from "#lib/linkedom";
import path from "node:path";

export default class GoogleGeotargets extends ExternalResourceBuilder {
    #version;
    #url;

    // properties
    get id () {
        return "softvisio-node/core/resources/google-geotargets";
    }

    // protected
    async _getEtag ( { etag, buildDate, meta } ) {
        const res = await this.#prepare();
        if ( !res.ok ) return res;

        return result( 200, this.#version );
    }

    async _build ( location ) {
        var res = await this.#prepare();
        if ( !res.ok ) return res;

        res = await fetch( this.#url );
        if ( !res.ok ) return res;

        var data = await res.text();

        // XXX patch - v2024-08-13
        if ( data.includes( '"9041231","Athens International Airport "Eleftherios Venizelos"","Eleftherios Venizelos Athens International Airport,Decentralized Administration of Attica,Greece","9069538","GR","Airport",Removal Planned' ) ) {
            data = data.replace(
                '"9041231","Athens International Airport "Eleftherios Venizelos"","Eleftherios Venizelos Athens International Airport,Decentralized Administration of Attica,Greece","9069538","GR","Airport",Removal Planned',

                '"9041231","Athens International Airport ""Eleftherios Venizelos""","Eleftherios Venizelos Athens International Airport,Decentralized Administration of Attica,Greece","9069538","GR","Airport",Removal Planned'
            );
        }

        try {
            var values = csv.parse( data, { "header": [ "id", "name", "canonical_name", "parent_id", "country", "type", "status" ] } ).map( row => {
                row.type = row.type.toLowerCase();
                row.status = row.status.toLowerCase();

                row.uule = uule.encode( row.canonical_name );

                return row;
            } );
        }
        catch {
            return result( [ 500, "CSV parsing error" ] );
        }

        const dbh = sql.new( url.pathToFileURL( location + "/google-geotargets.sqlite" ) );

        dbh.exec( sql`
CREATE TABLE IF NOT EXISTS geotarget (
    id int4 PRIMARY KEY,
    name text NOT NULL COLLATE NOCASE,
    canonical_name text NOT NULL COLLATE NOCASE,
    parent_id text,
    country text COLLATE NOCASE,
    type text COLLATE NOCASE,
    status text COLLATE NOCASE,
    uule text
);

CREATE INDEX geotarget_name_idx ON geotarget ( name );
CREATE INDEX geotarget_canonical_name_idx ON geotarget ( canonical_name );
CREATE INDEX geotarget_type_country_idx ON geotarget ( type = 'country', country );
CREATE INDEX geotarget_type_nams_country_idx ON geotarget ( type, name, country );
` );

        dbh.do( sql`INSERT INTO "geotarget"`.VALUES( values ) );

        dbh.destroy();

        return result( 200 );
    }

    async _getMeta () {
        return {
            "version": "v" + this.#version,
        };
    }

    // private
    async #prepare () {
        if ( !this.#version ) {
            const baseUrl = "https://developers.google.com/adwords/api/docs/appendix/geotargeting";

            const res = await fetch( baseUrl, {
                "headers": {
                    "accept-language": "en-US",
                },
            } );
            if ( !res.ok ) return res;

            const text = await res.text();

            const document = new DOMParser().parseFromString( text, "text/html" );

            const link = document.querySelector( `a:contains("Latest zipped CSV")` );
            if ( !link ) return result( [ 500, `Geotargets parsing error` ] );

            const href = link.getAttribute( "href" ).replace( ".zip", "" );

            this.#url = new URL( href, baseUrl );

            this.#version = path.basename( this.#url.pathname ).match( /(\d\d\d\d-\d\d-\d\d)/ )?.[ 1 ];

            if ( !this.#version ) return result( [ 500, `Geotargets version parsing error` ] );
        }

        return result( 200 );
    }
}
