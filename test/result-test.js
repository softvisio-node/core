const { result, parseResult } = require( "../lib/result" );

console.log( result( 200 ) );
console.log( result( 200, "data" ) );
console.log( result( [200], "data" ) );
console.log( result( [200, "Custom"], "data" ) );
try {
    console.log( result( "200" ) );
}
catch ( e ) {
    console.log( e );
}

console.log( parseResult( 200 ) );
console.log( parseResult( [200] ) );
console.log( parseResult( [200, "Custom"] ) );
console.log( parseResult( [[200, "Custom"], "data"] ) );
try {
    console.log( parseResult( {} ) );
}
catch ( e ) {
    console.log( e );
}
