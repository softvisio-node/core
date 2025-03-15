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
    setSpec ( spec ) {
        if ( spec.title ) this.#title = spec.title;
        if ( spec.description ) this.#description = spec.description;
        if ( spec.deprecated != null ) this.#deprecated = spec.deprecated;
        if ( "permission" in spec ) this.#permission = spec.permission;
        if ( spec.authorizationRequired != null ) this.#authorizationRequired = spec.authorizationRequired;
        if ( spec.persistentConnectionRequired != null ) this.#persistentConnectionRequired = spec.persistentConnectionRequired;

        if ( "maxParallelCallsPerClient" in spec ) {
            this.#maxParallelCallsPerClient = spec.maxParallelCallsPerClient;
        }

        if ( spec.params ) this.#params = spec.params;

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
        const paramsSchema = this.#buildParamsSchema();

        // compile method params schema validator
        try {
            global[ Symbol.for( "aclResolver" ) ] = null;

            this.#paramsValidator = buildParamsValidator( paramsSchema );

            this.#aclResolvers = global[ Symbol.for( "aclResolver" ) ];
            global[ Symbol.for( "aclResolver" ) ] = null;

            if ( this.#aclResolvers?.size > 1 ) return result( [ 500, `Only one ACL resolver is possible for API methis: ${ this.id }` ] );

            return result( 200 );
        }
        catch ( e ) {
            return result( [ 500, `Failed to compile params schema for "${ this.module.name }/${ this.#name }": ${ e.message }\n${ JSON.stringify( paramsSchema, null, 4 ) }` ] );
        }
    }

    #buildParamsSchema () {
        let maxItems = 0,
            minItems = 0;

        const params = [];

        for ( const param of this.#params || [] ) {
            maxItems++;

            // param is required
            if ( param.required ) {
                minItems = maxItems;

                params.push( param.schema );
            }

            // param is not required
            else {
                params.push( {
                    "anyOf": [

                        //
                        { "type": "null" },
                        param.schema,
                    ],
                    "errorMessage": {
                        "anyOf": `Parameter "${ param.name }" must be null or match schema`,
                    },
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
                "errorMessage": {
                    "minItems": `Invalid number of arguments`,
                    "maxItems": `Invalid number of arguments`,
                },
            };
        }

        // method has no params
        else {
            return {
                "type": "array",
                "items": false,
                "errorMessage": `Method require no parameters`,
            };
        }
    }
}
