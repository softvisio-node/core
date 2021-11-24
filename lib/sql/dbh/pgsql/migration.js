import Migration from "#lib/sql/migration";

export default Super =>
    class extends Migration( Super || Object ) {

        // protected
        async _applyPatch ( dbh, module, version, patch ) {
            const action = patch.default;

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

            if ( !res.ok ) throw result( [500, `Error applying patch for module "${module}", patch "${version}": ` + res.statusText] );
        }

        async _applyTypes ( dbh, module, version, patch ) {
            const types = patch.types;

            if ( !types ) return;

            for ( const name in types ) {
                const res = await dbh.addType( name, types[name] );

                if ( !res.ok ) throw result( [500, `Error applying types for module "${module}", patch "${version}": ` + res.statusText] );
            }
        }
    };
