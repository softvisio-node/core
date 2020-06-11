var s = {
    "type": "object",
    "properties": {
        "name": { "type": "string" },
        "summary": { "type": "string" },
        "description": { "type": "string" },
        "ignore": { "type": "boolean" },
        "deprecated": { "type": "boolean" },
        "extends": { "type": "array", "items": { "type": "string" } },
        "properties": {
            "type": "object",
            "additionalProperties": {
                "type": "object",
                "properties": {
                    "name": { "type": "string" },
                    "summary": { "type": "string" },
                    "description": { "type": "string" },
                    "ignore": { "type": "boolean" },
                    "access": { "type": "string", "enum": ["public", "protected", "private"] },
                    "deprecated": { "type": "boolean" },
                },
                "required": ["name", "summary", "access"],
                "additionalProperties": false,
            },
        },
        "methods": {
            "type": "object",
            "additionalProperties": {
                "type": "object",
                "properties": {
                    "name": { "type": "string" },
                    "summary": { "type": "string" },
                    "description": { "type": "string" },
                    "ignore": { "type": "boolean" },
                    "access": { "type": "string", "enum": ["public", "protected", "private"] },
                    "deprecated": { "type": "boolean" },
                    "permissions": { "type": ["null", "array"] },
                    "params": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": { "type": "string" },
                                "summary": { "type": "string" },
                                "description": { "type": "string" },
                                "required": { "type": "boolean" },
                                "schema": {},
                            },
                            "required": ["name", "schema"],
                            "additionalProperties": false,
                        },
                    },
                    "skipParamsValidation": { "type": "boolean" },
                    "_isApiMethod": { "type": "boolean" },
                },
                "required": ["name", "summary", "access"],
                "additionalProperties": false,
            },
        },
    },
    "required": ["name", "summary"],
    "additionalProperties": false,
};
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 1:5           | no-unused-vars               | 's' is assigned a value but never used.                                        |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
