import env from "#lib/env";
import Ajv from "#lib/ajv";
import apiReadKeyword from "./ajv/api-read-keyword.js";
import File from "#lib/file";
import isValidCamelCase from "#lib/utils/camel-case";

Ajv.registerInstance( "File", File );

export default class Method {
    #module;
    #name;
    #spec;
    #id;
    #apiName;
    #permissions;
    #validate;
    #markdownSignature;

    constructor ( module, name, spec ) {
        this.#module = module;
        this.#name = name;
        this.#spec = spec;

        // check, that method name is in camelCase
        if ( !isValidCamelCase( this.#name ) ) throw result( [500, `API Method name "${this.#name}" in module "${this.module.name}" must be in the camelCase`] );

        // convert class permissions to object
        if ( this.#spec.permissions ) this.#permissions = Object.keys( Object.fromEntries( this.#spec.permissions.map( permission => [permission, true] ) ) ).sort();

        // inherit module permissions
        else if ( this.#module.permissions ) this.#permissions = this.#module.permissions;

        // permissions are not defined
        else throw result( [500, `Permissions for API method "${this.name}" in module "${this.module.url}" must be defined.`] );

        // check, that params names are in the camelCase
        if ( spec.params ) {
            for ( const param of spec.params ) if ( !isValidCamelCase( param.name ) ) throw result( [500, `Parameter name "${param.name}" for module "${this.module.name}" method "${this.name}" must be in the camelCase`] );
        }

        if ( this.namespace ) {
            this.#id = this.namespace + "/" + this.#name;

            this.#apiName = "API_" + this.#name;
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

    get permissions () {
        return this.#permissions;
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

    // meta
    get meta () {
        return this.#spec.meta || {};
    }

    get isUpload () {
        return this.#spec.meta?.type === "upload";
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
    async loadApi ( api ) {
        if ( this.#spec.validateParams !== false ) {
            const paramsSchema = this.#buildParamsSchema();

            // compile method params schema validator
            try {
                this.#validate = Ajv.new().addKeyword( apiReadKeyword.keyword ).compile( paramsSchema );
            }
            catch ( e ) {
                throw result( 500, [`Unable to compile params schema. ` + e] );
            }
        }

        return this.#module.loadApi( api );
    }

    validateParams ( params ) {
        if ( !this.#validate || this.#validate( params ) ) return result( 200 );

        // log validation errors
        if ( env.isDevelopment ) console.log( `Params validation errors for method "${this.id}":\n` + JSON.stringify( this.#validate.errors, null, 4 ) );

        return result( [-32808, this.#validate.errors.map( e => e.message ).join( "; " )] );
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

                if ( !param.schema.errorMessage ) param.schema.errorMessage = `Parameter "${param.name}" is invalid`;
            }

            // param is not required
            else {
                params.push( {
                    "anyOf": [

                        //
                        { "type": "null" },
                        param.schema,
                    ],
                    "errorMessage": `Parameter "${param.name}" is invalid`,
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
                "errorMessage": `Invalid number of parameters`,
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
