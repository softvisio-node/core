import Migration from "#lib/sql/migration";

export default Super =>
    class extends Migration( Super || Object ) {

        // protected
        async _applyPatch ( dbh, patch ) {
            const action = patch.patch.default;

            if ( !action ) return;

            var res;

            if ( typeof action === "function" ) {
                try {
                    res = result.try( await action( dbh ), { "allowUndefined": true } );
                }
                catch ( e ) {
                    res = result.catch( e );
                }
            }
            else {
                res = await dbh.exec( action );
            }

            if ( !res.ok ) throw result( [500, `Error applying patch for module "${patch.module}", patch "${patch.version}": ` + res.statusText] );
        }

        async _applyTypes ( dbh, patch ) {
            const types = patch.patch.types;

            if ( !types ) return;

            for ( const name in types ) {
                const res = await dbh.addType( name, types[name] );

                if ( !res.ok ) throw result( [500, `Error applying types for module "${patch.module}", patch "${patch.version}": ` + res.statusText] );
            }
        }
    };
