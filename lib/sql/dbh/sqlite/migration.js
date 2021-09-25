export default Super =>
    class extends ( Super || Object ) {

        // protected
        _applyPatch ( dbh, patch ) {
            const action = patch.patch.default;

            if ( !action ) return;

            var res;

            if ( typeof action === "function" ) {
                try {
                    res = result.try( action( dbh ) );
                }
                catch ( e ) {
                    res = result.catch( e );
                }
            }
            else {
                res = dbh.exec( action );
            }

            if ( !res.ok ) throw result( [500, `Error applying patch for module "${patch.module}", patch "${patch.version}": ` + res.statusText] );
        }

        _applyTypes ( dbh, patch ) {
            const types = patch.patch.types;

            if ( !types ) return;

            for ( const name in types ) {
                const res = dbh.addType( name, types[name] );

                if ( !res.ok ) throw result( [500, `Error applying types for module "${patch.module}", patch "${patch.version}": ` + res.statusText] );
            }
        }
    };
