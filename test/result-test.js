const { res, returnRes } = require( "../lib/result" );

console.log( res( 200 ) );
console.log( res( 200, "data" ) );
console.log( res( [200], "data" ) );
console.log( res( [200, "Custom"], "data" ) );
try {
    console.log( res( "200" ) );
}
catch ( e ) {
    console.log( e );
}

console.log( returnRes( 200 ) );
console.log( returnRes( [200] ) );
console.log( returnRes( [200, "Custom"] ) );
console.log( returnRes( [[200, "Custom"], "data"] ) );
try {
    console.log( returnRes( {} ) );
}
catch ( e ) {
    console.log( e );
}
