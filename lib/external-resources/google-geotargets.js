import ExternalResourceBuilder from "#lib/external-resource-builder";
import url from "node:url";
import sql from "#lib/sql";
import fetch from "#lib/fetch";
import csv from "#lib/csv";
import * as uule from "#lib/api/google/uule";

export default class GoogleGeotargets extends ExternalResourceBuilder {
    #version;
    #url;

    // properties
    get id () {
        return "softvisio-node/core/resources/google-geotargets";
    }

    // protected
    async _getEtag () {
        const res = await this.#prepare();
        if ( !res.ok ) return res;

        return result( 200, this.#version );
    }

    async _build ( location ) {
        var res = await this.#prepare();
        if ( !res.ok ) return res;

        const dbh = await sql.new( url.pathToFileURL( location + "/geotargets.sqlite" ) );

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

        res = await fetch( this.#url );
        if ( !res.ok ) throw res;

        const data = await res.text();

        const values = csv.parse( data, { "header": [ "id", "name", "canonical_name", "parent_id", "country", "type", "status" ] } ).map( row => {
            row.type = row.type.toLowerCase();
            row.status = row.status.toLowerCase();

            row.uule = uule.encode( row.canonical_name );

            return row;
        } );

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
            const res = await fetch( "https://developers.google.com/adwords/api/docs/appendix/geotargeting?csw=1" );
            if ( !res.ok ) return res;

            const text = await res.text();

            text.match( /<a><\/a>/ );

            const match = text.match( /<a[^>]+href="([^"]+)"[^>]*>Latest zipped CSV/ ),
                href = match?.[ 1 ];

            this.#version = href.slice( -18, -8 );

            this.#url = `https://developers.google.com${ href.replace( ".zip", "" ) }`;
        }

        return result( 200 );
    }
}
