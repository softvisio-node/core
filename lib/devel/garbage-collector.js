import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";

setFlagsFromString( "--expose_gc" );

const collectGarbage = runInNewContext( "gc" );

export default collectGarbage;
