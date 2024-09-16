export default Super =>
    class extends Super {

        // public
        async run ( ctx, message ) {
            return this.sendCommandsList( ctx );
        }

        isEnabled ( ctx ) {
            return this.isChildCommandsEnabled( ctx );
        }

        getDescription ( ctx ) {
            return l10nt( `your settings` );
        }

        getGroupDescription ( ctx ) {
            return l10nt( `Your settings` );
        }
    };
