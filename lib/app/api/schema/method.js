import env from "#lib/env";
import ajv from "#lib/ajv";

const OK = result( 200 );

export default class Method {
    #module;
    #name;
    #spec;
    #id;
    #APIname;
    #permissions;
    #validate;

    constructor ( module, name, spec ) {
        this.#module = module;
        this.#name = name;
        this.#spec = spec;

        // convert class permissions to object
        if ( this.#spec.permissions ) this.#permissions = Object.keys( Object.fromEntries( this.#spec.permissions.map( permission => [permission, true] ) ) ).sort();

        // inherit module permissions
        else if ( this.#module.permissions ) this.#permissions = this.#module.permissions;

        // permissions are not defined
        else throw result( [500, `Permissions for API method "${this.name}" in module "${this.module.url}" must be defined.`] );

        if ( this.namespace ) {
            this.#id = this.namespace + "/" + this.#name;

            this.#APIname = "API_" + this.#name.replaceAll( "-", "_" );
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

    get APIname () {
        return this.#APIname;
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

    get summary () {
        return this.#spec.summary;
    }

    get description () {
        return this.#spec.description;
    }

    get deprecated () {
        return this.#spec.deprecated;
    }

    get activeRequestsLimit () {
        return this.#spec.activeRequestsLimit;
    }

    get activeRequestsUserLimit () {
        return this.#spec.activeRequestsUserLimit;
    }

    get logApiCalls () {
        return this.#spec.logApiCalls;
    }

    get upload () {
        return this.#spec.upload;
    }

    get uploadMaxSize () {
        return this.#spec.uploadMaxSize;
    }

    get object () {
        return this.#module.object;
    }

    // markdown
    get markdownId () {
        if ( this.deprecated ) {
            return this.id + "-deprecated";
        }
        else {
            return this.id;
        }
    }

    get markdownParams () {
        if ( this.#spec.params ) {
            const params =
                ", " +
                this.#spec.params
                    .map( param => {

                        // required
                        if ( param.required ) {
                            return param.name;
                        }

                        // not required
                        else {
                            return "[" + param.name + "]";
                        }
                    } )
                    .join( ", " );

            return params;
        }

        // method has no params
        else {
            return "";
        }
    }

    // public
    async loadObject ( api ) {
        if ( this.#spec.validateParams !== false ) {
            const paramsSchema = this.#buildParamsSchema();

            // compile method params schema validator
            try {
                this.#validate = ajv().addApiKeywords().compile( paramsSchema );
            }
            catch ( e ) {
                throw result( 500, [`Unable to compile params schema. ` + e] );
            }
        }

        return this.#module.loadObject( api );
    }

    validateParams ( params ) {
        if ( this.#validate && this.#validate( params ) ) return OK;

        // log validation errors
        if ( env.isDevelopment ) console.log( `Params validation errors for method "${this.id}":`, this.#validate.errors );

        return result( [400, this.#validate.errors.map( e => e.message ).join( "\n" )] );
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
                    "anyOf": [{ "type": "null" }, param.schema],
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
            };
        }

        // methos has no params
        else {
            return { "type": "array", "items": false };
        }
    }
}
