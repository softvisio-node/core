import * as namingConventions from "#lib/naming-conventions";

export default [
    {
        "keyword": "path",
        "type": "string",
        "metaSchema": {
            "type": "object",
            "properties": {
                "root": { "type": "boolean" },
                "folder": { "type": "boolean" },
                "absolute": { "type": "boolean" },
                "format": {
                    "enum": [ "kebab-case", "snake-case", "constant-case", "cames-case", "pascal-case" ],
                },
            },
            "additionalProperties": false,
            "required": [],
        },
        "errors": false,
        compile ( schema, parentSchema, it ) {
            const { root, absolute, folder, format } = schema;

            return function validator ( data ) {
                return namingConventions.validatePath( data, {
                    root,
                    absolute,
                    folder,
                    format,
                } );
            };
        },
    },
];
