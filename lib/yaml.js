import * as yaml from "js-yaml";
import _ejs from "#lib/ejs";
import Locale from "#lib/locale";

class Yaml {

    // public
    stringify ( data, options = {} ) {
        return yaml.dump( data, {
            "indent": 2,
            "lineWidth": -1,
            "quotingType": '"',
            "noCompatMode": true,
            ...options,
        } );
    }

    parse ( buffer, { all, schema, locale, ejs } = {} ) {
        schema ??= this.#buildYamlSchema( locale, ejs );

        const config = yaml.loadAll( buffer, { schema } );

        if ( all ) {
            return config;
        }
        else {
            return config[ 0 ];
        }
    }

    // private
    #buildYamlSchema ( locale, ejs ) {
        locale ||= Locale.default;
        ejs ||= _ejs;

        const schema = yaml.DEFAULT_SCHEMA.extend( [

            // !l10n
            new yaml.Type( "!l10n", {
                "kind": "scalar",

                resolve ( data ) {
                    if ( !data || typeof data !== "string" ) return false;

                    return true;
                },

                construct ( data ) {
                    return locale.l10n( data );
                },
            } ),

            new yaml.Type( "!l10n", {
                "kind": "sequence",

                resolve ( data ) {
                    if ( !data[ 0 ] || typeof data[ 0 ] !== "string" ) return false;

                    if ( data[ 1 ] && typeof data[ 1 ] !== "string" ) return false;

                    if ( data[ 2 ] && typeof data[ 2 ] !== "number" ) return false;

                    return true;
                },

                construct ( data ) {
                    return locale.l10n( ...data );
                },
            } ),

            // !l10nt
            new yaml.Type( "!l10nt", {
                "kind": "scalar",

                resolve ( data ) {
                    if ( !data || typeof data !== "string" ) return false;

                    return true;
                },

                construct ( data ) {
                    return locale.l10nt( data );
                },
            } ),

            new yaml.Type( "!l10nt", {
                "kind": "sequence",

                resolve ( data ) {
                    if ( !data[ 0 ] || typeof data[ 0 ] !== "string" ) return false;

                    if ( data[ 1 ] && typeof data[ 1 ] !== "string" ) return false;

                    if ( data[ 2 ] && typeof data[ 2 ] !== "number" ) return false;

                    return true;
                },

                construct ( data ) {
                    return locale.l10nt( ...data );
                },
            } ),

            // !ejs
            new yaml.Type( "!ejs", {
                "kind": "scalar",

                resolve ( data ) {
                    if ( !data || typeof data !== "string" ) return false;

                    return true;
                },

                construct ( data ) {
                    return ejs( data );
                },
            } ),
        ] );

        return schema;
    }
}

export default new Yaml();
