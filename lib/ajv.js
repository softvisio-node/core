const Ajv = require( "ajv" ).default;
const ajvErrors = require( "ajv-errors" );
const ajvFormats = require( "ajv-formats" );
const ajvFormatsDraft2019 = require( "ajv-formats-draft2019" );
const ajvKeywords = require( "ajv-keywords" );

// const ajvMergePatch = require( "ajv-merge-patch" );

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

module.exports = function ( options = {} ) {
    options = {
        "strict": false,
        "coerceTypes": true,
        "allErrors": true,
        ...options,
    };

    const ajv = new Ajv( options );

    // plugins
    ajvErrors( ajv, { "keepErrors": false, "singleError": false } );
    ajvFormats( ajv );
    ajvFormatsDraft2019( ajv );
    ajvKeywords( ajv );

    // ajvMergePatch( ajv );

    ajv.addApiKeywords = function () {
        this.addKeyword( apiReaderKeyword );

        return this;
    };

    return ajv;
};

const apiReaderKeyword = {
    "keyword": "apiReader",
    "metaSchema": {
        "type": "object",
        "additionalProperties": {
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

        // order-by
        if ( sortable.length ) {
            data.properties.order_by = {
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
