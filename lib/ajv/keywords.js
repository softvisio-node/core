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
                    "enum": [ "kebab-case", "snake-case" ],
                },
            },
            "additionalProperties": false,
            "required": [],
        },
        "errors": false,
        compile ( schema, parentSchema, it ) {
            const root = schema.root,
                absolute = schema.absolute,
                folder = schema.folder,
                format = schema.format;

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
