import _Ajv from "ajv";
import ajvErrors from "ajv-errors";
import ajvFormats from "ajv-formats";
import ajvFormatsDraft2019 from "ajv-formats-draft2019";
import ajvKeywords from "ajv-keywords";
import InstanceOfDefinitions from "ajv-keywords/dist/definitions/instanceof.js";
import AjvErrors from "#lib/ajv/errors";
import customFormats from "#lib/ajv/formats";

// import ajvMergePatch from "ajv-merge-patch";

export default class Ajv extends _Ajv {
    #errors;

    constructor ( options = {} ) {
        super( {
            "strict": false,
            "coerceTypes": true,
            "allErrors": true,
            "useDefaults": true,
            ...options,
        } );

        // plugins
        ajvErrors( this, { "keepErrors": false, "singleError": true } );
        ajvFormats( this );
        ajvFormatsDraft2019( this );
        ajvKeywords( this );
        this.addFormats( customFormats );

        // ajvMergePatch( this );
    }

    // static
    static registerInstance ( name, Class ) {
        InstanceOfDefinitions.CONSTRUCTORS[ name ] = Class;
    }

    // properties
    get errors () {
        return this.#errors;
    }

    set errors ( value ) {
        this.#errors = value ? new AjvErrors( value ) : value;
    }

    // public
    addFormats ( formats ) {
        for ( const name in formats ) {
            super.addFormat( name, formats[ name ] );
        }

        return this;
    }

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
