export default Super =>
    class extends Super {

        // public
        async [ "API_get-wal" ] ( ctx ) {
            return result( 200 );
        }
    };
