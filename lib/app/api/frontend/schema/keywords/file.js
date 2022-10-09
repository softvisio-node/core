import File from "#lib/file";

const keyword = {
    "keyword": "file",
    "metaSchema": {
        "type": "object",
        "properties": {
            "maxSize": { "type": "integer", "minimum": 1 },
            "contentType": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" }, "minItems": 1 }] },
        },
        "required": ["maxSize"],
        "additionalProperties": false,
    },
    "errors": true,
    compile ( schema, parentSchema ) {
        const maxSize = schema.maxSize;
        const contentType = schema.contentType ? new Set( Array.isArray( schema.contentType ) ? schema.contentType : [schema.contentType] ) : null;

        return function validator ( data ) {
            validator.errors = [];

            if ( data instanceof File ) {
                if ( !data.size || data.size > maxSize ) {
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

    async getDescription ( param ) {
        var desc = "<File\\>" + ( param.description ? " " + param.description.trim() : "" ) + ` Maximim file size: \`${new Intl.NumberFormat( "en-US" ).format( param.schema.file.maxSize )}\` bytes.`;

        if ( param.schema.file.contentType ) {
            const types = new Set( Array.isArray( param.schema.file.contentType ) ? param.schema.file.contentType : [param.schema.file.contentType] );

            desc +=
                " Allowed content types: " +
                [...types]
                    .sort()
                    .map( type => `\`"${type}"\`` )
                    .join( ", " ) +
                ".";
        }

        return desc;
    }
}

export default new FileKeyword();
