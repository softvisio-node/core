const Ajv = require( "ajv" );
const result = require( "./result" );
const fs = require( "./fs" );
const path = require( "path" );
const url = require( "url" );
const YAML = require( "js-yaml" );

const commentRegex = /\/\*\*([\s\S]*?)\*\//gm;

module.exports = class {
    #namespace;
    #modules = {};

    constructor ( namespace ) {
        this.#namespace = path.resolve( namespace );
    }

    // TODO
    async getApiSchema () {
        await this._scanNamespace();

        console.log( JSON.stringify( this.#modules, null, 4 ) );
    }

    // TODO
    async getApiPermissions () {}

    async _scanNamespace () {
        var modules = await fs.readTree( this.#namespace );

        for ( const modulePath of modules ) {

            // filter out not *.js files
            if ( path.extname( modulePath ) !== ".js" ) continue;

            this._scanModule( modulePath );
        }
    }

    _scanModule ( modulePath ) {
        const absModulePath = path.resolve( this.#namespace, modulePath );

        // module is already processed
        if ( this.#modules[absModulePath] ) return this.#modules[absModulePath];

        this.#modules[absModulePath] = true;

        const namespacePath = path.relative( this.#namespace, absModulePath );

        const spec = this._parseModule( absModulePath );

        this.#modules[absModulePath] = spec;

        return spec;
    }

    _parseModule ( absModulePath ) {
        const content = fs.readFileSync( absModulePath, "utf8" );

        let spec = {},
            currentClass;

        const docBlocks = content.match( commentRegex );

        if ( docBlocks ) {
            for ( let docBlock of docBlocks ) {
                docBlock = docBlock.replace( /^\s*\/\*+.*$/gm, "" );
                docBlock = docBlock.replace( /^\s*\*\/.*/gm, "" );
                docBlock = docBlock.replace( /^\s*\*\s/gm, "" );

                docBlock = YAML.safeLoad( docBlock );

                // module
                if ( docBlock.module ) {

                    // TODO
                }

                // module function
                else if ( docBlock.function ) {

                    // TODO
                }

                // class
                else if ( docBlock.class ) {
                    spec = docBlock;

                    currentClass = docBlock;

                    if ( !currentClass.properties ) currentClass.properties = {};
                    if ( !currentClass.methods ) currentClass.methods = {};

                    // process "extends"
                    if ( currentClass.extends ) {
                        if ( !Array.isArray( currentClass.extends ) ) currentClass.extends = [currentClass.extends];

                        for ( let superClass of currentClass.extends ) {

                            // relative node module path
                            if ( superClass.charAt( 0 ) === "." ) {
                                superClass = path.resolve( path.dirname( absModulePath ), superClass + ".js" );
                            }

                            // global node module path
                            else {
                                superClass = require.resolve( superClass );
                            }

                            const superClassSpec = this._scanModule( superClass );

                            currentClass.properties = this._mergeClassSymbols( superClassSpec.properties, currentClass.properties );
                            currentClass.methods = this._mergeClassSymbols( superClassSpec.methods, currentClass.methods );
                        }
                    }
                }

                // class property
                else if ( docBlock.property ) {
                    docBlock.name = docBlock.property;
                    delete docBlock.property;
                    currentClass.properties = this._mergeClassSymbols( currentClass.properties, { [docBlock.name]: docBlock } );
                }

                // class method
                else if ( docBlock.method ) {
                    docBlock.name = docBlock.method;
                    delete docBlock.method;
                    currentClass.methods = this._mergeClassSymbols( currentClass.methods, { [docBlock.name]: docBlock } );
                }
            }
        }

        return spec;
    }

    _mergeClassSymbols ( baseSymbols, newSymbols ) {
        const symbols = { ...baseSymbols };

        for ( const symbol in newSymbols ) {
            if ( symbols[symbol] ) {
                symbols[symbol] = {
                    ...symbols[symbol],
                    ...newSymbols[symbol],
                };
            }
            else {
                symbols[symbol] = newSymbols[symbol];
            }
        }

        return symbols;
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
// | ERROR | 48:15         | no-unused-vars               | 'namespacePath' is assigned a value but never used.                            |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
