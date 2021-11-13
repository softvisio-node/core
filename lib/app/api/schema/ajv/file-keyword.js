import File from "#lib/file";

const keyword = {
    "keyword": "file",
    "metaSchema": {
        "type": "object",
        "properties": {
            "maxSize": { "type": "integer", "minimum": 1 },
            "contentType": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }] },
        },
        "additionalProperties": false,
    },
    "macro": ( schema, parentSchema, it ) => {
        const data = {
            "instanceof": File,
        };

        return data;
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
