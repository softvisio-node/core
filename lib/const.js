const { constants } = require( "./util/browser/constants" );

const CONST = {
    ...require( "./const/browser" ),

    "OBJECT_IS_SQL_QUERY": Symbol(),
    "OBJECT_IS_IP_ADDR": Symbol(),
    "OBJECT_IS_SUBNET": Symbol(),
    "OBJECT_IS_PROXY": Symbol(),

    "SQL_MIGRATION_TABLE_NAME": "__migration",
    "SQL_MIGRATION_DEFAULT_MODULE": "main",
    "SQL_TYPE": Symbol(),

    "AUTH_USER": 1,
    "AUTH_TOKEN": 2,
    "AUTH_SESSION": 3,
    "AUTH_EMAIL_CONFIRM": 4,
    "AUTH_PASSWORD_RESET": 5,
};

module.exports = constants( CONST );
