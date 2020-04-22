const Base = require( "./base" );
const config = require( "./config" );
const Ajv = require( "ajv" );
const res = require( "./result" );
const fs = require( "fs" );
const path = require( "path" );
const util = require( "@softvisio/core/lib/util" );

const openRpcSpecValidator = new Ajv().compile( config.read( require.resolve( "../resources/openrpc.schema.yaml" ) ) );

module.exports = class OpenRpc extends Base {
    specs = {};
    refs = {};
    methods = {};

    constructor () {
        super();
    }

    async loadSchemas ( schemas ) {
        var ajv = new Ajv();

        for ( const schema of schemas ) {
            const stat = fs.lstatSync( schema.path );

            if ( !stat ) {
                throw `Schema ${schema.path} is not exists`;
            }

            if ( stat.isFile() ) {
                this._loadSchema( ajv, schema.namespace, "/", schema.path );
            }
            else {
                var files = await util.readTree( schema.path );

                for ( const file of files ) {
                    const ext = path.extname( file );

                    // skip non-yaml files
                    if ( ext !== ".yaml" && ext !== ".yml" ) continue;

                    const schemaPath = path.posix.normalize( `/${path.dirname( file )}/${path.basename( file, ext )}` );

                    this._loadSchema( ajv, schema.namespace, schemaPath, `${schema.path}/${file}` );
                }
            }
        }

        this._compileMethods( ajv );
    }

    _loadSchema ( ajv, namespace, path, filename ) {
        // read spec
        var spec = config.read( filename );

        // validate spec
        if ( !openRpcSpecValidator( spec ) ) {
            throw openRpcSpecValidator.errors;
        }

        this.specs[namespace] = this.specs[namespace] || {};
        this.specs[namespace][path] = this.specs[namespace][path] || {};

        // register spec
        this.specs[namespace][path] = spec;

        // load components
        spec.components = spec.components || {};
        for ( const componentClass in spec.components ) {
            for ( const componentName in spec.components[componentClass] ) {
                const component = spec.components[componentClass][componentName];

                component.ref = `//${namespace}${path}#/components/${componentClass}/${componentName}`;

                // register component
                this.refs[component.ref] = component;

                ajv.addSchema( component, component.ref );
            }
        }

        this.methods[namespace] = {};

        // load schema methods
        spec.methods = spec.methods || [];
        for ( const method of spec.methods ) {
            method.id = `${path}/${method.name}`;
            method.namespace = namespace;
            method.path = path;

            // check, that method is unique globally
            if ( this.methods[namespace][method.id] ) {
                throw `Method ${method.namespace}/${method.id} is not unique`;
            }

            // register method
            this.methods[namespace][method.id] = method;
        }
    }

    _compileMethods ( ajv ) {
        for ( const namespace in this.methods ) {
            for ( const methodId in this.methods[namespace] ) {
                const method = this.methods[namespace][methodId],
                    params = [];

                let paramIndex = 0,
                    minItems = 0;

                method.params = method.params || [];

                for ( const param of method.params ) {
                    paramIndex++;

                    // param is required
                    if ( param.required ) {
                        minItems = paramIndex;

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
                    "$schema": "http://json-schema.org/draft-07/schema#",
                    "$id": `//${method.namespace}${method.path}#/methods/${method.name}`,
                    "type": "array",
                    minItems,
                    "items": params,
                };

                // compile method schema validator
                method.validator = ajv.compile( schema );
            }
        }
    }

    validate ( namespace, method, data ) {
        var methodSpec = this.methods[namespace][method];

        // method not found
        if ( !methodSpec ) {
            throw "Method not found";
        }

        // method is deprecated
        if ( methodSpec.deprecated ) {
            throw "Method is deprecated";
        }

        // validate schema
        if ( methodSpec.validator( data ) ) {
            return res( 200 );
        }
        else {
            return res( 400, methodSpec.validator.errors );
        }
    }
};
