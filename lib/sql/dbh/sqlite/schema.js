import Schema from "#lib/sql/schema";

export default Super =>
    class extends Schema( Super ) {

        // protected
        _applySchemaPatch ( dbh, module, version, patch ) {
            const action = patch.default;

            if ( !action ) return;

            var res;

            if ( typeof action === "function" ) {
                try {
                    res = action( dbh );

                    if ( res instanceof Promise ) throw Error( `SQLite transactions must be synchronous` );

                    res = result.try( res, { "allowUndefined": true } );
                }
                catch ( e ) {
                    res = result.catch( e );
                }
            }
            else {
                res = dbh.exec( action );
            }

            if ( !res.ok ) throw result( [500, `Error applying patch for module "${module}", patch "${version}": ` + res.statusText] );
        }

        _applySchemaTypes ( dbh, module, version, patch ) {
            const types = patch.types;

            if ( !types ) return;

            for ( const name in types ) {
                const res = dbh.addType( name, types[name] );

                if ( !res.ok ) throw result( [500, `Error applying types for module "${module}", patch "${version}": ` + res.statusText] );
            }
        }

        _applySchemaFunctions ( dbh, module, version, patch ) {
            if ( !this.isSqlite ) return;

            const functions = patch.functions;

            if ( !functions ) return;

            try {
                for ( const name in functions ) {
                    dbh.function( name, functions[name] );
                }
            }
            catch ( e ) {
                throw result( [500, `Error applying functions for module "${module}", patch "${version}": ` + e] );
            }
        }
    };
