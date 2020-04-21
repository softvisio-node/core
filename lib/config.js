var fs = require( "fs" );
const path = require( "path" );
const JSON5 = require( "json5" );
const YAML = require( "yaml" );

module.exports.read = function ( config_path ) {
    var ext = path.extname( config_path );

    if ( ext === ".json" ) {
        return JSON.parse( fs.readFileSync( config_path ) );
    }
    else if ( ext === ".json5" ) {
        return JSON5.parse( fs.readFileSync( config_path ) );
    }
    else if ( ext === ".yaml" || ext === ".yml" ) {
        return YAML.parse( fs.readFileSync( config_path, "utf8" ) );
    }
};

module.exports.write = function ( config_path, data, readable ) {
    var ext = path.extname( config_path );

    if ( ext === ".json" || ext === ".json5" ) {
        fs.writeFile( config_path, JSON.stringify( data, null, readable ? 4 : null ) );
    }
    else if ( ext === ".yaml" || ext === ".yml" ) {
        fs.writeFile( config_path, YAML.stringify( data, { "indent": 4 } ) );
    }
};
