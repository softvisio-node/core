import yaml from "js-yaml";
import Locale from "#lib/locale";

class Yaml {

    // public
    stringify ( data, options = {} ) {
        return yaml.dump( data, {
            "indent": 2,
            "quotingType": '"',
            ...options,
        } );
    }

    parse ( buffer, { all, schema, locale } = {} ) {
        schema ??= this.#buildYamlSchema( locale );

        const config = yaml.loadAll( buffer, { schema } );

        if ( all ) {
            return config;
        }
        else {
            return config[0];
        }
    }

    // private
    #buildYamlSchema ( locale ) {
        locale ||= new Locale();

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
                    if ( !data[0] || typeof data[0] !== "string" ) return false;

                    if ( data[1] ) {
                        if ( typeof data[1] !== "object" ) return false;

                        if ( data[1].plural && typeof data[1].plural !== "string" ) return false;

                        if ( data[1].pluralNumber && typeof data[1].pluralNumber !== "number" ) return false;

                        if ( data[1].domain && typeof data[1].domain !== "string" ) return false;

                        if ( data[1].tags ) {
                            const tags = Array.isArray( data[1].tags ) ? data[1].tags : [data[1].tags];

                            for ( const tag of tags ) {
                                if ( typeof tag !== "string" ) return false;
                            }
                        }
                    }

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
                    if ( !data[0] || typeof data[0] !== "string" ) return false;

                    if ( data[1] ) {
                        if ( typeof data[1] !== "object" ) return false;

                        if ( data[1].plural && typeof data[1].plural !== "string" ) return false;

                        if ( data[1].pluralNumber && typeof data[1].pluralNumber !== "number" ) return false;

                        if ( data[1].domain && typeof data[1].domain !== "string" ) return false;

                        if ( data[1].tags ) {
                            const tags = Array.isArray( data[1].tags ) ? data[1].tags : [data[1].tags];

                            for ( const tag of tags ) {
                                if ( typeof tag !== "string" ) return false;
                            }
                        }
                    }

                    return true;
                },

                construct ( data ) {
                    return locale.l10nt( ...data );
                },
            } ),
        ] );

        return schema;
    }
}

export default new Yaml();
