require( "@softvisio/core" );
const _ajv = require( "./ajv" );
const fs = require( "./fs" );
const path = require( "path" );
const YAML = require( "js-yaml" );

const ajv = _ajv().addSchema( fs.config.read( __dirname + "/../resources/schemas/doc.meta.schema.yaml" ) );
const commentRegex = /\/\*\*([\s\S]*?)\*\//gm;
const SCHEMA_INDENT = 4;

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
            const namespacePath = this.#classes[classId].module.namespacePath;

            if ( !namespacePath ) continue;

            let apiClass = "/" + path.posix.relative( apiPath, namespacePath );
            apiClass = apiClass.substring( 0, apiClass.length - 3 );

            for ( const member in this.#classes[classId].members ) {
                if ( !this.#classes[classId].members[member].isApiMethod ) continue;

                const methodId = ( apiClass + "/" + member.substr( 4 ) ).replace( /_/g, "-" );

                const labels = methodId.match( /\/v(\d+)\/(.+)\/([^/]+)/ );

                methods[methodId] = {
                    ...this.#classes[classId].members[member],
                    apiClass,
                    "method": {
                        "apiVersion": labels[1],
                        "apiNamespace": labels[2],
                        "name": labels[3],
                    },
                };

                if ( !methods[methodId].noParamsValidation ) {
                    const paramsSchema = this._buildParamsSchema( this.#classes[classId].members[member] );

                    // compile method params schema validator
                    try {
                        methods[methodId].validate = _ajv().addKeyword( _ajv.apiReaderKeyword ).compile( paramsSchema );
                    }
                    catch ( e ) {
                        throw `Unable to compile params schema. ` + e;
                    }
                }
            }
        }

        return methods;
    }

    async generate () {
        await this._scanNamespace();

        const fileTree = fs.fileTree(),
            ejs = require( "ejs" ),
            indexTmpl = __dirname + "/../resources/tmpl/doc/index.md.ejs",
            classTmpl = __dirname + "/../resources/tmpl/doc/api-class.md.ejs";

        // TODO process modules

        const apiClasses = {};

        // process classes
        for ( const classId in this.#classes ) {
            const spec = this.#classes[classId];

            // skip externam classes
            if ( !spec.module.namespacePath ) continue;

            // remove extname
            spec.module.namespacePath = spec.module.namespacePath.replace( /\..+$/, "" );

            // api class
            // TODO can be api/v1/..., or api/name/v1/...
            let match;

            if ( ( match = spec.module.namespacePath.match( /api(\/(v\d+)\/.+)/ ) ) ) {
                spec.isApiClass = true;

                spec.apiNamespace = match[1].replace( /_/g, "-" );
                spec.apiVersion = match[2];

                if ( !apiClasses[spec.apiVersion] ) apiClasses[spec.apiVersion] = [];
                apiClasses[spec.apiVersion].push( spec );
            }

            for ( const memberId in spec.members ) {
                const member = spec.members[memberId];

                // method
                if ( member.isMethod ) {

                    // api method
                    if ( member.isApiMethod ) {
                        member.apiName = member.name.substr( 4 ).replace( /_/g, "-" );

                        member.apiFullName = spec.apiNamespace + "/" + member.apiName;

                        member.markdownId = member.apiName;
                    }
                    else {
                        member.markdownId = member.name;
                    }

                    if ( member.deprecated ) member.markdownId += "-deprecated";

                    // method has params
                    if ( member.params ) {
                        member.templateParams =
                            ", " +
                            member.params
                                .map( param => {

                                    // required
                                    if ( param.required ) {
                                        return param.name;
                                    }

                                    // not required
                                    else {
                                        return "[" + param.name + "]";
                                    }
                                } )
                                .join( ", " );

                        // serialize params schema
                        for ( const param of member.params ) {
                            param.templateSchema = YAML.dump( param.schema, {
                                "indent": SCHEMA_INDENT,
                                "lineWidth": -1,
                                "noArrayIndent": false,
                                "flowLevel": 5,
                                "quotingType": '"',
                                "styles": {
                                    "!!null": "lowercase",
                                    "!!bool": "lowercase",
                                    "!!float": "lowercase",
                                },
                            } );

                            // indent with 8 spaces
                            param.templateSchema = " ".repeat( 4 ) + param.templateSchema.replace( /^/gm, " ".repeat( 4 ) ).trim();
                        }
                    }

                    // method has no params
                    else {
                        member.templateParams = "";
                    }
                }
            }

            // TODO currently only api classes generated
            if ( spec.isApiClass ) {
                fileTree.add( spec.module.namespacePath + ".md", await ejs.renderFile( classTmpl, { spec } ) );
            }
        }

        // generate main index
        if ( !Object.isEmpty( fileTree.files ) ) {
            fileTree.add( "index.md", await ejs.renderFile( indexTmpl, { apiClasses, "hasApi": !Object.isEmpty( apiClasses ) } ) );
        }

        return fileTree;
    }

    // PROTECTED
    async _scanNamespace () {
        if ( this.#isScanned ) return;

        this.#isScanned = true;

        const glob = require( "glob" ),
            modules = glob.sync( "**/*.js", { "cwd": this.#namespace, "nodir": true } );

        for ( const modulePath of modules ) {

            // filter out not *.js files
            if ( path.extname( modulePath ) !== ".js" ) continue;

            this._loadModule( "./" + modulePath, this.#namespace + "/file.js" );
        }
    }

    _loadModule ( modulePath, from ) {
        if ( from == null ) from = this.#namespace;

        // remove symbol name
        const idx = modulePath.indexOf( "#" );

        var symbolName,
            id,
            name,
            namespacePath = null;

        if ( idx > 0 ) {
            symbolName = modulePath.substr( idx + 1 );

            modulePath = modulePath.substr( 0, idx );
        }

        // relative node module path
        if ( modulePath.charAt( 0 ) === "." ) {
            id = path.resolve( path.dirname( from ), modulePath );

            name = path.relative( this.#namespace, id );

            if ( name.charAt( 0 ) !== "." ) namespacePath = name;
        }

        // global node module path
        else {
            id = require.resolve( modulePath, { "paths": [from] } );

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
                id, // absolute path
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
        const content = fs.readFileSync( module.id, "utf8" );

        let spec, currentClassId;

        const docBlocks = content.match( commentRegex );

        if ( docBlocks ) {
            for ( let docBlock of docBlocks ) {
                docBlock = docBlock //
                    .replace( /^ *\/\*+ */gm, "" )
                    .replace( /^ *\*\/.*/gm, "" )
                    .replace( /^ *\* ?/gm, "" );

                try {
                    spec = YAML.load( docBlock );
                }
                catch ( e ) {
                    throw `Failed to parse doc block in module "${module.id}": ${docBlock}`;
                }

                spec.module = module;

                // function
                if ( Object.hasOwnProperty.call( spec, "function" ) ) {
                    this._processFunction( spec );
                }

                // class
                else if ( Object.hasOwnProperty.call( spec, "class" ) ) {
                    this._processClass( spec );

                    currentClassId = spec.id;
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
        spec.name = "";
        spec.id = spec.module.id;
        spec.members = {};

        // module is already exists
        if ( this.#modules[spec.id] ) throw `Module "${spec.id} is already defined.`;

        // validate spec
        if ( !ajv.validate( "module", spec ) ) throw `Schema error in module "${spec.module.id}":\nspec:\n${JSON.stringify( spec, null, 4 )}\nerrors:\n${JSON.stringify( ajv.errors, null, 4 )}`;

        // register module
        this.#modules[spec.id] = spec;
    }

    _processFunction ( spec ) {
        spec.name = spec.function;
        spec.id = spec.name;
        spec.isFunction = true;

        if ( !this.#modules[spec.module.id] ) throw `Unable to register function for module "${spec.module.id}", module is not defined.`;

        // function is already exists
        if ( this.#modules[spec.module.id].members[spec.id] ) throw `Function "${spec.name}" for module "${spec.module.id}" is already defined.`;

        // validate spec
        if ( !ajv.validate( "function", spec ) ) throw `Schema error in module "${spec.module.id}":\nspec:\n${JSON.stringify( spec, null, 4 )}\nerrors:\n${JSON.stringify( ajv.errors, null, 4 )}`;

        // register function
        this.#modules[spec.module.id].members[spec.id] = spec;
    }

    _processClass ( spec ) {
        spec.name = spec.class;
        spec.id = spec.module.id + "#" + spec.name;
        spec.members = {};

        // class is already defined
        if ( this.#classes[spec.id] ) throw `Class "${spec.name}" is already defined in module "${spec.module.id}".`;

        // convert class permissions to object
        if ( spec.permissions ) spec.permissions = Object.keys( Object.fromEntries( spec.permissions.map( permission => [permission, true] ) ) ).sort();

        // validate spec
        if ( !ajv.validate( "class", spec ) ) throw `Schema error in module "${spec.module.id}":\nspec:\n${JSON.stringify( spec, null, 4 )}\nerrors:\n${JSON.stringify( ajv.errors, null, 4 )}`;

        // process class inheritance
        if ( spec.extends ) {
            const resolvedExtends = [];

            for ( const superClass of spec.extends ) {
                const superClassId = this._loadModule( superClass, spec.module.id );

                if ( !this.#classes[superClassId] ) throw `Unable to resolve super class "${superClass}" for class "${spec.name}" in module "${spec.module.id}".`;

                resolvedExtends.push( superClassId );

                // inherit members
                for ( const memberId in this.#classes[superClassId].members ) {

                    // make a copy of member spec
                    spec.members[memberId] = { ...this.#classes[superClassId].members[memberId] };

                    // set inheritedFrom property
                    spec.members[memberId].inheritedFrom = superClassId;

                    // set class permissions for inherited method
                    if ( spec.members[memberId].isApiMethod && spec.permissions ) spec.members[memberId].permissions = spec.permissions;
                }
            }

            spec.extends = resolvedExtends;
        }

        // register class
        this.#classes[spec.id] = spec;
    }

    _processProperty ( spec, classId ) {
        spec.name = spec.property;
        spec.isProperty = true;

        if ( !classId ) throw `Property "${spec.name}" is not belongs to any class in module "${spec.module.id}".`;

        spec.id = spec.name;
        if ( spec.static ) spec.id += "-static";

        // property is already defined
        if ( this.#classes[classId].members[spec.id] && !this.#classes[classId].members[spec.id].inheritedFrom ) throw `Property "${spec.id}" for class "${classId}" is already defined.`;

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

        // validate spec
        if ( !ajv.validate( "property", spec ) ) throw `Schema error in module "${spec.module.id}":\nspec:\n${JSON.stringify( spec, null, 4 )}\nerrors:\n${JSON.stringify( ajv.errors, null, 4 )}`;

        // register property
        this.#classes[classId].members[spec.id] = spec;
    }

    _processMethod ( spec, classId ) {
        spec.name = spec.method;
        spec.isMethod = true;

        if ( !classId ) throw `Method "${spec.name}" is not belongs to any class in module "${spec.module.id}".`;

        spec.id = spec.name;
        if ( spec.static ) spec.id += "-static";

        // method is already defined
        if ( this.#classes[classId].members[spec.id] && !this.#classes[classId].members[spec.id].inheritedFrom ) throw `Method "${spec.id}" for class "${classId}" is already defined.`;

        // set access
        if ( spec.name.charAt( 0 ) === "_" ) {
            spec.access = "protected";
        }
        else {
            spec.access = "public";
        }

        // api method
        if ( spec.name.substr( 0, 4 ) === "API_" ) {
            spec.isApiMethod = true;

            // convert permissions to object
            if ( spec.permissions ) spec.permissions = Object.keys( Object.fromEntries( spec.permissions.map( permission => [permission, true] ) ) ).sort();

            // inhertit class permissions
            else if ( this.#classes[classId].permissions ) spec.permissions = this.#classes[classId].permissions;

            // permissions are not defined
            else throw `Permissions for API method "${spec.id}" in class "${classId}" must be defined.`;
        }
        else {
            delete spec.isApiMethod;
        }

        // validate spec
        if ( !ajv.validate( "method", spec ) ) throw `Schema error in module "${spec.module.id}":\nspec:\n${JSON.stringify( spec, null, 4 )}\nerrors:\n${JSON.stringify( ajv.errors, null, 4 )}`;

        // register method
        this.#classes[classId].members[spec.id] = spec;
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
