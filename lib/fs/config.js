const fs = require( "fs" );
const _path = require( "path" );
const JSON5 = require( "json5" );
const YAML = require( "js-yaml" );
const { createRequire } = require( "module" );

// options:
// json5: false
// cache: true, load json using require()
// resolve: import.meta.url, __filename
// all: yaml load all documents, returns array
module.exports.read = function ( path, options = {} ) {
    var ext = _path.extname( path );

    var _require;

    if ( options.resolve ) _require = createRequire( options.resolve );
    else _require = createRequire( _path.resolve( "1.js" ) );

    path = _require.resolve( path );

    // json
    if ( ext === ".json" ) {
        if ( options.cache ) {

            // XXX https://github.com/nodejs/node/issues/38284
            // XXX this caused only when running script via file assoc
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
};

module.exports.write = function ( path, data, options = {} ) {
    var ext = _path.extname( path );

    if ( ext === ".json" ) {
        fs.writeFileSync( path, JSON.stringify( data, null, options.readable ? 4 : null ) );
    }
    else if ( ext === ".yaml" || ext === ".yml" ) {
        fs.writeFileSync( path, YAML.safeDump( data, { "indent": 2, "quotingType": '"' } ) );
    }
};
