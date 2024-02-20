export default Super =>
    class extends Super {

        // public
        getDescription ( ctx ) {
            return l10nt( `your settings` );
        }

        getGroupDescription ( ctx ) {
            return l10nt( `Your settings` );
        }

        isEnabled ( ctx ) {
            return this.isChildCommandsEnabled( ctx );
        }

        async run ( ctx, requestMessage ) {
            return this.sendCommandsList( ctx );
        }
    };
