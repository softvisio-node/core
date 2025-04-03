import env from "#lib/env";
import { kebabToCamelCase } from "#lib/naming-conventions";
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
    #authorizationRequired = false;
    #persistentConnectionRequired = false;
    #maxParallelCallsPerClient;

    #params;
    #paramsValidator;
    #aclResolvers;

    #readLimit;
    #readDefaultOrderBy;

    constructor ( module, name ) {
        this.#module = module;
        this.#name = name;
        this.#id = `${ module.id }/${ name }`;
        this.#apiName = "API_" + kebabToCamelCase( name );
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

    get authorizationRequired () {
        return this.#authorizationRequired;
    }

    get persistentConnectionRequired () {
        return this.#persistentConnectionRequired;
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
        if ( !this.#title ) return result( [ 400, `API method title is required` ] );

        if ( Reflect.has( config, "description" ) ) {
            this.#description = config.description;
        }

        if ( Reflect.has( config, "deprecated" ) ) {
            this.#deprecated = config.deprecated;
        }

        if ( Reflect.has( config, "permission" ) ) {
            this.#permission = config.permission;
        }

        if ( Reflect.has( config, "authorizationRequired" ) ) {
            this.#authorizationRequired = config.authorizationRequired;
        }

        if ( Reflect.has( config, "persistentConnectionRequired" ) ) {
            this.#persistentConnectionRequired = config.persistentConnectionRequired;
        }

        if ( Reflect.has( config, "maxParallelCallsPerClient" ) ) {
            this.#maxParallelCallsPerClient = config.maxParallelCallsPerClient;
        }

        if ( Reflect.has( config, "params" ) ) {
            this.#params = config.params;
        }

        const res = this.#buildParamsValudator();
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
            "authorizationRequired": this.authorizationRequired,
            "persistentConnectionRequired": this.persistentConnectionRequired,
            "maxParallelCallsPerClient": this.maxParallelCallsPerClient || this.api.config.frontend.maxParallelCallsPerClient,
            "arguments": this.#params,
        };
    }

    // private
    #buildParamsValudator () {
        var res;

        res = this.#buildParamsSchema();
        if ( !res.ok ) return res;

        const paramsSchema = res.data;

        // compile method params schema validator
        try {
            global[ Symbol.for( "aclResolver" ) ] = null;

            this.#paramsValidator = buildParamsValidator( paramsSchema, false );

            this.#aclResolvers = global[ Symbol.for( "aclResolver" ) ];
            global[ Symbol.for( "aclResolver" ) ] = null;

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
                try {
                    buildParamsValidator( param.schema, true );
                }
                catch ( e ) {
                    return result( [ 500, `Failed to compile parameter schema for "${ this.module.name }/${ this.#name }/${ param.name }": ${ e.message }\n${ JSON.stringify( param.schema, null, 4 ) }` ] );
                }

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
                    "minItems": `Invalid number of arguments`,
                    "maxItems": `Invalid number of arguments`,
                },
            } );
        }

        // method has no params
        else {
            return result( 200, {
                "type": "array",
                "items": false,
                "errorMessage": `Method require no parameters`,
            } );
        }
    }
}
