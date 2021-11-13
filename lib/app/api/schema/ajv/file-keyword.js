import File from "#lib/file";

const keyword = {
    "keyword": "file",
    "metaSchema": {
        "type": "object",
        "properties": {
            "maxSize": { "type": "integer", "minimum": 0 },
            "contentType": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }] },
        },
        "additionalProperties": false,
    },
    "errors": true,
    compile ( schema, parentSchema ) {
        const maxSize = schema.maxSize;
        const contentType = schema.contentType ? new Set( Array.isArray( schema.contentType ) ? schema.contentType : [schema.contentType] ) : null;

        return function validator ( data ) {
            validator.errors = [];

            if ( data instanceof File ) {
                if ( maxSize && ( !data.size || data.size > maxSize ) ) {
                    validator.errors.push( {
                        "keyword": "file",
                        "message": `File is too large. Maximum allowed file size is ${maxSize} byte(s)`,
                    } );
                }

                if ( contentType && ( !data.type || !contentType.has( data.type ) ) ) {
                    validator.errors.push( {
                        "keyword": "file",
                        "message": `Content type is invalid`,
                    } );
                }
            }
            else {
                validator.errors.push( {
                    "keyword": "file",
                    "message": "Not a file object",
                } );
            }

            return;
        };
    },
};

class FileKeyword {
    get keyword () {
        return keyword;
    }

    async getDescription ( schema, meta = {} ) {
        return "";

        // upload file
        // else if ( method.meta?.type === "upload" && param.schema?.instanceof === "File" ) {
        // desc = "<File\\>" + ( param.description ? " " + param.description.trim() : "" ) + ` Maximim file size: \`${new Intl.NumberFormat( "en-US" ).format( method.meta.uploadMaxSize )}\` bytes.`;
        // if ( method.meta.uploadContentType ) {
        //     const types = new Set( method.meta.uploadContentType );
        //     desc +=
        //         " Allowed content types: " +
        //         [...types]
        //             .sort()
        //             .map( type => `\`"${type}"\`` )
        //             .join( ", " ) +
        //         ".";
        // }
        // }
        // const { "default": ejs } = await import( "#lib/ejs" ),
        //     tmpl = utils.resolve( "#resources/templates/file-keyword.md.ejs", import.meta.url );
        // return ejs.renderFile( tmpl, {
        //     schema,
        // } );
    }
}

export default new FileKeyword();

// else if ( method.meta?.type === "upload" && param.schema?.instanceof === "File" ) {
//     desc = "<File\\>" + ( param.description ? " " + param.description.trim() : "" ) + ` Maximim file size: \`${new Intl.NumberFormat( "en-US" ).format( method.meta.uploadMaxSize )}\` bytes.`;

//     if ( method.meta.uploadContentType ) {
//         const types = new Set( method.meta.uploadContentType );

//         desc +=
//             " Allowed content types: " +
//             [...types]
//                 .sort()
//                 .map( type => `\`"${type}"\`` )
//                 .join( ", " ) +
//             ".";
//     }
// }
