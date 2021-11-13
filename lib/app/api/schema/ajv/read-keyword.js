import * as utils from "#lib/utils";

const READER_SCHEMAS = {
    "null": {
        "=": { "anyOf": [{ "type": "null" }, { "type": "array", "items": [{ "const": "=" }, { "type": "null" }] }] },
        "!=": { "anyOf": [{ "type": "null" }, { "type": "array", "items": [{ "const": "!=" }, { "type": "null" }] }] },
    },
    "boolean": {
        "=": { "anyOf": [{ "type": "boolean" }, { "type": "array", "items": [{ "const": "=" }, { "type": "boolean" }] }] },
        "!=": { "anyOf": [{ "type": "boolean" }, { "type": "array", "items": [{ "const": "!=" }, { "type": "boolean" }] }] },
        "in": { "type": "array", "items": [{ "const": "in" }, { "type": "array", "items": { "type": "boolean" } }] },
        "not in": { "type": "array", "items": [{ "const": "not in" }, { "type": "array", "items": { "type": "boolean" } }] },
    },
    "string": {
        "=": { "anyOf": [{ "type": "string" }, { "type": "array", "items": [{ "const": "=" }, { "type": "string" }] }] },
        "!=": { "anyOf": [{ "type": "string" }, { "type": "array", "items": [{ "const": "!=" }, { "type": "string" }] }] },
        "like": { "type": "array", "items": [{ "const": "like" }, { "type": "string" }] },
        "in": { "type": "array", "items": [{ "const": "in" }, { "type": "array", "items": { "type": "string" } }] },
        "not in": { "type": "array", "items": [{ "const": "not in" }, { "type": "array", "items": { "type": "string" } }] },
    },
    "number": {
        "=": { "anyOf": [{ "type": "number" }, { "type": "array", "items": [{ "const": "=" }, { "type": "number" }] }] },
        "!=": { "anyOf": [{ "type": "number" }, { "type": "array", "items": [{ "const": "!=" }, { "type": "number" }] }] },
        "<": { "type": "array", "items": [{ "const": "<" }, { "type": "number" }] },
        ">": { "type": "array", "items": [{ "const": ">" }, { "type": "number" }] },
        "<=": { "type": "array", "items": [{ "const": "<=" }, { "type": "number" }] },
        ">=": { "type": "array", "items": [{ "const": ">=" }, { "type": "number" }] },
        "in": { "type": "array", "items": [{ "const": "in" }, { "type": "array", "items": { "type": "number" } }] },
        "not in": { "type": "array", "items": [{ "const": "not in" }, { "type": "array", "items": { "type": "number" } }] },
    },
    "integer": {
        "=": { "anyOf": [{ "type": "integer" }, { "type": "array", "items": [{ "const": "=" }, { "type": "integer" }] }] },
        "!=": { "anyOf": [{ "type": "integer" }, { "type": "array", "items": [{ "const": "!=" }, { "type": "integer" }] }] },
        "<": { "type": "array", "items": [{ "const": "<" }, { "type": "integer" }] },
        ">": { "type": "array", "items": [{ "const": ">" }, { "type": "integer" }] },
        "<=": { "type": "array", "items": [{ "const": "<=" }, { "type": "integer" }] },
        ">=": { "type": "array", "items": [{ "const": ">=" }, { "type": "integer" }] },
        "in": { "type": "array", "items": [{ "const": "in" }, { "type": "array", "items": { "type": "integer" } }] },
        "not in": { "type": "array", "items": [{ "const": "not in" }, { "type": "array", "items": { "type": "integer" } }] },
    },
};

const keyword = {
    "keyword": "read",
    "metaSchema": {
        "type": "object",
        "properties": {

            // fields
            "fields": {
                "type": "object",
                "patternProperties": {

                    // snake_case names
                    "^[a-z]+(?:_[a-z\\d]+)*$": {
                        "type": "object",
                        "properties": {
                            "type": { "type": "string", "enum": ["null", "boolean", "string", "number", "integer"] },
                            "conditions": {
                                "type": "array",
                                "items": { "type": "string", "enum": ["=", "!=", "<", ">", "<=", ">=", "like", "in", "not in"] },
                                "minItems": 1,
                                "uniqueItems": true,
                            },
                            "required": { "type": "boolean" },
                            "sortable": { "type": "boolean" },
                        },
                        "additionalProperties": false,
                    },
                },
                "additionalProperties": false,
                "errorMessage": `API read method fields must be in the snake_case`,
            },

            // default order by
            "order_by": {
                "anyOf": [

                    //
                    { "type": "string" },
                    {
                        "type": "array",
                        "items": {
                            "anyOf": [

                                //
                                { "type": "string" },
                                { "type": "array", "items": [{ "type": "string" }, { "enum": ["asc", "desc"] }] },
                            ],
                        },
                        "minItems": 1,
                    },
                ],
            },

            // offset
            "offset": { "const": false },

            // limit
            "limit": {
                "anyOf": [
                    { "const": false },
                    {
                        "type": "object",
                        "properties": {
                            "default_limit": { "type": "integer", "minimum": 1 },
                            "max_limit": { "type": "integer", "minimum": 1 },
                            "max_results": { "type": "integer", "minimum": 1 },
                        },
                        "additionalProperties": false,
                    },
                ],
            },
        },
    },

    "macro": ( schema, parentSchema, it ) => {
        const macro = {
            "type": "object",
            "properties": {},
            "additionalProperties": false,
        };

        // offset
        if ( schema.offset !== false ) {
            macro.properties.offset = { "type": "integer", "minimum": 0 };
        }

        // limit
        if ( schema.limit !== false ) {
            const limit = { "type": "integer", "minimum": 1 };

            if ( schema.limit.max_limit ) limit.maximum = schema.limit.max_limit;

            macro.properties.limit = limit;
        }

        const required = [];
        const sortable = [];

        for ( const fieldName in schema.fields ) {
            const field = schema.fields[fieldName];

            // "id" field
            if ( fieldName === "id" ) {
                macro.properties.id = {};

                if ( field.type ) macro.properties.id.type = field.type;
            }

            if ( field.required ) required.push( fieldName );
            if ( field.sortable ) sortable.push( fieldName );

            if ( field.conditions ) {
                const spec = [];

                for ( const type of Array.isArray( field.type ) ? field.type : [field.type] ) {
                    for ( const condition of field.conditions ) {
                        spec.push( READER_SCHEMAS[type][condition] );
                    }
                }

                macro.properties.where ||= { "type": "object", "additionalProperties": false, "properties": {} };

                macro.properties.where.properties[fieldName] = {
                    "anyOf": spec,
                };
            }
        }

        // required
        if ( required.length ) macro.properties.where.required = required;

        // order by
        if ( sortable.length ) {
            macro.properties["order_by"] = {
                "anyOf": [
                    { "enum": sortable },
                    {
                        "type": "array",
                        "items": {
                            "anyOf": [
                                { "enum": sortable },
                                {
                                    "type": "array",
                                    "items": [
                                        { "enum": sortable }, //
                                        { "enum": ["asc", "desc"] },
                                    ],
                                },
                            ],
                        },
                    },
                ],
            };
        }

        return macro;
    },
};

class readKeyword {
    get keyword () {
        return keyword;
    }

    async getDescription ( param ) {
        const { "default": ejs } = await import( "#lib/ejs" ),
            tmpl = utils.resolve( "#resources/templates/read-keyword.md.ejs", import.meta.url );

        return ejs.renderFile( tmpl, {
            "schema": param.schema,
            "fields": param.schema.fields,
            "where": Object.keys( param.schema.fields || {} ).filter( field => param.schema.fields[field].conditions?.length ),
            "order_by": Object.keys( param.schema.fields ).filter( field => param.schema.fields[field].sortable ),
            "offset": param.schema.offset,
            "limit": param.schema.limit,
        } );
    }
}

export default new readKeyword();
