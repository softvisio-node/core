import Ajv from "ajv";
import ajvErrors from "ajv-errors";
import ajvFormats from "ajv-formats";
import ajvFormatsDraft2019 from "ajv-formats-draft2019";
import ajvKeywords from "ajv-keywords";
import InstanceOfDefinitions from "ajv-keywords/dist/definitions/instanceof.js";
import * as namingConventions from "#lib/utils/naming-conventions";

// import ajvMergePatch from "ajv-merge-patch";

class AjvWrapper {
    new ( options = {} ) {
        options = {
            "strict": false,
            "coerceTypes": true,
            "allErrors": true,
            ...options,
        };

        const ajv = new Ajv( options );

        // plugins
        ajvErrors( ajv, { "keepErrors": false, "singleError": true } );
        ajvFormats( ajv );
        ajvFormatsDraft2019( ajv );
        ajvKeywords( ajv );

        ajv.addFormat( "kebab-case", {
            "type": "string",
            "validate": value => namingConventions.isKebabCase( value, { "sep": "/" } ),
        } );

        // ajvMergePatch( ajv );

        return ajv;
    }

    registerInstance ( name, Class ) {
        InstanceOfDefinitions.CONSTRUCTORS[name] = Class;
    }
}

export default new AjvWrapper();
