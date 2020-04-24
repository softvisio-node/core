const Base = require( "./base" );
const config = require( "./config" );
const Ajv = require( "ajv" );
const res = require( "./result" );
const fs = require( "fs" );
const path = require( "path" );
const util = require( "./util" );
const url = require( "url" );
const ejs = require( "ejs" );
const YAML = require( "yaml" );

const specValidator = loadSpecValidator( __dirname + "/../resources/schemas/openrpc.meta.schema.yaml" );

const docIndent = 2;

function loadSpecValidator ( path ) {
    var ajv = new Ajv();

    var spec = config.read( path );

    spec.components = spec.components || {};

    for ( const componentName in spec.components ) {
        const component = spec.components[componentName];

        ajv.addSchema( component, `/#/components/${componentName}` );
    }

    spec.schema.$id = "/";

    return ajv.compile( spec.schema );
}

module.exports = class OpenRpc extends Base {
    specs = {};
    refs = {};
    methods = {};

    constructor () {
        super();
    }

    async load ( schema, components ) {
        var ajv = new Ajv();

        // load main schema
        await this._load( ajv, "", schema );

        if ( !components ) return;

        // load components
        for ( const schema in components ) {
            await this._load( ajv, schema, components[schema] );
        }

        this._compileMethods( ajv );
    }

    async _load ( ajv, namespace, path1 ) {
        const stat = fs.lstatSync( path1 );

        if ( !stat ) {
            throw `Schema ${path1} is not exists`;
        }

        if ( stat.isFile() ) {
            this._processSpec( ajv, namespace, "/", path1 );
        }
        else {
            var files = await util.readTree( path1 );

            for ( const file of files ) {
                const ext = path.extname( file );

                // skip non-yaml files
                if ( ext !== ".yaml" && ext !== ".yml" ) continue;

                const schemaPath = path.posix.normalize( `/${path.dirname( file )}/${path.basename( file, ext )}` );

                this._processSpec( ajv, namespace, schemaPath, `${path1}/${file}` );
            }
        }
    }

    _processSpec ( ajv, namespace, path, filename ) {
        // read spec
        var spec = config.read( filename );

        if ( !namespace ) {
            this._processMainSpec( ajv, path, spec );
        }
        else {
            this._processComponentsSpec( ajv, namespace, path, spec );
        }
    }

    _processMainSpec ( ajv, path, spec ) {
        // validate spec
        if ( !specValidator( spec ) ) {
            throw specValidator.errors;
        }

        spec.path = path;

        // register spec
        this.specs[path] = spec;

        // load components
        this._registerComponents( spec, ajv, "", path );

        // load schema methods
        spec.methods = spec.methods || [];

        for ( const method of spec.methods ) {
            method.id = `${path}/${method.name}`;
            method.path = path;

            // check, that method is unique globally
            if ( this.methods[method.id] ) {
                throw `Method "${method.id}" is not unique`;
            }

            // register method
            this.methods[method.id] = method;
        }
    }

    // TODO enable validation
    _processComponentsSpec ( ajv, namespace, path, spec ) {
        // validate spec
        // if ( !specValidator( spec ) ) {
        //     throw specValidator.errors;
        // }

        // load components
        this._registerComponents( spec, ajv, namespace, path );
    }

    _registerComponents ( spec, ajv, namespace, path ) {
        spec.components = spec.components || {};

        for ( const componentClass in spec.components ) {
            for ( const componentName in spec.components[componentClass] ) {
                const component = spec.components[componentClass][componentName];

                const ref = `//${namespace}${path}#/components/${componentClass}/${componentName}`;

                // register component
                this.refs[ref] = component;

                if ( componentClass === "schemas" ) ajv.addSchema( component, ref );
            }
        }
    }

    _compileMethods ( ajv ) {
        for ( const methodId in this.methods ) {
            const method = this.methods[methodId],
                params = [];

            // method has no params
            if ( !method.params ) {
                method.validator = function () {
                    return true;
                };

                return;
            }

            let maxItems = 0,
                minItems = 0;

            method.params = method.params || [];

            for ( const param of method.params ) {
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

            // create methos schema
            const schema = {
                "$id": `//${method.path}#/methods/${method.name}`,
                "type": "array",
                minItems,
                maxItems,
                "items": params,
            };

            // compile method schema validator
            method.validator = ajv.compile( schema );
        }
    }

    validate ( method, data ) {
        var methodSpec = this.methods[method];

        // method not found
        if ( !methodSpec ) {
            return res( [404, "Method not found"] );
        }

        // method is deprecated
        if ( methodSpec.deprecated ) {
            return res( [400, "Method is deprecated"] );
        }

        // validate schema
        if ( methodSpec.validator( data ) ) {
            return res( 200 );
        }
        else {
            return res( 400, methodSpec.validator.errors );
        }
    }

    async generate ( outputDir ) {
        var refs = {};

        const jsonReplacer = function ( key, val ) {
            if ( key === "" ) return val;

            if ( Array.isArray( val ) ) {
                if ( key === "enum" ) {
                    return val.join( ", " );
                }
                else if ( key === "type" ) {
                    return val.join( ", " );
                }
                else if ( key === "required" ) {
                    return val.join( ", " );
                }
            }

            return val;
        };

        // serialize schema components
        for ( const ref in this.refs ) {
            refs[ref] = JSON.stringify( this.refs[ref], jsonReplacer );
        }

        var specUri;

        var resolveRef = function ( match, ref ) {
            const componentUri = url.resolve( specUri, ref );

            return refs[componentUri];
        };

        // generate specs
        for ( const id in this.specs ) {
            const spec = this.specs[id];

            specUri = `//${spec.path}`;

            for ( const method of spec.methods ) {
                method.templateParams = method.params ? ", " + method.params.map( ( e ) => e.name ).join( ", " ) : "";

                if ( !method.params ) continue;

                for ( const param of method.params ) {
                    // prepare schema JSON
                    let schema = JSON.stringify( param.schema, jsonReplacer );

                    schema = schema.replace( /{"\$ref":"([^"]+)"}/g, resolveRef );

                    schema = YAML.stringify( JSON.parse( schema ), { "indent": docIndent } );

                    param.templateSchema = schema;
                }
            }

            const specPath = outputDir + spec.path + ".md";
            fs.mkdirSync( path.dirname( specPath ), { "recursive": true } );
            const md = await ejs.renderFile( require.resolve( __dirname + "/../resources/tmpl/schemas/module.ejs" ), { "spec": spec } );
            fs.writeFileSync( specPath, md );
        }

        // generate index
        fs.writeFileSync( outputDir + "/index.md", await ejs.renderFile( require.resolve( __dirname + "/../resources/tmpl/schemas/index.ejs" ), { "specs": this.specs } ) );
    }
};
