const Base = require( "./base" );
const config = require( "./config" );
const Ajv = require( "ajv" );
const res = require( "./result" );

const openRpcSpecValidator = new Ajv().compile( config.read( require.resolve( "../resources/openrpc.schema.yaml" ) ) );

module.exports = class OpenRpc extends Base {
    #ajv = null;

    spec = null;
    methods = null;

    constructor () {
        super();

        this.#ajv = new Ajv();
    }

    loadSpec ( filename ) {
        this.spec = config.read( filename );

        // validate openRpc shema
        if ( !openRpcSpecValidator( this.spec ) ) {
            throw openRpcSpecValidator.errors;
        }

        var methods = {};

        // indexing methods
        for ( const method of this.spec.methods ) {
            methods[method.name] = method;

            const params = [];

            for ( const param of method.params ) {
                params.push( param.schema );
            }

            const schema = {
                "type": "array",
                "items": params,
            };

            method.validator = this.#ajv.compile( schema );
        }

        this.methods = methods;
    }

    validate ( method, data ) {
        var methodSpec = this.methods[method];

        if ( !methodSpec ) throw "Method not found";

        if ( methodSpec.validator( data ) ) {
            return res( 200 );
        }
        else {
            return res( 400, methodSpec.validator.errors );
        }
    }
};
