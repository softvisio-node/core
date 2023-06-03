import fs from "fs";
import _path from "path";
import JSON5 from "#lib/json5";
import yaml from "#lib/yaml";
import module from "module";
import url from "url";

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
        return parseJsonConfig( fs.readFileSync( path ), options );
    }

    // yaml
    else if ( ext === ".yaml" || ext === ".yml" ) {
        return parseYamlConfig( fs.readFileSync( path, "utf8" ), options );
    }
}

export function parseJsonConfig ( buffer, options = {} ) {
    if ( options.json5 ) {
        return JSON5.parse( buffer );
    }
    else {
        return JSON.parse( buffer );
    }
}

export function parseYamlConfig ( buffer, { all, schema, locale } = {} ) {
    schema ??= buildYamlSchema( locale );

    const config = yaml.loadAll( buffer, { schema } );

    if ( all ) {
        return config;
    }
    else {
        return config[0];
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

function buildYamlSchema ( locale ) {
    const schema = yaml.DEFAULT_SCHEMA.extend( [
        new yaml.Type( "!i18n", {
            "kind": "sequence",

            resolve ( data ) {
                if ( !Array.isArray( data ) ) return false;

                if ( !data[0] || typeof data[0] !== "string" ) return false;

                if ( data[1] && typeof data[1] !== "string" ) return false;

                return true;
            },

            construct ( data ) {
                if ( !locale ) {
                    return data[0];
                }
                else {
                    return locale.i18n( ...data );
                }
            },
        } ),
        new yaml.Type( "!i18nd", {
            "kind": "sequence",

            resolve ( data ) {
                if ( !Array.isArray( data ) ) return false;

                if ( !data[1] || typeof data[1] !== "string" ) return false;

                if ( data[2] && typeof data[2] !== "string" ) return false;

                return true;
            },

            construct ( data ) {
                if ( !locale ) {
                    return data[1];
                }
                else {
                    return locale.i18nd( ...data );
                }
            },
        } ),
        new yaml.Type( "!i18nt", {
            "kind": "sequence",

            resolve ( data ) {
                if ( !Array.isArray( data ) ) return false;

                if ( !data[0] || typeof data[0] !== "string" ) return false;

                if ( data[1] && typeof data[1] !== "string" ) return false;

                return true;
            },

            construct ( data ) {
                if ( !locale ) {
                    return data;
                }
                else {
                    return locale.i18nt( locale => locale.i18n( ...data ) );
                }
            },
        } ),
    ] );

    return schema;
}
