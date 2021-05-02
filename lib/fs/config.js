import fs from "fs";
import _path from "path";
import JSON5 from "json5";
import YAML from "js-yaml";
import module from "module";

// options:
// json5: false
// require: true, load json using require()
// resolve: import.meta.url
// all: yaml load all documents, returns array
export function read ( path, options = {} ) {
    var ext = _path.extname( path );

    var _require;

    if ( options.resolve ) _require = module.createRequire( options.resolve );
    else _require = module.createRequire( _path.resolve( "1.js" ) );

    path = _require.resolve( path );

    // XXX lowercase drive letter
    // XXX https://github.com/nodejs/node/issues/38284
    // XXX this caused only when running script via file assoc, because windows always expand script name to full path withh uppercase drive letter
    if ( process.platform === "win32" ) path = path[0].toLowerCase() + path.substr( 1 );

    // json
    if ( ext === ".json" ) {
        if ( options.require ) {
            return _require( path );
        }
        else if ( options.json5 ) {
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
    var ext = _path.extname( path );

    if ( ext === ".json" ) {
        fs.writeFileSync( path, JSON.stringify( data, null, options.readable ? 4 : null ) + ( options.readable ? "\n" : "" ) );
    }
    else if ( ext === ".yaml" || ext === ".yml" ) {
        fs.writeFileSync( path, YAML.safeDump( data, { "indent": 2, "quotingType": '"' } ) );
    }
}
