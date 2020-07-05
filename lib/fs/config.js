const fs = require( "fs" );
const path = require( "path" );
const YAML = require( "js-yaml" );

module.exports.read = function ( config_path ) {
    var ext = path.extname( config_path );

    if ( ext === ".json" ) {
        return JSON.parse( fs.readFileSync( config_path ) );
    }
    else if ( ext === ".yaml" || ext === ".yml" ) {
        return YAML.safeLoad( fs.readFileSync( config_path, "utf8" ) );
    }
};

module.exports.write = function ( config_path, data, readable ) {
    var ext = path.extname( config_path );

    if ( ext === ".json" ) {
        fs.writeFile( config_path, JSON.stringify( data, null, readable ? 4 : null ) );
    }
    else if ( ext === ".yaml" || ext === ".yml" ) {
        fs.writeFile( config_path, YAML.safeDump( data, { "indent": 2 } ) );
    }
};
