const { mixin } = require( "../../../mixins" );
const result = require( "../../../result" );
const sql = require( "../../../sql" );
const { TOKEN_TYPE_SESSION } = require( "../../../const" );

const q = {
    "storeHash": sql`INSERT INTO "auth_hash" ("id", "hash") VALUES (?, ?)`.prepare(),
    "storeToken": sql`INSERT INTO "user_session" ("id", "user_id") VALUES (?, ?)`.prepare(),
    "remove": sql`DELETE FROM "user_session" WHERE "id" = ?`.prepare(),
};

module.exports = mixin( ( Super ) =>
    class extends Super {
        constructor ( app, dbh ) {
            super( app, dbh );
        }

        async authenticateUserSession ( privateToken ) {
			
		}

        async createUserSession ( userId ) {

            // resolve user
            var user = await this.getUser( userId );

            // user error
            if ( !user.isOk() ) return user;

            var token = this.generateToken( TOKEN_TYPE_SESSION );

            var res = await this.dbh.begin( async ( dbh ) => {

                // insert hash
                var res = await dbh.do( q.storeHash, [token.id, token.hash] );

                if ( !res.isOk() || !res.rows ) throw result( 500 );

                res = await dbh.do( q.storeToken, [token.id, user.data.id] );

                if ( !res.isOk() || !res.rows ) throw result( 500 );

                return result( 200, {
                    "id": token.id,
                    "type": TOKEN_TYPE_SESSION,
                    "token": token.token,
                    "userId": user.data.id,
                    "userName": user.data.name,
                    "permissions": user.data.permissions,
                } );
            } );

            return res;
        }

        async removeUserSession ( tokenId ) {
            var res = await this.dbh.do( q.emove, [tokenId] );

            if ( !res.isOk() ) return res;

            if ( !res.rows ) return result( 204 );

            this.invalidateUserToken( tokenId );

            return result( 200 );
        }
    } );
