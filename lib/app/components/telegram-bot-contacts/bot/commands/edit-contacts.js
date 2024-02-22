export default Super =>
    class extends Super {

        // public
        getDescription ( ctx ) {
            return l10nt( `edit start your contacts` );
        }

        isEnabled ( ctx ) {
            return ctx.permissions.has( "telegram/bot:update" );
        }

        // protected
    };
