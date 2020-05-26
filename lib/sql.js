const { sql, WHERE } = require( "./sql/dbi" );
sql.sql = sql;
sql.WHERE = WHERE;
sql.connect = require( "./sql/dbd" ).connect;

module.exports = sql;
