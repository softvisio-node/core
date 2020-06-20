const Ajv = require( "ajv" );
const fs = require( "./fs" );
const path = require( "path" );
const YAML = require( "js-yaml" );
const commentRegex = /\/\*\*([\s\S]*?)\*\//gm;

const ajv = new Ajv().addSchema( fs.config.read( require.resolve( "@softvisio/core/resources/schemas/doc.yaml" ) ) );

module.exports = class {
    #namespace;
    #isScanned = false;
    #loadedModules = {}; // scanned modules
    #modules = {};
    #classes = {};

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

        console.log( this.#classes );
        console.log( this.#loadedModules );
    }

    _loadModule ( modulePath, from ) {
        if ( from == null ) from = this.#namespace;

        // remove symbol name
        const idx = modulePath.indexOf( "#" );

        var symbolName,
            absPath,
            id,
            name,
            namespaceId = null;

        if ( idx > 0 ) {
            symbolName = modulePath.substr( idx + 1 );

            modulePath = modulePath.substr( 0, idx );
        }

        // remove .js extension
        if ( path.extname( modulePath ) === ".js" ) modulePath = modulePath.substr( 0, modulePath.length - 3 );

        // relative node module path
        if ( modulePath.charAt( 0 ) === "." ) {
            absPath = path.resolve( path.dirname( from ), modulePath + ".js" );

            // remove ".js"
            id = absPath.substr( 0, absPath.length - 3 );

            name = path.relative( this.#namespace, id );

            if ( name.charAt( 0 ) !== "." ) namespaceId = name;
        }

        // global node module path
        else {
            absPath = require.resolve( modulePath, { "paths": [from] } );

            // remove ".js"
            id = absPath.substr( 0, absPath.length - 3 );

            name = path.relative( this.#namespace, id );

            // module is external, relative to the scanned namespace
            if ( name.charAt( 0 ) === "." ) {
                name = modulePath;
            }
            else {
                namespaceId = name;
            }
        }

        // module is not loaded
        if ( !this.#loadedModules[id] ) {

            // register loaded module
            this.#loadedModules[id] = {
                id, // absolute path without .js
                "path": absPath, // absolute module path.js
                name,
                "namespaceId": namespaceId,
            };

            // parse module documentation
            this._parseModule( this.#loadedModules[id] );
        }

        if ( symbolName ) {
            return id + "#" + symbolName;
        }
        else {
            return id;
        }
    }

    _parseModule ( module ) {
        const content = fs.readFileSync( module.path, "utf8" );

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
                    throw `Failed to parse doc block in module "${module.id}": ${docBlock}`;
                }

                spec._module = module;

                // function
                if ( Object.hasOwnProperty.call( spec, "function" ) ) {
                    this._processFunction( spec );
                }

                // class
                else if ( Object.hasOwnProperty.call( spec, "class" ) ) {
                    this._processClass( spec );

                    currentClassId = spec._id;
                }

                // property
                else if ( Object.hasOwnProperty.call( spec, "property" ) ) {
                    this._processProperty( spec, currentClassId );
                }

                // method
                else if ( Object.hasOwnProperty.call( spec, "method" ) ) {
                    this._processMethod( spec, currentClassId );
                }

                // module
                else {
                    this._processModule( spec );
                }
            }
        }
    }

    // SPEC PROCESSORS
    _processModule ( spec ) {
        spec._name = "";
        spec._id = spec._module.id;
        spec._members = {};

        // validate spec
        if ( !ajv.validate( "module", spec ) ) throw `Schema error in module "${spec._id}", spec: ${JSON.stringify( spec, null, 4 )} ${JSON.stringify( ajv.errors, null, 4 )}`;

        // module is already exists
        if ( this.#modules[spec._id] ) throw `Module "${spec._id} is already defined.`;

        // register module
        this.#modules[spec._id] = spec;
    }

    _processFunction ( spec ) {
        spec._name = spec.function;
        spec._id = spec._name;
        spec._isFunction = true;
        spec._memberOf = spec._module.id;

        // validate spec
        if ( !ajv.validate( "function", spec ) ) throw `Schema error in module "${spec._module.id}", spec: ${JSON.stringify( spec, null, 4 )} ${JSON.stringify( ajv.errors, null, 4 )}`;

        if ( !this.#modules[spec._memberOf] ) throw `Unable to register function for module "${spec._memberOf}", module is not defined.`;

        // function is already exists
        if ( this.#modules[spec._memberOf].members[spec._id] ) throw `Function "${spec._name}" for module "${spec._memberOf}" is already defined.`;

        // register module
        this.#modules[spec._memberOf]._members[spec._id] = spec;
    }

    _processClass ( spec ) {
        spec._name = spec.class;
        spec._id = spec._module.id + "#" + spec._name;
        spec._members = {};

        if ( this.#classes[spec._id] ) throw `Class "${spec._name}" is already defined in module "${spec._module.id}"`;

        // process class inheritance
        if ( spec.extends ) {
            const resolvedExtends = [];

            for ( const superClass of spec.extends ) {
                const superClassId = this._loadModule( superClass, spec._module.id );

                if ( !this.#classes[superClassId] ) throw `Unable to resolve super class "${superClass}" for class "${spec._name}" in module "${spec._module.id}"`;

                resolvedExtends.push( superClassId );
            }

            spec.extends = resolvedExtends;
        }

        // validate spec
        if ( !ajv.validate( "class", spec ) ) throw `Schema error in module "${spec._module.id}", spec: ${JSON.stringify( spec, null, 4 )} ${JSON.stringify( ajv.errors, null, 4 )}`;

        // register class
        this.#classes[spec._id] = spec;
    }

    _processProperty ( spec, classId ) {
        spec._name = spec.property;
        spec._isProperty = true;

        if ( !classId ) throw `Property "${spec._name}" is not belongs to any class in module "${spec._module.id}"`;

        spec._id = classId + "#" + spec._name;
        if ( spec.static ) spec._id += "-static";

        spec._memberOf = classId;

        // set access
        if ( spec._name.charAt( 0 ) === "#" ) {
            spec._access = "private";
        }
        else if ( spec._name.charAt( 0 ) === "_" ) {
            spec._access = "protected";
        }
        else {
            spec._access = "public";
        }

        // validate spec
        if ( !ajv.validate( "property", spec ) ) throw `Schema error in module "${spec._module.id}", spec: ${JSON.stringify( spec, null, 4 )} ${JSON.stringify( ajv.errors, null, 4 )}`;

        // TODO check, that symbol with this id is not registered

        // register property
        this.#classes[spec._memberOf]._members[spec._id] = spec;
    }

    _processMethod ( spec, classId ) {
        spec._name = spec.method;
        spec._isMethod = true;

        if ( !classId ) throw `Method "${spec._name}" is not belongs to any class in module "${spec._module.id}"`;

        spec._id = classId + "#" + spec._name;
        if ( spec.static ) spec._id += "-static";

        spec._memberOf = classId;

        // set access
        if ( spec._name.charAt( 0 ) === "_" ) {
            spec._access = "protected";
        }
        else {
            spec._access = "public";
        }

        // validate spec
        if ( !ajv.validate( "method", spec ) ) throw `Schema error in module "${spec._module.id}", spec: ${JSON.stringify( spec, null, 4 )} ${JSON.stringify( ajv.errors, null, 4 )}`;

        // TODO check, that symbol with this id is not registered

        // register property
        this.#classes[spec._memberOf]._members[spec._id] = spec;
    }
};
