import fs from "fs";
import _path from "path";
import JSON5 from "#lib/json5";
import yaml from "#lib/yaml";
import module from "module";
import url from "url";
import Locale from "#lib/locale";

// options:
// json5: false
// resolve: import.meta.url
// all: yaml load all documents, returns array
export function readConfig ( path, options = {} ) {
    if ( path instanceof URL ) {
        path = url.fileURLToPath( path );
    }
    else if ( path.startsWith( "file:" ) ) {
        path = url.fileURLToPath( path );
    }
    else if ( options.resolve ) {
        path = module.createRequire( options.resolve ).resolve( path );
    }

    const ext = _path.extname( path );

    // json
    if ( ext === ".json" ) {
        return parseJson( fs.readFileSync( path ), options );
    }

    // yaml
    else if ( ext === ".yaml" || ext === ".yml" ) {
        return parseYaml( fs.readFileSync( path, "utf8" ), options );
    }
}

export function writeConfig ( path, data, options = {} ) {
    if ( path instanceof URL ) path = url.fileURLToPath( path );
    else if ( path.startsWith( "file:" ) ) path = url.fileURLToPath( path );
    else if ( options.resolve ) path = module.createRequire( options.resolve ).resolve( path );

    var ext = _path.extname( path );

    if ( ext === ".json" ) {
        fs.writeFileSync( path, JSON.stringify( data, null, options.readable ? 4 : null ) + ( options.readable ? "\n" : "" ) );
    }
    else if ( ext === ".yaml" || ext === ".yml" ) {
        fs.writeFileSync(
            path,
            yaml.dump( data, {
                "indent": 2,
                "quotingType": '"',
                ...options,
            } )
        );
    }
}

export function parseJson ( buffer, { json5 } = {} ) {
    if ( json5 ) {
        return JSON5.parse( buffer );
    }
    else {
        return JSON.parse( buffer );
    }
}

export function parseYaml ( buffer, { all, schema, locale } = {} ) {
    schema ??= buildYamlSchema( locale );

    const config = yaml.loadAll( buffer, { schema } );

    if ( all ) {
        return config;
    }
    else {
        return config[0];
    }
}

function buildYamlSchema ( locale ) {
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

                if ( data[1] && typeof data[1] !== "string" ) return false;

                return true;
            },

            construct ( data ) {
                return locale.l10n( ...data );
            },
        } ),

        // !l10nd
        new yaml.Type( "!l10nd", {
            "kind": "sequence",

            resolve ( data ) {
                if ( !data[1] || typeof data[1] !== "string" ) return false;

                if ( data[2] && typeof data[2] !== "string" ) return false;

                return true;
            },

            construct ( data ) {
                return locale.l10nd( ...data );
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

                if ( data[1] && typeof data[1] !== "string" ) return false;

                return true;
            },

            construct ( data ) {
                return locale.l10nt( ...data );
            },
        } ),
    ] );

    return schema;
}
