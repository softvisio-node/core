const Ajv = require( "ajv" );
const result = require( "./result" );
const fs = require( "./fs" );
const path = require( "path" );
const YAML = require( "js-yaml" );

const commentRegex = /\/\*\*([\s\S]*?)\*\//gm;

module.exports = class {
    #namespace;
    #modules = {};
    #namespaceModules = {};

    constructor ( namespace ) {
        this.#namespace = path.resolve( namespace );
    }

    // TODO
    async getApiSchema () {
        await this._scanNamespace();

        const schema = {};

        // console.log( JSON.stringify( this.#modules, null, 4 ) );
        // console.log( JSON.stringify( this.#namespaceModules, null, 4 ) );

        for ( const moduleName in this.#namespaceModules ) {
            for ( const methodName in this.#namespaceModules[moduleName].methods ) {
                const method = this.#namespaceModules[moduleName].methods[methodName];

                if ( method.isApiMethod ) {
                    const methodId = ( moduleName + "/" + methodName.substr( 4 ) ).replace( /_/g, "-" );

                    // TODO create validator
                    const validate = function () {
                        return true;
                    };

                    schema[methodId] = { ...method, validate, moduleName };
                }
            }
        }

        return schema;
    }

    async _scanNamespace () {
        var modules = await fs.readTree( this.#namespace );

        for ( const modulePath of modules ) {

            // filter out not *.js files
            if ( path.extname( modulePath ) !== ".js" ) continue;

            this._loadModule( modulePath );
        }
    }

    _loadModule ( modulePath ) {
        const absModulePath = path.resolve( this.#namespace, modulePath );

        // module is already processed
        if ( this.#modules[absModulePath] ) return this.#modules[absModulePath];

        this.#modules[absModulePath] = true;

        const spec = this._parseModule( absModulePath );

        this.#modules[absModulePath] = spec;

        let namespacePath = path.relative( this.#namespace, absModulePath );

        // module belongs to scanned namespace
        if ( namespacePath.charAt( 0 ) !== "." ) {
            namespacePath = "/" + path.posix.join( path.dirname( namespacePath ), path.parse( namespacePath ).name );

            this.#namespaceModules[namespacePath] = spec;
        }

        return spec;
    }

    // TODO validate docBlock using JsonSchema
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

                    // ignore docBlock
                    if ( docBlock.ignore ) continue;

                    // TODO
                }

                // module function
                else if ( docBlock.function ) {

                    // ignore docBlock
                    if ( docBlock.ignore ) continue;

                    // TODO
                }

                // class
                else if ( docBlock.class ) {

                    // ignore docBlock
                    if ( docBlock.ignore ) continue;

                    spec = docBlock;
                    currentClass = docBlock;

                    // set "name" property
                    docBlock.name = docBlock.class;
                    delete docBlock.class;

                    if ( !currentClass.properties ) currentClass.properties = {};
                    if ( !currentClass.methods ) currentClass.methods = {};

                    // TODO ajv

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

                            // load super class module
                            const superClassSpec = this._loadModule( superClass );

                            // copy properties from super class
                            currentClass.properties = this._mergeClassSymbols( superClassSpec.properties, currentClass.properties );

                            // copy methods from super class
                            currentClass.methods = this._mergeClassSymbols( superClassSpec.methods, currentClass.methods );
                        }
                    }
                }

                // class property
                else if ( docBlock.property ) {

                    // set "name" property
                    docBlock.name = docBlock.property;
                    delete docBlock.property;

                    // ignore docBlock
                    if ( docBlock.ignore ) {
                        delete currentClass.properties[docBlock.name];

                        continue;
                    }

                    // set "access" property
                    if ( docBlock.name.charAt( 0 ) === "#" ) {
                        docBlock.access = "private";
                    }
                    else if ( docBlock.name.charAt( 0 ) === "_" ) {
                        docBlock.access = "protected";
                    }
                    else {
                        docBlock.access = "public";
                    }

                    // TODO ajv

                    // add property to current class
                    currentClass.properties = this._mergeClassSymbols( currentClass.properties, { [docBlock.name]: docBlock } );
                }

                // class method
                else if ( docBlock.method ) {

                    // set "name" property
                    docBlock.name = docBlock.method;
                    delete docBlock.method;

                    // ignore docBlock
                    if ( docBlock.ignore ) {
                        delete currentClass.methods[docBlock.name];

                        continue;
                    }

                    // set "access" property
                    if ( docBlock.name.charAt( 0 ) === "_" ) {
                        docBlock.access = "protected";
                    }
                    else if ( !docBlock.access ) {
                        docBlock.access = "public";
                    }

                    let isApiMethod = false;

                    // api method
                    if ( docBlock.name.substr( 0, 4 ) === "API_" ) {
                        isApiMethod = true;

                        // convert permissions array to object
                        if ( docBlock.permissions ) {
                            docBlock.permissions = Object.fromEntries( docBlock.permissions.map( ( permission ) => [permission, true] ) );
                        }
                    }

                    // TODO ajv

                    docBlock.isApiMethod = isApiMethod;

                    // add method to current class
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
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
