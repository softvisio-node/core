const Ajv = require( "ajv" );
const result = require( "./result" );
const fs = require( "./fs" );
const path = require( "path" );
const url = require( "url" );
const YAML = require( "js-yaml" );

const commentRegex = /\/\*\*([\s\S]*?)\*\//gm;

module.exports = class {
    async parse ( sourcePath ) {
        var files = await fs.readTree( sourcePath );

        for ( const file of files ) {
            console.log( file );

            // const ext = path.extname( file );
            // // skip non-yaml files
            // if ( ext !== ".yaml" && ext !== ".yml" ) continue;
            // const schemaPath = path.posix.normalize( `/${path.dirname( file )}/${path.basename( file, ext )}` );
            // this._processSpec( ajv, namespace, schemaPath, `${path1}/${file}` );
        }
    }

    _parseComments ( content ) {
        const regexResults = content.match( commentRegex );

        if ( regexResults ) {
            for ( let i = 0; i < regexResults.length; i += 1 ) {
                regexResults[i] = regexResults[i].replace( /^\s*\/\*+.*$/gm, "" );
                regexResults[i] = regexResults[i].replace( /^\s*\*\/.*/gm, "" );
                regexResults[i] = regexResults[i].replace( /^\s*\*\s/gm, "" );

                // console.log( regexResults[i] );
                console.log( JSON.stringify( YAML.safeLoad( regexResults[i] ), null, 4 ) );

                console.log( "---------------------------------------" );
            }
        }
    }
};
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 1:7           | no-unused-vars               | 'Ajv' is assigned a value but never used.                                      |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 2:7           | no-unused-vars               | 'result' is assigned a value but never used.                                   |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 4:7           | no-unused-vars               | 'path' is assigned a value but never used.                                     |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 5:7           | no-unused-vars               | 'url' is assigned a value but never used.                                      |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
