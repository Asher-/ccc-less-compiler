
import { CCCLessCompiler } from '../ccc-less-compiler.js';

import FileSet from '../node_modules/file-set/index.mjs';

let less_dirs = [ 'component', 'style' ];

let less_dirs_glob = '+(' + less_dirs.join('|') + ')' + '/**/!(*.mixin).less'
let file_set = new FileSet;
await file_set.add( less_dirs_glob );

console.log('Compiling .less files to .css');
for ( let this_less_input_file of file_set.files ) {
  let this_less_compiler = new CCCLessCompiler( this_less_input_file );
  this_less_compiler.compile();
}
console.log();
