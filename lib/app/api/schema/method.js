import env from "#lib/env";
import { buildParamsValidator } from "./validator.js";

export default class {
    #module;
    #name;
    #id;

    #title;
    #description;
    #deprecated = false;
    #private = false;
    #roles;
    #authorizationRequired = false;
    #persistentConnectionRequired = false;
    #logApiCalls = false;
    #activeRequestsLimit = 0;
    #activeRequestsUserLimit = 0;

    #params;
    #paramsValidator;
    #aclObjectTypes;

    #isUpload;
    #uploadMaxSize;
    #uploadContentType;

    #readLimit;
    #readDefaultOrderBy;

    // XXX validators
    constructor ( module, name ) {
        this.#module = module;
        this.#name = name;
        this.#id = `${module.id}/${name}`;
    }

    // properties
    get module () {
        return this.#module;
    }

    get name () {
        return this.#name;
    }

    get id () {
        return this.#id;
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

    get private () {
        return this.#private;
    }

    get roles () {
        return this.#roles || this.#module.roles;
    }

    get authorizationRequired () {
        return this.#authorizationRequired;
    }

    get persistentConnectionRequired () {
        return this.#persistentConnectionRequired;
    }

    get logApiCalls () {
        return this.#logApiCalls;
    }

    get activeRequestsLimit () {
        return this.#activeRequestsLimit;
    }

    get activeRequestsUserLimit () {
        return this.#activeRequestsUserLimit;
    }

    get object () {
        return this.#module.object;
    }

    get aclObjectTypes () {
        return this.#aclObjectTypes;
    }

    // upload method
    get isUpload () {
        this.#isUpload ??= this.#params?.[0]?.schema?.file;

        return this.#isUpload;
    }

    get uploadMaxSize () {
        if ( this.#uploadMaxSize == null ) {
            if ( this.isUpload ) {
                this.#uploadMaxSize = this.#params?.[0]?.schema?.file.maxSize;
            }
            else {
                this.#uploadMaxSize = false;
            }
        }

        return this.#uploadMaxSize;
    }

    get uploadContentType () {
        if ( this.#uploadContentType == null ) {
            if ( this.isUpload ) {
                const contentType = this.#params?.[0]?.schema?.file.contentType;

                if ( !contentType ) this.#uploadContentType = false;
                else this.#uploadContentType = new Set( Array.isArray( contentType ) ? contentType : [contentType] );
            }
            else {
                this.#uploadContentType = false;
            }
        }

        return this.#uploadContentType;
    }

    // read
    get readLimit () {
        this.#readLimit ??= {
            "defaultLimit": this.#params?.[0]?.schema?.read?.limit?.defaultLimit,
            "maxLimit": this.#params?.[0]?.schema?.read?.limit?.maxLimit,
            "maxResults": this.#params?.[0]?.schema?.read?.limit?.maxResults,
        };

        return this.#readLimit;
    }

    get readDefaultOrderBy () {
        this.#readDefaultOrderBy ??= this.#params?.[0]?.schema?.read?.order_by ?? false;

        return this.#readDefaultOrderBy;
    }

    // public
    setSpec ( spec ) {
        if ( spec.title ) this.#title = spec.title;
        if ( spec.description ) this.#description = spec.description;
        if ( spec.deprecated != null ) this.#deprecated = spec.deprecated;
        if ( spec.private != null ) this.#private = spec.private;
        if ( spec.roles ) this.#roles = new Set( spec.roles );
        if ( spec.authorizationRequired != null ) this.#authorizationRequired = spec.authorizationRequired;
        if ( spec.persistentConnectionRequired != null ) this.#persistentConnectionRequired = spec.persistentConnectionRequired;
        if ( spec.logApiCalls != null ) this.#logApiCalls = spec.logApiCalls;
        if ( spec.activeRequestsLimit != null ) this.#activeRequestsLimit = spec.activeRequestsLimit;
        if ( spec.activeRequestsUserLimit != null ) this.#activeRequestsUserLimit = spec.activeRequestsUserLimit;
        if ( spec.params ) this.#params = spec.params;

        return result( 200 );
    }

    validateParams ( params ) {
        global[Symbol.for( "aclObjectType" )] = null;

        const ok = this.#paramsValidator( params );

        const aclObjectTypes = global[Symbol.for( "aclObjectType" )];
        global[Symbol.for( "aclObjectType" )] = null;

        if ( ok ) return result( 200, { aclObjectTypes } );

        // log validation errors
        if ( env.isDevelopment ) {
            console.log( `Params validation errors for method "${this.id}"\nInput params:\n` + JSON.stringify( params, null, 4 ), "\nErrors:\n" + this.#paramsValidator.errors.toString() );
        }

        return result( -32808, null, { "errors": this.#paramsValidator.errors.messages } );
    }

    // private
    #buildParamsValudator () {
        const paramsSchema = this.#buildParamsSchema();

        // compile method params schema validator
        try {
            global[Symbol.for( "aclObjectType" )] = null;

            this.#paramsValidator = buildParamsValidator( paramsSchema );

            this.#aclObjectTypes = global[Symbol.for( "aclObjectType" )];
            global[Symbol.for( "aclObjectType" )] = null;
        }
        catch ( e ) {
            throw result( [500, `Unable to compile params schema for "${this.module.name}/${this.#name}". ` + e] );
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
                        "anyOf": `Parameter "${param.name}" must be null or match schema`,
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
