import ejs from "#lib/ejs";
import * as utils from "#lib/utils";

const TYPES = {
    "null": new Set( [ "=", "!=" ] ),
    "boolean": new Set( [ "=", "!=", "in", "not in" ] ),
    "string": new Set( [

        //
        "=",
        "!=",

        "like",
        "not like",
        "ilike",
        "not ilike",

        "includes",
        "not includes",
        "includes case insensitive",
        "not includes case insensitive",

        "starts with",
        "not starts with",
        "starts with case insensitive",
        "not starts with case insensitive",

        "ends with",
        "not ends with",
        "ends with case insensitive",
        "not ends with case insensitive",

        "glob",
        "glob case insensitive",

        "in",
        "not in",

        "~",
        "~*",
        "!~",
        "!~*",
    ] ),
    "number": new Set( [ "=", "!=", "<", ">", "<=", ">=", "in", "not in" ] ),
    "integer": new Set( [ "=", "!=", "<", ">", "<=", ">=", "in", "not in" ] ),
};

const ARRAY_OPERATORS = new Set( [

    //
    "in",
    "not in",
] );

const GLOB_OPERATORS = new Set( [

    //
    "glob",
    "glob case insensitive",
] );

const ALL_OPERATORS = [
    ...new Set( [

        //
        ...TYPES.null,
        ...TYPES.boolean,
        ...TYPES.string,
        ...TYPES.number,
        ...TYPES.integer,
    ] ),
];

function generateMacro ( type, format, operators, _const, _enum, aclResolver ) {
    if ( !Array.isArray( operators ) ) operators = [ operators ];

    var scalarOperators = [],
        arrayOperators = [],
        globOperators = [];

    // validate operators
    for ( const operator of operators ) {
        if ( !TYPES[ type ].has( operator ) ) throw `Operator "${ operator }" is invalid for type "${ type }"`;

        // group operators
        if ( ARRAY_OPERATORS.has( operator ) ) {
            arrayOperators.push( operator );
        }
        else if ( GLOB_OPERATORS.has( operator ) ) {
            globOperators.push( operator );
        }
        else {
            scalarOperators.push( operator );
        }
    }

    const macros = [];

    if ( scalarOperators.length ) {
        macros.push( {
            "type": "array",
            "items": [

                //
                scalarOperators.length === 1
                    ? { "const": scalarOperators[ 0 ] }
                    : { "enum": scalarOperators },
                generateType( type, format, _const, _enum, aclResolver ),
            ],
        } );
    }

    if ( arrayOperators.length ) {
        macros.push( {
            "type": "array",
            "items": [

                //
                arrayOperators.length === 1
                    ? { "const": arrayOperators[ 0 ] }
                    : { "enum": arrayOperators },
                {
                    "type": "array",
                    "items": generateType( type, format, _const, _enum, aclResolver ),
                    "minItems": 1,
                },
            ],
        } );
    }

    if ( globOperators.length ) {
        macros.push( {
            "type": "array",
            "items": [

                //
                globOperators.length === 1
                    ? { "const": globOperators[ 0 ] }
                    : { "enum": globOperators },
                {
                    "anyOf": [

                        //
                        generateType( type, format, _const, _enum, aclResolver ),
                        {
                            "type": "array",
                            "items": [
                                {
                                    "anyOf": [

                                        //
                                        generateType( type, format, _const, _enum, aclResolver ),
                                        {
                                            "type": "array",
                                            "items": generateType( type, format, _const, _enum, aclResolver ),
                                            "minItems": 1,
                                        },
                                    ],
                                },
                                {
                                    "type": "object",
                                    "properties": {
                                        "prefix": {
                                            "type": "string",
                                        },
                                    },
                                    "additionalProperties": false,
                                    "required": [ "prefix" ],
                                },
                            ],
                            "minItems": 1,
                        },
                    ],
                },
            ],
        } );
    }

    if ( macros.length === 1 ) {
        return macros[ 0 ];
    }
    else {
        return { "anyOf": macros };
    }
}

function generateType ( type, format, _const, _enum, aclResolver ) {
    const macro = {};

    if ( _const !== undefined ) {
        macro.const = _const;
    }
    else if ( _enum ) {
        macro.enum = _enum;
    }
    else {
        macro.type = type;

        if ( format ) macro.format = format;
    }

    if ( aclResolver ) macro.aclResolver = aclResolver;

    return macro;
}

const keyword = {
    "keyword": "read",
    "metaSchema": {
        "type": "object",
        "properties": {

            // fields
            "fields": {
                "type": "object",
                "propertyNames": { "type": "string", "format": "snake-case" },
                "additionalProperties": {
                    "type": "object",
                    "properties": {
                        "description": { "type": "string" },
                        "type": { "enum": [ "null", "boolean", "string", "number", "integer" ] },
                        "format": { "type": "string" },
                        "operator": {
                            "anyOf": [

                                //
                                {
                                    "enum": ALL_OPERATORS,
                                },
                                {
                                    "type": "array",
                                    "items": {
                                        "enum": ALL_OPERATORS,
                                    },
                                    "minItems": 1,
                                    "uniqueItems": true,
                                },
                            ],
                        },
                        "const": {},
                        "enum": { "type": "array", "minItems": 1, "uniqueItems": true },
                        "required": { "type": "boolean" },
                        "sortable": { "type": "boolean" },
                        "aclResolver": { "type": "string" },
                    },
                    "additionalProperties": false,
                },
                "errorMessage": `API read method fields must be in the snake_case`,
            },

            // default order by
            "order_by": {
                "type": "array",
                "items": {
                    "type": "array",
                    "items": [

                        //
                        { "type": "string", "format": "snake-case" },
                        { "enum": [ "asc", "desc" ] },
                    ],
                },
                "minItems": 1,
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
            const field = schema.fields[ fieldName ];

            if ( field.required ) required.push( fieldName );

            if ( field.sortable ) sortable.push( fieldName );

            if ( field.operator ) {
                macro.properties.where ||= { "type": "object", "additionalProperties": false, "properties": {} };

                macro.properties.where.properties[ fieldName ] = generateMacro( field.type, field.format, field.operator, field.const, field.enum, field[ "aclResolver" ] );
            }
        }

        // required
        if ( required.length ) macro.properties.where.required = required;

        // order by
        if ( sortable.length ) {
            macro.properties[ "order_by" ] = {
                "type": "array",
                "items": {
                    "type": "array",
                    "items": [

                        //
                        { "enum": sortable },
                        { "enum": [ "asc", "desc" ] },
                    ],
                },
                "minItems": 1,
            };
        }

        if ( required.length ) {
            macro.required = [ "where" ];
        }

        return macro;
    },
};

class readKeyword {
    get keyword () {
        return keyword;
    }

    async getDescription ( param ) {
        const template = utils.resolve( "#resources/templates/read-keyword.md.ejs", import.meta.url );

        return ejs.renderFile( template, {
            "schema": param.schema.read,
            "fields": param.schema.read.fields,
            "where": Object.keys( param.schema.read.fields || {} ).filter( field => param.schema.read.fields[ field ].operator ),
            "order_by": Object.keys( param.schema.read.fields || {} ).filter( field => param.schema.read.fields[ field ].sortable ),
            "offset": param.schema.read.offset,
            "limit": param.schema.read.limit,
        } );
    }
}

export default new readKeyword();
