import env from "#lib/env";
import { buildParamsValidator } from "./validator.js";

export default class ApiMethod {
    #module;
    #name;
    #id;
    #apiName;

    #title;
    #description;
    #deprecated = false;
    #permission;
    #requireAuthorization = false;
    #requirePersistentConnection = false;
    #maxParallelCallsPerClient;

    #params;
    #paramsValidator;
    #aclResolvers;
    #maxUploadFileSize = 0;

    #readLimit;
    #readDefaultOrderBy;

    constructor ( module, name ) {
        this.#module = module;
        this.#name = name;
        this.#id = `${ module.id }/${ name }`;
        this.#apiName = "API_" + name;
    }

    // properties
    get api () {
        return this.#module.api;
    }

    get module () {
        return this.#module;
    }

    get name () {
        return this.#name;
    }

    get id () {
        return this.#id;
    }

    get apiName () {
        return this.#apiName;
    }

    get title () {
        return this.#title;
    }

    get description () {
        return this.#description;
    }

    get deprecated () {
        return this.#deprecated;
    }

    get permission () {
        return this.#permission;
    }

    get requireAuthorization () {
        return this.#requireAuthorization;
    }

    get requirePersistentConnection () {
        return this.#requirePersistentConnection;
    }

    get maxParallelCallsPerClient () {
        return this.#maxParallelCallsPerClient;
    }

    get object () {
        return this.#module.object;
    }

    get aclResolvers () {
        return this.#aclResolvers;
    }

    get maxUploadFileSize () {
        return this.#maxUploadFileSize;
    }

    get params () {
        return this.#params;
    }

    // read
    get readLimit () {
        this.#readLimit ??= {
            "defaultLimit": this.#params?.[ 0 ]?.schema?.read?.limit?.defaultLimit,
            "maxLimit": this.#params?.[ 0 ]?.schema?.read?.limit?.maxLimit,
            "maxResults": this.#params?.[ 0 ]?.schema?.read?.limit?.maxResults,
        };

        return this.#readLimit;
    }

    get readDefaultOrderBy () {
        this.#readDefaultOrderBy ??= this.#params?.[ 0 ]?.schema?.read?.order_by ?? false;

        return this.#readDefaultOrderBy;
    }

    // public
    setConfig ( config ) {
        if ( config.title ) this.#title = config.title;
        if ( !this.#title ) return result( [ 400, "API method title is required" ] );

        if ( Reflect.has( config, "description" ) ) {
            this.#description = config.description;
        }

        if ( Reflect.has( config, "deprecated" ) ) {
            this.#deprecated = config.deprecated;
        }

        if ( Reflect.has( config, "permission" ) ) {
            this.#permission = config.permission;
        }

        if ( Reflect.has( config, "requireAuthorization" ) ) {
            this.#requireAuthorization = config.requireAuthorization;
        }

        if ( Reflect.has( config, "requirePersistentConnection" ) ) {
            this.#requirePersistentConnection = config.requirePersistentConnection;
        }

        if ( Reflect.has( config, "maxParallelCallsPerClient" ) ) {
            this.#maxParallelCallsPerClient = config.maxParallelCallsPerClient;
        }

        if ( Reflect.has( config, "params" ) ) {
            this.#params = config.params;
        }

        const res = this.#buildParamsValidator();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    validateParams ( params ) {
        try {
            global[ Symbol.for( "aclResolver" ) ] = null;

            const ok = this.#paramsValidator( params );

            const aclResolvers = global[ Symbol.for( "aclResolver" ) ];
            global[ Symbol.for( "aclResolver" ) ] = null;

            if ( ok ) {
                return result( 200, {
                    aclResolvers,
                } );
            }

            // log validation errors
            if ( env.isDevelopment ) {
                console.log( `Parameters validation errors for method "${ this.id }"\nInput params:\n` + JSON.stringify( params, null, 4 ), "\nErrors:\n" + this.#paramsValidator.errors.toString() );
            }

            return result( -32_808, null, {
                "errors": this.#paramsValidator.errors.messages,
            } );
        }
        catch ( e ) {
            return result.catch( e, { "log": false } );
        }
    }

    toJSON () {
        return {
            "id": this.id,
            "title": this.title,
            "description": this.description,
            "deprecated": this.deprecated,
            "permission": this.permission,
            "requireAuthorization": this.requireAuthorization,
            "requirePersistentConnection": this.requirePersistentConnection,
            "maxParallelCallsPerClient": this.maxParallelCallsPerClient || this.api.config.frontend.maxParallelCallsPerClient,
            "arguments": this.#params,
        };
    }

    // private
    #buildParamsValidator () {
        var res;

        res = this.#buildParamsSchema();
        if ( !res.ok ) return res;

        const paramsSchema = res.data;

        // compile method params schema validator
        try {
            global[ Symbol.for( "aclResolver" ) ] = null;
            global[ Symbol.for( "ajvFileKeyword" ) ] = null;

            this.#paramsValidator = buildParamsValidator( paramsSchema, false );

            this.#aclResolvers = global[ Symbol.for( "aclResolver" ) ];
            global[ Symbol.for( "aclResolver" ) ] = null;

            if ( global[ Symbol.for( "ajvFileKeyword" ) ] ) {
                this.#maxUploadFileSize = global[ Symbol.for( "ajvFileKeyword" ) ];
            }
            global[ Symbol.for( "ajvFileKeyword" ) ] = null;

            if ( this.#aclResolvers?.size > 1 ) return result( [ 500, `Only one ACL resolver is possible for API methis: ${ this.id }` ] );

            return result( 200 );
        }
        catch ( e ) {
            return result( [ 500, `Failed to compile parameters schema for "${ this.module.name }/${ this.#name }": ${ e.message }\n${ JSON.stringify( paramsSchema, null, 4 ) }` ] );
        }
    }

    #buildParamsSchema () {

        // method has params
        if ( this.#params ) {
            let minItems = 0,
                hasOptionalParams;

            const items = [];

            for ( const param of this.#params ) {
                items.push( param.schema );

                // parameter is required
                if ( param.required ) {
                    if ( hasOptionalParams ) {
                        return result( [ 400, `API method "${ this.id }" required parameter placed after optional parameters` ] );
                    }

                    minItems++;
                }

                // parameter is optional
                else {
                    hasOptionalParams = true;
                }
            }

            return result( 200, {
                "type": "array",
                minItems,
                "maxItems": items.length,
                items,
                "errorMessage": {
                    "minItems": "Invalid number of arguments",
                    "maxItems": "Invalid number of arguments",
                },
            } );
        }

        // method has no params
        else {
            return result( 200, {
                "type": "array",
                "items": false,
                "errorMessage": "Method require no parameters",
            } );
        }
    }
}
