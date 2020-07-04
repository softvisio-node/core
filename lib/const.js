const { constants } = require( "./util" );

const CONST = {
    "IS_MIXIN": Symbol(),
    "IS_RESULT": Symbol(),
    "IS_APP": Symbol(),
    "IS_SQL_QUERY": Symbol(),
    "SQL_TYPE": Symbol(),

    "SQL_MIGRATION_TABLE_NAME": "__migration",
    "SQL_MIGRATION_DEFAULT_MODULE": "main",

    "ROOT_USER_NAME": "root",
    "ROOT_USER_ID": 1,

    "TOKEN_TYPE_PASSWORD": 1,
    "TOKEN_TYPE_TOKEN": 2,
    "TOKEN_TYPE_SESSION": 3,
    "TOKEN_TYPE_EMAIL_CONFIRM": 4,
    "TOKEN_TYPE_PASSWORD_RESET": 5,
};

module.exports = constants( CONST );
