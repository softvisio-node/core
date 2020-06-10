const Ajv = require( "ajv" );
const result = require( "./result" );
const fs = require( "./fs" );
const path = require( "path" );
const url = require( "url" );
const YAML = require( "js-yaml" );

const commentRegex = /\/\*\*([\s\S]*?)\*\//gm;

module.exports = class {
    #base;
    #deps = {};

    async parse ( sourcePath ) {
        this.#base = sourcePath;

        var files = await fs.readTree( sourcePath );

        for ( const file of files ) {
            if ( path.extname( file ) !== ".js" ) continue;

            if ( path.basename( file ) === ".pnp.js" ) continue;

            this._parseModule( sourcePath + "/" + file );
        }

        console.log( this.#deps );
    }

    _parseModule ( sourcePath ) {
        if ( this.#deps[sourcePath] ) return;

        const content = fs.readFileSync( sourcePath, "utf8" );

        const spec = this._parseComments( content );

        this.#deps[sourcePath] = spec;

        if ( spec.extends ) {
            if ( !Array.isArray( spec.extends ) ) spec.extends = [spec.extends];

            for ( const base of spec.extends ) {
                const source = require.resolve( base, { "paths": [path.dirname( sourcePath )] } );

                this._parseModule( source );
            }
        }
    }

    _parseComments ( content ) {
        const regexResults = content.match( commentRegex );

        let spec = {};

        if ( regexResults ) {
            for ( let i = 0; i < regexResults.length; i += 1 ) {
                regexResults[i] = regexResults[i].replace( /^\s*\/\*+.*$/gm, "" );
                regexResults[i] = regexResults[i].replace( /^\s*\*\/.*/gm, "" );
                regexResults[i] = regexResults[i].replace( /^\s*\*\s/gm, "" );

                const block = YAML.safeLoad( regexResults[i] );

                if ( block.class ) {
                    spec = block;

                    block.methods = {};
                }
                else if ( block.method ) {
                    spec.methods[block.method] = block;
                }
            }
        }

        return spec;
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
// | ERROR | 5:7           | no-unused-vars               | 'url' is assigned a value but never used.                                      |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 43:23         | no-unused-vars               | 'source' is assigned a value but never used.                                   |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 45:36         | no-undef                     | 'sourc' is not defined.                                                        |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
