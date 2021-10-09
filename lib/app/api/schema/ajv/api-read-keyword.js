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
    "keyword": "apiRead",
    "metaSchema": {
        "type": "object",
        "patternProperties": {
            "^[a-z](?:_[a-zd]+)*$": {
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
    "macro": ( schema, parentSchema, it ) => {
        const data = {
            "type": "object",
            "properties": {
                "limit": { "type": "integer", "minimum": 0 },
                "offset": { "type": "integer", "minimum": 0 },
            },
            "additionalProperties": false,
        };

        const required = [];
        const sortable = [];

        for ( const field in schema ) {

            // "id" field
            if ( field === "id" ) {
                data.properties.id = {};

                if ( schema[field].type ) data.properties.id.type = schema[field].type;
            }

            if ( schema[field].required ) required.push( field );
            if ( schema[field].sortable ) sortable.push( field );

            if ( schema[field].conditions ) {
                const spec = [];

                for ( const type of Array.isArray( schema[field].type ) ? schema[field].type : [schema[field].type] ) {
                    for ( const condition of schema[field].conditions ) {
                        spec.push( READER_SCHEMAS[type][condition] );
                    }
                }

                data.properties.where ||= { "type": "object", "additionalProperties": false, "properties": {} };

                data.properties.where.properties[field] = {
                    "anyOf": spec,
                };
            }
        }

        // required
        if ( required.length ) data.properties.where.required = required;

        // order by
        if ( sortable.length ) {
            data.properties["order_by"] = {
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

        return data;
    },
};

class apiReadKeyword {
    get keyword () {
        return keyword;
    }

    async getDescription ( schema, meta = {} ) {
        const { "default": ejs } = await import( "#lib/ejs" ),
            TMPL = utils.resolve( "#resources/templates/api-read-keyword.md.ejs", import.meta.url );

        return ejs.renderFile( TMPL, {
            schema,
            "where": Object.keys( schema ).filter( field => schema[field].conditions?.length ),
            "order_by": Object.keys( schema ).filter( field => schema[field].sortable ),
            meta,
        } );
    }
}

export default new apiReadKeyword();
