import env from "#lib/env";
import { isKebabCase, isSnakeCase, kebabToCamelCase } from "#lib/utils/naming-conventions";
import { buildParamsValidator } from "./validator.js";

export default class Method {
    #module;
    #name;
    #spec;
    #id;
    #apiName;
    #roles;
    #validator;
    #aclTypes;
    #markdownSignature;

    #isUpload;
    #uploadMaxSize;
    #uploadContentType;

    #readLimit;
    #readDefaultOrderBy;

    constructor ( module, name, spec ) {
        this.#module = module;
        this.#name = name;
        this.#spec = spec;

        // check, that method name is in the kebab-case
        if ( !isKebabCase( this.#name ) ) throw result( [500, `API Method "${this.module.name}/${this.#name}" must be in the kebab-case`] );

        // check method name prefix
        // const prefix = this.#name.substring( 0, this.#name.indexOf( "-" ) );
        // if ( !prefix ) console.log( `API Method "${this.module.name}/${this.#name}" has invalid prefix` );

        // convert class roles to object
        if ( this.#spec.roles ) this.#roles = Object.keys( Object.fromEntries( this.#spec.roles.map( role => [role, true] ) ) ).sort();

        // inherit module roles
        else if ( this.#module.roles ) this.#roles = this.#module.roles;

        // roles are not defined
        else throw result( [500, `Roles for API method "${this.name}" in module "${this.module.url}" must be defined.`] );

        // check, that params names are in the snake_case
        if ( spec.params ) {
            for ( const param of spec.params ) if ( !isSnakeCase( param.name ) ) throw result( [500, `API method "${this.module.name}/${this.#name}", parameter "${param.name}" must be in the snake_case`] );
        }

        if ( this.namespace ) {
            this.#id = this.namespace + "/" + this.#name;

            // convert kebab-case to the camelCase
            this.#apiName = "API_" + kebabToCamelCase( this.#name );
        }
    }

    get module () {
        return this.#module;
    }

    get name () {
        return this.#name;
    }

    get spec () {
        return this.#spec;
    }

    get id () {
        return this.#id;
    }

    get apiName () {
        return this.#apiName;
    }

    get roles () {
        return this.#roles;
    }

    get namespace () {
        return this.#module.namespace;
    }

    get version () {
        return this.#module.version;
    }

    get title () {
        return this.#spec.title;
    }

    get description () {
        return this.#spec.description;
    }

    get private () {
        return this.#spec.private;
    }

    get deprecated () {
        return this.#spec.deprecated;
    }

    get aclTypes () {
        return this.#aclTypes;
    }

    get persistentConnectionRequired () {
        return this.#spec.persistentConnectionRequired;
    }

    // log
    get activeRequestsLimit () {
        return this.#spec.activeRequestsLimit;
    }

    get activeRequestsUserLimit () {
        return this.#spec.activeRequestsUserLimit;
    }

    get logApiCalls () {
        return this.#spec.logApiCalls;
    }

    // upload method
    get isUpload () {
        this.#isUpload ??= this.#spec.params?.[0]?.schema?.file;

        return this.#isUpload;
    }

    get uploadMaxSize () {
        if ( this.#uploadMaxSize == null ) {
            if ( this.isUpload ) {
                this.#uploadMaxSize = this.#spec.params?.[0]?.schema?.file.maxSize;
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
                const contentType = this.#spec.params?.[0]?.schema?.file.contentType;

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
            "defaultLimit": this.#spec.params?.[0]?.schema?.read?.limit?.defaultLimit,
            "maxLimit": this.#spec.params?.[0]?.schema?.read?.limit?.maxLimit,
            "maxResults": this.#spec.params?.[0]?.schema?.read?.limit?.maxResults,
        };

        return this.#readLimit;
    }

    get readDefaultOrderBy () {
        this.#readDefaultOrderBy ??= this.#spec.params?.[0]?.schema?.read?.order_by ?? false;

        return this.#readDefaultOrderBy;
    }

    get object () {
        return this.#module.object;
    }

    // markdown
    get markdownSignature () {
        if ( this.#markdownSignature == null ) {

            // method has params
            if ( this.#spec.params ) {
                const params = this.#spec.params
                    .map( param => {

                        // required
                        if ( param.required ) {
                            return param.name;
                        }

                        // not required
                        else {
                            return param.name + "?";
                        }
                    } )
                    .join( ", " );

                this.#markdownSignature = params;
            }

            // method has no params
            else {
                this.#markdownSignature = "";
            }
        }

        return this.#markdownSignature;
    }

    // public
    async buildParamsSchema () {
        const paramsSchema = this.#buildParamsSchema();

        // compile method params schema validator
        try {
            global[Symbol.for( "checkAcl" )] = null;

            this.#validator = buildParamsValidator( paramsSchema );

            this.#aclTypes = global[Symbol.for( "checkAcl" )];
            global[Symbol.for( "checkAcl" )] = null;
        }
        catch ( e ) {
            throw result( [500, `Unable to compile params schema for "${this.module.name}/${this.#name}". ` + e] );
        }
    }

    async loadApi ( api ) {
        return this.#module.loadApi( api );
    }

    validateParams ( params ) {
        if ( this.#validator( params ) ) return result( 200 );

        // log validation errors
        if ( env.isDevelopment ) console.log( `Params validation errors for method "${this.id}"\nInput params:\n` + JSON.stringify( params, null, 4 ), "\nErrors:\n" + this.#validator.errors.toString() );

        return result( -32808, null, { "errors": this.#validator.errors.messages } );
    }

    // private
    #buildParamsSchema () {
        let maxItems = 0,
            minItems = 0;

        const params = [];

        for ( const param of this.#spec.params || [] ) {
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
