const sql = require( "../../sql" );
const Local = require( "./local" );
const { "v4": uuidv4 } = require( "uuid" );
const { ROOT_USER_ID } = require( "../../const" );

module.exports = class extends Local {
    constructor ( app, dbh ) {
        super( app, dbh );
    }

    // TODO mode id, guid to top class
    async _createUser ( dbh, fields ) {
        const guid = uuidv4();

        if ( this.app.userIsRoot( fields.name ) ) fields.id = ROOT_USER_ID;

        fields.guid = guid;

        const res = await dbh.do( sql`INSERT INTO "user"`.VALUES( [fields] ).sql`RETURNING "id", "guid"` );

        if ( !res.isOk() ) {
            return res;
        }
        else {
            res.data.name = name;

            return res;
        }
    }
};
