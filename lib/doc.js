const Ajv = require( "ajv" );
const fs = require( "./fs" );
const path = require( "path" );
const YAML = require( "js-yaml" );
const commentRegex = /\/\*\*([\s\S]*?)\*\//gm;

const ajv = new Ajv().addSchema( fs.config.read( require.resolve( "@softvisio/core/resources/schemas/doc.yaml" ) ) );

module.exports = class {
    #namespace;
    #isScanned = false;
    #modules = {}; // scanned modules
    #symbols = {};

    // ------------------

    #namespaceModules = {};

    constructor ( namespace ) {
        this.#namespace = path.resolve( namespace );
    }

    async _scanNamespace () {
        if ( this.#isScanned ) return;

        this.#isScanned = true;

        var modules = await fs.readTree( this.#namespace );

        for ( let modulePath of modules ) {

            // filter out not *.js files
            if ( path.extname( modulePath ) !== ".js" ) continue;

            // remove ".js"
            modulePath = modulePath.substr( 0, modulePath.length - 3 );

            this._loadModule( "./" + modulePath, this.#namespace + "/file" );
        }

        console.log( this.#symbols );
        console.log( this.#modules );
    }

    _loadModule ( modulePath, from ) {

        // remove symbol name
        const idx = modulePath.indexOf( "#" );

        var symbolName;

        if ( idx > 0 ) {
            symbolName = modulePath.substr( idx + 1 );

            modulePath = modulePath.substr( 0, idx );
        }

        var absModulePath;

        // relative node module path
        if ( modulePath.charAt( 0 ) === "." ) {
            absModulePath = path.resolve( path.dirname( from ), modulePath + ".js" );
        }

        // global node module path
        else {
            absModulePath = require.resolve( modulePath );
        }

        // remove ".js"
        const moduleId = absModulePath.substr( 0, absModulePath.length - 3 );

        // module is not loaded
        if ( !this.#modules[moduleId] ) {

            // register loaded module
            this.#modules[moduleId] = {};

            // parse namespace relative path
            const namespaceId = path.relative( this.#namespace, moduleId );

            // module is belongs to the scanned namespace
            if ( namespaceId.charAt( 0 ) !== "." ) this.#modules[moduleId].namespaceId = namespaceId;

            // parse module documentation
            this._parseModule( moduleId );
        }

        if ( symbolName ) {
            return moduleId + "#" + symbolName;
        }
        else {
            return moduleId;
        }
    }

    _parseModule ( moduleId ) {
        const content = fs.readFileSync( moduleId + ".js", "utf8" );

        let spec, currentClassId;

        const docBlocks = content.match( commentRegex );

        if ( docBlocks ) {
            for ( let docBlock of docBlocks ) {
                docBlock = docBlock.replace( /^\s*\/\*+\s*/gm, "" );
                docBlock = docBlock.replace( /^\s*\*\/.*/gm, "" );
                docBlock = docBlock.replace( /^\s*\*\s/gm, "" );

                try {
                    spec = YAML.safeLoad( docBlock );
                }
                catch ( e ) {
                    throw `Failed to parse doc block in module "${moduleId}": ${docBlock}`;
                }

                // function
                if ( Object.hasOwnProperty.call( spec, "function" ) ) {

                    // validate spec
                    if ( !ajv.validate( "function", spec ) ) throw `Schema error in module "${moduleId}", spec: ${JSON.stringify( spec, null, 4 )} ${JSON.stringify( ajv.errors, null, 4 )}`;

                    spec.name = spec.function;
                    delete spec.function;
                    spec.isFunction = true;

                    spec.id = moduleId + "#" + spec.name;

                    spec.memberOf = moduleId;
                }

                // class
                else if ( Object.hasOwnProperty.call( spec, "class" ) ) {

                    // validate spec
                    if ( spec.extends ) {
                        if ( !ajv.validate( "subClass", spec ) ) throw `Schema error in module "${moduleId}", spec: ${JSON.stringify( spec, null, 4 )} ${JSON.stringify( ajv.errors, null, 4 )}`;
                    }
                    else {
                        if ( !ajv.validate( "class", spec ) ) throw `Schema error in module "${moduleId}", spec: ${JSON.stringify( spec, null, 4 )} ${JSON.stringify( ajv.errors, null, 4 )}`;
                    }

                    spec.name = spec.class;
                    delete spec.class;
                    spec.isClass = true;

                    spec.id = currentClassId = moduleId + "#" + spec.name;

                    // process class inheritance
                    if ( spec.extends ) {
                        if ( !Array.isArray( spec.extends ) ) spec.extends = [spec.extends];

                        const resolvedExtends = {};

                        for ( const superClass of spec.extends ) {
                            const superClassId = this._loadModule( superClass, moduleId );

                            if ( !this.#symbols[superClassId] ) throw `Unable to resolve dependency "${superClass}" for class "${spec.name}" in module "${moduleId}"`;

                            if ( !this.#symbols[superClassId].isClass ) throw `Dependency "${superClass}" for class "${spec.name}" in module "${moduleId}" is not a class`;

                            resolvedExtends[superClassId] = true;
                        }

                        spec.extends = Object.keys( resolvedExtends );
                    }
                }

                // property
                else if ( Object.hasOwnProperty.call( spec, "property" ) ) {

                    // validate spec
                    if ( spec.extends ) {
                        if ( !ajv.validate( "subProperty", spec ) ) throw `Schema error in module "${moduleId}", spec: ${JSON.stringify( spec, null, 4 )} ${JSON.stringify( ajv.errors, null, 4 )}`;
                    }
                    else {
                        if ( !ajv.validate( "property", spec ) ) throw `Schema error in module "${moduleId}", spec: ${JSON.stringify( spec, null, 4 )} ${JSON.stringify( ajv.errors, null, 4 )}`;
                    }

                    spec.name = spec.property;
                    delete spec.property;
                    spec.isProperty = true;

                    if ( !currentClassId ) throw `Property "${spec.name}" is not belongs to any class in module "${moduleId}"`;

                    spec.id = currentClassId + "#" + spec.name;
                    if ( spec.static ) spec.id += "-static";

                    spec.memberOf = currentClassId;

                    // set access
                    if ( spec.name.charAt( 0 ) === "#" ) {
                        spec.access = "private";
                    }
                    else if ( spec.name.charAt( 0 ) === "_" ) {
                        spec.access = "protected";
                    }
                    else {
                        spec.access = "public";
                    }
                }

                // method
                else if ( Object.hasOwnProperty.call( spec, "method" ) ) {

                    // validate spec
                    if ( spec.extends ) {
                        if ( !ajv.validate( "subMethod", spec ) ) throw `Schema error in module "${moduleId}", spec: ${JSON.stringify( spec, null, 4 )} ${JSON.stringify( ajv.errors, null, 4 )}`;
                    }
                    else {
                        if ( !ajv.validate( "method", spec ) ) throw `Schema error in module "${moduleId}", spec: ${JSON.stringify( spec, null, 4 )} ${JSON.stringify( ajv.errors, null, 4 )}`;
                    }

                    spec.name = spec.method;
                    delete spec.method;
                    spec.isMethod = true;

                    if ( !currentClassId ) throw `Method "${spec.name}" is not belongs to any class in module "${moduleId}"`;

                    spec.id = currentClassId + "#" + spec.name;
                    if ( spec.static ) spec.id += "-static";

                    spec.memberOf = currentClassId;

                    // set access
                    if ( spec.name.charAt( 0 ) === "_" ) {
                        spec.access = "protected";
                    }
                    else {
                        spec.access = "public";
                    }
                }

                // module
                else {

                    // validate spec
                    if ( !ajv.validate( "module", spec ) ) throw `Schema error in module "${moduleId}", spec: ${JSON.stringify( spec, null, 4 )} ${JSON.stringify( ajv.errors, null, 4 )}`;

                    spec.name = "";
                    spec.isModule = true;

                    spec.id = moduleId;
                }

                // symbol is already exists
                if ( this.#symbols[spec.id] ) throw `Symbol "${spec.id} is already exists in module "${moduleId}""`;

                spec.moduleId = moduleId;
                spec.namespaceId = this.#modules[moduleId].namespaceId;

                // register symbol
                this.#symbols[spec.id] = spec;
            }
        }
    }

    // -----------------------------------------------

    async getApiSchema () {
        await this._scanNamespace();

        const ajv = new Ajv(),
            schema = {};

        for ( const moduleName in this.#namespaceModules ) {
            for ( const methodName in this.#namespaceModules[moduleName].methods ) {
                const method = this.#namespaceModules[moduleName].methods[methodName];

                if ( method._isApiMethod ) {
                    const methodId = ( moduleName + "/" + methodName.substr( 4 ) ).replace( /_/g, "-" );

                    schema[methodId] = { ...method, moduleName };

                    if ( !method.skipParamsValidation ) {
                        const paramsSchema = this._buildParamsSchema( method );

                        // compile method params schema validator
                        try {
                            schema[methodId].validate = ajv.compile( paramsSchema );
                        }
                        catch ( e ) {
                            throw `Unable to compile params schema`;
                        }
                    }
                }
            }
        }

        return schema;
    }

    _loadModule1 ( modulePath ) {
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
    _parseModule1 ( absModulePath ) {
        const content = fs.readFileSync( absModulePath, "utf8" );

        let spec = {},
            currentClass;

        const docBlocks = content.match( commentRegex );

        if ( docBlocks ) {
            for ( let docBlock of docBlocks ) {
                docBlock = docBlock.replace( /^\s*\/\*+\s*/gm, "" );
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

                    let _isApiMethod = false;

                    // api method
                    if ( docBlock.name.substr( 0, 4 ) === "API_" ) {
                        _isApiMethod = true;

                        // convert permissions array to object
                        if ( typeof docBlock.permissions !== "undefined" ) {
                            if ( !docBlock.permissions ) {
                                docBlock.permissions = [];
                            }
                            else if ( !Array.isArray( docBlock.permissions ) ) {
                                docBlock.permissions = [docBlock.permissions];
                            }

                            if ( !docBlock.permissions.length ) {
                                docBlock.permissions = null;
                            }
                            else {

                                // TODO validate permissiosns names, make permissions unique
                            }
                        }
                    }

                    // TODO ajv

                    docBlock._isApiMethod = _isApiMethod;

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

    _buildParamsSchema ( method ) {
        let maxItems = 0,
            minItems = 0;

        const params = [];

        for ( const param of method.params || [] ) {
            maxItems++;

            // param is required
            if ( param.required ) {
                minItems = maxItems;

                params.push( param.schema );
            }

            // param is not required
            else {
                params.push( {
                    "anyOf": [{ "type": "null" }, param.schema],
                } );
            }
        }

        // method has params
        if ( params.length ) {
            return {
                "type": "array",
                minItems,
                maxItems,
                "items": params,
            };
        }

        // methos has no params
        else {
            return { "type": "array", "items": false };
        }
    }
};
