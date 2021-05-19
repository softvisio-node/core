import { sql } from "#lib/sql/dbi";
import { connect } from "#lib/sql/dbd";

sql.sql = sql;
sql.connect = connect;

export default sql;
