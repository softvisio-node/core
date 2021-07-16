import Ajv from "ajv";
import ajvErrors from "ajv-errors";
import ajvFormats from "ajv-formats";
import ajvFormatsDraft2019 from "ajv-formats-draft2019";
import ajvKeywords from "ajv-keywords";

// import ajvMergePatch from "ajv-merge-patch";

import apiReadKeyword from "#lib/ajv/api-read-keyword";

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

        // ajvMergePatch( ajv );

        if ( options.api ) ajv.addKeyword( apiReadKeyword.keyword );

        return ajv;
    }

    get keywords () {
        return { apiReadKeyword };
    }
}

export default new AjvWrapper();
