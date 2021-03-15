const fs = require( "fs" );
const _path = require( "path" );
const YAML = require( "js-yaml" );

module.exports.read = function ( path, options = {} ) {
    var ext = _path.extname( path );

    if ( ext === ".json" ) {
        return JSON.parse( fs.readFileSync( path ) );
    }
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
