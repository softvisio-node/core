import _Ajv from "ajv";
import ajvErrors from "ajv-errors";
import ajvFormats from "ajv-formats";
import ajvFormatsDraft2019 from "ajv-formats-draft2019";
import ajvKeywords from "ajv-keywords";
import InstanceOfDefinitions from "ajv-keywords/dist/definitions/instanceof.js";
import * as namingConventions from "#lib/utils/naming-conventions";

// import ajvMergePatch from "ajv-merge-patch";

class AjvErrors {
    #errors;
    #messages;
    #toString;

    constructor ( errors ) {
        this.#errors = errors;
    }

    get raw () {
        return this.#errors;
    }

    get messages () {
        if ( !this.#messages ) {
            const messages = [];

            for ( const error of this.#errors ) {
                if ( error.keyword === "errorMessage" ) {
                    messages.push( error.message );
                }
                else if ( !error.instancePath ) {
                    messages.push( `Data ${error.message}` );
                }
                else {
                    messages.push( `Value at "${error.instancePath}" ${error.message}` );
                }
            }

            this.#messages = messages;
        }

        return this.#messages;
    }

    // public
    toString () {
        this.#toString ??= this.messages.join( "\n" );

        return this.#toString;
    }

    toJSON () {
        return this.#messages;
    }
}

export default class Ajv extends _Ajv {
    #errors;

    constructor ( options = {} ) {
        super( {
            "strict": false,
            "coerceTypes": true,
            "allErrors": true,
            ...options,
        } );

        // plugins
        ajvErrors( this, { "keepErrors": false, "singleError": true } );
        ajvFormats( this );
        ajvFormatsDraft2019( this );
        ajvKeywords( this );

        this.addFormat( "event-name", {
            "type": "string",
            "validate": value => namingConventions.isKebabCase( value, { "sep": "/" } ),
        } );

        // ajvMergePatch( this );
    }

    // static
    static registerInstance ( name, Class ) {
        InstanceOfDefinitions.CONSTRUCTORS[name] = Class;
    }

    // properties
    get errors () {
        return this.#errors;
    }

    set errors ( value ) {
        this.#errors = value ? new AjvErrors( value ) : value;
    }

    // public
    compile ( schema ) {
        const _validate = super.compile( schema );

        return function validate ( data ) {
            if ( _validate( data ) ) {
                validate.errors = null;

                return true;
            }
            else {
                validate.errors = new AjvErrors( _validate.errors );

                return false;
            }
        };
    }

    validate ( schema, data ) {
        return super.validate( schema, data );
    }
}
