const Base = require( "./base" );
const config = require( "./config" );
const Ajv = require( "ajv" );
const res = require( "./result" );

const openRpcSpecValidator = new Ajv().compile( config.read( require.resolve( "../resources/openrpc.schema.yaml" ) ) );

module.exports = class OpenRpc extends Base {
    spec = null;
    methods = null;

    constructor () {
        super();
    }

    loadSpec ( filename ) {
        this.spec = config.read( filename );

        // validate openRpc shema
        if ( !openRpcSpecValidator( this.spec ) ) {
            throw openRpcSpecValidator.errors;
        }

        var ajv = new Ajv(),
            methods = {};

        // indexing methods
        for ( const method of this.spec.methods ) {
            methods[method.name] = method;

            var params = [],
                paramIndex = 0,
                minItems = 0;

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

            const schema = {
                "$schema": "http://json-schema.org/draft-07/schema#",
                "type": "array",
                minItems,
                "items": params,
            };

            console.log( JSON.stringify( schema, null, 4 ) );

            method.validator = ajv.compile( schema );
        }

        this.methods = methods;
    }

    validate ( method, data ) {
        var methodSpec = this.methods[method];

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
