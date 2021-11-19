import * as utils from "#lib/utils";

const TYPES = {
    "null": new Set( ["=", "!="] ),
    "boolean": new Set( ["=", "!=", "in", "not in"] ),
    "string": new Set( ["=", "!=", "like", "in", "not in"] ),
    "number": new Set( ["=", "!=", "<", ">", "<=", ">=", "in", "not in"] ),
    "integer": new Set( ["=", "!=", "<", ">", "<=", ">=", "in", "not in"] ),
};

const ARRAY_OPERATORS = new Set( ["in", "not in"] );

function generateMacro ( type, operators, _enum ) {
    if ( !Array.isArray( operators ) ) operators = [operators];

    var equal,
        scalar = [],
        array = [];

    // validate operators
    for ( const operator of operators ) {
        if ( !TYPES[type].has( operator ) ) throw `Operator "${operator}" is invalid for type "${type}"`;

        // group operators
        if ( operator === "=" ) equal = true;

        if ( ARRAY_OPERATORS.has( operator ) ) array.push( operator );
        else scalar.push( operator );
    }

    const macros = [];

    if ( equal ) {
        macros.push( genType( type, _enum ) );
    }

    if ( scalar.length ) {
        macros.push( { "type": "array", "items": [{ "enum": scalar }, genType( type, _enum )] } );
    }

    if ( array.length ) {
        macros.push( { "type": "array", "items": [{ "enum": array }, { "type": "array", "items": genType( type, _enum ), "minItems": 1 }] } );
    }

    if ( macros.length === 1 ) return macros[0];
    else return { "anyOf": macros };
}

function genType ( type, _enum ) {
    if ( _enum ) return { "enum": _enum };
    else return { type };
}

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
                            "type": { "enum": ["null", "boolean", "string", "number", "integer"] },
                            "operator": {
                                "anyOf": [

                                    //
                                    { "enum": ["=", "!=", "<", ">", "<=", ">=", "like", "in", "not in"] },
                                    { "type": "array", "items": { "enum": ["=", "!=", "<", ">", "<=", ">=", "like", "in", "not in"] }, "minItems": 1, "uniqueItems": true },
                                ],
                            },
                            "enum": { "type": "array", "minItems": 1, "uniqueItems": true },
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
                            "defaultLimit": { "type": "integer", "minimum": 1 },
                            "maxLimit": { "type": "integer", "minimum": 1 },
                            "maxResults": { "type": "integer", "minimum": 1 },
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

            if ( schema.limit?.maxLimit ) limit.maximum = schema.limit.maxLimit;

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

            if ( field.operator ) {
                macro.properties.where ||= { "type": "object", "additionalProperties": false, "properties": {} };

                macro.properties.where.properties[fieldName] = generateMacro( field.type, field.operator, field.enum );
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
            "schema": param.schema.read,
            "fields": param.schema.read.fields,
            "where": Object.keys( param.schema.read.fields || {} ).filter( field => param.schema.read.fields[field].operator ),
            "order_by": Object.keys( param.schema.read.fields || {} ).filter( field => param.schema.read.fields[field].sortable ),
            "offset": param.schema.read.offset,
            "limit": param.schema.read.limit,
        } );
    }
}

export default new readKeyword();
