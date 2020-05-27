function constants ( obj ) {
    return new Proxy( obj, {
        get ( obj, prop ) {
            if ( !Object.prototype.hasOwnProperty.call( obj, prop ) ) throw Error( `Constant "${prop}" is not defined.` );

            return obj[prop];
        },

        set ( obj, prop, value ) {
            throw Error( `Unable to modify constant "${prop}".` );
        },
    } );
}

module.exports.constants = constants;

const CONST = {
    "IS_MIXIN": Symbol(),
    "IS_RESULT": Symbol(),
    "IS_APP": Symbol(),
    "IS_SQL_QUERY": Symbol(),

    "SQL_MIGRATION_TABLE_NAME": "__migration",
    "SQL_MIGRATION_DEFAULT_MODULE": "main",
    "SQL_MAX_PARAMS_SQLITE": 999,
    "SQL_MAX_PARAMS_PGSQL": 65535,

    "ROOT_USER_NAME": "root",
    "ROOT_USER_ID": 1,

    "TOKEN_TYPE_PASSWORD": 1,
    "TOKEN_TYPE_TOKEN": 2,
    "TOKEN_TYPE_SESSION": 3,
    "TOKEN_TYPE_EMAIL_CONFIRM": 4,
    "TOKEN_TYPE_PASSWORD_RECOVER": 5,

    "AUTH_HASH": "SHA3-512",

    // TODO
    "GROUP_ANY": null,
    "GROUP_GUESTS": "guests",
};

module.exports = constants( CONST );
