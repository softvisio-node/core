import { setFlagsFromString } from "v8";
import { runInNewContext } from "vm";

setFlagsFromString( "--expose_gc" );

const gc = runInNewContext( "gc" );

export default gc;
