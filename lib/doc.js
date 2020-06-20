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

    // apiPath - path, related to doc namespace path
    async getApiSchema ( apiPath ) {
        await this._scanNamespace();

        const methods = {};

        for ( const classId in this.#classes ) {
            const namespacePath = this.#classes[classId]._module.namespacePath;

            if ( !namespacePath ) continue;

            if ( namespacePath.indexOf( apiPath ) !== 0 ) continue;

            let apiClass = namespacePath.substr( apiPath.length );
            if ( apiClass.charAt( 0 ) !== "/" ) apiClass = "/" + apiClass;

            for ( const member in this.#classes[classId]._members ) {
                if ( !this.#classes[classId]._members[member]._isApiMethod ) continue;

                const methodId = ( apiClass + "/" + member.substr( 4 ) ).replace( /_/g, "-" );

                methods[methodId] = {
                    ...this.#classes[classId]._members[member],
                    apiClass,
                };

                if ( !methods[methodId].skipParamsValidation ) {
                    const paramsSchema = this._buildParamsSchema( this.#classes[classId]._members[member] );

                    // compile method params schema validator
                    try {
                        const ajv = new Ajv();

                        methods[methodId].validate = ajv.compile( paramsSchema );
                    }
                    catch ( e ) {
                        throw `Unable to compile params schema`;
                    }
                }
            }
        }

        return methods;
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
    }

    _loadModule ( modulePath, from ) {
        if ( from == null ) from = this.#namespace;

        // remove symbol name
        const idx = modulePath.indexOf( "#" );

        var symbolName,
            absPath,
            id,
            name,
            namespacePath = null;

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

            if ( name.charAt( 0 ) !== "." ) namespacePath = name;
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
                namespacePath = name;
            }
        }

        // module is not loaded
        if ( !this.#loadedModules[id] ) {
            name = name.replace( /\\/g, "/" );
            if ( namespacePath != null ) namespacePath = namespacePath.replace( /\\/g, "/" );

            // register loaded module
            this.#loadedModules[id] = {
                id, // absolute path without .js
                "path": absPath, // absolute module path.js
                name,
                namespacePath,
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

        // module is already exists
        if ( this.#modules[spec._id] ) throw `Module "${spec._id} is already defined.`;

        // validate spec
        if ( !ajv.validate( "module", spec ) ) throw `Schema error in module "${spec._module.id}":\nspec:\n${JSON.stringify( spec, null, 4 )}\nerrors:\n${JSON.stringify( ajv.errors, null, 4 )}`;

        // register module
        this.#modules[spec._id] = spec;
    }

    _processFunction ( spec ) {
        spec._name = spec.function;
        spec._id = spec._name;
        spec._isFunction = true;

        if ( !this.#modules[spec._module.id] ) throw `Unable to register function for module "${spec._module.id}", module is not defined.`;

        // function is already exists
        if ( this.#modules[spec._module.id]._members[spec._id] ) throw `Function "${spec._name}" for module "${spec._module.id}" is already defined.`;

        // validate spec
        if ( !ajv.validate( "function", spec ) ) throw `Schema error in module "${spec._module.id}":\nspec:\n${JSON.stringify( spec, null, 4 )}\nerrors:\n${JSON.stringify( ajv.errors, null, 4 )}`;

        // register function
        this.#modules[spec._module.id]._members[spec._id] = spec;
    }

    _processClass ( spec ) {
        spec._name = spec.class;
        spec._id = spec._module.id + "#" + spec._name;
        spec._members = {};

        // class is already defined
        if ( this.#classes[spec._id] ) throw `Class "${spec._name}" is already defined in module "${spec._module.id}".`;

        // convert class permissions to object
        if ( spec.permissions ) spec.permissions = Object.fromEntries( spec.permissions.sort().map( ( permission ) => [permission, true] ) );

        // validate spec
        if ( !ajv.validate( "class", spec ) ) throw `Schema error in module "${spec._module.id}":\nspec:\n${JSON.stringify( spec, null, 4 )}\nerrors:\n${JSON.stringify( ajv.errors, null, 4 )}`;

        // process class inheritance
        if ( spec.extends ) {
            const resolvedExtends = [];

            for ( const superClass of spec.extends ) {
                const superClassId = this._loadModule( superClass, spec._module.id );

                if ( !this.#classes[superClassId] ) throw `Unable to resolve super class "${superClass}" for class "${spec._name}" in module "${spec._module.id}".`;

                resolvedExtends.push( superClassId );

                // inherit members
                for ( const memberId in this.#classes[superClassId]._members ) {

                    // make a copy of member spec
                    spec._members[memberId] = { ...this.#classes[superClassId]._members[memberId] };

                    // set inheritedFrom property
                    spec._members[memberId]._inheritedFrom = superClassId;

                    // set class permissions for inherited method
                    if ( spec._members[memberId]._isApiMethod && spec.permissions ) spec._members[memberId].permissions = spec.permissions;
                }
            }

            spec.extends = resolvedExtends;
        }

        // register class
        this.#classes[spec._id] = spec;
    }

    _processProperty ( spec, classId ) {
        spec._name = spec.property;
        spec._isProperty = true;

        if ( !classId ) throw `Property "${spec._name}" is not belongs to any class in module "${spec._module.id}".`;

        spec._id = spec._name;
        if ( spec.static ) spec._id += "-static";

        // property is already defined
        if ( this.#classes[classId]._members[spec._id] && !this.#classes[classId]._members[spec._id]._inheritedFrom ) throw `Property "${spec._id}" for class "${classId}" is already defined.`;

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
        if ( !ajv.validate( "property", spec ) ) throw `Schema error in module "${spec._module.id}":\nspec:\n${JSON.stringify( spec, null, 4 )}\nerrors:\n${JSON.stringify( ajv.errors, null, 4 )}`;

        // register property
        this.#classes[classId]._members[spec._id] = spec;
    }

    _processMethod ( spec, classId ) {
        spec._name = spec.method;
        spec._isMethod = true;

        if ( !classId ) throw `Method "${spec._name}" is not belongs to any class in module "${spec._module.id}".`;

        spec._id = spec._name;
        if ( spec.static ) spec._id += "-static";

        // method is already defined
        if ( this.#classes[classId]._members[spec._id] && !this.#classes[classId]._members[spec._id]._inheritedFrom ) throw `Method "${spec._id}" for class "${classId}" is already defined.`;

        // set access
        if ( spec._name.charAt( 0 ) === "_" ) {
            spec._access = "protected";
        }
        else {
            spec._access = "public";
        }

        // api method
        if ( spec._name.substr( 0, 4 ) === "API_" ) {
            spec._isApiMethod = true;

            // convert permissions to object
            if ( spec.permissions ) spec.permissions = Object.fromEntries( spec.permissions.sort().map( ( permission ) => [permission, true] ) );

            // inhertit class permissions
            else if ( this.#classes[classId].permissions ) spec.permissions = this.#classes[classId].permissions;

            // permissions are not defined
            else throw `Permissions for API method "${spec._id}" in class "${classId}" must be defined.`;
        }
        else {
            delete spec._isApiMethod;
        }

        // validate spec
        if ( !ajv.validate( "method", spec ) ) throw `Schema error in module "${spec._module.id}":\nspec:\n${JSON.stringify( spec, null, 4 )}\nerrors:\n${JSON.stringify( ajv.errors, null, 4 )}`;

        // register method
        this.#classes[classId]._members[spec._id] = spec;
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
