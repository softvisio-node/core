import fs from "fs";
import _path from "path";
import JSON5 from "#lib/json5";
import YAML from "#lib/yaml";
import module from "module";
import url from "url";

// options:
// json5: false
// resolve: import.meta.url
// all: yaml load all documents, returns array
export function read ( path, options = {} ) {
    if ( path instanceof URL ) path = url.fileURLToPath( path );
    else if ( path.startsWith( "file://" ) ) path = url.fileURLToPath( path );
    else if ( options.resolve ) path = module.createRequire( options.resolve ).resolve( path );

    const ext = _path.extname( path );

    // json
    if ( ext === ".json" ) {
        if ( options.json5 ) {
            return JSON5.parse( fs.readFileSync( path ) );
        }
        else {
            return JSON.parse( fs.readFileSync( path ) );
        }
    }

    // yaml
    else if ( ext === ".yaml" || ext === ".yml" ) {
        const data = YAML.loadAll( fs.readFileSync( path, "utf8" ) );

        if ( options.all ) {
            return data;
        }
        else {
            return data[0];
        }
    }
}

export function write ( path, data, options = {} ) {
    if ( path instanceof URL ) path = url.fileURLToPath( path );
    else if ( path.startsWith( "file://" ) ) path = url.fileURLToPath( path );
    else if ( options.resolve ) path = module.createRequire( options.resolve ).resolve( path );

    var ext = _path.extname( path );

    if ( ext === ".json" ) {
        fs.writeFileSync( path, JSON.stringify( data, null, options.readable ? 4 : null ) + ( options.readable ? "\n" : "" ) );
    }
    else if ( ext === ".yaml" || ext === ".yml" ) {
        fs.writeFileSync( path, YAML.safeDump( data, { "indent": 2, "quotingType": '"' } ) );
    }
}
